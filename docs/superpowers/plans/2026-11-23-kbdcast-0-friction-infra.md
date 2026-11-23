# サブプロジェクト 0: 回り道を記録する仕組み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emela のコードを書く前に、回り道を機械的に検知して記録させる道具（検査、wish check、agent の hook、prek）と規則の文書を置く。

**Architecture:** 検査は `tools/check.ts` の 1 つの入口にまとめ、Claude Code の hook、omp の hook、prek の 3 か所から同じものを呼ぶ。検査の部品（字句の読み取り、lint、friction のメモの検査、emela の呼び出し）は `tools/lib/` の小さなモジュールに分け、`bun test` で振る舞いを確かめる。wish check は repo を一時ディレクトリに写し、wish を置く予定の場所に書いてから `emela check` する。

**Tech Stack:** Bun 1.4.3 で TypeScript を直接実行（npm の依存なし）、Emela 0.28.2（mise の `github:` backend）、prek 0.4.1。

**Spec:** `docs/superpowers/specs/2026-11-23-kbdcast-0-friction-infra-design.md`

## Global Constraints

- 道具はすべて mise で固定する: `bun = "1.4.3"`、`prek = "0.4.1"`、`"github:emela-lang/emela" = "0.28.2"`。Emela の版を書くのは `mise.toml` だけ。
- `[env]` に `EMELA_JS_HOST = "bun"` を置く。
- `tools/` は Bun 上の TypeScript で、npm の依存を足さない。
- コードのコメントは英語、利用者に出すメッセージと文書は日本語。
- hook と prek からは `mise exec -- bun ...` で呼ぶ（PATH に固定した版の emela と bun が来るようにするため）。
- commit は main に直接積む。message は `type: 日本語の説明`。`git commit --no-gpg-sign` を使う。
- 外向きの操作（emela への issue や PR）はしない。

## File Structure

| ファイル | 責務 |
|---|---|
| `mise.toml` | 道具の版と `EMELA_JS_HOST` |
| `.gitignore` | `tmp/`、`target/`、`.claude/settings.local.json` |
| `tools/lib/report.ts` | 問題の型 `Problem` と表示 |
| `tools/lib/scan.ts` | Emela のソースのコード部分の単語とコメントを、行番号付きで取り出す |
| `tools/lib/lint.ts` | 基盤レベルの単語の検出、`foundation.allow` の読み取り |
| `tools/lib/friction.ts` | friction のメモの検査、`FRICTION(NNN)` の印の収集と照合 |
| `tools/lib/emela.ts` | emela の呼び出し（glibc の警告の filter）、版の読み取り |
| `tools/lib/pomes.ts` | ファイルと Pome の発見、lint の対象の Pome |
| `tools/check.ts` | 検査の入口 |
| `tools/wish.ts` | wish check |
| `tools/hooks/claude.ts` | Claude Code の hook の入口 |
| `tools/lint/foundation.allow` | 基盤レベルを使ってよいモジュールの一覧 |
| `tools/test/*.test.ts` | `bun test` |
| `friction/README.md`、`friction/001-release-binary-glibc.md` | メモの雛形と最初のメモ |
| `wish/README.md` | wish の書き方 |
| `.claude/settings.json` | Claude Code の hook |
| `.omp/hooks/post/kbdcast-check.ts` | omp の hook |
| `AGENTS.md`、`CLAUDE.md` | 規則 |
| `.agents/skills/friction-review/SKILL.md`、`.claude/skills/friction-review`（symlink） | レビュー用の skill |
| `.pre-commit-config.yaml` | prek |

---

### Task 1: 道具の固定と ignore

**Files:**
- Create: `mise.toml`
- Create: `.gitignore`

**Interfaces:**
- Produces: `mise exec -- emela`、`mise exec -- bun`、`mise exec -- prek` が固定した版で動く。後のタスクの `tools/lib/emela.ts` が `mise.toml` の `"github:emela-lang/emela" = "<版>"` の行を読む。

- [ ] **Step 1: `mise.toml` を書く**

```toml
[tools]
bun = "1.4.3"
prek = "0.4.1"
"github:emela-lang/emela" = "0.28.2"

[env]
EMELA_JS_HOST = "bun"
```

- [ ] **Step 2: `.gitignore` を書く**

```gitignore
tmp/
target/
.claude/settings.local.json
```

- [ ] **Step 3: mise に信頼させて入れる**

Run: `mise trust mise.toml && mise install`
Expected: エラーなく終わる（入っていれば何もしない）。

- [ ] **Step 4: 版を確かめる**

Run: `mise exec -- emela --version 2>/dev/null && mise exec -- bun --version && mise exec -- prek --version`
Expected:

```text
emela 0.28.2+9d052d2
1.4.3
prek 0.4.1
```

（emela は stderr に `weak version 'GLIBC_2.39' not found` を出すが、これは friction 001 で扱う。`2>/dev/null` で隠している）

- [ ] **Step 5: Commit**

```bash
git add mise.toml .gitignore
git commit --no-gpg-sign -m "chore: Bun、prek、Emela 0.28.2 を mise で固定する"
```

---

### Task 2: Emela のソースを読む scanner

**Files:**
- Create: `tools/lib/report.ts`
- Create: `tools/lib/scan.ts`
- Test: `tools/test/scan.test.ts`

**Interfaces:**
- Produces:
  - `type Problem = { kind: "version" | "emela" | "lint" | "allowlist" | "friction"; path: string; line?: number; message: string; detail?: string }`
  - `formatProblems(problems: Problem[]): string`
  - `type Word = { text: string; line: number }`、`type Comment = { text: string; line: number }`
  - `scan(source: string): { words: Word[]; comments: Comment[]; codeLines: Set<number> }`。`words` はコード部分の識別子と `@` 付きの注釈。`comments.text` は `#` の後ろ。`codeLines` はコード（文字列を含む）がある行。

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/scan.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { scan } from "../lib/scan";

const words = (src: string) => scan(src).words.map((w) => `${w.line}:${w.text}`);

describe("scan", () => {
  test("keywords in comments and strings are not words", () => {
    expect(words(["# effect in a comment", 'x = "handler in a string"', "fn f() { 1 }"].join("\n"))).toEqual(["2:x", "3:fn", "3:f"]);
  });

  test("code inside an interpolation is read, including nested strings", () => {
    expect(words('x = "a #{ uses("b #{effect}") } c"')).toEqual(["1:x", "1:uses", "1:effect"]);
  });

  test("an escaped quote and an escaped hash stay inside the string", () => {
    expect(words('x = "q\\" \\#{ handler } r"\ny = suspend')).toEqual(["1:x", "2:y", "2:suspend"]);
  });

  test("a multiline string ends only at a line holding just the closing quotes", () => {
    expect(words(['x = """', '  layer """ inside', "  #{trait}", '  """', "impl"].join("\n"))).toEqual(["1:x", "3:trait", "5:impl"]);
  });

  test("a comment inside an interpolation is a comment", () => {
    const result = scan('x = "#{ a # effect\n }"');
    expect(result.words.map((w) => w.text)).toEqual(["x", "a"]);
    expect(result.comments).toEqual([{ text: " effect", line: 1 }]);
  });

  test("annotations are words", () => {
    expect(words('@external(js, "f")\nfn f() -> () uses {}')).toEqual(["1:@external", "1:js", "2:fn", "2:f", "2:uses"]);
  });

  test("code lines exclude blank lines and comment-only lines", () => {
    expect([...scan("# c\n\nx = 1 # d\n").codeLines]).toEqual([3]);
  });
});
```

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/scan.test.ts`
Expected: FAIL（`Cannot find module '../lib/scan'`）

- [ ] **Step 3: `tools/lib/report.ts` を書く**

```ts
export type Problem = {
  kind: "version" | "emela" | "lint" | "allowlist" | "friction";
  path: string;
  line?: number;
  message: string;
  detail?: string;
};

export function formatProblems(problems: Problem[]): string {
  return problems
    .map((p) => {
      const head = `${p.kind} ${p.line === undefined ? p.path : `${p.path}:${p.line}`}: ${p.message}`;
      if (!p.detail?.trim()) return head;
      const body = p.detail
        .trimEnd()
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      return `${head}\n${body}`;
    })
    .join("\n");
}
```

- [ ] **Step 4: `tools/lib/scan.ts` を書く**

```ts
// Reads just enough of Emela's lexical structure to tell code from comments and strings.
// It does not report lexical errors: `emela check` does that.

export type Word = { text: string; line: number };
export type Comment = { text: string; line: number };
export type Scan = { words: Word[]; comments: Comment[]; codeLines: Set<number> };

export function scan(source: string): Scan {
  const scanner = new Scanner(source);
  scanner.code(false);
  return { words: scanner.words, comments: scanner.comments, codeLines: scanner.codeLines };
}

class Scanner {
  readonly words: Word[] = [];
  readonly comments: Comment[] = [];
  readonly codeLines = new Set<number>();
  private i = 0;
  private line = 1;

  constructor(private readonly src: string) {}

  // Reads code to the end of the input, or, inside an interpolation, to the `}` that closes it.
  code(inInterpolation: boolean): void {
    let depth = 0;
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\n" || ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }
      if (ch === "#") {
        this.comment();
        continue;
      }
      this.codeLines.add(this.line);
      if (this.src.startsWith('"""', this.i)) {
        this.multilineString();
      } else if (ch === '"') {
        this.string();
      } else if (ch === "{") {
        depth++;
        this.advance();
      } else if (ch === "}") {
        this.advance();
        if (inInterpolation && depth === 0) return;
        depth--;
      } else if (ch === "@" || /[A-Za-z_]/.test(ch)) {
        this.word();
      } else {
        this.advance();
      }
    }
  }

  private peek(): string {
    return this.src[this.i] ?? "";
  }

  private advance(): string {
    const ch = this.src[this.i++] ?? "";
    if (ch === "\n") this.line++;
    return ch;
  }

  private word(): void {
    const line = this.line;
    let text = this.advance();
    while (/[A-Za-z0-9_]/.test(this.peek())) text += this.advance();
    this.words.push({ text, line });
  }

  private comment(): void {
    const line = this.line;
    this.advance();
    let text = "";
    while (this.i < this.src.length && this.peek() !== "\n") text += this.advance();
    this.comments.push({ text: text.replace(/\r$/, ""), line });
  }

  private string(): void {
    this.advance();
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\n") return; // an unterminated string (E0101) ends at the line break
      if (ch === "\\") {
        this.advance();
        this.advance();
      } else if (ch === '"') {
        this.advance();
        return;
      } else if (this.src.startsWith("#{", this.i)) {
        this.i += 2;
        this.code(true);
      } else {
        this.advance();
      }
    }
  }

  private multilineString(): void {
    this.i += 3;
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\\") {
        this.advance();
        this.advance();
      } else if (this.src.startsWith('"""', this.i) && this.onlyIndentBefore()) {
        this.i += 3;
        return;
      } else if (this.src.startsWith("#{", this.i)) {
        this.codeLines.add(this.line);
        this.i += 2;
        this.code(true);
      } else {
        if (ch !== "\n" && ch !== " " && ch !== "\t") this.codeLines.add(this.line);
        this.advance();
      }
    }
  }

  // The closing `"""` of a multiline string stands alone on its line, after the indentation.
  private onlyIndentBefore(): boolean {
    let j = this.i - 1;
    while (j >= 0 && (this.src[j] === " " || this.src[j] === "\t")) j--;
    return j < 0 || this.src[j] === "\n";
  }
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `mise exec -- bun test tools/test/scan.test.ts`
Expected: `7 pass`、`0 fail`

- [ ] **Step 6: Commit**

```bash
git add tools/lib/report.ts tools/lib/scan.ts tools/test/scan.test.ts
git commit --no-gpg-sign -m "feat: lint のために Emela のコードとコメントと文字列を見分ける scanner を足す"
```

---

### Task 3: 基盤レベルの lint

**Files:**
- Create: `tools/lib/lint.ts`
- Create: `tools/lint/foundation.allow`
- Test: `tools/test/lint.test.ts`

**Interfaces:**
- Consumes: `scan`（Task 2）、`Problem`（Task 2）
- Produces:
  - `FOUNDATION_WORDS: Record<string, true>`
  - `type AllowEntry = { path: string; reason: string }`
  - `parseAllowlist(text: string, file: string, exists: (path: string) => boolean): { entries: AllowEntry[]; problems: Problem[] }`
  - `lintSource(path: string, source: string): Problem[]`

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/lint.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { lintSource, parseAllowlist } from "../lib/lint";

const lines = (src: string) => lintSource("src/a.emel", src).map((p) => p.line);
const USES = "fn g() -> () uses { Log } { () }";

describe("lintSource", () => {
  test("reports a foundation-level keyword in code", () => {
    expect(lines("effect Log {\n  fn log(text: String) -> ()\n}")).toEqual([1]);
  });

  test("tells use (everyday) from uses (foundation)", () => {
    expect(lines(`fn f() {\n  (use Log).log("x")\n}\n${USES}`)).toEqual([4]);
  });

  test("reports @external and @export", () => {
    expect(lines('@external(js, "f")\nfn f() -> ()\n@export\nfn g() { 1 }')).toEqual([1, 3]);
  });

  test("a FRICTION mark on the same line covers it", () => {
    expect(lines(`${USES} # FRICTION(001)`)).toEqual([]);
  });

  test("a FRICTION mark on the comment line above covers it, across blank lines", () => {
    expect(lines(`# FRICTION(002): reason\n\n${USES}`)).toEqual([]);
  });

  test("a FRICTION mark above another code line does not cover it", () => {
    expect(lines(`# FRICTION(002)\nx = 1\n${USES}`)).toEqual([3]);
  });

  test("a mark without three digits does not count", () => {
    expect(lines(`# FRICTION(NNN)\n${USES}`)).toEqual([2]);
  });
});

describe("parseAllowlist", () => {
  const exists = (p: string) => p === "src/driver.emel";

  test("reads entries with their reasons", () => {
    const result = parseAllowlist("# header\n\nsrc/driver.emel  # the domain port of the recorder\n", "tools/lint/foundation.allow", exists);
    expect(result).toEqual({ entries: [{ path: "src/driver.emel", reason: "the domain port of the recorder" }], problems: [] });
  });

  test("rejects an entry without a reason and a path that does not exist", () => {
    const result = parseAllowlist("src/driver.emel\nsrc/gone.emel  # reason\n", "tools/lint/foundation.allow", exists);
    expect(result.entries).toEqual([]);
    expect(result.problems.map((p) => p.line)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/lint.test.ts`
Expected: FAIL（`Cannot find module '../lib/lint'`）

- [ ] **Step 3: `tools/lib/lint.ts` を書く**

```ts
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
```

- [ ] **Step 4: `tools/lint/foundation.allow` を書く**

```text
# core、regex、cli の src/ で基盤レベル（effect handler layer suspend trait impl fails uses @external @export）を使ってよいモジュール。
# 設計として選んだもの（ドメインの port にする effect など）だけを登録する。回り道は FRICTION(NNN) とメモで記録する。
# 形式: <repo からの相対パス>  # <理由>
```

- [ ] **Step 5: 通ることを確かめる**

Run: `mise exec -- bun test tools/test/lint.test.ts`
Expected: `9 pass`、`0 fail`

- [ ] **Step 6: Commit**

```bash
git add tools/lib/lint.ts tools/lint/foundation.allow tools/test/lint.test.ts
git commit --no-gpg-sign -m "feat: 普段のコードに基盤レベルが出たら止める lint を足す"
```

---

### Task 4: friction のメモと印の検査

**Files:**
- Create: `tools/lib/friction.ts`
- Create: `friction/README.md`
- Create: `friction/001-release-binary-glibc.md`
- Test: `tools/test/friction.test.ts`

**Interfaces:**
- Consumes: `Problem`（Task 2）
- Produces:
  - `REQUIRED_FIELDS: string[]`、`STATES: Record<string, true>`
  - `type Note = { number: string; path: string }`、`type Mark = { number: string; path: string; line: number }`
  - `checkNotes(files: { name: string; text: string }[]): { notes: Note[]; problems: Problem[] }`（`name` は `friction/` からのファイル名）
  - `parseFields(text: string): Map<string, string>`
  - `findMarks(path: string, text: string): Mark[]`
  - `checkMarks(marks: Mark[], notes: Note[]): Problem[]`

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/friction.test.ts`:

```ts
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
```

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/friction.test.ts`
Expected: FAIL（`Cannot find module '../lib/friction'`）

- [ ] **Step 3: `tools/lib/friction.ts` を書く**

```ts
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
```

- [ ] **Step 4: 通ることを確かめる**

Run: `mise exec -- bun test tools/test/friction.test.ts`
Expected: `6 pass`、`0 fail`

- [ ] **Step 5: `friction/README.md` を書く**

````md
# friction

Emela で回り道をした記録。1 つのファイルに 1 つの論点だけを書く（proposal の「1 draft に 1 決定」に揃える）。

## ファイル

- 名前は `NNN-slug.md`。NNN は 3 桁の連番で重複させない。slug は小文字と `-`。
- コードの回避箇所には `# FRICTION(NNN)` を付ける（その行か、直前のコメント行）。印のある番号にはメモが要る（`tools/check.ts` が検査する）。
- コードの外の friction（道具、ドキュメント）は、印なしでよい。

## 雛形

欄はすべて必須。分からなければ「なし」と書く。値は次の行から字下げして続けてもよい。

```md
# NNN slug

- 状態: open
- Emela: v0.28.2
- 意図: 何をしたかったか
- こう書きたかった: wish/<name>.emel の該当部分、またはコード
- 診断: 出た診断（E0443 など）
- 回避策: 実際にどう書いたか
- コスト: 行数 / 性能 / 普段のコードに基盤レベルが漏れたか
- spec: 関係する節（[ext.boundary] など）
- 既存: 関係する open question / issue / proposal
- 行き先: 分類と、提出したものへのリンク
```

## 状態

| 状態 | 意味 |
|---|---|
| `open` | 記録しただけ |
| `filed` | issue や proposal などを出した |
| `resolved` | 解消した（版を上げたら書けるようになった、自分の誤解だった、など） |
| `dropped` | 前提（`[intro.premises]`）に反するなどで捨てた。コストの記録は残す |

## 分類と行き先

| 分類 | 行き先 |
|---|---|
| 自分の誤解だった | ドキュメントや診断メッセージの改善（emela の `spec/diagnostics.md`） |
| spec と実装がずれている、またはバグ | issue |
| 既に知られている制限（`open-questions.md`、Known limitations） | 実際の使い道を添えて issue にするか、既存のものに足す |
| 前提の範囲内で spec に足りない | proposal の下書き（emela の `emela-proposal` skill で詰める） |
| 前提に反する | 捨てる。コストだけ残す |

emela に issue や proposal を出す前に、user に確認する。

## 見直し

Emela の版を上げたら、`open` と `filed` のメモをすべて見直す。解消したものは `resolved` にする。
````

- [ ] **Step 6: `friction/001-release-binary-glibc.md` を書く**

```md
# 001 release-binary-glibc

- 状態: open
- Emela: v0.28.2
- 意図: mise の `github:emela-lang/emela` で公式のリリースを固定し、そのまま使う
- こう書きたかった: `mise.toml` に `"github:emela-lang/emela" = "0.28.2"` と書くだけで、警告なく動く
- 診断:
  呼ぶたびに stderr に `` /…/emela: /lib/x86_64-linux-gnu/libc.so.6: weak version `GLIBC_2.39' not found (required by /…/emela) `` が出る。Ubuntu 22.04（glibc 2.35）。`check` も `run` も動く。要求しているのは weak シンボルの `pidfd_spawnp` と `pidfd_getpid`（`objdump -T` で確認）
- 回避策: `tools/lib/emela.ts` で、この行を stderr から取り除く（`FRICTION(001)` の印）
- コスト: 道具に filter が 1 つ。手で emela を呼ぶと毎回警告が出る
- spec: なし（README の Install は「Linux (x86_64)」とだけ書き、glibc の要件を書いていない）
- 既存: issue は無い（「GLIBC」「glibc」で検索、2026-11-23）。release は `.github/workflows/release-plz.yml` で `ubuntu-latest` を使って build している
- 行き先: spec と実装のずれ → issue（未提出。出す前に user に確認する）
```

- [ ] **Step 7: Commit**

```bash
git add tools/lib/friction.ts tools/test/friction.test.ts friction/README.md friction/001-release-binary-glibc.md
git commit --no-gpg-sign -m "feat: friction のメモと FRICTION の印を検査し、最初のメモ（glibc）を書く"
```

---

### Task 5: emela の呼び出しと検査の入口

**Files:**
- Create: `tools/lib/emela.ts`
- Create: `tools/lib/pomes.ts`
- Create: `tools/check.ts`
- Test: `tools/test/emela.test.ts`

**Interfaces:**
- Consumes: `Problem`、`formatProblems`（Task 2）、`lintSource`、`parseAllowlist`（Task 3）、`checkNotes`、`findMarks`、`checkMarks`（Task 4）
- Produces:
  - `type RunResult = { code: number; stdout: string; stderr: string }`
  - `stripLoaderWarning(stderr: string): string`、`runEmela(args: string[], cwd: string): RunResult`
  - `parseEmelaVersion(output: string): string | undefined`、`pinnedEmelaVersion(miseToml: string): string | undefined`
  - `LINT_POMES: string[]`、`listFiles(dir: string, ext: string): string[]`（絶対パス）、`findPomes(root: string): string[]`（root からの相対、root は `"."`）
  - `ROOT: string`、`runCheck(root: string): Problem[]`（`tools/check.ts` から export）

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/emela.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseEmelaVersion, pinnedEmelaVersion, stripLoaderWarning } from "../lib/emela";

test("the glibc loader warning is removed and other stderr is kept", () => {
  const stderr =
    "/x/emela: /lib/x86_64-linux-gnu/libc.so.6: weak version `GLIBC_2.39' not found (required by /x/emela)\nerror[E0205]: cannot find module\n";
  expect(stripLoaderWarning(stderr)).toBe("error[E0205]: cannot find module\n");
});

test("the running version and the pinned version are read", () => {
  expect(parseEmelaVersion("emela 0.28.2+9d052d2\n")).toBe("0.28.2");
  expect(pinnedEmelaVersion('[tools]\nbun = "1.4.3"\n"github:emela-lang/emela" = "0.28.2"\n')).toBe("0.28.2");
});
```

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/emela.test.ts`
Expected: FAIL（`Cannot find module '../lib/emela'`）

- [ ] **Step 3: `tools/lib/emela.ts` を書く**

```ts
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
```

- [ ] **Step 4: 通ることを確かめる**

Run: `mise exec -- bun test tools/test/emela.test.ts`
Expected: `2 pass`、`0 fail`

- [ ] **Step 5: `tools/lib/pomes.ts` を書く**

```ts
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
```

- [ ] **Step 6: `tools/check.ts` を書く**

```ts
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
```

Run: `chmod +x tools/check.ts`

- [ ] **Step 7: この repo で通ることを確かめる**

Run: `mise exec -- bun tools/check.ts`
Expected: `tools/check: ok`（Pome はまだ無い。`tools/lib/emela.ts` の `FRICTION(001)` は `friction/001-release-binary-glibc.md` と対応している）

- [ ] **Step 8: 使い捨ての repo で失敗の形を確かめる（smoke、commit しない）**

```bash
T=$(mktemp -d)
cp -r tools mise.toml friction "$T"/
cd "$T" && mise trust -q mise.toml
printf '[pome]\nname = "github.com/kisepichu/kbdcast-fixture"\nversion = "0.1.0"\nemela = "0.28.2"\n' > Pome.toml
mkdir -p src && printf 'effect Log {\n  fn log(text: String) -> ()\n}\n\nfn main() {\n  ()\n}\n' > src/main.emel
mise exec -- emela pome install 2>/dev/null
mise exec -- bun tools/check.ts || echo "exit=$?"
```

Expected:

```text
lint src/main.emel:1: 基盤レベルの `effect`。設計として使うなら tools/lint/foundation.allow に理由と一緒に登録し、回り道なら FRICTION(NNN) を付けてメモを書く
exit=1
```

続けて、allowlist で通ることと、emela check の失敗が載ることを確かめる:

```bash
printf 'src/main.emel  # fixture\n' >> tools/lint/foundation.allow
mise exec -- bun tools/check.ts || echo "exit=$?"
printf 'fn main() {\n  x\n}\n' > src/main.emel
mise exec -- bun tools/check.ts || echo "exit=$?"
cd - >/dev/null && rm -rf "$T"
```

Expected: 1 回目は `tools/check: ok`。2 回目は `emela Pome.toml: emela check . が失敗した` の下に `error[E0211]: cannot find value \`x\` in this scope` を含むブロックが出て `exit=1`。

- [ ] **Step 9: Commit**

```bash
git add tools/lib/emela.ts tools/lib/pomes.ts tools/check.ts tools/test/emela.test.ts
git commit --no-gpg-sign -m "feat: 版、各 Pome の fmt と check、lint、friction をまとめて走らせる tools/check.ts を足す"
```

---

### Task 6: wish check

**Files:**
- Create: `tools/wish.ts`
- Create: `wish/README.md`
- Test: `tools/test/wish.test.ts`

**Interfaces:**
- Consumes: `runEmela`、`parseEmelaVersion`（Task 5）
- Produces:
  - `readTarget(text: string): string | undefined`
  - `stripDiagnostics(text: string): string`
  - `withDiagnostics(body: string, version: string, output: string): string`
  - `checkWish(root: string, wishPath: string): string`（emela の出力を返し、wish ファイルの診断ブロックを書き換える）

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/wish.test.ts`:

```ts
import { expect, test } from "bun:test";
import { readTarget, stripDiagnostics, withDiagnostics } from "../wish";

const BODY = "# wish-target: src/a.emel\nfn f() { 1 }\n";

test("the target is read from the header", () => {
  expect(readTarget(BODY)).toBe("src/a.emel");
  expect(readTarget("fn f() { 1 }\n")).toBeUndefined();
});

test("checking again replaces the diagnostics block instead of adding one", () => {
  const once = withDiagnostics(BODY, "0.28.2", "error[E0205]: x\n\n1 error\n");
  expect(once).toBe(`${BODY}\n# --- wish check (emela 0.28.2) ---\n# error[E0205]: x\n#\n# 1 error\n# --- end wish check ---\n`);
  const twice = withDiagnostics(stripDiagnostics(once), "0.28.2", "");
  expect(twice).toBe(`${BODY}\n# --- wish check (emela 0.28.2) ---\n# (診断なし)\n# --- end wish check ---\n`);
});
```

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/wish.test.ts`
Expected: FAIL（`Cannot find module '../wish'`）

- [ ] **Step 3: `tools/wish.ts` を書く**

```ts
#!/usr/bin/env bun
// `bun tools/wish.ts check wish/<name>.emel`: checks a wish in place of the module it describes, in a copy of the repo,
// and writes the diagnostics into a block at the end of the wish.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseEmelaVersion, runEmela } from "./lib/emela";

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

export function withDiagnostics(body: string, version: string, output: string): string {
  const diagnostics = output.trim() === "" ? ["# (診断なし)"] : output.trimEnd().split("\n").map((l) => (l === "" ? "#" : `# ${l}`));
  return `${body.trimEnd()}\n\n${BEGIN} (emela ${version}) ---\n${diagnostics.join("\n")}\n${END}\n`;
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
    mkdirSync(dirname(placed), { recursive: true });
    writeFileSync(placed, body);
    let pome = dirname(placed);
    while (!existsSync(join(pome, "Pome.toml"))) {
      if (pome === copy) throw new Error(`${target} を含む Pome（Pome.toml）が無い`);
      pome = dirname(pome);
    }
    const install = runEmela(["pome", "install"], pome);
    const check = runEmela(["check", "."], pome);
    const output = `${install.code === 0 ? "" : install.stdout + install.stderr}${check.stdout}${check.stderr}`.replaceAll(copy, "<repo>");
    const version = parseEmelaVersion(runEmela(["--version"], root).stdout) ?? "unknown";
    writeFileSync(file, withDiagnostics(body, version, output));
    return output;
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [command, wishPath] = process.argv.slice(2);
  if (command !== "check" || !wishPath) {
    console.error("usage: bun tools/wish.ts check wish/<name>.emel");
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
```

Run: `chmod +x tools/wish.ts`

- [ ] **Step 4: 通ることを確かめる**

Run: `mise exec -- bun test tools/test/wish.test.ts`
Expected: `2 pass`、`0 fail`

- [ ] **Step 5: 使い捨ての repo で動きを確かめる（smoke、commit しない）**

```bash
T=$(mktemp -d)
cp -r tools mise.toml friction "$T"/
cd "$T" && mise trust -q mise.toml
printf '[pome]\nname = "github.com/kisepichu/kbdcast-fixture"\nversion = "0.1.0"\nemela = "0.28.2"\n' > Pome.toml
mkdir -p src wish && printf 'fn main() {\n  ()\n}\n' > src/main.emel
printf '# wish-target: src/log.emel\n\npub fn shout(text: String) -> String {\n  text.upper()\n}\n' > wish/log.emel
mise exec -- bun tools/wish.ts check wish/log.emel
mise exec -- bun tools/wish.ts check wish/log.emel >/dev/null
grep -c "wish check (emela" wish/log.emel; ls src
cd - >/dev/null && rm -rf "$T"
```

Expected: 1 回目の出力に `error[E0313]: type \`String\` has no field or function \`upper\`` が出る。`grep -c` は `1`（2 回目で置き換わり、増えない）。`ls src` は `main.emel` だけ（元の repo を汚さない）。

- [ ] **Step 6: `wish/README.md` を書く**

```md
# wish

実装する前に書く「こう書きたい」コード。spec を調べる前に、推測の文法で書く。

## 書き方

- ファイルは `wish/<name>.emel`。
- 先頭に、置く予定の場所を repo からの相対パスで書く: `# wish-target: src/recorder.emel`
- 中身は、置く予定のモジュールとして書く（import もそのモジュールから見た形で書く）。

## 検査

`bun tools/wish.ts check wish/<name>.emel`

repo を一時ディレクトリに写し、wish-target の場所に wish を置いて、その Pome で `emela pome install` と `emela check` を走らせる。出力はファイル末尾の `# --- wish check` から `# --- end wish check ---` までのブロックに書かれる。もう一度走らせると、このブロックは置き換わる。元の repo の `src/` は変わらない。

## 手順

1. wish を書いて検査する。
2. wish だけを commit する（`wish: <name> の理想形を書く`）。実装との差を履歴で比べられるようにするため。
3. 実装する。wish と違う書き方になったら、それが回り道かどうかを判断し、回り道なら `friction/` に記録する。
```

- [ ] **Step 7: Commit**

```bash
git add tools/wish.ts tools/test/wish.test.ts wish/README.md
git commit --no-gpg-sign -m "feat: wish を置く予定の場所で emela check し、診断を wish に貼る tools/wish.ts を足す"
```

---

### Task 7: agent の hook

**Files:**
- Create: `tools/hooks/claude.ts`
- Create: `.claude/settings.json`
- Create: `.omp/hooks/post/kbdcast-check.ts`

**Interfaces:**
- Consumes: `ROOT`、`runCheck`（Task 5）、`formatProblems`（Task 2）
- Produces: Claude Code の PostToolUse と Stop、omp の `tool_result` と `session_stop` から `tools/check.ts` が走る。

- [ ] **Step 1: `tools/hooks/claude.ts` を書く**

```ts
#!/usr/bin/env bun
// Claude Code hook entry. `post`: after Edit/Write/MultiEdit; `stop`: when Claude is about to end its turn.
// Exit 2 shows stderr to Claude (PostToolUse) or keeps it working (Stop).
import { relative, resolve } from "node:path";
import { ROOT, runCheck } from "../check";
import { formatProblems } from "../lib/report";

const RELEVANT = /(\.emel|(^|\/)Pome\.toml)$|^(friction|wish)\/|^tools\/lint\/foundation\.allow$/;

async function main(): Promise<number> {
  const mode = process.argv[2];
  const input = JSON.parse((await Bun.stdin.text()) || "{}");
  if (mode === "post") {
    const filePath = input?.tool_input?.file_path;
    if (typeof filePath !== "string" || !RELEVANT.test(relative(ROOT, resolve(ROOT, filePath)))) return 0;
  } else if (mode === "stop") {
    if (input?.stop_hook_active === true) return 0;
  } else {
    console.error("usage: bun tools/hooks/claude.ts post|stop");
    return 1;
  }
  const problems = runCheck(ROOT);
  if (problems.length === 0) return 0;
  console.error(`tools/check.ts が失敗した。直すか、回り道なら FRICTION(NNN) とメモで記録する。\n${formatProblems(problems)}`);
  return 2;
}

process.exit(await main());
```

Run: `chmod +x tools/hooks/claude.ts`

- [ ] **Step 2: `.claude/settings.json` を書く**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "cd \"$CLAUDE_PROJECT_DIR\" && mise exec -- bun tools/hooks/claude.ts post" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "cd \"$CLAUDE_PROJECT_DIR\" && mise exec -- bun tools/hooks/claude.ts stop" }]
      }
    ]
  }
}
```

- [ ] **Step 3: `.omp/hooks/post/kbdcast-check.ts` を書く**

```ts
// omp hook: runs tools/check.ts after edits to checked files and before the session stops.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const RELEVANT = /(\.emel|(^|\/)Pome\.toml)$|(^|\/)(friction|wish)\/|tools\/lint\/foundation\.allow$/;
const ADVICE = "tools/check.ts が失敗した。直すか、回り道なら FRICTION(NNN) とメモで記録する。";

export default function kbdcastCheck(pi: ExtensionAPI): void {
  let lastStopReport = "";

  const check = async (cwd: string): Promise<string | undefined> => {
    const result = await pi.exec("mise", ["exec", "--", "bun", "tools/check.ts"], { cwd });
    return result.code === 0 ? undefined : `${result.stdout}${result.stderr}`.trim();
  };

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    const input = event.input as { path?: unknown; paths?: unknown };
    const paths = [input.path, ...(Array.isArray(input.paths) ? input.paths : [])].filter((p): p is string => typeof p === "string");
    if (paths.length > 0 && !paths.some((p) => RELEVANT.test(p))) return;
    const report = await check(ctx.cwd);
    if (report !== undefined) return { additionalContext: `${ADVICE}\n${report}` };
  });

  pi.on("session_stop", async (_event, ctx) => {
    const report = await check(ctx.cwd);
    if (report === undefined || report === lastStopReport) {
      lastStopReport = report ?? "";
      return;
    }
    lastStopReport = report;
    return { continue: true, additionalContext: `${ADVICE}\n${report}` };
  });
}
```

- [ ] **Step 4: Claude Code の hook の入口を確かめる（smoke、commit しない）**

この repo の中で、関係のないファイルでは何もせず、Stop が `stop_hook_active` を尊重し、検査が通っていれば 0 で終わることを確かめる:

```bash
echo '{"tool_input":{"file_path":"docs/a.md"}}' | mise exec -- bun tools/hooks/claude.ts post; echo "post irrelevant exit=$?"
echo '{"tool_input":{"file_path":"friction/001-release-binary-glibc.md"}}' | mise exec -- bun tools/hooks/claude.ts post; echo "post relevant exit=$?"
echo '{"stop_hook_active":true}' | mise exec -- bun tools/hooks/claude.ts stop; echo "stop active exit=$?"
echo '{"stop_hook_active":false}' | mise exec -- bun tools/hooks/claude.ts stop; echo "stop exit=$?"
```

Expected: 4 行とも `exit=0`。

失敗のときに 2 で終わり、stderr に理由が出ることを、一時的に壊したメモで確かめる:

```bash
cp friction/001-release-binary-glibc.md /tmp/kb-001.bak
printf '# 001 broken\n\n- 状態: wip\n' > friction/001-release-binary-glibc.md
echo '{"stop_hook_active":false}' | mise exec -- bun tools/hooks/claude.ts stop; echo "stop broken exit=$?"
cp /tmp/kb-001.bak friction/001-release-binary-glibc.md
```

Expected: stderr に `tools/check.ts が失敗した。` と `friction friction/001-release-binary-glibc.md: 必須欄「Emela」が空か、無い` などが出て、`stop broken exit=2`。最後の `cp` でメモを戻す。

- [ ] **Step 5: omp の hook の構文を確かめる**

Run: `mise exec -- bun build --no-bundle .omp/hooks/post/kbdcast-check.ts > /dev/null && echo ok`
Expected: `ok`

この session では omp の hook は読み込まれない。動くかどうかは、次に omp をこの repo で起動したときに `.emel` を編集して確かめる（Task 8 の後の報告で user に伝える）。

- [ ] **Step 6: Commit**

```bash
git add tools/hooks/claude.ts .claude/settings.json .omp/hooks/post/kbdcast-check.ts
git commit --no-gpg-sign -m "feat: Claude Code と omp の hook から編集のたびとターンの終わりに検査を走らせる"
```

---

### Task 8: 規則、レビューの skill、prek

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `.agents/skills/friction-review/SKILL.md`
- Create: `.claude/skills/friction-review`（symlink）
- Create: `.pre-commit-config.yaml`

**Interfaces:**
- Consumes: Task 1〜7 のすべて
- Produces: commit のたびに prek が `tools/check.ts` と（tools を変えたときは）`bun test tools/test` を走らせる。

- [ ] **Step 1: `AGENTS.md` を書く**

```md
# AGENTS.md

kbdcast は、端末アプリのデモ GIF を、操作を書いた tape から決定的に作るツール。Emela で書き、詰まった所を記録して Emela と ecosystem に返すことも目的にしている。

- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`
- サブプロジェクトの spec と plan: `docs/superpowers/specs/`、`docs/superpowers/plans/`

## 構成

| 場所 | 中身 | `@external` |
|---|---|---|
| `/`（`src/`） | core。純粋な部分と effect を使う部分 | 置かない |
| `regex/` | 汎用の正規表現の Pome | 置かない |
| `pty/` | effect Pty の宣言だけ | 置かない |
| `pty-bun/` | handler BunPty | ここだけ |
| `cli/` | main | 置かない |
| `wish/` | 理想のコード（src の外）。`wish/README.md` | — |
| `friction/` | 回り道の記録。`friction/README.md` | — |
| `tools/` | 検査の道具（Bun 上の TypeScript） | — |

まだ無いディレクトリは、そのサブプロジェクトで作る。

## 規則

### 1. wish-first

新しい単位（モジュール、effect、主要な関数）を書くときは:

1. spec を調べる前に、推測の文法で「こう書きたい」コードを `wish/<name>.emel` に書く。先頭に `# wish-target: <置く予定の repo からの相対パス>` を書く。
2. `bun tools/wish.ts check wish/<name>.emel` を走らせる。診断がファイルの末尾に貼られる。
3. wish だけを commit する。
4. それから spec を調べ、`src/` に実装する。wish と実装が違ったら、その差が回り道かどうかを判断する。

### 2. 黙って回避しない

次のどれかをしたら、それは回り道。止まって記録する。

- 回避のためだけの補助関数を足した
- String を経由して base64 で Bytes を渡した
- UTF-8 を自前で読んだ
- 素直に書けないので、まわりくどい再帰や変換を挟んだ
- Option や Result を握りつぶした
- `@external` を足した
- 普通の処理なのに基盤レベル（`effect`、`handler`、`layer`、`suspend`、`trait`、`impl`、`fails`、`uses`、`@external`、`@export`）を書いた
- wish の書き方が通らず、別の書き方に変えた

記録の手順:

1. 回避したコードに `# FRICTION(NNN)` を付ける（その行か、直前のコメント行）。
2. `friction/NNN-slug.md` を `friction/README.md` の雛形で書く。
3. 迷ったら記録する側に倒す。分類は後で直せる。

### 3. 基盤レベル

core、regex、cli の `src/` で基盤レベルのキーワードを書けるのは、`tools/lint/foundation.allow` に理由と一緒に登録したモジュールだけ。登録するのは、設計として選んだもの（ドメインの port にする effect など）。登録の理由と実際の使い方がずれたら、それも回り道として記録する。

### 4. 検査

- ターンを終える前と commit の前に `mise exec -- bun tools/check.ts` を通す。
- Claude Code と omp の hook が編集のたびとターンの終わりに、prek が commit のたびに、同じ検査を走らせる。hook や prek を止めたり飛ばしたりして通さない。
- `tools/` を変えたら `mise exec -- bun test tools/test` も通す。

## Emela について

- 版は `mise.toml` で固定している（今は 0.28.2）。
- 仕様は `../emela`（emela-lang/emela の checkout）の `spec/` にある。`python3 scripts/spec.py show <name>` で節を引ける。`emela-spec` skill も使える。checkout の版は固定した版とずれることがあるので、違いが効くときは `git -C ../emela show v0.28.2:<path>` で読む。
- 前提（`[intro.premises]`）: 継続は 1 回しか再開できない、変数は不変、ループ構文は無い、高カインド型も演算子オーバーロードも無い。これに反する要望は記録だけして捨てる。
- emela に issue、proposal、PR を出す前に user に確認する。出すときは emela の `AGENTS.md` と `emela-proposal` skill の手順に従う。
- Koka は、苦しい箇所に概念の名前を付けるためだけに小さく書く。Koka で書いて写すことはしない。

## commit

- 当面は main に直接積む。
- message は `type: 日本語の説明`。type は `feat`、`fix`、`docs`、`chore`、`test`、`refactor`、`wish`。
```

- [ ] **Step 2: `CLAUDE.md` を書く**

```md
@AGENTS.md
```

- [ ] **Step 3: `.agents/skills/friction-review/SKILL.md` を書く**

```md
---
name: friction-review
description: kbdcast で、書いた agent とは別のセッションから差分を読み、記録されていない回り道（friction）を探す。PR やまとまった変更の後に使う。
---

# friction-review

書いた側が黙って合わせた箇所を、後から拾うためのレビュー。コードは直さない。

## 入力

レビューする範囲（PR 番号、commit の範囲、ファイル）。指定が無ければ `git log` で直近のまとまりを選び、範囲を明示してから始める。

## 手順

1. `AGENTS.md`、`friction/README.md`、`tools/lint/foundation.allow` を読む。
2. 範囲の差分を読む。範囲で実装した単位ごとに `wish/` の wish を探し、wish と実装を比べる。
3. 次のものを探す。
   - wish と実装の差のうち、friction のメモも説明も無いもの
   - 回避のためだけの補助関数
   - String を経由した base64、自前の UTF-8 処理
   - まわりくどい再帰や変換
   - Option や Result の握りつぶし（既定値での上書きを含む）
   - 目的に合わない型変換
   - `foundation.allow` の理由と実際の使い方のずれ
   - `FRICTION` の印はあるが、メモの内容が実際の回避と合わないもの
4. 見つけたものごとに、場所、何が回り道か、Emela でどう書きたかったはずか、を書く。確信が無いものは「候補」とする。

## 出力

- 見つけたものの一覧を返す。
- user が望めば、`friction/` に下書きを足す（雛形は `friction/README.md`、番号は既存の最大の次）。
```

- [ ] **Step 4: Claude Code からも skill が見えるように link を張る**

Run: `mkdir -p .claude/skills && ln -s ../../.agents/skills/friction-review .claude/skills/friction-review && ls .claude/skills/friction-review/`
Expected: `SKILL.md`

- [ ] **Step 5: `.pre-commit-config.yaml` を書く**

```yaml
repos:
  - repo: local
    hooks:
      - id: tools-check
        name: tools/check.ts
        entry: mise exec -- bun tools/check.ts
        language: system
        pass_filenames: false
        always_run: true
      - id: tools-test
        name: bun test tools/test
        entry: mise exec -- bun test tools/test
        language: system
        pass_filenames: false
        files: ^tools/
```

- [ ] **Step 6: prek を git hook に入れ、全体を走らせる**

Run: `mise exec -- prek install && git add -A && mise exec -- prek run --all-files`
Expected:

```text
tools/check.ts...........................................................Passed
bun test tools/test......................................................Passed
```

（`git add -A` の前に `git status --short` を見て、`tmp/` が ignore されていること、意図しないファイルが無いことを確かめる）

- [ ] **Step 7: テスト全体を走らせる**

Run: `mise exec -- bun test tools/test`
Expected: `26 pass`、`0 fail`

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md CLAUDE.md .agents/skills/friction-review/SKILL.md .claude/skills/friction-review .pre-commit-config.yaml
git commit --no-gpg-sign -m "docs: 回り道を記録する規則とレビューの skill を書き、prek で commit のたびに検査する"
```

Expected: commit の前に prek の 2 つの hook が `Passed` になる。
