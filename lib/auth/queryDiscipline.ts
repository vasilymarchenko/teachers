import ts from "typescript";

/**
 * The static half of the `userId` discipline of overview §8.4.
 *
 * The rule is a convention, and a convention that nothing checks is a
 * convention until the first hurried afternoon. This walks the syntax of
 * `lib/db/queries`, `lib/actions` and `lib/validation` and reports what the
 * rule forbids. `queryDiscipline.test.ts` walks those directories and feeds
 * every file through it, and feeds it inline sources that are supposed to fail.
 *
 * It lives in `lib/auth` rather than next to the queries it checks for two
 * reasons: what it enforces is the reach of `requireUser()`, and a checker
 * inside `lib/db/queries` would be scanned by itself.
 *
 * It is syntactic on purpose: no type checker, no program, no `tsconfig`, so it
 * costs milliseconds and cannot be defeated by a missing build. The cost is
 * that it proves a `userId` is *taken* correctly, not that it is *used* — a
 * query that accepts `userId` and forgets to filter on it still passes. That
 * one is the reviewer's, and the integration tests'.
 */

export type Violation = { file: string; line: number; message: string };

/** Server Actions that legitimately run before a session exists. */
export const ACTIONS_WITHOUT_A_SESSION = ["signInAction"];

/** Identifiers a `userId` may never be read out of — see `checkSource`. */
const FORBIDDEN_GETTER_KEY = "userId";

export type SourceKind = "query" | "action" | "validation";

/**
 * Reports every violation in one file. `kind` selects which rules apply; the
 * test derives it from the directory the file came from.
 */
export function checkSource(
  file: string,
  source: string,
  kind: SourceKind,
): Violation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const violations: Violation[] = [];
  const report = (node: ts.Node, message: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({ file, line: line + 1, message });
  };

  if (kind === "query") {
    for (const fn of exportedFunctions(sourceFile)) {
      checkUserIdIsFirstParameter(fn, report);
    }
  }

  if (kind === "action") {
    for (const fn of exportedFunctions(sourceFile)) {
      checkCallsRequireUser(fn, report);
    }
  }

  checkNoUserIdFromInput(sourceFile, report);

  return violations;
}

/** Rule 1 — overview §8.4, first bullet. */
function checkUserIdIsFirstParameter(
  fn: ExportedFunction,
  report: (node: ts.Node, message: string) => void,
) {
  const first = fn.node.parameters[0];

  if (!first) {
    report(fn.node, `${fn.name}() takes no parameters; a query takes userId first`);
    return;
  }

  if (!ts.isIdentifier(first.name) || first.name.text !== "userId") {
    report(first, `${fn.name}()'s first parameter must be named userId`);
    return;
  }

  if (first.type?.kind !== ts.SyntaxKind.StringKeyword) {
    report(first, `${fn.name}()'s userId must be declared \`userId: string\``);
  }
}

/** Rule 2 — overview §8.3: the boundary runs at the entry of every action. */
function checkCallsRequireUser(
  fn: ExportedFunction,
  report: (node: ts.Node, message: string) => void,
) {
  if (ACTIONS_WITHOUT_A_SESSION.includes(fn.name)) return;

  let found = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "requireUser"
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(fn.node);

  if (!found) {
    report(
      fn.node,
      `${fn.name}() does not call requireUser(); a Server Action starts at the ` +
        `authorisation boundary, or is named in ACTIONS_WITHOUT_A_SESSION`,
    );
  }
}

/**
 * Rules 3–5 — overview §8.4, second bullet: `userId` comes from
 * `requireUser()` and from nowhere else. The three shapes that carry request
 * input into a function are a `.get("userId")` off a `FormData` or
 * `URLSearchParams`, a `userId` read off one of the function's own parameters,
 * and a `userId` key in a Zod schema, which is how it would arrive validated
 * and look respectable.
 */
function checkNoUserIdFromInput(
  sourceFile: ts.SourceFile,
  report: (node: ts.Node, message: string) => void,
) {
  const visit = (node: ts.Node) => {
    if (isGetterFor(node, FORBIDDEN_GETTER_KEY)) {
      report(
        node,
        "userId is read out of request input; it comes only from requireUser()",
      );
    }

    if (ts.isPropertyAccessExpression(node) && node.name.text === "userId") {
      const root = leftmostIdentifier(node.expression);
      if (root && isParameterOfAnEnclosingFunction(node, root)) {
        report(
          node,
          `userId is read off the parameter \`${root}\`; it comes only from requireUser()`,
        );
      }
    }

    if (isZodObjectKey(node, "userId")) {
      report(
        node,
        "a Zod schema declares userId; validating it does not make it trusted",
      );
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

/** `<anything>.get("userId")` — `FormData`, `URLSearchParams`, `cookies()`. */
function isGetterFor(node: ts.Node, key: string): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== "get"
  ) {
    return false;
  }
  const [argument] = node.arguments;
  return (
    argument !== undefined &&
    ts.isStringLiteralLike(argument) &&
    argument.text === key
  );
}

/** A property named `key` in an object literal passed to `z.object(...)`. */
function isZodObjectKey(node: ts.Node, key: string): boolean {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) {
    return false;
  }
  if (!ts.isIdentifier(node.name) || node.name.text !== key) return false;

  const literal = node.parent;
  if (!ts.isObjectLiteralExpression(literal)) return false;

  const call = literal.parent;
  return (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "object"
  );
}

/** The `a` of `a.b.c` — `undefined` for anything not a plain identifier chain. */
function leftmostIdentifier(node: ts.Expression): string | undefined {
  let current: ts.Expression = node;
  while (ts.isPropertyAccessExpression(current)) current = current.expression;
  return ts.isIdentifier(current) ? current.text : undefined;
}

function isParameterOfAnEnclosingFunction(node: ts.Node, name: string): boolean {
  for (let scope = node.parent; scope; scope = scope.parent) {
    if (!ts.isFunctionLike(scope)) continue;
    for (const parameter of scope.parameters) {
      if (bindingNames(parameter.name).includes(name)) return true;
    }
  }
  return false;
}

/** Every identifier a parameter introduces, destructuring included. */
function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}

type ExportedFunction = {
  name: string;
  node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
};

/** `export function f()` and `export const f = () => {}`, top level only. */
function exportedFunctions(sourceFile: ts.SourceFile): ExportedFunction[] {
  const found: ExportedFunction[] = [];

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      found.push({ name: statement.name.text, node: statement });
      continue;
    }

    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer) continue;
      if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) {
        continue;
      }
      if (!ts.isIdentifier(declaration.name)) continue;
      found.push({ name: declaration.name.text, node: initializer });
    }
  }

  return found;
}

function hasExportModifier(node: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}
