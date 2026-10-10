import { describe, expect, it } from "vitest";

import { commandLine, commandOutput } from "./spawn";

const NODE = "/usr/bin/node";
const NPM_CLI = "/usr/lib/node_modules/npm/bin/npm-cli.js";

describe("commandLine", () => {
  it("runs npm through node and npm's own script, with no shell", () => {
    expect(
      commandLine(["npm", "run", "lint"], { npm_execpath: NPM_CLI }, NODE),
    ).toEqual([NODE, [NPM_CLI, "run", "lint"]]);
  });

  it("finds npm's script on a Windows path too", () => {
    const cli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
    expect(
      commandLine(["npm", "test"], { npm_execpath: cli }, "C:\\node.exe"),
    ).toEqual(["C:\\node.exe", [cli, "test"]]);
  });

  it("leaves npm by name when the gate was not started by npm", () => {
    expect(commandLine(["npm", "run", "build"], {}, NODE)).toEqual([
      "npm",
      ["run", "build"],
    ]);
  });

  it("leaves npm by name when another package manager started the gate", () => {
    expect(
      commandLine(
        ["npm", "run", "build"],
        { npm_execpath: "/usr/lib/node_modules/yarn/bin/yarn.js" },
        NODE,
      ),
    ).toEqual(["npm", ["run", "build"]]);
  });

  it("passes any other command and its arguments through untouched", () => {
    const url = "postgres://u:p@localhost/db?sslmode=disable&x=1";
    expect(
      commandLine(["psql", url, "-f", "scripts/verify-schema.sql"], {
        npm_execpath: NPM_CLI,
      }),
    ).toEqual(["psql", [url, "-f", "scripts/verify-schema.sql"]]);
  });
});

describe("commandOutput", () => {
  it("says why a command never started", () => {
    expect(
      commandOutput({
        error: new Error("spawnSync npm ENOENT"),
        stdout: null,
        stderr: null,
      }),
    ).toBe("spawnSync npm ENOENT\n");
  });

  it("is what the command printed when it ran", () => {
    expect(commandOutput({ stdout: "out\n", stderr: "err\n" })).toBe(
      "out\nerr\n",
    );
  });
});
