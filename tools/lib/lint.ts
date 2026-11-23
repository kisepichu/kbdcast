import type { Problem } from "./report";
import { scan } from "./scan";

// The foundation level of [intro.layers], plus the annotations that reach the host.
export const FOUNDATION_WORDS: Record<string, true> = {
  effect: true,
  handler: true,
  layer: true,
  suspend: true,
  trait: true,
  impl: true,
  fails: true,
  uses: true,
  "@external": true,
  "@export": true,
};

const FRICTION_MARK = /FRICTION\(\d{3}\)/;

export type AllowEntry = { path: string; reason: string };

export function parseAllowlist(
  text: string,
  file: string,
  exists: (path: string) => boolean,
): { entries: AllowEntry[]; problems: Problem[] } {
  const entries: AllowEntry[] = [];
  const problems: Problem[] = [];
  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const hash = line.indexOf("#");
    const path = (hash === -1 ? line : line.slice(0, hash)).trim();
    const reason = hash === -1 ? "" : line.slice(hash + 1).trim();
    if (reason === "") {
      problems.push({ kind: "allowlist", path: file, line: index + 1, message: `${path} に理由が無い（\`<path>  # <理由>\` の形で書く）` });
    } else if (!exists(path)) {
      problems.push({ kind: "allowlist", path: file, line: index + 1, message: `${path} が存在しない` });
    } else {
      entries.push({ path, reason });
    }
  });
  return { entries, problems };
}

// Reports each foundation-level word in code, unless a FRICTION mark covers its line:
// a mark on the same line, or on the nearest non-blank line above when that line is a comment only.
export function lintSource(path: string, source: string): Problem[] {
  const { words, comments, codeLines } = scan(source);
  const marked = new Set(comments.filter((c) => FRICTION_MARK.test(c.text)).map((c) => c.line));
  const commented = new Set(comments.map((c) => c.line));
  const reported = new Set<string>();
  const problems: Problem[] = [];
  for (const word of words) {
    if (FOUNDATION_WORDS[word.text] !== true) continue;
    const key = `${word.line}:${word.text}`;
    if (reported.has(key) || isCovered(word.line, marked, commented, codeLines)) continue;
    reported.add(key);
    problems.push({
      kind: "lint",
      path,
      line: word.line,
      message: `基盤レベルの \`${word.text}\`。設計として使うなら tools/lint/foundation.allow に理由と一緒に登録し、回り道なら FRICTION(NNN) を付けてメモを書く`,
    });
  }
  return problems;
}

function isCovered(line: number, marked: Set<number>, commented: Set<number>, codeLines: Set<number>): boolean {
  if (marked.has(line)) return true;
  for (let prev = line - 1; prev >= 1; prev--) {
    const hasCode = codeLines.has(prev);
    if (!hasCode && !commented.has(prev)) continue;
    return marked.has(prev) && !hasCode;
  }
  return false;
}
