#!/usr/bin/env bun
// The single entry of every check: run by the agent hooks after edits and at the end of a turn, and by prek on commit.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseEmelaVersion, pinnedEmelaVersion, runEmela } from "./lib/emela";
import { checkMarks, checkNotes, findMarks } from "./lib/friction";
import { lintSource, parseAllowlist } from "./lib/lint";
import { findPomes, LINT_POMES, listFiles } from "./lib/pomes";
import { formatProblems, type Problem } from "./lib/report";

export const ROOT = resolve(import.meta.dir, "..");
const ALLOWLIST = "tools/lint/foundation.allow";

export function runCheck(root: string): Problem[] {
  return [...checkVersion(root), ...checkPomes(root), ...checkLint(root), ...checkFriction(root)];
}

function checkVersion(root: string): Problem[] {
  const pinned = pinnedEmelaVersion(readFileSync(join(root, "mise.toml"), "utf8"));
  if (!pinned) return [{ kind: "version", path: "mise.toml", message: '"github:emela-lang/emela" の版が書かれていない' }];
  const result = runEmela(["--version"], root);
  const actual = parseEmelaVersion(result.stdout);
  if (result.code !== 0 || !actual) {
    return [{ kind: "version", path: "mise.toml", message: "emela --version が読めない。`mise install` を実行する", detail: result.stderr }];
  }
  if (actual !== pinned) return [{ kind: "version", path: "mise.toml", message: `emela ${actual} が使われている。固定しているのは ${pinned}` }];
  return [];
}

function checkPomes(root: string): Problem[] {
  const problems: Problem[] = [];
  for (const pome of findPomes(root)) {
    const dir = join(root, pome);
    const fmtPaths = ["src", "test"].filter((p) => existsSync(join(dir, p)));
    for (const args of [["fmt", "--check", ...fmtPaths], ["check", "."]]) {
      const result = runEmela(args, dir);
      if (result.code !== 0) {
        problems.push({ kind: "emela", path: join(pome, "Pome.toml"), message: `emela ${args.join(" ")} が失敗した`, detail: result.stdout + result.stderr });
      }
    }
  }
  return problems;
}

function checkLint(root: string): Problem[] {
  const { entries, problems } = parseAllowlist(readFileSync(join(root, ALLOWLIST), "utf8"), ALLOWLIST, (p) => existsSync(join(root, p)));
  const allowed = new Set(entries.map((e) => e.path));
  for (const pome of LINT_POMES) {
    if (!existsSync(join(root, pome, "Pome.toml"))) continue;
    for (const file of listFiles(join(root, pome, "src"), ".emel")) {
      const path = relative(root, file);
      if (!allowed.has(path)) problems.push(...lintSource(path, readFileSync(file, "utf8")));
    }
  }
  return problems;
}

function checkFriction(root: string): Problem[] {
  const dir = join(root, "friction");
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".md") && name !== "README.md")
        .sort()
        .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }))
    : [];
  const { notes, problems } = checkNotes(files);
  const sources = [...listFiles(root, ".emel"), ...listFiles(join(root, "tools"), ".ts").filter((f) => !relative(root, f).startsWith("tools/test/"))];
  const marks = sources.flatMap((file) => findMarks(relative(root, file), readFileSync(file, "utf8")));
  return [...problems, ...checkMarks(marks, notes)];
}

if (import.meta.main) {
  const problems = runCheck(ROOT);
  if (problems.length === 0) {
    console.log("tools/check: ok");
  } else {
    console.log(formatProblems(problems));
    process.exit(1);
  }
}
