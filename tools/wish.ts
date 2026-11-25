#!/usr/bin/env bun
// `mise exec -- bun tools/wish.ts check wish/<name>.emel`: checks a wish in place of the module it describes, in a copy of the repo,
// and writes the diagnostics into a block at the end of the wish.
// When no Pome.toml is above the wish-target yet, the copy gets a provisional one (see provisionalManifest).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseEmelaVersion, pinnedEmelaVersion, runEmela } from "./lib/emela";

const ROOT = resolve(import.meta.dir, "..");
const SKIP: Record<string, true> = { ".git": true, target: true, tmp: true, node_modules: true };
const BEGIN = "# --- wish check";
const END = "# --- end wish check ---";

export function readTarget(text: string): string | undefined {
  return /^#\s*wish-target:\s*(\S+)\s*$/m.exec(text)?.[1];
}

export function stripDiagnostics(text: string): string {
  const lines = text.split("\n");
  const begin = lines.findIndex((l) => l.startsWith(BEGIN));
  if (begin === -1) return text;
  const end = lines.findIndex((l, i) => i > begin && l === END);
  return `${[...lines.slice(0, begin), ...(end === -1 ? [] : lines.slice(end + 1))].join("\n").trimEnd()}\n`;
}

// `provisional` is the repo-relative path of a Pome.toml that the check placed in the copy, reported on the first line of the block.
export function withDiagnostics(body: string, version: string, output: string, provisional?: string): string {
  const diagnostics = output.trim() === "" ? ["# (診断なし)"] : output.trimEnd().split("\n").map((l) => (l === "" ? "#" : `# ${l}`));
  const note = provisional === undefined ? [] : [`# (Pome.toml は wish check が仮に置いた: ${provisional})`];
  return `${body.trimEnd()}\n\n${BEGIN} (emela ${version}) ---\n${[...note, ...diagnostics].join("\n")}\n${END}\n`;
}

// The Pome of a wish whose Pome does not exist yet: the directory before the first `src` or `test` segment of the target.
// Undefined when the target has neither segment.
export function provisionalManifest(target: string, emelaVersion: string): { path: string; text: string } | undefined {
  const segments = target.split("/");
  const at = segments.findIndex((s) => s === "src" || s === "test");
  if (at === -1) return undefined;
  const dir = segments.slice(0, at);
  const name = ["github.com/kisepichu/kbdcast", ...dir].join("/");
  return { path: [...dir, "Pome.toml"].join("/"), text: `[pome]\nname = "${name}"\nversion = "0.1.0"\nemela = "${emelaVersion}"\n` };
}

// The nearest directory from `from` up to `copy` that holds a Pome.toml.
function findPome(copy: string, from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "Pome.toml"))) return dir;
    // Stop at the filesystem root as well, in case the walk never meets `copy`.
    if (dir === copy || dirname(dir) === dir) return undefined;
  }
}

export function checkWish(root: string, wishPath: string): string {
  const file = resolve(root, wishPath);
  const body = stripDiagnostics(readFileSync(file, "utf8"));
  const target = readTarget(body);
  if (!target) throw new Error(`${wishPath}: 先頭に \`# wish-target: <repo からの相対パス>\` が無い`);
  const copy = mkdtempSync(join(tmpdir(), "kbdcast-wish-"));
  try {
    cpSync(root, copy, { recursive: true, filter: (src) => src === root || SKIP[basename(src)] !== true });
    const placed = join(copy, target);
    // `join` normalizes `..`, so a target like `../x.emel` would land outside the copy.
    const rel = relative(copy, placed);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${target} が repo の外を指している`);
    mkdirSync(dirname(placed), { recursive: true });
    writeFileSync(placed, body);
    let pome = findPome(copy, dirname(placed));
    let provisional: string | undefined;
    if (pome === undefined) {
      const pinned = pinnedEmelaVersion(readFileSync(join(root, "mise.toml"), "utf8"));
      if (!pinned) throw new Error('mise.toml に "github:emela-lang/emela" の版が書かれていない');
      // `rel` is the target normalized, so `./text/src/a.emel` still names the Pome `text`.
      const manifest = provisionalManifest(rel, pinned);
      if (!manifest) throw new Error(`${target} を含む Pome（Pome.toml）が無い`);
      writeFileSync(join(copy, manifest.path), manifest.text);
      pome = dirname(join(copy, manifest.path));
      provisional = manifest.path;
    }
    const install = runEmela(["pome", "install"], pome);
    const check = runEmela(["check", "."], pome);
    const output = `${install.code === 0 ? "" : install.stdout + install.stderr}${check.stdout}${check.stderr}`.replaceAll(copy, "<repo>");
    const version = parseEmelaVersion(runEmela(["--version"], root).stdout) ?? "unknown";
    writeFileSync(file, withDiagnostics(body, version, output, provisional));
    return output;
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [command, wishPath] = process.argv.slice(2);
  if (command !== "check" || !wishPath) {
    console.error("使い方: mise exec -- bun tools/wish.ts check wish/<name>.emel");
    process.exit(1);
  }
  try {
    const output = checkWish(ROOT, wishPath);
    console.log(output.trim() === "" ? `${wishPath}: 診断なし` : output.trimEnd());
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
