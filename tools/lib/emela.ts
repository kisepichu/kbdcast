export type RunResult = { code: number; stdout: string; stderr: string };

// FRICTION(001): the official Linux binary asks for weak GLIBC_2.39 symbols, and the loader warns on every run.
const GLIBC_WARNING = /weak version `GLIBC_2\.39' not found/;

export function stripLoaderWarning(stderr: string): string {
  return stderr
    .split("\n")
    .filter((line) => !GLIBC_WARNING.test(line))
    .join("\n");
}

export function runEmela(args: string[], cwd: string): RunResult {
  try {
    const proc = Bun.spawnSync(["emela", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    return { code: proc.exitCode ?? 1, stdout: proc.stdout.toString(), stderr: stripLoaderWarning(proc.stderr.toString()) };
  } catch {
    return { code: 127, stdout: "", stderr: "emela が見つからない。`mise install` を実行する\n" };
  }
}

export function parseEmelaVersion(output: string): string | undefined {
  return /^emela (\d+\.\d+\.\d+)/m.exec(output)?.[1];
}

export function pinnedEmelaVersion(miseToml: string): string | undefined {
  return /^"github:emela-lang\/emela"\s*=\s*"([^"]+)"/m.exec(miseToml)?.[1];
}
