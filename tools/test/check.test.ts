import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkUntracked } from "../check";
import type { Problem } from "../lib/report";

// prek runs this suite from git's pre-commit hook, which exports GIT_INDEX_FILE (an absolute path for `git commit <paths>`).
// Clear the GIT_* variables so every git command here, including the one in checkUntracked, stays in the throwaway repo,
// and stop repository discovery at tmpdir() so a non-repo stays a non-repo.
const saved: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const key of Object.keys(process.env).filter((k) => k.startsWith("GIT_"))) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.GIT_CEILING_DIRECTORIES = tmpdir();
});
afterAll(() => {
  delete process.env.GIT_CEILING_DIRECTORIES;
  Object.assign(process.env, saved);
});

function git(cwd: string, ...args: string[]): void {
  const proc = Bun.spawnSync(["git", ...args], { cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`);
}

const lines = (problems: Problem[]) => problems.map((p) => `${p.kind} ${p.path}: ${p.message}`);

describe("checkUntracked", () => {
  test("reports a checked file that is not in the commit, and not one that is", () => {
    const root = mkdtempSync(join(tmpdir(), "kbdcast-check-test-"));
    try {
      git(root, "init", "-q");
      mkdirSync(join(root, "friction"));
      writeFileSync(join(root, "friction", "001-a.md"), "# 001 a\n");
      writeFileSync(join(root, "friction", "002-b.md"), "# 002 b\n");
      git(root, "add", "friction/001-a.md");
      expect(lines(checkUntracked(root, ["friction/001-a.md", "friction/002-b.md"]))).toEqual([
        "untracked friction/002-b.md: commit に入っていない。`git add` するか消す",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a failing git is reported instead of passing", () => {
    const root = mkdtempSync(join(tmpdir(), "kbdcast-check-test-"));
    try {
      writeFileSync(join(root, "a.emel"), "fn f() { 1 }\n");
      expect(lines(checkUntracked(root, ["a.emel"]))).toEqual(["untracked .: git ls-files が失敗した。commit に入っていない検査対象を確かめられない"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
