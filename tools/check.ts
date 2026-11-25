#!/usr/bin/env bun
// The single entry of every check: run by the agent hooks after edits and at the end of a turn, and by prek on commit.
// prek passes `--commit`, which also reports checked files that the commit lacks (see checkUntracked), and `--test`, which runs `emela test`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseEmelaVersion, pinnedEmelaVersion, type RunResult, runEmela } from "./lib/emela";
import { checkMarks, checkNotes, findMarks } from "./lib/friction";
import { lintSource, parseAllowlist } from "./lib/lint";
import { findPomes, LINT_POMES, listFiles, pomeInputs } from "./lib/pomes";
import { formatProblems, type Problem } from "./lib/report";

export const ROOT = resolve(import.meta.dir, "..");
const ALLOWLIST = "tools/lint/foundation.allow";

export function runCheck(root: string, { commit = false, test = false } = {}): Problem[] {
  // Every file the check depends on lands in `inputs`: through `read`, or directly for files only emela reads.
  // Commit mode looks at exactly these files, so it cannot drift from what the check reads.
  const inputs = new Set<string>();
  const read: Read = (path) => {
    inputs.add(path);
    return readFileSync(join(root, path), "utf8");
  };
  const problems = [...checkVersion(root, read), ...checkPomes(root, inputs, test), ...checkLint(root, read), ...checkFriction(root, read)];
  return commit ? [...problems, ...checkUntracked(root, inputs)] : problems;
}

// Reads a file given relative to the root and records it as an input of the check.
type Read = (path: string) => string;

function checkVersion(root: string, read: Read): Problem[] {
  const pinned = pinnedEmelaVersion(read("mise.toml"));
  if (!pinned) return [{ kind: "version", path: "mise.toml", message: '"github:emela-lang/emela" の版が書かれていない' }];
  const result = runEmela(["--version"], root);
  const actual = parseEmelaVersion(result.stdout);
  if (result.code !== 0 || !actual) {
    return [{ kind: "version", path: "mise.toml", message: "emela --version が読めない。`mise install` を実行する", detail: result.stderr }];
  }
  if (actual !== pinned) return [{ kind: "version", path: "mise.toml", message: `emela ${actual} が使われている。固定しているのは ${pinned}` }];
  return [];
}

function checkPomes(root: string, inputs: Set<string>, test: boolean): Problem[] {
  const problems: Problem[] = [];
  for (const pome of findPomes(root)) {
    const dir = join(root, pome);
    // emela reads these files, not this script.
    for (const file of pomeInputs(root, pome)) inputs.add(file);
    const fmtPaths = ["src", "test"].filter((p) => existsSync(join(dir, p)));
    const commands = [["fmt", "--check", ...fmtPaths], ["check", "."], ...(test ? [["test", "."]] : [])];
    for (const args of commands) {
      const result = runEmela(args, dir);
      if (result.code !== 0) {
        problems.push({ kind: "emela", path: join(pome, "Pome.toml"), message: `emela ${args.join(" ")} が失敗した`, detail: result.stdout + result.stderr });
      }
    }
  }
  return problems;
}

function checkLint(root: string, read: Read): Problem[] {
  const { entries, problems } = parseAllowlist(read(ALLOWLIST), ALLOWLIST, (p) => existsSync(join(root, p)));
  const allowed = new Set(entries.map((e) => e.path));
  for (const pome of LINT_POMES) {
    if (!existsSync(join(root, pome, "Pome.toml"))) continue;
    for (const file of listFiles(join(root, pome, "src"), ".emel")) {
      const path = relative(root, file);
      if (!allowed.has(path)) problems.push(...lintSource(path, read(path)));
    }
  }
  return problems;
}

function checkFriction(root: string, read: Read): Problem[] {
  const dir = join(root, "friction");
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".md") && name !== "README.md")
        .sort()
        .map((name) => ({ name, text: read(join("friction", name)) }))
    : [];
  const { notes, problems } = checkNotes(files);
  const sources = [...listFiles(root, ".emel"), ...listFiles(join(root, "tools"), ".ts").filter((f) => !relative(root, f).startsWith("tools/test/"))];
  const marks = sources.map((file) => relative(root, file)).flatMap((path) => findMarks(path, read(path)));
  return [...problems, ...checkMarks(marks, notes)];
}

// prek stashes unstaged changes but leaves untracked files in place, so the check would also read files the commit lacks.
// A failing git is a problem too: commit mode must not pass when it cannot tell.
export function checkUntracked(root: string, inputs: Iterable<string>): Problem[] {
  let git: RunResult;
  try {
    // Explicit `process.env`: Bun's default is the environment at startup, and the test clears git's hook variables from process.env.
    const proc = Bun.spawnSync(["git", "ls-files", "-z", "--others", "--exclude-standard"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe" });
    git = { code: proc.exitCode ?? 1, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
  } catch (error) {
    git = { code: 127, stdout: "", stderr: (error as Error).message };
  }
  if (git.code !== 0) {
    return [{ kind: "untracked", path: ".", message: "git ls-files が失敗した。commit に入っていない検査対象を確かめられない", detail: git.stderr }];
  }
  const untracked = new Set(git.stdout.split("\0"));
  return [...inputs]
    .filter((path) => untracked.has(path))
    .sort()
    .map((path) => ({ kind: "untracked" as const, path, message: "commit に入っていない。`git add` するか消す" }));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--commit" && arg !== "--test")) {
    console.error("使い方: mise exec -- bun tools/check.ts [--commit] [--test]");
    process.exit(1);
  }
  const problems = runCheck(ROOT, { commit: args.includes("--commit"), test: args.includes("--test") });
  if (problems.length === 0) {
    console.log("tools/check: ok");
  } else {
    console.log(formatProblems(problems));
    process.exit(1);
  }
}
