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
 * - the chain has `.returning(` and its result is read where it stands
 *   (`(await …).length`, `(await …)[0]`), or bound to a name that is then
 *   read; or
 * - the chain has no `.returning(` and the action reads `count` off the
 *   result — the explicit row-count check. `count` and not `rowCount`:
 *   `lib/db/client.ts` runs on `drizzle-orm/postgres-js`, whose result has no
 *   `rowCount`, so a test of that one would never fire.
 *
 * A name is *read* where the code looks into it or tests it: `updated.length`,
 * `updated[0]`, `row === undefined`, `!row`, `if (row)`. Any other place a
 * result can end up — an argument, an array element, a `return` — is reported,
 * bound or not: the checker cannot follow it there, and the caller a `return`
 * hands it to may be a transaction callback whose value nobody keeps. An
 * action tests the result in the function that ran the statement.
 *
 * `.delete()` is not checked: the rule quoted above is about UPDATE. That is
 * a limit of this checker and not a finding about deletes —
 * `docs/architecture/design/T-010-weekly-template-editor.md` §4 holds a DELETE
 * that matched no rows to the same standard, and nothing here enforces it.
 * `onConflictDoUpdate` is not checked either: an upsert always has a row.
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
export const RESULT_DISCARDED = `the result of .returning() is not read — ${WHY}`;
export const RESULT_NEVER_READ = `the result of .returning() is bound and never read — ${WHY}`;

/** What the postgres-js driver calls the number of rows a statement touched. */
const ROW_COUNT = "count";

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

  if (ts.isVariableDeclaration(consumer) && consumer.initializer === value) {
    if (hasReturning) {
      return isRead(consumer) ? undefined : RESULT_NEVER_READ;
    }
    return readsRowCount(consumer) ? undefined : MISSING_RETURNING;
  }

  if (!hasReturning) {
    return isPropertyRead(consumer, value, ROW_COUNT) ? undefined : MISSING_RETURNING;
  }

  // Everything that is not a read where it stands — a bare statement, an
  // argument, an array element, a `return` — is a result the checker cannot
  // see anyone read.
  return isReadOf(value) ? undefined : RESULT_DISCARDED;
}

const TESTS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

/**
 * Whether an expression — the chain itself, or a name bound to its result —
 * sits where the code looks into it or tests it. One definition for both, so
 * `log(await …)` and `const updated = await …; log(updated)` get one verdict.
 */
function isReadOf(node: ts.Expression): boolean {
  const parent = node.parent;

  if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
    return parent.expression === node;
  }
  if (ts.isBinaryExpression(parent)) return TESTS.has(parent.operatorToken.kind);
  if (ts.isPrefixUnaryExpression(parent)) {
    return parent.operator === ts.SyntaxKind.ExclamationToken;
  }
  if (ts.isIfStatement(parent)) return parent.expression === node;
  if (ts.isConditionalExpression(parent)) return parent.condition === node;
  return false;
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

/**
 * The chain as the surrounding code sees it — past `await`, `(…)`, `as`,
 * `satisfies`, `!`, and out of a branch of `a ? b : c`.
 */
function unwrapped(node: ts.Expression): ts.Expression {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (
      ts.isAwaitExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      (ts.isConditionalExpression(parent) && parent.condition !== current)
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

/** Whether any name the declaration binds is read — `isReadOf` — in its scope. */
function isRead(declaration: ts.VariableDeclaration): boolean {
  const names = bindingNames(declaration.name);
  return references(declaration).some(
    (reference) => names.includes(reference.text) && isReadOf(reference),
  );
}

/** `result.count` on the bound name, or a destructured `{ count }` that is read. */
function readsRowCount(declaration: ts.VariableDeclaration): boolean {
  const name = declaration.name;
  const found = references(declaration);

  if (ts.isIdentifier(name)) {
    return found.some(
      (reference) =>
        reference.text === name.text && isPropertyRead(reference.parent, reference, ROW_COUNT),
    );
  }

  if (!ts.isObjectBindingPattern(name)) return false;
  return name.elements.some((element) => {
    const property = element.propertyName ?? element.name;
    if (!ts.isIdentifier(property) || property.text !== ROW_COUNT) return false;
    if (!ts.isIdentifier(element.name)) return false;
    const local = element.name.text;
    return found.some((reference) => reference.text === local && isReadOf(reference));
  });
}

/**
 * Every identifier in the declaration's function other than the declaration
 * itself. A property or a type member of the same text is among them and is
 * told apart by `isReadOf`, which looks at where an identifier stands.
 * Shadowing is not resolved: this is syntax, and a second `updated` in the same
 * function is not a shape the actions take.
 */
function references(declaration: ts.VariableDeclaration): ts.Identifier[] {
  let scope: ts.Node = declaration;
  while (scope.parent && !ts.isFunctionLike(scope)) scope = scope.parent;

  const found: ts.Identifier[] = [];
  const visit = (node: ts.Node) => {
    if (node === declaration.name) return;
    if (ts.isIdentifier(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return found;
}

/** Every identifier a declaration introduces, destructuring included. */
function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}
