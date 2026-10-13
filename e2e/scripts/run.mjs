// Starts the e2e stack, runs the tests, and always tears the stack down afterwards.
// Set E2E_KEEP_STACK=1 to leave it running for faster repeat runs.
//
// No shell is used anywhere: with `shell: true` Node joins arguments without quoting them, so
// `-t "adds a to-do"` would be split into three arguments on Windows. `docker` is a real
// executable and Vitest is started through the current Node binary, so neither needs a shell.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
const compose = ["compose", "-p", "todo-e2e", "-f", path.join(root, "..", "docker-compose.e2e.yml")];
const run = (command, args) => spawnSync(command, args, { stdio: "inherit", cwd: root });

// Ctrl+C is delivered to this process and to the child. Without a handler Node would exit
// immediately and skip the `finally` below, leaving the stack running. With a (no-op) handler the
// child stops, `spawnSync` returns, and the teardown still happens.
process.on("SIGINT", () => {});

let status = 1;
try {
  if (run("docker", [...compose, "up", "--build", "-d"]).status !== 0) {
    throw new Error("The e2e stack failed to start");
  }
  // Extra CLI arguments are passed to Vitest, e.g. `npm run e2e -- tests/todos.e2e.test.ts`
  // or `npm run e2e -- -t "adds a to-do"`.
  status = run(process.execPath, [vitest, "run", ...process.argv.slice(2)]).status ?? 1;
} finally {
  if (process.env.E2E_KEEP_STACK !== "1") run("docker", [...compose, "down", "-v"]);
}
process.exit(status);
