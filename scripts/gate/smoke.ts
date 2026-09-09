/**
 * The image half of the gate: build `runner`, build `migrator`, and prove the
 * migrator image migrates.
 *
 * `ci.yml` does the same three things. The one difference is how the migrator
 * container reaches its database: CI uses `--network host`, which on Docker
 * Desktop reaches the Windows host and not a published container port. Here the
 * two containers share a user-defined network and the migrator addresses the
 * database by container name, which behaves the same on every platform. The
 * schema is then verified from the host over the published port.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:net";

import { exec, type Executed } from "./exec";
import { verifySchema } from "./verifySchema";

const NETWORK = "teachers-gate-net";
const DB_CONTAINER = "teachers-gate-db";
const MIGRATOR_TAG = "teachers-migrator:gate";
const RUNNER_TAG = "teachers-runner:gate";

/**
 * A port the operating system says is free, asked for rather than chosen.
 *
 * The database has to publish one so the schema can be verified from the host
 * through the same driver the `verify-schema` check uses. Any fixed number is a
 * guess about the developer's machine, and this project's own
 * `docker-compose.yml` is one of the things likely to have taken it.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
    });
  });
}

/**
 * The Postgres version, read from `docker-compose.yml` rather than named here.
 *
 * `lib/db/postgresImage.test.ts` holds three files to one version. A fourth
 * place naming it would have to join that test; reading one of the three
 * instead means the gate cannot drift from them at all.
 */
export function postgresImage(compose = "docker-compose.yml"): string {
  const match = /\bpostgres:\d[\w.-]*/.exec(readFileSync(compose, "utf8"));
  if (!match) {
    throw new Error(`No postgres image found in ${compose}.`);
  }
  return match[0];
}

export async function dockerAvailable(): Promise<boolean> {
  const { exitCode } = await exec("docker", ["info", "--format", "{{.ServerVersion}}"]);
  return exitCode === 0;
}

export function buildImage(target: "runner" | "migrator"): Promise<Executed> {
  return exec("docker", [
    "build",
    "--target",
    target,
    "--tag",
    target === "runner" ? RUNNER_TAG : MIGRATOR_TAG,
    ".",
  ]);
}

async function waitForHealthy(container: string): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { exitCode, output } = await exec("docker", [
      "inspect",
      "-f",
      "{{.State.Health.Status}}",
      container,
    ]);
    if (exitCode === 0 && output.trim() === "healthy") return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

async function tearDown(): Promise<void> {
  await exec("docker", ["rm", "-f", DB_CONTAINER]);
  await exec("docker", ["network", "rm", NETWORK]);
}

/**
 * Runs the migrator image against a database of its own, then asserts the
 * schema it left. Exit 0 from `drizzle-kit migrate` is not the assertion — it
 * reports success on work it did not do — the schema is.
 */
export async function migratorSmoke(): Promise<Executed> {
  const image = postgresImage();
  const hostPort = await freePort();
  let log = "";
  const record = (step: string, result: Executed) => {
    log += `\n--- ${step} (exit ${result.exitCode}) ---\n${result.output}`;
    return result;
  };

  // A previous run that died before its teardown leaves both behind.
  await tearDown();

  try {
    const network = record("docker network create", await exec("docker", ["network", "create", NETWORK]));
    if (network.exitCode !== 0) return { exitCode: network.exitCode, output: log };

    const started = record(
      "docker run postgres",
      await exec("docker", [
        "run", "-d", "--name", DB_CONTAINER, "--network", NETWORK,
        "-e", "POSTGRES_USER=teachers",
        "-e", "POSTGRES_PASSWORD=teachers",
        "-e", "POSTGRES_DB=teachers",
        "-p", `${hostPort}:5432`,
        "--health-cmd", "pg_isready -h 127.0.0.1 -U teachers -d teachers",
        "--health-interval", "5s",
        "--health-timeout", "5s",
        "--health-retries", "20",
        image,
      ]),
    );
    if (started.exitCode !== 0) return { exitCode: started.exitCode, output: log };

    if (!(await waitForHealthy(DB_CONTAINER))) {
      const logs = record("docker logs", await exec("docker", ["logs", DB_CONTAINER]));
      return { exitCode: 1, output: `${log}\nPostgres did not become healthy.\n${logs.output}` };
    }

    const migrated = record(
      "the migrator image migrates",
      await exec("docker", [
        "run", "--rm", "--network", NETWORK,
        "-e", `DATABASE_URL=postgres://teachers:teachers@${DB_CONTAINER}:5432/teachers`,
        MIGRATOR_TAG,
      ]),
    );
    if (migrated.exitCode !== 0) return { exitCode: migrated.exitCode, output: log };

    try {
      await verifySchema(`postgres://teachers:teachers@127.0.0.1:${hostPort}/teachers`);
      log += "\n--- the schema it left is the schema (exit 0) ---\nverified\n";
      return { exitCode: 0, output: log };
    } catch (error) {
      return {
        exitCode: 1,
        output: `${log}\n--- verify-schema.sql ---\n${(error as Error).message}\n`,
      };
    }
  } finally {
    await tearDown();
  }
}
