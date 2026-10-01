import ts from "typescript";

/**
 * The static half of one row of `docs/architecture/design/T-009-year-setup.md`
 * §5, "Which rule is checked where":
 *
 * > | an UPDATE that matched no row (deleted in another tab) | the action, via
 * > `.returning()` | Drizzle reports success for an UPDATE that matched nothing |
 *
 * The rule is invisible at the call site: an `.update()` that forgets
 * `.returning()` compiles, passes every test and fails only against a
 * concurrent delete no test performs. This walks the syntax of a file and
 * reports every `.update(` chain whose result nothing reads.
 * `updateDiscipline.test.ts` feeds it every file under `lib/actions`, and
 * inline sources that are supposed to fail.
 *
 * `.returning()` is necessary, not sufficient — a result that is thrown away
 * tells the action nothing. So what is checked is that the result is *used*:
 *
 * - the chain has `.returning(` and its result is bound to a name that is read
 *   afterwards, or consumed by an expression directly; or
 * - the chain has no `.returning(` and the action reads `rowCount` off the
 *   result — the explicit row-count check.
 *
 * `.delete()` is left alone on purpose: a delete that matched nothing found the
 * row already gone, which is what the teacher asked for. So is
 * `onConflictDoUpdate`, which always has a row to report.
 *
 * It lives in `lib/db` rather than next to the actions it checks because
 * `lib/auth/queryDiscipline.test.ts` requires every function exported from
 * `lib/actions` to reach `requireUser()`, and because what it enforces is how
 * a Drizzle statement's outcome is read.
 *
 * It is syntactic on purpose, like `lib/auth/queryDiscipline.ts`: no type
 * checker, no program. The cost is that it proves the result is *read*, not
 * that the read is a test for zero rows — `updated.length > 5` passes. It also
 * takes any `.update(` call for a Drizzle one; a hash's `.update()` in
 * `lib/actions` would have to be told apart here.
 *
 * **Test support — never import this from application code.** It pulls in
 * `typescript`, which is a devDependency; an `app/` or `lib/` module importing
 * it would break the production build.
 */

export type Violation = { file: string; line: number; message: string };

export type UpdateReport = {
  /** How many `.update(` chains the file holds — zero means nothing was checked. */
  updates: number;
  violations: Violation[];
};

const WHY = "Drizzle reports success for an UPDATE that matched no row";

export const MISSING_RETURNING = `MISSING .returning() — ${WHY}, and nothing reads its row count`;
export const RESULT_DISCARDED = `the result of .returning() is discarded — ${WHY}`;
export const RESULT_NEVER_READ = `the result of .returning() is bound and never read — ${WHY}`;

/** Reports every `.update(` chain in one file whose result nothing reads. */
export function checkUpdates(file: string, source: string): UpdateReport {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const report: UpdateReport = { updates: 0, violations: [] };

  const visit = (node: ts.Node) => {
    if (isMethodCall(node, "update")) {
      report.updates += 1;
      const message = violationOf(node);
      if (message !== undefined) {
        // The line of `.update(` itself, not of the `getDb()` the chain starts
        // on — that is the line a reader searches for.
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.expression.name.getStart(sourceFile),
        );
        report.violations.push({ file, line: line + 1, message });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return report;
}

type MethodCall = ts.CallExpression & { expression: ts.PropertyAccessExpression };

function isMethodCall(node: ts.Node, name: string): node is MethodCall {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === name
  );
}

/** What is wrong with one `.update(` chain, or `undefined` if nothing is. */
function violationOf(update: MethodCall): string | undefined {
  const { top, hasReturning } = chainFrom(update);
  const value = unwrapped(top);
  const consumer = value.parent;

  if (ts.isExpressionStatement(consumer) || ts.isVoidExpression(consumer)) {
    return hasReturning ? RESULT_DISCARDED : MISSING_RETURNING;
  }

  if (ts.isVariableDeclaration(consumer) && consumer.initializer === value) {
    if (hasReturning) {
      return isRead(consumer) ? undefined : RESULT_NEVER_READ;
    }
    return readsRowCount(consumer) ? undefined : MISSING_RETURNING;
  }

  // Consumed where it stands: returned, passed on, or read as `(await …).length`.
  if (hasReturning) return undefined;
  return isPropertyRead(consumer, value, "rowCount") ? undefined : MISSING_RETURNING;
}

/**
 * The whole `x.update(…).set(…).where(…).returning(…)` chain a call starts:
 * its outermost call, and whether `.returning(` is one of its links.
 */
function chainFrom(update: MethodCall): { top: ts.Expression; hasReturning: boolean } {
  let top: ts.Expression = update;
  let hasReturning = false;

  for (;;) {
    const access = top.parent;
    if (!ts.isPropertyAccessExpression(access) || access.expression !== top) break;
    const call = access.parent;
    if (!ts.isCallExpression(call) || call.expression !== access) break;
    if (access.name.text === "returning") hasReturning = true;
    top = call;
  }

  return { top, hasReturning };
}

/** The chain as the surrounding code sees it — past `await`, `(…)`, `as`, `!`. */
function unwrapped(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (
      ts.isAwaitExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isNonNullExpression(parent)
    ) {
      current = parent;
      continue;
    }
    return current;
  }
}

function isPropertyRead(node: ts.Node, of: ts.Expression, name: string): boolean {
  return (
    ts.isPropertyAccessExpression(node) && node.expression === of && node.name.text === name
  );
}

/** Whether any name the declaration binds is referenced again in its scope. */
function isRead(declaration: ts.VariableDeclaration): boolean {
  const names = bindingNames(declaration.name);
  return references(declaration).some((reference) => names.includes(reference.text));
}

/** `result.rowCount` on the bound name, or a destructured `{ rowCount }` that is read. */
function readsRowCount(declaration: ts.VariableDeclaration): boolean {
  const name = declaration.name;
  const found = references(declaration);

  if (ts.isIdentifier(name)) {
    return found.some(
      (reference) =>
        reference.text === name.text && isPropertyRead(reference.parent, reference, "rowCount"),
    );
  }

  if (!ts.isObjectBindingPattern(name)) return false;
  return name.elements.some((element) => {
    const property = element.propertyName ?? element.name;
    if (!ts.isIdentifier(property) || property.text !== "rowCount") return false;
    if (!ts.isIdentifier(element.name)) return false;
    const local = element.name.text;
    return found.some((reference) => reference.text === local);
  });
}

/**
 * Every identifier in the declaration's function that is a use of a variable
 * rather than the declaration itself or the `b` of `a.b`. Shadowing is not
 * resolved: this is syntax, and a second `updated` in the same function is not
 * a shape the actions take.
 */
function references(declaration: ts.VariableDeclaration): ts.Identifier[] {
  let scope: ts.Node = declaration;
  while (scope.parent && !ts.isFunctionLike(scope)) scope = scope.parent;

  const found: ts.Identifier[] = [];
  const visit = (node: ts.Node) => {
    if (node === declaration.name) return;
    if (ts.isIdentifier(node) && !isPropertyName(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node)
  );
}

/** Every identifier a declaration introduces, destructuring included. */
function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}
