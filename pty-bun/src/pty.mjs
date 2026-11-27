// The host side of BunPty: a process on a pseudo-terminal of Bun (Bun.Terminal and Bun.spawn).
// Bun pushes the output to the `data` callback; this module keeps it until `read` takes it, so that an interrupted
// `read` loses nothing.

// How long `read` keeps waiting for the end of the output after the process has exited. A process that leaves a child
// holding the terminal open would otherwise never let the output end.
const DRAIN_MS = 100;
// How long `close` waits for the process to end after SIGTERM before it sends SIGKILL.
const KILL_MS = 1000;

function wake(pty) {
  if (pty.waiter !== null) {
    const waiter = pty.waiter;
    pty.waiter = null;
    waiter();
  }
}

// Starts `argv` on a new terminal of `cols` × `rows` in `cwd`, with the environment of this process and the
// `NAME=value` entries of `env` over it. When the process cannot start, the result holds the reason (`openError`).
export function open(argv, cols, rows, cwd, env) {
  const pty = { chunks: [], waiter: null, eof: false, exited: false, drained: false, code: -1, error: "", process: null };
  pty.terminal = new Bun.Terminal({
    cols,
    rows,
    data(_terminal, bytes) {
      pty.chunks.push(new Uint8Array(bytes));
      wake(pty);
    },
    exit() {
      pty.eof = true;
      wake(pty);
    },
  });
  const overrides = Object.fromEntries(env.map((entry) => [entry.slice(0, entry.indexOf("=")), entry.slice(entry.indexOf("=") + 1)]));
  try {
    pty.process = Bun.spawn(argv, { terminal: pty.terminal, cwd, env: { ...process.env, ...overrides } });
  } catch (error) {
    pty.terminal.close();
    pty.error = error instanceof Error ? error.message : String(error);
    return pty;
  }
  pty.process.exited.then((code) => {
    pty.exited = true;
    pty.code = code;
    setTimeout(() => {
      pty.drained = true;
      wake(pty);
    }, DRAIN_MS);
    wake(pty);
  });
  return pty;
}

// Why the process could not start, or "" when it started.
export function openError(pty) {
  return pty.error;
}

function ended(pty) {
  return pty.exited && (pty.eof || pty.drained);
}

function take(pty) {
  const out = new Uint8Array(pty.chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of pty.chunks) {
    out.set(c, at);
    at += c.length;
  }
  pty.chunks = [];
  return out;
}

// The output that has arrived, waiting until some arrives. Empty once the process has exited and its output has
// ended. When `signal` aborts (the reading fiber is interrupted), the output stays for the next read.
export function read(pty, signal) {
  if (pty.chunks.length > 0) return take(pty);
  if (ended(pty) || signal.aborted) return new Uint8Array(0);
  return new Promise((resolve) => {
    const onAbort = () => {
      pty.waiter = null;
      resolve(new Uint8Array(0));
    };
    const check = () => {
      if (pty.chunks.length > 0 || ended(pty)) {
        signal.removeEventListener("abort", onAbort);
        resolve(pty.chunks.length > 0 ? take(pty) : new Uint8Array(0));
      } else {
        pty.waiter = check;
      }
    };
    pty.waiter = check;
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function write(pty, bytes) {
  pty.terminal.write(bytes);
}

// The exit code of the process once `read` has returned empty: its code, or 128 + the number of the signal that
// ended it.
export function exitCode(pty) {
  return pty.code;
}

// Ends the process if it is still running (SIGTERM, then SIGKILL after KILL_MS) and closes the terminal.
export async function close(pty) {
  if (pty.process === null) return;
  if (!pty.exited) {
    pty.process.kill("SIGTERM");
    const timer = setTimeout(() => pty.process.kill("SIGKILL"), KILL_MS);
    await pty.process.exited;
    clearTimeout(timer);
  }
  if (!pty.terminal.closed) pty.terminal.close();
}
