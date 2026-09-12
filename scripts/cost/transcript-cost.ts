/**
 * What one session cost, read out of its own transcript (T-034).
 *
 * A `/teachers-ticket` run accumulates one context from phase 1 to phase 7, and
 * every API call re-sends everything the run has read so far. That is invisible
 * from inside the run: the terminal shows tool calls, not the context each one
 * carried. This reads the transcript the CLI writes and reports the three
 * numbers a decision about the loop's shape needs — how many calls, how big the
 * context was at each of them, and where the tokens went, per phase.
 *
 * Usage:
 *
 *   npm run cost -- <session-id | path/to/transcript.jsonl> [--json]
 *
 * One API call is written as *several* entries — one per content block of the
 * response, each repeating that call's `usage` verbatim — so the entries are
 * folded back together by `requestId` before anything is counted. Taking one
 * entry as one call multiplies the call count and all four token totals by the
 * number of blocks the response happened to have.
 *
 * With no argument it takes the most recently modified transcript of the
 * current project — the directory `process.cwd()` slugifies to, and no other.
 * Transcripts live under `~/.claude/projects/<slug>/<id>.jsonl`, one JSON object
 * per line; only `assistant` entries carry a `usage`.
 *
 * The parsing half is pure over its input so `transcript-cost.test.ts` asserts
 * against strings rather than against whichever sessions this machine happens
 * to have run.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The four classes an API call's tokens fall into. */
export interface Tokens {
  /** Fresh input: what this call sent that no earlier call had sent. */
  input: number;
  /** Written into the cache by this call. */
  cacheCreation: number;
  /** Read back out of the cache — the re-sent context, charged again. */
  cacheRead: number;
  output: number;
}

export interface Call {
  /** `"1"`…`"7"`, or `"—"` for a call made before any phase marker. */
  phase: string;
  /** A call made inside a subagent rather than in the main thread. */
  sidechain: boolean;
  tokens: Tokens;
  /** Everything the call sent: the three input classes together. */
  context: number;
  /** Tool uses in the assistant message this call produced. */
  toolUses: number;
  timestamp: string | null;
}

export interface PhaseRow {
  phase: string;
  calls: number;
  sidechainCalls: number;
  tokens: Tokens;
  /** Context size across the phase's calls. */
  contextMin: number;
  contextMedian: number;
  contextMax: number;
  /** This phase's share of the run's re-sent context, 0…1. */
  cacheReadShare: number;
}

export interface Report {
  transcript: string;
  calls: number;
  sidechainCalls: number;
  tokens: Tokens;
  /** Context across every call, sidechain included — the table's totals row. */
  contextMin: number;
  contextMax: number;
  /**
   * The main thread's growth curve, sidechain calls excluded.
   *
   * This is the metric `ADR-017` states a run by — "a context that grew from
   * 67K to 244K without one reset". A run whose last activity is inside a
   * review fork would otherwise report that fork's narrow context as the
   * number the next measurement is compared against.
   */
  contextFirst: number;
  contextLast: number;
  contextWidest: number;
  /** Calls whose message carried more than one tool use. */
  multiToolCalls: number;
  phases: PhaseRow[];
  /** Every call, in order. Serialised by `--json`; not printed in the table. */
  callDetail: Call[];
}

const EMPTY: Tokens = {
  input: 0,
  cacheCreation: 0,
  cacheRead: 0,
  output: 0,
};

function add(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    cacheCreation: a.cacheCreation + b.cacheCreation,
    cacheRead: a.cacheRead + b.cacheRead,
    output: a.output + b.output,
  };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The last phase number a text matches, or `null`.
 *
 * The last, never the first: both markers are written at a boundary, and a
 * boundary names two phases. An `Edit` of the state file carries the old phase
 * in `old_string` and the new one in `new_string`; a transition sentence —
 * "phase 6 is done, starting phase 7" — names the phase being left first. Taking
 * the first match attributes every call of the new phase to the old one, which
 * is the whole table one boundary late.
 */
function last(text: string, pattern: RegExp): string | null {
  let found: string | null = null;
  for (const match of text.matchAll(pattern)) found = match[1];
  return found;
}

/**
 * The phase a line announces, or `null`.
 *
 * Two markers, in order of trust. The state file `/teachers-ticket` writes at
 * every phase boundary carries `"phase": N`, and an agent that wrote it is
 * demonstrably in that phase. Failing that, the phase the assistant named in
 * its own prose. Neither is read from a tool *result*: a transcript that merely
 * quoted the skill file back would otherwise re-phase the whole run.
 */
export function phaseMarker(entry: Record<string, unknown>): string | null {
  if (entry.type !== "assistant") return null;
  const message = entry.message as { content?: unknown } | undefined;
  const content = Array.isArray(message?.content) ? message.content : [];

  let prose: string | null = null;
  for (const block of content as Array<Record<string, unknown>>) {
    if (block.type === "tool_use") {
      const written = JSON.stringify(block.input ?? "");
      // The state file, whichever tool wrote it — the path is what identifies
      // it, and the quoting depends on whether the content was nested JSON or
      // a string. A `phase` key anywhere else is not this marker.
      if (/run\.json/.test(written)) {
        const state = last(written, /\bphase\\?["']?\s*:\s*\\?["']?([1-7])\b/gi);
        if (state !== null) return state;
      }
      continue;
    }
    if (block.type === "text" && typeof block.text === "string") {
      const named = last(block.text, /\bphase\s*([1-7])\b/gi);
      if (named !== null) prose = named;
    }
  }
  return prose;
}

/** One `Call` per API call in the transcript, in order. */
export function callsFrom(lines: readonly string[]): Call[] {
  const calls: Call[] = [];
  // `requestId` → the call already opened for it. One response is written as
  // one entry per content block, each carrying that call's `usage` again; the
  // tool uses are spread across those entries, so they accumulate while the
  // tokens are taken once. An entry with no `requestId` — a synthetic line, an
  // older transcript — is its own call, which is the pre-fold behaviour.
  const open = new Map<string, Call>();
  let phase = "—";

  for (const line of lines) {
    if (line.trim() === "") continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      // A transcript is appended to while it is being read; a half-written
      // last line is not a reason to report nothing.
      continue;
    }

    const marker = phaseMarker(entry);
    // A subagent's own prose must not move the caller's phase: it is reading
    // the same skill file and will name phases the caller is not in.
    if (marker !== null && entry.isSidechain !== true) phase = marker;

    if (entry.type !== "assistant") continue;
    const message = entry.message as
      | { usage?: Record<string, unknown>; content?: unknown }
      | undefined;
    const usage = message?.usage;
    if (!usage) continue;

    const toolUses = (Array.isArray(message?.content) ? message.content : [])
      .filter((block) => (block as Record<string, unknown>)?.type === "tool_use")
      .length;
    const requestId =
      typeof entry.requestId === "string" ? entry.requestId : null;
    if (requestId !== null) {
      const already = open.get(requestId);
      if (already) {
        already.toolUses += toolUses;
        continue;
      }
    }

    const tokens: Tokens = {
      input: num(usage.input_tokens),
      cacheCreation: num(usage.cache_creation_input_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
      output: num(usage.output_tokens),
    };
    const call: Call = {
      phase,
      sidechain: entry.isSidechain === true,
      tokens,
      context: tokens.input + tokens.cacheCreation + tokens.cacheRead,
      toolUses,
      timestamp: typeof entry.timestamp === "string" ? entry.timestamp : null,
    };
    calls.push(call);
    if (requestId !== null) open.set(requestId, call);
  }

  return calls;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function summarise(transcript: string, calls: readonly Call[]): Report {
  const cacheRead = calls.reduce((total, call) => total + call.tokens.cacheRead, 0);
  const byPhase = new Map<string, Call[]>();
  for (const call of calls) {
    const bucket = byPhase.get(call.phase) ?? [];
    bucket.push(call);
    byPhase.set(call.phase, bucket);
  }

  const phases: PhaseRow[] = [...byPhase.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([phase, rows]) => {
      const contexts = rows.map((row) => row.context);
      return {
        phase,
        calls: rows.length,
        sidechainCalls: rows.filter((row) => row.sidechain).length,
        tokens: rows.reduce((total, row) => add(total, row.tokens), EMPTY),
        contextMin: Math.min(...contexts),
        contextMedian: median(contexts),
        contextMax: Math.max(...contexts),
        cacheReadShare:
          cacheRead === 0
            ? 0
            : rows.reduce((total, row) => total + row.tokens.cacheRead, 0) /
              cacheRead,
      };
    });

  const contexts = calls.map((call) => call.context);
  // The growth curve is the main thread's. A sidechain call carries the
  // subagent's own context, which starts small and says nothing about how far
  // the run itself has grown — see `Report.contextFirst`.
  const main = calls.filter((call) => !call.sidechain).map((call) => call.context);
  return {
    transcript,
    calls: calls.length,
    sidechainCalls: calls.filter((call) => call.sidechain).length,
    tokens: calls.reduce((total, call) => add(total, call.tokens), EMPTY),
    contextMin: contexts.length === 0 ? 0 : Math.min(...contexts),
    contextMax: contexts.length === 0 ? 0 : Math.max(...contexts),
    contextFirst: main.at(0) ?? 0,
    contextLast: main.at(-1) ?? 0,
    contextWidest: main.length === 0 ? 0 : Math.max(...main),
    multiToolCalls: calls.filter((call) => call.toolUses > 1).length,
    phases,
    callDetail: [...calls],
  };
}

/** `58847231` → `58.85M`. Whole tokens below 10K, where the digits matter. */
export function short(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function row(cells: readonly string[], widths: readonly number[]): string {
  return cells
    .map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i])))
    .join("  ");
}

export function formatReport(report: Report): string {
  const header = [
    "phase",
    "calls",
    "sub",
    "input",
    "cache w",
    "cache r",
    "output",
    "ctx min",
    "ctx med",
    "ctx max",
  ];
  const body = report.phases.map((phase) => [
    phase.phase,
    String(phase.calls),
    String(phase.sidechainCalls),
    short(phase.tokens.input),
    short(phase.tokens.cacheCreation),
    short(phase.tokens.cacheRead),
    short(phase.tokens.output),
    short(phase.contextMin),
    short(phase.contextMedian),
    short(phase.contextMax),
  ]);
  const total = [
    "all",
    String(report.calls),
    String(report.sidechainCalls),
    short(report.tokens.input),
    short(report.tokens.cacheCreation),
    short(report.tokens.cacheRead),
    short(report.tokens.output),
    // The narrowest call of the run, not its first: the column header is
    // `ctx min`, and a totals row whose "minimum" exceeds a phase row's is
    // read as a bug in the table.
    short(report.contextMin),
    "",
    short(report.contextMax),
  ];

  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...[...body, total].map((r) => r[i].length)),
  );

  const lines = [
    `transcript: ${report.transcript}`,
    "",
    row(header, widths),
    row(
      widths.map((width) => "─".repeat(width)),
      widths,
    ),
    ...body.map((cells) => row(cells, widths)),
    row(total, widths),
    "",
    `context in the main thread: ${short(report.contextFirst)} at the first call, ` +
      `${short(report.contextLast)} at the last, ${short(report.contextWidest)} at its widest`,
    `cache read is the re-sent context, charged on every call: ` +
      `${short(report.tokens.cacheRead)} against ${short(report.tokens.input)} fresh input`,
    `${report.multiToolCalls} of ${report.calls} calls carried more than one tool use`,
  ];

  const seven = report.phases.find((phase) => phase.phase === "7");
  if (seven) {
    lines.push(
      `phase 7 is ${(seven.cacheReadShare * 100).toFixed(1)}% of the re-sent context`,
    );
  }

  if (report.phases.length === 1 && report.phases[0].phase === "—") {
    lines.push(
      "",
      "no phase marker in this transcript — it is not a /teachers-ticket run, " +
        "or the run wrote no .gate/run.json",
    );
  }

  return lines.join("\n");
}

/** The directory name the CLI stores a working directory's transcripts under. */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/** `~/.claude/projects/<slug>/<id>.jsonl` for one project, or for all of them. */
function transcripts(slug?: string): string[] {
  const root = join(homedir(), ".claude", "projects");
  const found: string[] = [];
  let projects: string[];
  try {
    projects = slug === undefined ? readdirSync(root) : [slug];
  } catch {
    return found;
  }
  for (const project of projects) {
    const dir = join(root, project);
    try {
      for (const file of readdirSync(dir)) {
        if (file.endsWith(".jsonl")) found.push(join(dir, file));
      }
    } catch {
      // A project directory that cannot be read is not this script's problem —
      // and with an explicit slug, a project with no transcripts yet is that.
    }
  }
  return found;
}

function modified(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    // Listed a moment ago and gone now: a concurrent session's cleanup. It
    // sorts last rather than throwing out of a report about other files.
    return 0;
  }
}

/**
 * A path, a session id, a prefix of one, or — with no argument — the newest.
 *
 * "The newest" is the newest *of this project*. Machine-wide, the answer to a
 * bare `npm run cost` would be whichever session this machine touched last,
 * which on a machine running more than one project is routinely another
 * repository's — and its numbers would be recorded here as this one's. A
 * session id is looked for in this project first and only then more widely,
 * since an id names exactly one session wherever it was run.
 */
export function resolveTranscript(argument: string | undefined): string | null {
  if (argument !== undefined && argument.endsWith(".jsonl")) return argument;
  const mine = transcripts(projectSlug(process.cwd()));
  if (argument !== undefined) {
    const match = (path: string) =>
      (path.split("/").at(-1) ?? "").startsWith(argument);
    return mine.find(match) ?? transcripts().find(match) ?? null;
  }
  if (mine.length === 0) return null;
  return mine
    .map((path) => ({ path, at: modified(path) }))
    .sort((a, b) => b.at - a.at)[0].path;
}

function main(argv: readonly string[]): number {
  const json = argv.includes("--json");
  const target = resolveTranscript(argv.find((arg) => !arg.startsWith("--")));
  if (target === null) {
    console.error(
      "no transcript found for this project. Pass a path to a .jsonl " +
        "transcript or a session id.",
    );
    return 1;
  }

  let lines: string[];
  try {
    lines = readFileSync(target, "utf8").split("\n");
  } catch (error) {
    console.error(`cannot read ${target}: ${String(error)}`);
    return 1;
  }

  const report = summarise(target, callsFrom(lines));
  if (report.calls === 0) {
    console.error(`${target} records no API call`);
    return 1;
  }
  console.log(json ? JSON.stringify(report, null, 2) : formatReport(report));
  return 0;
}

if (process.argv[1]?.includes("transcript-cost")) {
  process.exitCode = main(process.argv.slice(2));
}
