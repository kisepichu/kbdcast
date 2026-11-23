import type { Problem } from "./report";

export const REQUIRED_FIELDS = ["状態", "Emela", "意図", "こう書きたかった", "診断", "回避策", "コスト", "spec", "既存", "行き先"];
export const STATES: Record<string, true> = { open: true, filed: true, resolved: true, dropped: true };
const NOTE_NAME = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const MARK = /FRICTION\((\d{3})\)/g;

export type Note = { number: string; path: string };
export type Mark = { number: string; path: string; line: number };

export function checkNotes(files: { name: string; text: string }[]): { notes: Note[]; problems: Problem[] } {
  const notes: Note[] = [];
  const problems: Problem[] = [];
  const seen = new Map<string, string>();
  for (const { name, text } of files) {
    const path = `friction/${name}`;
    const match = NOTE_NAME.exec(name);
    if (!match) {
      problems.push({ kind: "friction", path, message: "ファイル名は NNN-slug.md にする（3 桁の番号、小文字と - の slug）" });
      continue;
    }
    const number = match[1];
    const first = seen.get(number);
    if (first) {
      problems.push({ kind: "friction", path, message: `番号 ${number} が ${first} と重複している` });
    } else {
      seen.set(number, path);
    }
    const fields = parseFields(text);
    for (const field of REQUIRED_FIELDS) {
      if (!fields.get(field)) problems.push({ kind: "friction", path, message: `必須欄「${field}」が空か、無い` });
    }
    const state = fields.get("状態");
    if (state && STATES[state] !== true) {
      problems.push({ kind: "friction", path, message: `状態「${state}」は open、filed、resolved、dropped のどれかにする` });
    }
    notes.push({ number, path });
  }
  return { notes, problems };
}

// Reads the top-level `- 欄: 値` lines. An empty value continued on indented lines counts as filled.
export function parseFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  let current: string | undefined;
  for (const line of text.split("\n")) {
    const top = /^- ([^:：]+)[:：][ \t]*(.*)$/.exec(line);
    if (top) {
      current = top[1].trim();
      fields.set(current, top[2].trim());
    } else if (current !== undefined && /^[ \t]+\S/.test(line)) {
      if (fields.get(current) === "") fields.set(current, line.trim());
    } else {
      current = undefined;
    }
  }
  return fields;
}

export function findMarks(path: string, text: string): Mark[] {
  return text.split("\n").flatMap((line, index) => [...line.matchAll(MARK)].map((m) => ({ number: m[1], path, line: index + 1 })));
}

export function checkMarks(marks: Mark[], notes: Note[]): Problem[] {
  const known = new Set(notes.map((n) => n.number));
  return marks
    .filter((m) => !known.has(m.number))
    .map((m) => ({ kind: "friction" as const, path: m.path, line: m.line, message: `FRICTION(${m.number}) に対応する friction/${m.number}-*.md が無い` }));
}
