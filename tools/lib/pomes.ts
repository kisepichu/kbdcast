import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP: Record<string, true> = { ".git": true, target: true, tmp: true, node_modules: true };

// The Pomes whose `src/` must stay at the everyday level (repo root = core).
export const LINT_POMES = [".", "regex", "cli"];

// Files under `dir` ending with `ext`, skipping build output, scratch space and dot directories.
export function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP[entry.name] === true || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, ext));
    else if (entry.name.endsWith(ext)) files.push(path);
  }
  return files;
}

// Directories (relative to `root`, "." for the root) that hold a Pome.toml.
export function findPomes(root: string): string[] {
  return listFiles(root, "Pome.toml").map((file) => relative(root, join(file, "..")) || ".");
}
