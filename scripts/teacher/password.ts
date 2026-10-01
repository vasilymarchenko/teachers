import { randomBytes } from "node:crypto";

/**
 * A password nobody chose: 18 random bytes as 24 URL-safe characters, well
 * inside better-auth's default bounds of 8 to 128.
 */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

/** Whether a password can be typed here without being shown. */
export function isTerminal(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Reads one line from the terminal without echoing it.
 *
 * Raw mode is what hides it: the terminal stops echoing and hands over each
 * key, so Enter, Backspace and Ctrl-C have to be handled here. The prompt goes
 * to stderr, which keeps stdout to what the command reports. Only callable on
 * a terminal — `setRawMode` does not exist on a pipe — which is why the command
 * checks `isTerminal()` first and refuses otherwise.
 */
export function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    let value = "";

    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    };

    const onData = (chunk: Buffer) => {
      for (const key of chunk.toString("utf8")) {
        if (key === "\r" || key === "\n" || key === "\u0004") {
          finish();
          resolve(value);
          return;
        }
        if (key === "\u0003") {
          finish();
          reject(new Error("Interrupted."));
          return;
        }
        if (key === "\u007f" || key === "\b") {
          value = value.slice(0, -1);
        } else {
          value += key;
        }
      }
    };

    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
