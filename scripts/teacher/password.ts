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

/** What a chunk of raw-mode input did to the line being typed. */
export type Typed =
  | { state: "typing" | "entered"; value: string }
  | { state: "interrupted" }
  | { state: "unusable" };

/**
 * Applies one chunk of raw-mode input to the line typed so far.
 *
 * Enter and Ctrl-D end the line, Ctrl-C interrupts, Backspace removes a
 * character. Any other control character makes the line unusable rather than
 * part of it: an arrow key, Delete or Home arrives as an escape sequence, and
 * appending it would store a password no sign-in form can type — repeated the
 * same way at the second prompt, the two entries would even match.
 */
export function typeKeys(value: string, chunk: string): Typed {
  for (const key of chunk) {
    if (key === "\r" || key === "\n" || key === "\u0004") return { state: "entered", value };
    if (key === "\u0003") return { state: "interrupted" };
    if (key === "\u007f" || key === "\b") {
      value = value.slice(0, -1);
    } else if (/\p{Cc}/u.test(key)) {
      return { state: "unusable" };
    } else {
      value += key;
    }
  }
  return { state: "typing", value };
}

/**
 * Reads one line from the terminal without echoing it.
 *
 * Raw mode is what hides it: the terminal stops echoing and hands over each
 * key, so `typeKeys()` has to handle Enter, Backspace and Ctrl-C itself. The
 * prompt goes to stderr, which keeps stdout to what the command reports. Only
 * callable on a terminal — `setRawMode` does not exist on a pipe — which is why
 * the command checks `isTerminal()` first and refuses otherwise.
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
      const typed = typeKeys(value, chunk.toString("utf8"));
      if (typed.state === "typing") {
        value = typed.value;
        return;
      }
      finish();
      if (typed.state === "entered") {
        resolve(typed.value);
      } else if (typed.state === "interrupted") {
        reject(new Error("Interrupted."));
      } else {
        reject(
          new Error(
            "The password prompt takes characters, Backspace and Enter only — no arrow, editing or other control keys. Nothing was changed.",
          ),
        );
      }
    };

    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
