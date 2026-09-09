/**
 * The rule `lib/db/queries/indexUsage.integration.test.ts` measures a query
 * plan against: overview §8.4 asks that no statement read a row belonging to
 * another teacher, and this decides whether a plan can (`ADR-011`).
 *
 * Test support, like `testDatabase.ts` — nothing in the application imports it.
 * It lives outside the test file because it is logic rather than assertion: the
 * plan shapes it has to get right are cheaper to state as data than to coax a
 * planner into producing, and `planBinding.test.ts` states them.
 */

/** The subset of `EXPLAIN (FORMAT JSON)` this rule reads. */
export type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  Alias?: string;
  "Index Name"?: string;
  "Index Cond"?: string;
  Filter?: string;
  Plans?: PlanNode[];
};

/** Every node of one plan, top-level node first, children left in place. */
export function nodesOf(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(nodesOf)];
}

/** The nodes that read through an index; a `Bitmap Heap Scan` names none. */
export function indexScansOf(plan: PlanNode[]): PlanNode[] {
  return plan.filter((node) => node["Index Name"] !== undefined);
}

/** `user_id` decided by the index, whatever it is equated to. */
export const BINDS_USER_ID = /\buser_id\b\s*=/;

/**
 * `user_id` equated to a value — a parameter or a literal — rather than to a
 * column of another relation.
 *
 * This is where a chain of restrictions has to end, so it is what
 * `unboundRelations()` starts from: a relation restricted by another's
 * `user_id` is restricted only as far as that other one is, and the value
 * `requireUser()` produced is the only thing that terminates the regress. A
 * `CTE`, `VALUES` or function relation supplying the `user_id` renders as
 * `(user_id = "*VALUES*".column1)` — an equality, and one that vouches for
 * nothing — so "is equated to something" cannot be the seed.
 *
 * A value is recognised positively. Testing for the *absence* of a relation
 * reference fails open on every form nobody anticipated — a quoted alias, or
 * the cast Postgres prints as `(user_id = (t.user_id)::text)` — and failing
 * open is the one direction this file must not fail in. A form that is a value
 * and is not matched (`= ANY (...)`, which no read produces) fails closed
 * instead, which is a red test and a five-minute fix.
 */
export const BINDS_USER_ID_TO_A_VALUE = /\buser_id\b\s*=\s*(?:\$\d+|'|\d)/;

/**
 * The `user_id` of another relation, as a restriction refers to it —
 * `(user_id = schedule_template.user_id)`, or the same with either side
 * qualified. The alias is the capture: a relation restricted this way is
 * restricted only as far as that one is.
 *
 * `"*VALUES*".column1` and a bare `$1` deliberately do not match. Neither is a
 * relation this rule can follow, so neither can vouch for anything.
 */
export const USER_ID_OF_A_RELATION =
  /(?:"([^"]+)"|\b([A-Za-z_][\w$]*))\.user_id\b/g;

/**
 * One table as a plan reads it: the alias it is known by, the indexes used, and
 * the conditions restricting it — those the index applied and those applied to
 * the rows it returned.
 *
 * A relation, not a node, is the unit: a `Bitmap Heap Scan` names the table
 * while the `Bitmap Index Scan` beneath it names the index and carries the
 * condition, and the two are one read of one table.
 */
export type RelationScan = {
  alias: string;
  table: string;
  indexes: string[];
  cond: string;
  filter: string;
};

/** Everything restricting the rows this scan can produce. */
export function restrictionOf(scan: RelationScan): string {
  return `${scan.cond} ${scan.filter}`;
}

export function relationScansOf(plan: PlanNode[]): RelationScan[] {
  const scans: RelationScan[] = [];

  // Conditions are collected as one conjunction per relation, which the arms of
  // a `BitmapOr` are not: a row is returned when *any* arm matches, so an arm
  // binding `user_id` restricts nothing on its own. Rather than model the
  // disjunction, the arms' conditions are dropped, and a relation reached only
  // through a `BitmapOr` reads as unrestricted. That is a red test for a plan
  // that may well be safe — the direction this file is allowed to be wrong in,
  // and the opposite of counting an alternative as a restriction.
  const walk = (
    node: PlanNode,
    owner: RelationScan | undefined,
    alternative: boolean,
  ) => {
    let next = owner;
    if (node["Relation Name"] !== undefined) {
      next = {
        alias: node.Alias ?? node["Relation Name"],
        table: node["Relation Name"],
        indexes: [],
        cond: "",
        filter: "",
      };
      scans.push(next);
    }
    if (next !== undefined) {
      const index = node["Index Name"];
      const cond = node["Index Cond"];
      const filter = node.Filter;
      // The index name is still worth reporting: it names the read in the
      // failure message even when its condition cannot be counted.
      if (index !== undefined) next.indexes.push(index);
      if (!alternative) {
        if (cond !== undefined) next.cond += ` ${cond}`;
        if (filter !== undefined) next.filter += ` ${filter}`;
      }
    }
    const arms = alternative || node["Node Type"] === "BitmapOr";
    for (const child of node.Plans ?? []) walk(child, next, arms);
  };

  // `plan` is the flattened tree with the top-level node first, and `nodesOf`
  // leaves every node's children in place, so walking the head walks all of it.
  const root = plan[0];
  if (root !== undefined) walk(root, undefined, false);
  return scans;
}

/**
 * A foreign key column pair whose parent column is a key of the parent on its
 * own — so binding the child column to it selects exactly one parent row, and
 * therefore one owner.
 */
export type ForeignKey = {
  table: string;
  column: string;
  parent: string;
  parentColumn: string;
};

/**
 * The relations a plan reads that are **not** restricted to one owner.
 *
 * Two ways to be restricted, which are the two mechanisms `design/schema.md` §8
 * gives a table (`ADR-011`):
 *
 *  1. `user_id` is equated to a value — `(user_id = $1)` — or to the `user_id`
 *     of a relation the plan has already restricted. "Already restricted" is
 *     the whole of it: `(user_id = "*VALUES*".column1)` equates `user_id` to
 *     something too, and to something that vouches for nothing;
 *  2. a foreign key of this table is equated to a key of a parent the plan has
 *     already restricted. `(template_id = schedule_template.id)` reaches
 *     exactly the slots of one template, and that template belongs to the owner
 *     its own scan was restricted to. The parent column has to be a key on its
 *     own, or "one parent row" is not true.
 *
 * **An `Index Cond` and a `Filter` count alike, and that is a deliberate
 * limit.** Which of the two a restriction lands in is the planner's decision at
 * this data size, not a property of the query: over the ~200 fixture rows
 * Postgres will read `template_slot` whole through any index and apply
 * `user_id` afterwards as readily as it will bind it, and both plans appear
 * from one run to the next as statistics move. Asserting the restriction
 * reaches the index asserts the cost model. What the plan can be held to is
 * that the restriction exists — that no relation is read unrestricted — and
 * that no `Seq Scan` answers it; that an index able to carry the restriction
 * exists at all is asserted against the catalog instead, where no planner has a
 * say (`indexUsage.integration.test.ts`, first case).
 *
 * Resolved as a fixpoint from the relations restricted to a *value*, because
 * both clauses lean on another relation being restricted already, and that
 * relation may appear anywhere in the plan. Seeding it with anything looser
 * would let the chain close on itself.
 *
 * The unit is the scan, not the alias: the two branches of an `Append` are one
 * alias and two reads, and one of them being restricted says nothing about the
 * other. An alias may therefore vouch for another relation only when *every*
 * scan carrying it is restricted.
 */
export function unboundRelations(
  plan: PlanNode[],
  foreignKeys: ForeignKey[],
): RelationScan[] {
  const scans = relationScansOf(plan);
  const byAlias = new Map<string, RelationScan[]>();
  for (const scan of scans) {
    const named = byAlias.get(scan.alias);
    if (named === undefined) byAlias.set(scan.alias, [scan]);
    else named.push(scan);
  }

  const bound = new Set(
    scans.filter((scan) => BINDS_USER_ID_TO_A_VALUE.test(restrictionOf(scan))),
  );

  /** An alias another relation may be restricted *through*. */
  const vouches = (alias: string, table?: string): boolean => {
    const named = byAlias.get(alias);
    if (named === undefined || named.length === 0) return false;
    if (table !== undefined && named.some((scan) => scan.table !== table)) {
      return false;
    }
    return named.every((scan) => bound.has(scan));
  };

  /** Every `alias.user_id` this scan's restriction reads, its own aside. */
  const userIdReferences = (scan: RelationScan): string[] =>
    [...restrictionOf(scan).matchAll(USER_ID_OF_A_RELATION)]
      .map((match) => match[1] ?? match[2])
      .filter((alias) => alias !== scan.alias);

  const boundThroughUserId = (scan: RelationScan): boolean =>
    BINDS_USER_ID.test(restrictionOf(scan)) &&
    userIdReferences(scan).some((alias) => vouches(alias));

  const boundThroughAKey = (scan: RelationScan): boolean =>
    foreignKeys
      .filter((fk) => fk.table === scan.table)
      .some((fk) => {
        const reference = new RegExp(
          `\\b${fk.column}\\s*=\\s*(?:"([^"]+)"|([A-Za-z_][\\w$]*))\\.${fk.parentColumn}\\b`,
        );
        const match = reference.exec(restrictionOf(scan));
        if (match === null) return false;
        return vouches(match[1] ?? match[2], fk.parent);
      });

  for (let settled = false; !settled; ) {
    settled = true;
    for (const scan of scans) {
      if (bound.has(scan)) continue;
      if (boundThroughUserId(scan) || boundThroughAKey(scan)) {
        bound.add(scan);
        settled = false;
      }
    }
  }

  return scans.filter((scan) => !bound.has(scan));
}

export function describeScan(scan: RelationScan): string {
  const via = scan.indexes.length > 0 ? scan.indexes.join(", ") : "no index";
  const cond = scan.cond === "" ? " no Index Cond" : scan.cond;
  const filter = scan.filter === "" ? "" : `, filtered by${scan.filter}`;
  return `${scan.alias} via ${via}:${cond}${filter}`;
}

/**
 * Everything the rule has to say about one plan; empty when the plan satisfies
 * it.
 *
 * One function, so that the reads, the negative controls and the written-out
 * plans below all measure against the same rule — a control that re-states the
 * check proves only that the control agrees with itself.
 */
export function violationsOf(
  plan: PlanNode[],
  foreignKeys: ForeignKey[],
): string[] {
  const scans = relationScansOf(plan);
  const violations: string[] = [];

  if (plan.some((node) => node["Node Type"] === "Seq Scan")) {
    violations.push("Seq Scan");
  }
  if (indexScansOf(plan).length === 0) {
    violations.push("no index answers the statement");
  }
  for (const scan of unboundRelations(plan, foreignKeys)) {
    violations.push(`unbound: ${describeScan(scan)}`);
  }
  if (
    !scans.some((scan) => BINDS_USER_ID_TO_A_VALUE.test(restrictionOf(scan)))
  ) {
    violations.push("no scan binds user_id to a value");
  }

  return violations;
}
