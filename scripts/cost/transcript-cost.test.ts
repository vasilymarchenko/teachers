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
  usage?: Partial<{
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  }>;
  sidechain?: boolean;
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
  return JSON.stringify({
    type: "assistant",
    isSidechain: options.sidechain ?? false,
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

  it("reports the context at the first call, the last and the widest", () => {
    expect(report.contextFirst).toBe(100);
    expect(report.contextLast).toBe(900);
    expect(report.contextMax).toBe(900);
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
