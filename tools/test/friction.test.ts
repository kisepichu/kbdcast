import { describe, expect, test } from "bun:test";
import { checkMarks, checkNotes, findMarks } from "../lib/friction";

const FIELDS: Record<string, string> = {
  状態: "open",
  Emela: "v0.28.2",
  意図: "PTY の出力を Bytes で受け取る",
  こう書きたかった: "wish/pty.emel",
  診断: "なし",
  回避策: "なし",
  コスト: "なし",
  spec: "[ext.boundary]",
  既存: "なし",
  行き先: "issue",
};
const note = (overrides: Record<string, string> = {}) =>
  `# 001 slug\n\n${Object.entries({ ...FIELDS, ...overrides })
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n")}\n`;

describe("checkNotes", () => {
  test("accepts a complete note", () => {
    expect(checkNotes([{ name: "001-slug.md", text: note() }]).problems).toEqual([]);
  });

  test("reports an empty required field", () => {
    const { problems } = checkNotes([{ name: "001-slug.md", text: note({ 回避策: "" }) }]);
    expect(problems.map((p) => p.message)).toEqual(["必須欄「回避策」が空か、無い"]);
  });

  test("accepts a value continued on indented lines", () => {
    const text = note().replace("- 診断: なし", "- 診断:\n  error[E0443]: Bytes at the C boundary");
    expect(checkNotes([{ name: "001-slug.md", text }]).problems).toEqual([]);
  });

  test("reports a state outside the four", () => {
    const { problems } = checkNotes([{ name: "001-slug.md", text: note({ 状態: "wip" }) }]);
    expect(problems.map((p) => p.message)).toEqual(["状態「wip」は open、filed、resolved、dropped のどれかにする"]);
  });

  test("reports a duplicate number and a malformed name", () => {
    const { problems } = checkNotes([
      { name: "001-a.md", text: note() },
      { name: "001-b.md", text: note() },
      { name: "1-c.md", text: note() },
    ]);
    expect(problems.map((p) => p.path)).toEqual(["friction/001-b.md", "friction/1-c.md"]);
  });
});

describe("marks", () => {
  test("a mark without a note is reported at its line", () => {
    const marks = findMarks("src/a.emel", "x = 1 # FRICTION(001)\ny = 2 # FRICTION(002)\n");
    const problems = checkMarks(marks, [{ number: "001", path: "friction/001-a.md" }]);
    expect(problems.map((p) => `${p.path}:${p.line}`)).toEqual(["src/a.emel:2"]);
  });
});
