import { describe, expect, it } from "vitest";

import {
  callsFrom,
  formatReport,
  phaseMarker,
  short,
  summarise,
} from "./transcript-cost";

/**
 * The parsing half of the cost report, over synthetic transcript lines (T-034).
 *
 * Asserting against a real transcript would pin the test to whichever sessions
 * this machine has run, which is the one input no CI runner shares.
 */

function assistant(options: {
  phaseText?: string;
  stateFile?: number;
  /** A state file moved from one phase to the next by an `Edit`. */
  stateEdit?: [number, number];
  toolUses?: number;
  usage?: Partial<{
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  }>;
  sidechain?: boolean;
  requestId?: string;
}): string {
  const content: unknown[] = [];
  if (options.phaseText !== undefined) {
    content.push({ type: "text", text: options.phaseText });
  }
  if (options.stateFile !== undefined) {
    content.push({
      type: "tool_use",
      name: "Write",
      input: {
        file_path: ".gate/run.json",
        content: `{"ticket":"T-034","phase": ${options.stateFile}}`,
      },
    });
  }
  if (options.stateEdit !== undefined) {
    const [from, to] = options.stateEdit;
    content.push({
      type: "tool_use",
      name: "Edit",
      input: {
        file_path: ".gate/run.json",
        old_string: `"phase": ${from}`,
        new_string: `"phase": ${to}`,
      },
    });
  }
  for (let i = 0; i < (options.toolUses ?? 0); i += 1) {
    content.push({ type: "tool_use", name: "Read", input: { file_path: "a.ts" } });
  }
  return JSON.stringify({
    type: "assistant",
    isSidechain: options.sidechain ?? false,
    ...(options.requestId ? { requestId: options.requestId } : {}),
    timestamp: "2026-09-12T09:00:00.000Z",
    message: {
      content,
      ...(options.usage ? { usage: options.usage } : {}),
    },
  });
}

describe("phaseMarker", () => {
  it("reads the phase out of a written state file", () => {
    expect(phaseMarker(JSON.parse(assistant({ stateFile: 5 })))).toBe("5");
  });

  it("reads the phase being entered out of an edited state file", () => {
    // `Edit` carries both phases: the old one in `old_string`. The marker is
    // the phase the run is moving into, or the whole table is one boundary late.
    expect(phaseMarker(JSON.parse(assistant({ stateEdit: [5, 6] })))).toBe("6");
  });

  it("falls back to the phase the assistant named in prose", () => {
    expect(
      phaseMarker(JSON.parse(assistant({ phaseText: "Starting phase 3 now." }))),
    ).toBe("3");
  });

  it("prefers the state file over the prose around it", () => {
    expect(
      phaseMarker(
        JSON.parse(assistant({ phaseText: "phase 2 is done", stateFile: 3 })),
      ),
    ).toBe("3");
  });

  it("takes the phase a transition sentence ends on, not the one it leaves", () => {
    expect(
      phaseMarker(
        JSON.parse(assistant({ phaseText: "Phase 6 is done — starting phase 7." })),
      ),
    ).toBe("7");
  });

  it("reads nothing out of a user entry", () => {
    const line = JSON.stringify({
      type: "user",
      message: { content: "run phase 7 for me" },
    });
    expect(phaseMarker(JSON.parse(line))).toBeNull();
  });
});

describe("callsFrom", () => {
  const lines = [
    assistant({ usage: { input_tokens: 10, cache_read_input_tokens: 100 } }),
    assistant({ stateFile: 1 }),
    assistant({
      usage: {
        input_tokens: 5,
        cache_creation_input_tokens: 40,
        cache_read_input_tokens: 200,
        output_tokens: 7,
      },
    }),
    "",
    "{ not json",
    assistant({
      sidechain: true,
      phaseText: "phase 7 of the skill I am reading",
      usage: { cache_read_input_tokens: 500 },
    }),
    assistant({ usage: { cache_read_input_tokens: 300 } }),
  ];

  it("counts one call per usage, and nothing else", () => {
    expect(callsFrom(lines)).toHaveLength(4);
  });

  it("attributes a call to the phase last announced before it", () => {
    expect(callsFrom(lines).map((call) => call.phase)).toEqual([
      "—",
      "1",
      "1",
      "1",
    ]);
  });

  it("does not let a subagent's own prose move the caller's phase", () => {
    // The subagent is reading the skill file and naming phases the caller is
    // not in. Its own call is still attributed to the caller's phase.
    const calls = callsFrom(lines);
    expect(calls[2].sidechain).toBe(true);
    expect(calls[3].phase).toBe("1");
  });

  it("sums the three input classes into the context the call carried", () => {
    expect(callsFrom(lines)[1].context).toBe(245);
  });

  it("folds the entries of one response into one call", () => {
    // The CLI writes one entry per content block, each repeating that call's
    // usage. Counted per entry, this is three calls and three times the tokens.
    const response = [
      assistant({
        requestId: "req_1",
        toolUses: 1,
        usage: { cache_read_input_tokens: 400, output_tokens: 8 },
      }),
      assistant({
        requestId: "req_1",
        toolUses: 1,
        usage: { cache_read_input_tokens: 400, output_tokens: 8 },
      }),
      assistant({
        requestId: "req_2",
        usage: { cache_read_input_tokens: 500, output_tokens: 2 },
      }),
    ];
    const folded = callsFrom(response);
    expect(folded).toHaveLength(2);
    expect(folded[0].tokens).toMatchObject({ cacheRead: 400, output: 8 });
    // The tool uses were spread across the entries; the count is the response's.
    expect(folded[0].toolUses).toBe(2);
  });

  it("survives a half-written last line", () => {
    expect(callsFrom(['{"type":"assistant"'])).toEqual([]);
  });
});

describe("summarise", () => {
  const report = summarise(
    "t.jsonl",
    callsFrom([
      assistant({ stateFile: 6 }),
      assistant({ usage: { cache_read_input_tokens: 100, output_tokens: 1 } }),
      assistant({ usage: { cache_read_input_tokens: 300, output_tokens: 3 } }),
      assistant({ stateFile: 7 }),
      assistant({
        sidechain: true,
        usage: { cache_read_input_tokens: 900, output_tokens: 9 },
      }),
    ]),
  );

  it("reports one row per phase, in phase order", () => {
    expect(report.phases.map((phase) => phase.phase)).toEqual(["6", "7"]);
  });

  it("counts the subagent calls inside the phase that launched them", () => {
    expect(report.phases[1]).toMatchObject({ calls: 1, sidechainCalls: 1 });
    expect(report.sidechainCalls).toBe(1);
  });

  it("takes the growth curve from the main thread alone", () => {
    // The last call of the run is a subagent's, carrying its own narrow
    // context. Reporting it as `contextLast` would say the run had shrunk.
    expect(report.contextFirst).toBe(100);
    expect(report.contextLast).toBe(300);
    expect(report.contextWidest).toBe(300);
  });

  it("takes the totals row over every call, sidechain included", () => {
    expect(report.contextMin).toBe(100);
    expect(report.contextMax).toBe(900);
  });

  it("never states a total narrower than a phase row's minimum", () => {
    const min = Math.min(...report.phases.map((phase) => phase.contextMin));
    expect(report.contextMin).toBeLessThanOrEqual(min);
    expect(formatReport(report)).toContain(short(report.contextMin));
  });

  it("gives each phase its share of the re-sent context", () => {
    expect(report.phases[1].cacheReadShare).toBeCloseTo(900 / 1300);
    expect(formatReport(report)).toContain("phase 7 is 69.2% of the re-sent context");
  });

  it("counts the calls that carried more than one tool use", () => {
    const busy = summarise(
      "t.jsonl",
      callsFrom([
        assistant({ toolUses: 2, usage: { input_tokens: 1 } }),
        assistant({ toolUses: 1, usage: { input_tokens: 1 } }),
      ]),
    );
    expect(busy.multiToolCalls).toBe(1);
    expect(busy.calls).toBe(2);
    expect(busy.callDetail.map((call) => call.toolUses)).toEqual([2, 1]);
  });

  it("keeps the four token classes apart", () => {
    expect(report.tokens).toEqual({
      input: 0,
      cacheCreation: 0,
      cacheRead: 1300,
      output: 13,
    });
  });

  it("says so when a transcript carries no phase marker at all", () => {
    const bare = summarise(
      "t.jsonl",
      callsFrom([assistant({ usage: { input_tokens: 1 } })]),
    );
    expect(formatReport(bare)).toContain("no phase marker");
  });
});

describe("short", () => {
  it("scales a count to the unit that makes it readable", () => {
    expect(short(999)).toBe("999");
    expect(short(58_847_231)).toBe("58.85M");
    expect(short(67_400)).toBe("67.4K");
  });
});
