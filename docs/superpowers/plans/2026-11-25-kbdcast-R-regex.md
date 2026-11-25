# サブプロジェクト R: 正規表現の Pome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ECMAScript（`u`）の正規な部分集合を線形時間で照合する Pome `regex` と、それが要る String の関数を補う Pome `text` を、`emela-lang/x` に移せる形で作る。

**Architecture:** `text` は std に足りない関数を std に入れるならこうなる形で置く。`regex` は `syntax`（pattern → AST）、`class`（code point の範囲の集合）、`fold`（case folding の表）、`program`（AST → 命令）、`vm`（Pike VM。ECMAScript の capture の消去と empty check は PLDI 2024 の論文に従う）、`lib`（公開 API）に分ける。テストは JS の RegExp を正解役にした固定の表と差分テスト。

**Tech Stack:** Emela（版は `mise.toml`）、JS ターゲットを Bun で、brix（assert と pbt）、Bun 上の TypeScript（道具）。

**Spec:** `docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md`

## Emela のコードを計画に書かない理由

この repo の規則（`AGENTS.md` の wish-first）では、実装する agent が spec を調べる前に自分で「こう書きたい」コードを書き、回り道を記録する。計画に Emela のコードを書くと、その発見が消える。そこで Emela のタスクには、ファイル、公開する名前と型、振る舞い、テストの入力と期待値（JS の RegExp で node と bun の両方から得たもの）、手順だけを書く。TypeScript と JS（道具と正解役）は、完全なコードを書く。

## Global Constraints

- Emela の版を**固定する**のは `mise.toml` の `"github:emela-lang/emela"` だけ。各 Pome の `Pome.toml` の `emela` は必須の欄（その Pome が要る compiler の最小の版）で、版の固定とは別。値は今の `mise.toml` の版にする。
- `Pome.toml` に `license` は書かない（kbdcast の repo の license は未定。x の Pome も書いていない）。
- ターゲットは JS（`EMELA_JS_HOST = "bun"`）。`emela` は `mise exec --` で呼ぶ。
- Pome の source path: `github.com/kisepichu/kbdcast/text`（root name `Text`）、`github.com/kisepichu/kbdcast/regex`（root name `Regex`）。どちらも version `0.1.0`。
- Pome の形は `emela-lang/x` に合わせる: `Pome.toml`、`README.md`（日本語。句読点は x と同じ `，．`）、`src/`、`test/`。
- regex は text を `"github.com/kisepichu/kbdcast/text" = "v0.1.0"` と `[replace]`（`{ path = "../text" }`）で参照する。brix は `[dev-dependencies]`。
- 公開 API に `Text` の型を出さない。
- `@external` は `regex/test/` の正解役だけ。
- library のエラーメッセージは英語。道具のメッセージと文書は日本語。コードのコメントは英語。
- 位置と長さは code point の単位。
- 照合は最悪でも O(m·n)。backtracking をしない。
- 新しい単位を書くときは `AGENTS.md` の wish-first に従う（wish を書き、`mise exec -- bun tools/wish.ts check` し、wish だけを commit してから実装する）。回り道は `FRICTION(NNN)` とメモで記録する。黙って回避しない。
- commit は branch `spR/regex` に積み、最後に PR を作って merge commit で main に入れる。message は `type: 日本語の説明`。`git commit --no-gpg-sign` を使う。
- emela-lang の repo（emela、x、brix）には、issue、PR、コメントを出さない。

## File Structure

| ファイル | 責務 |
|---|---|
| `tools/lib/pomes.ts` | lint の対象に `text` を足す。Pome が読むファイルの一覧 `pomeInputs` |
| `tools/check.ts` | `--test` で `emela test` も走らせる。`Pome.lock` と `src/`、`test/` の全ファイルを検査の入力にする |
| `tools/gen-case-folding.ts` | CaseFolding.txt（Unicode 17.0.0）から `regex/src/fold_table.emel` を作る |
| `text/` | `from_code_points`、`slice` |
| `regex/src/lib.emel` | 公開 API（`Flags`、`RegexSyntax`、`Regex`、`Match` と関数） |
| `regex/src/syntax.emel` | pattern → AST |
| `regex/src/class.emel` | code point の範囲の集合 |
| `regex/src/fold.emel`、`regex/src/fold_table.emel` | case folding |
| `regex/src/program.emel` | AST → 命令 |
| `regex/src/vm.emel` | Pike VM |
| `regex/test/oracle.mjs` | 正解役（JS の RegExp） |
| `regex/test/*.emel` | テスト |
| `friction/NNN-*.md` | 回り道の記録 |

`regex/src/` の中のモジュールの分け方は、wish を書いた結果で変えてよい。変えたら report に理由を書く。

---

### Task 1: 検査の道具を R に合わせる

**Files:**
- Modify: `tools/lib/pomes.ts`
- Modify: `tools/check.ts`
- Modify: `.pre-commit-config.yaml`
- Modify: `AGENTS.md`
- Test: `tools/test/check.test.ts`

**Interfaces:**
- Produces:
  - `LINT_POMES = [".", "text", "regex", "cli"]`
  - `pomeInputs(root: string, pome: string): string[]`: Pome が読むファイル（`Pome.toml`、あれば `Pome.lock`、`src/` と `test/` の下の全ファイル）を root からの相対パスで返す。
  - `runCheck(root: string, { commit?: boolean; test?: boolean }): Problem[]`
  - `mise exec -- bun tools/check.ts [--commit] [--test]`

- [ ] **Step 1: 失敗するテストを足す**

`tools/test/check.test.ts` の末尾に足す:

```ts
describe("pomeInputs", () => {
  test("lists the manifest, the lock and every file under src and test", () => {
    const root = mkdtempSync(join(tmpdir(), "kbdcast-check-test-"));
    try {
      mkdirSync(join(root, "regex", "src"), { recursive: true });
      mkdirSync(join(root, "regex", "test"), { recursive: true });
      writeFileSync(join(root, "regex", "Pome.toml"), "");
      writeFileSync(join(root, "regex", "Pome.lock"), "");
      writeFileSync(join(root, "regex", "README.md"), "");
      writeFileSync(join(root, "regex", "src", "lib.emel"), "");
      writeFileSync(join(root, "regex", "test", "oracle.mjs"), "");
      expect(pomeInputs(root, "regex")).toEqual(["regex/Pome.toml", "regex/Pome.lock", "regex/src/lib.emel", "regex/test/oracle.mjs"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

先頭の import に `import { pomeInputs } from "../lib/pomes";` を足す。

- [ ] **Step 2: 失敗することを確かめる**

Run: `mise exec -- bun test tools/test/check.test.ts`
Expected: FAIL（`pomeInputs` が export されていない）

- [ ] **Step 3: `tools/lib/pomes.ts` を直す**

`LINT_POMES` を次にする:

```ts
// The Pomes whose `src/` must stay at the everyday level (repo root = core).
export const LINT_POMES = [".", "text", "regex", "cli"];
```

末尾に足す:

```ts
// The files of a Pome that emela reads: the manifest, the lock, and everything under src/ and test/
// (the sources, and the host files that @external points to).
export function pomeInputs(root: string, pome: string): string[] {
  const dir = join(root, pome);
  const files = ["Pome.toml", "Pome.lock"].filter((name) => existsSync(join(dir, name))).map((name) => join(pome, name));
  for (const sub of ["src", "test"]) files.push(...listFiles(join(dir, sub), "").map((file) => relative(root, file)));
  return files;
}
```

- [ ] **Step 4: `tools/check.ts` を直す**

import を `import { findPomes, LINT_POMES, listFiles, pomeInputs } from "./lib/pomes";` にする。

`runCheck` を次にする:

```ts
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
```

`checkPomes` を次にする:

```ts
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
```

`import.meta.main` の部分を次にする:

```ts
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
```

ファイルの先頭のコメントの 2 行目を次にする:

```ts
// prek passes `--commit`, which also reports checked files that the commit lacks (see checkUntracked), and `--test`, which runs `emela test`.
```

- [ ] **Step 5: 通ることを確かめる**

Run: `mise exec -- bun test tools/test`
Expected: すべて pass（30 件）

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

- [ ] **Step 6: prek の entry を直す**

`.pre-commit-config.yaml` の `tools-check` の entry を `mise exec -- bun tools/check.ts --commit --test` にする。

- [ ] **Step 7: AGENTS.md を直す**

構成の表の `regex/` の行の前に、次の行を足す:

```md
| `text/` | std に足りない String の関数（std に入ったら消す） | 置かない |
```

`### 4. 検査` の箇条書きの 2 つ目の後に、次の行を足す:

```md
- commit のときの prek は `--test` も付け、各 Pome の `emela test` を走らせる。編集のたびとターンの終わりの hook は走らせない（時間がかかるため）。
```

- [ ] **Step 8: Commit**

```bash
git add tools/lib/pomes.ts tools/check.ts tools/test/check.test.ts .pre-commit-config.yaml AGENTS.md
git commit --no-gpg-sign -m "feat: 検査の入力に Pome.lock と src、test の全ファイルを入れ、commit では emela test も走らせる"
```

---

### Task 2: text Pome

**Files:**
- Create: `wish/text.emel`
- Create: `text/Pome.toml`、`text/README.md`、`text/src/lib.emel`、`text/test/text_test.emel`（test のファイル名は Emela の規則に合わせてよい）
- Create: `friction/002-string-slice.md`（番号は空いている最小のもの）

**Interfaces:**
- Produces（`import Text` で使う）:
  - `Text.from_code_points(cps: List[Int]) -> Option[String]`
  - `Text.slice(s: String, from: Int, to: Int) -> String`

- [ ] **Step 1: wish を書く**

spec を調べる前に、`wish/text.emel` を書く。先頭は `# wish-target: text/src/lib.emel`。中身は 2 つの関数と doc comment。String の関数で欲しいものが std に無いと思ったら、wish の中では「あるつもり」で書いてよい（それが friction の材料になる）。

- [ ] **Step 2: Pome を置き、wish を検査する**

`text/Pome.toml`（`emela` の欄は `mise.toml` の版）:

```toml
[pome]
name = "github.com/kisepichu/kbdcast/text"
version = "0.1.0"
emela = "0.28.2"
```

Run: `mise exec -- bun tools/wish.ts check wish/text.emel`
Expected: wish の末尾に診断のブロックが付く（診断があってもよい）。

- [ ] **Step 3: wish を commit する**

```bash
git add wish/text.emel
git commit --no-gpg-sign -m "wish: text の理想形を書く"
```

- [ ] **Step 4: spec を調べる**

`../emela` で `python3 scripts/spec.py show <name>` を使う。少なくとも `api.string`、`api.list`、`api.option`、`module.pome`、`test` の章（`spec/language/13-testing.md`）、`lib.api-rules`。brix は `gh api repos/emela-lang/brix/contents/src -H 'Accept: application/vnd.github.raw'` などで読む（書き込みはしない）。

- [ ] **Step 5: 失敗するテストを書く**

brix を足す: `cd text && mise exec -- emela pome add --dev github:emela-lang/brix`

テストの期待値:

| 呼び出し | 結果 |
|---|---|
| `slice("a\u{1F600}b", 1, 2)` | `"\u{1F600}"` |
| `slice("abc", -1, 2)` | `"ab"` |
| `slice("abc", 2, 10)` | `"c"` |
| `slice("abc", 2, 1)` | `""` |
| `slice("", 0, 1)` | `""` |
| `from_code_points([0x61, 0x1F600])` | `Some("a\u{1F600}")` |
| `from_code_points([])` | `Some("")` |
| `from_code_points([0xD800])` | `None` |
| `from_code_points([0x110000])` | `None` |
| `from_code_points([-1])` | `None` |

性質テスト（brix の pbt。code point の List から文字列を作る生成器を書く）:
- `from_code_points(String.code_points(s)) == Some(s)`
- どの `n` でも `String.append(slice(s, 0, n), slice(s, n, len)) == s`（`len` は code point の数）

Run: `cd text && mise exec -- emela test`
Expected: FAIL（関数が無い）

- [ ] **Step 6: 実装する**

`text/src/lib.emel` に実装する。doc comment は英語で、std の `[api.string]` の書き方に合わせる。std に入れる提案の材料になるので、規約（`[lib.api-rules]`）との対応をモジュールの doc comment に 1 段落で書く。

Run: `cd text && mise exec -- emela test && mise exec -- emela fmt --check src test`
Expected: すべて pass、整形の差なし

- [ ] **Step 7: README を書く**

`text/README.md`（日本語、句読点は `，．`）: 1 段落の説明（std に足りない関数を std に入れるならこうなる形で置いたもの，std に入ったら消す），使い方の例，関数の表（名前，型，振る舞い）。x の `base64/README.md` の形に合わせる。

- [ ] **Step 8: friction のメモを書く**

`friction/002-string-slice.md`（雛形は `friction/README.md`）。行き先は「前提の範囲内で spec に足りない → proposal の下書き」。メモの中に proposal の下書きの節を足す: Summary、Motivation（regex と、後の VT で要るコード）、Proposal（2 つの関数の型と振る舞い）、Open questions（位置の単位: std の `length` と `chars` は grapheme、`contains`、`split`、`Json` の offset は code point）。`text/src/lib.emel` のモジュールの doc comment に `# FRICTION(002)` を付ける（番号はメモに合わせる）。

この task で他にも回り道をしたら、それぞれメモを書く。

- [ ] **Step 9: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`（新しいファイルを `git add` してから走らせる）

```bash
git add text friction/002-string-slice.md
git commit --no-gpg-sign -m "feat: std に足りない String の関数を補う text Pome を足す"
```

---

### Task 3: regex Pome の骨組みと case folding の表

**Files:**
- Create: `tools/gen-case-folding.ts`
- Create: `regex/Pome.toml`、`regex/README.md`（骨組み）、`regex/src/lib.emel`（骨組み）
- Create: `regex/src/fold_table.emel`（生成）
- Create: `wish/fold.emel`、`regex/src/fold.emel`
- Test: `regex/test/fold_test.emel`

**Interfaces:**
- Produces: `fold.emel` の `pub fn canonicalize(c: Int) -> Int`（ECMAScript の `u` と `i` の Canonicalize: CaseFolding.txt の status C と S の対応があればその値、無ければ `c`）

- [ ] **Step 1: 表を作る道具を書く**

`tools/gen-case-folding.ts`:

```ts
#!/usr/bin/env bun
// Generates regex/src/fold_table.emel from CaseFolding.txt (status C and S: the simple case folding that
// ECMAScript's Canonicalize uses with the `u` and `i` flags). The Unicode version matches the ICU of the oracle's JS host.
// usage: mise exec -- bun tools/gen-case-folding.ts
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const UNICODE = "17.0.0";
const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "regex", "src", "fold_table.emel");

const response = await fetch(`https://www.unicode.org/Public/${UNICODE}/ucd/CaseFolding.txt`);
if (!response.ok) throw new Error(`CaseFolding.txt を取得できない: ${response.status}`);
const pairs = (await response.text())
  .split("\n")
  .map((line) => /^([0-9A-F]+); [CS]; ([0-9A-F]+);/.exec(line))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => [Number.parseInt(m[1], 16), Number.parseInt(m[2], 16)] as const)
  .sort((a, b) => a[0] - b[0]);

const hex = (n: number) => `0x${n.toString(16)}`;
const list = (values: number[]) => `[\n${values.map((v) => `  ${hex(v)},`).join("\n")}\n]`;
writeFileSync(
  OUT,
  `# Generated by tools/gen-case-folding.ts from CaseFolding-${UNICODE}.txt (status C and S). Do not edit.

## The code points that simple case folding changes, in increasing order.
pub const SOURCES: List[Int] = ${list(pairs.map((p) => p[0]))}

## The folded code point of each entry of SOURCES, at the same position.
pub const TARGETS: List[Int] = ${list(pairs.map((p) => p[1]))}
`,
);
const fmt = Bun.spawnSync(["emela", "fmt", OUT], { stdout: "inherit", stderr: "inherit" });
if (fmt.exitCode !== 0) throw new Error("emela fmt が失敗した");
console.log(`wrote ${OUT}: ${pairs.length} entries (Unicode ${UNICODE})`);
```

Run: `chmod +x tools/gen-case-folding.ts`

- [ ] **Step 2: regex の Pome を置く**

`regex/Pome.toml`（`emela` の欄は `mise.toml` の版）:

```toml
[pome]
name = "github.com/kisepichu/kbdcast/regex"
version = "0.1.0"
emela = "0.28.2"

[dependencies]
"github.com/kisepichu/kbdcast/text" = "v0.1.0"

[replace]
"github.com/kisepichu/kbdcast/text" = { path = "../text" }
```

brix を足す: `cd regex && mise exec -- emela pome add --dev github:emela-lang/brix && mise exec -- emela pome install`

`regex/src/lib.emel` は、モジュールの doc comment だけの骨組みにする（中身は Task 6）。`regex/README.md` は見出しと 1 行の説明だけ（中身は Task 9）。

- [ ] **Step 3: 表を作る**

Run: `mise exec -- bun tools/gen-case-folding.ts`
Expected: `wrote …/regex/src/fold_table.emel: 1512 entries (Unicode 17.0.0)`

Run: `cd regex && mise exec -- emela check .`
Expected: 診断なし。compile に目立って時間がかかる（数秒を超える）、または `emela fmt` がこの形を受け付けないなら、回り道として記録し、表の形（2 つの List）を変えてよい。

- [ ] **Step 4: fold の wish を書いて commit する**

`wish/fold.emel`（`# wish-target: regex/src/fold.emel`）。`canonicalize` を表からどう引くか（2 分探索、Array など）を、spec を調べる前に書く。

Run: `mise exec -- bun tools/wish.ts check wish/fold.emel`

```bash
git add wish/fold.emel
git commit --no-gpg-sign -m "wish: fold の理想形を書く"
```

- [ ] **Step 5: 失敗するテストを書く**

| 呼び出し | 結果 |
|---|---|
| `canonicalize(0x41)` | `0x61` |
| `canonicalize(0x61)` | `0x61` |
| `canonicalize(0x212A)` | `0x6B` |
| `canonicalize(0x17F)` | `0x73` |
| `canonicalize(0x1E9E)` | `0xDF` |
| `canonicalize(0xDF)` | `0xDF` |
| `canonicalize(0x3A3)` | `0x3C3` |
| `canonicalize(0x3C2)` | `0x3C3` |
| `canonicalize(0x1F600)` | `0x1F600` |

Run: `cd regex && mise exec -- emela test`
Expected: FAIL

- [ ] **Step 6: 実装する**

`regex/src/fold.emel`。一回の呼び出しは O(log 表の大きさ) にする。

Run: `cd regex && mise exec -- emela test`
Expected: PASS

- [ ] **Step 7: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add tools/gen-case-folding.ts regex
git commit --no-gpg-sign -m "feat: regex Pome を置き、Unicode 17.0 の simple case folding の表を生成する"
```

---

### Task 4: syntax（pattern → AST）

**Files:**
- Create: `wish/syntax.emel`、`regex/src/syntax.emel`
- Test: `regex/test/syntax_test.emel`

**Interfaces:**
- Consumes: `canonicalize`（Task 3）は使わない（folding は class と vm で扱う）
- Produces:
  - `RegexSyntax(message: String, offset: Int)`。使う側は `import Regex.{RegexSyntax}` で import できる（x の `base64` の `Base64Error` と同じ）。Emela には re-export が無く、モジュールの循環も compile error なので、`syntax` と `lib` のどちらに宣言するかは wish で決める。思うように置けなければ回り道として記録する
  - `syntax.emel` の `parse(pattern: String) -> Ast fails RegexSyntax`。`Ast` は、根の node、capture の group の数、名前から番号への対応を持つ。node の型は wish で決める。受け付ける構文（spec §6）だけを表現でき、受け付けない構文は表現できない形にする

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/syntax.emel`（`# wish-target: regex/src/syntax.emel`）。AST の enum と parser の形（再帰下降。code point の List か Array を読む）を書く。

Run: `mise exec -- bun tools/wish.ts check wish/syntax.emel`

```bash
git add wish/syntax.emel
git commit --no-gpg-sign -m "wish: syntax の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

ECMAScript の `u` モードの文法（ECMA-262 の Pattern の文法と Early Errors）を参照する（tc39.es/ecma262 を読む）。Emela は `data.enum`、`error`、`type.rules`、`api.array`、`api.map`。

- [ ] **Step 3: 失敗するテストを書く**

エラーの表（offset は pattern の code point の offset。メッセージは完全に一致させる）:

| pattern | offset | message |
|---|---|---|
| `(a)\1` | 3 | `backreferences are not supported` |
| `\k<a>(?<a>x)` | 0 | `backreferences are not supported` |
| `a(?=b)` | 1 | `lookahead is not supported` |
| `a(?!b)` | 1 | `lookahead is not supported` |
| `(?<=a)b` | 0 | `lookbehind is not supported` |
| `(?<!a)b` | 0 | `lookbehind is not supported` |
| `\p{L}` | 0 | `Unicode property escapes are not supported` |
| `(?i:a)` | 0 | `modifiers are not supported` |
| `a{1001}` | 1 | `repetition count above 1000` |
| `a)` | 1 | `unmatched ')'` |
| `(a` | 0 | `unterminated group` |
| `[a` | 0 | `unterminated character class` |
| `a{2,1}` | 1 | `numbers out of order in {} quantifier` |
| `*a` | 0 | `nothing to repeat` |
| `a**` | 2 | `nothing to repeat` |
| `x{2}{3}` | 4 | `nothing to repeat` |
| `\q` | 0 | `invalid escape` |
| `\-` | 0 | `invalid escape` |
| `\c` | 0 | `invalid escape` |
| `{` | 0 | `lone quantifier brackets` |
| `}` | 0 | `lone quantifier brackets` |
| `]` | 0 | `lone quantifier brackets` |
| `a{` | 1 | `incomplete quantifier` |
| `a{,5}` | 1 | `incomplete quantifier` |
| `[b-a]` | 1 | `range out of order in character class` |
| `[\d-z]` | 1 | `invalid character class` |
| `(?<a>x)(?<a>y)` | 7 | `duplicate capture group name` |
| `\u{110000}` | 0 | `invalid Unicode escape` |

受け付ける pattern（`parse` が成功する。group の数と名前も確かめる）:

| pattern | group の数 | 名前 |
|---|---|---|
| `` | 0 | なし |
| `(?:)` | 0 | なし |
| `[]` | 0 | なし |
| `[^]` | 0 | なし |
| `[\-]` | 0 | なし |
| `\/` | 0 | なし |
| `(a)(?:b)(?<c>d)` | 2 | `c` → 2 |
| `a{1000}` | 0 | なし |
| `\u{1F600}\u0041\x41\cA\0` | 0 | なし |

（表の pattern は正規表現の文字そのもの。Emela の文字列リテラルに書くときは `\` を `\\` にする）

Run: `cd regex && mise exec -- emela test`
Expected: FAIL

- [ ] **Step 4: 実装する**

`regex/src/syntax.emel`。ECMAScript の `u` モードで SyntaxError になる pattern は、受け付ける範囲の構文でも `RegexSyntax` にする。offset は問題のある構文の始まり（閉じていない group と class は開きの位置）。

Run: `cd regex && mise exec -- emela test`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

公開 API で `fails` を宣言するモジュールは、`tools/lint/foundation.allow` に理由と一緒に登録する（例: `regex/src/syntax.emel  # library の公開 API が RegexSyntax を宣言する`）。エンジンの内部で `fails` を書かずに済むなら書かない。

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add regex tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: ECMAScript の u モードの部分集合の pattern を AST に変換する"
```

---

### Task 5: class（code point の範囲の集合）

**Files:**
- Create: `wish/class.emel`、`regex/src/class.emel`
- Test: `regex/test/class_test.emel`

**Interfaces:**
- Consumes: `canonicalize`（Task 3）、Task 4 の AST の class の表現
- Produces（名前は wish で決めてよい。report に書く）:
  - 並んだ、重ならない範囲の集合の型と、`union`、`complement`（0〜0x10FFFF の中で）、`contains(set, c)`
  - `\d`、`\w`（`ignore_case` のときは U+017F と U+212A も含む word 文字）、`\s`（ECMAScript の WhiteSpace と LineTerminator）、`.`（`dot_all` でなければ `\n` `\r` U+2028 U+2029 を除く）
  - `ignore_case` のための正規化: 集合 A に対し `{canonicalize(a) | a ∈ A}` を、範囲ごとに表の項目だけを見て O(範囲の数 + 表の大きさ) で作る（A の要素を 1 つずつ回さない）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/class.emel`（`# wish-target: regex/src/class.emel`）。

```bash
git add wish/class.emel
git commit --no-gpg-sign -m "wish: class の理想形を書く"
```

- [ ] **Step 2: ECMAScript の意味を確かめる**

ECMA-262 の CharacterSetMatcher、Canonicalize、WordCharacters、CharacterClassEscape を読む。押さえる点:
- `[^...]` の否定は、正規化して比べた**後に**かける（`/[^k]/iu` は KELVIN SIGN に一致しない）。そのため、class の照合は「正規化した集合」と「否定の flag」の組で表す。
- `\W`、`\D`、`\S` は否定の flag ではなく、補集合そのもの。

- [ ] **Step 3: 失敗するテストを書く**

| 集合 | 入っている | 入っていない |
|---|---|---|
| `union([a-c], [b-e])` | `a`、`e` | `f` |
| `complement([\u{0}-\u{10FFFF}])` | なし | `a` |
| `\d` | `0`、`9` | `a`、U+0660 |
| `\w`（`ignore_case` なし） | `a`、`Z`、`_`、`0` | U+017F、U+212A、`-` |
| `\w`（`ignore_case`） | U+017F、U+212A | `-` |
| `\s` | U+0020、U+0009、U+000A、U+3000、U+FEFF、U+2028 | `a` |
| `.`（`dot_all` なし） | `a`、U+1F600 | `\n`、`\r`、U+2028、U+2029 |
| `.`（`dot_all`） | `\n` | なし |
| `[a-z]` を正規化 | `k`（U+212A を正規化した値も `k`） | `K` を正規化せずに比べたときの `K` |

Run: `cd regex && mise exec -- emela test`
Expected: FAIL

- [ ] **Step 4: 実装し、検査して commit する**

Run: `cd regex && mise exec -- emela test`
Expected: PASS

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add regex
git commit --no-gpg-sign -m "feat: code point の範囲の集合と、ECMAScript の文字クラスと case folding を足す"
```

---

### Task 6: program と vm と公開 API の照合

**Files:**
- Create: `wish/vm.emel`、`wish/lib.emel`、`regex/src/program.emel`、`regex/src/vm.emel`
- Modify: `regex/src/lib.emel`
- Test: `regex/test/find_test.emel`、`regex/test/linear_test.emel`

**Interfaces:**
- Consumes: Task 3〜5
- Produces（spec §5。`import Regex` で使う）:
  - `Regex.Flags(ignore_case: Bool, multiline: Bool, dot_all: Bool)` と、flag を何も立てない値（名前は wish で決める。report に書く）
  - `Regex.compile(pattern: String, flags: Flags) -> Regex fails RegexSyntax`
  - `Regex.is_match(re, s) -> Bool`、`Regex.find(re, s) -> Option[Match]`
  - `Match` の `start`、`end`、`text`、`group(index)`、`named(name)`（`m.text()` と書ける）

- [ ] **Step 1: 論文を読む**

Barrière と Pit-Claudel, "Linear Matching of JavaScript Regular Expressions"（PLDI 2024、https://arxiv.org/abs/2311.17620）。capture の消去（量指定子の 1 回ごとに中の group を消す）、empty check（必須の回数を超えた 1 回が空なら失敗）、最短一致を、Pike VM で線形時間に扱う方法を確かめる。ECMA-262 の RepeatMatcher も読む。論文のどの節に従うかを、`vm.emel` の doc comment に書く。

- [ ] **Step 2: wish を書いて検査し、commit する**

`wish/vm.emel`（`# wish-target: regex/src/vm.emel`）と `wish/lib.emel`（`# wish-target: regex/src/lib.emel`）。スレッドの状態（命令の位置、capture、empty check の記録）と、優先順位の順に並べたスレッドのリストの扱い、同じ命令の位置のスレッドを除く集合を、spec を調べる前に書く。

```bash
git add wish/vm.emel wish/lib.emel
git commit --no-gpg-sign -m "wish: vm と公開 API の理想形を書く"
```

- [ ] **Step 3: 失敗するテストを書く**

`find` の表（JS の RegExp の結果。flag の `i` は `ignore_case`、`m` は `multiline`、`s` は `dot_all`。位置は code point。`groups` は group 1 から順）:

| pattern | flags | input | find |
|---|---|---|---|
| `abc` | - | "xabcx" | start=1 end=4 text="abc" groups=[] |
| `a\|ab` | - | "ab" | start=0 end=1 text="a" groups=[] |
| `a+` | - | "aaa" | start=0 end=3 text="aaa" groups=[] |
| `a+?` | - | "aaa" | start=0 end=1 text="a" groups=[] |
| `a{2,3}` | - | "aaaa" | start=0 end=3 text="aaa" groups=[] |
| `a{2,}?` | - | "aaaa" | start=0 end=2 text="aa" groups=[] |
| `a{2}` | - | "a" | None |
| `[a-c]+` | - | "xbcay" | start=1 end=4 text="bca" groups=[] |
| `[^a-c]+` | - | "abxyc" | start=2 end=4 text="xy" groups=[] |
| `\d+` | - | "ab12c" | start=2 end=4 text="12" groups=[] |
| `\w+` | - | "-a_1-" | start=1 end=4 text="a_1" groups=[] |
| `\s+` | - | "a \t\u{3000}b" | start=1 end=4 text=" \t\u{3000}" groups=[] |
| `.` | - | "\n" | None |
| `.` | s | "\n" | start=0 end=1 text="\n" groups=[] |
| `.` | - | "\u{1F600}" | start=0 end=1 text="\u{1F600}" groups=[] |
| `b` | - | "\u{1F600}b" | start=1 end=2 text="b" groups=[] |
| `[]` | - | "a" | None |
| `[^]` | - | "\n" | start=0 end=1 text="\n" groups=[] |
| `^a` | - | "ba" | None |
| `^a` | m | "b\na" | start=2 end=3 text="a" groups=[] |
| `a$` | - | "ab" | None |
| `a$` | m | "a\nb" | start=0 end=1 text="a" groups=[] |
| `\bfoo\b` | - | "a foo b" | start=2 end=5 text="foo" groups=[] |
| `\Bo` | - | "foo" | start=1 end=2 text="o" groups=[] |
| `(a)(b)?` | - | "a" | start=0 end=1 text="a" groups=["a", None] |
| `(?<y>\d{4})-(?<m>\d\d)` | - | "on 2026-11 ok" | start=3 end=10 text="2026-11" groups=["2026", "11"] |
| `(?:a)(b)` | - | "ab" | start=0 end=2 text="ab" groups=["b"] |
| `(?:(a)\|b)+` | - | "ab" | start=0 end=2 text="ab" groups=[None] |
| `(a*)*` | - | "b" | start=0 end=0 text="" groups=[None] |
| `(a*)+` | - | "b" | start=0 end=0 text="" groups=[""] |
| `(?:a\|())*?b` | - | "ab" | start=0 end=2 text="ab" groups=[None] |
| `(?:(a)\|(b))+` | - | "ab" | start=0 end=2 text="ab" groups=[None, "b"] |
| `(a\|)+b` | - | "aab" | start=0 end=3 text="aab" groups=["a"] |
| `(a*?)*` | - | "aa" | start=0 end=2 text="aa" groups=["a"] |
| `k` | i | "\u{212A}" | start=0 end=1 text="\u{212A}" groups=[] |
| `[^k]` | i | "\u{212A}" | None |
| `\w` | i | "\u{17F}" | start=0 end=1 text="\u{17F}" groups=[] |
| `ß` | i | "\u{1E9E}" | start=0 end=1 text="\u{1E9E}" groups=[] |
| `ss` | i | "\u{DF}" | None |
| `[a-z]` | i | "\u{212A}" | start=0 end=1 text="\u{212A}" groups=[] |
| `Σ` | i | "\u{3C2}" | start=0 end=1 text="\u{3C2}" groups=[] |
| `\bk` | i | "\u{212A}" | start=0 end=1 text="\u{212A}" groups=[] |

（pattern は正規表現の文字そのもの。input と text は Emela の文字列リテラルの書き方。表の `\|` は markdown の escape で、pattern の中では `|`）

`named` と `group` の境界:
- `(?<y>\d{4})-(?<m>\d\d)` に "on 2026-11 ok": `named(m, "y") == Some("2026")`、`named(m, "z") == None`、`group(m, 0) == Some("2026-11")`、`group(m, 3) == None`、`group(m, -1) == None`

線形時間（`regex/test/linear_test.emel`）: pattern `(a*)*b`、`(a|a)*b`、`(a?){30}a{30}` について、入力 `"a" × n`（最後に `b` を付けない）で n = 2000 と 4000 の照合の手間を比べ、4000 のときが 2000 のときのおよそ 2 倍（2.5 倍以下）であることを確かめる。手間は、vm が処理したスレッドの数を数えられるなら、その数で比べる（決定的になる）。テストから数を取り出す手段が Emela に無ければ、時間で比べ、その不便さを friction として記録する。

Run: `cd regex && mise exec -- emela test`
Expected: FAIL

- [ ] **Step 4: 実装する**

`program.emel`（AST から命令の Array を作る）、`vm.emel`、`lib.emel` の `compile`、`is_match`、`find`、`Match` の関数。

- 入力は `String.code_points` から作った Array で読む。
- 一致した文字列は `Text.slice` で作る（`Text` は公開 API に出さない）。
- 同じ命令の位置のスレッドを除く集合は、JS で `Array.set` が常にコピーすることを踏まえて選ぶ。何を選んだか、なぜかを friction のメモに書く（予想した friction）。
- `compile` の公開 API の `fails` は `foundation.allow` に理由と一緒に登録する。

Run: `cd regex && mise exec -- emela test`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add regex tools/lint/foundation.allow friction
git commit --no-gpg-sign -m "feat: ECMAScript の意味論の Pike VM で compile、is_match、find を足す"
```

---

### Task 7: find_all、replace、split

**Files:**
- Modify: `regex/src/lib.emel`
- Test: `regex/test/all_test.emel`

**Interfaces:**
- Consumes: Task 6
- Produces: `Regex.find_all(re, s) -> List[Match]`、`Regex.replace(re, s, f: fn(Match) -> String) -> String`、`Regex.split(re, s) -> List[String]`

- [ ] **Step 1: 失敗するテストを書く**

`find_all`（`位置:text` の並び）:

| pattern | input | find_all |
|---|---|---|
| `a*` | "baac" | 0:"" 1:"aa" 3:"" 4:"" |
| `\d` | "a1b22" | 1:"1" 3:"2" 4:"2" |
| `` | "\u{1F600}a" | 0:"" 1:"" 2:"" |

`replace`（`f` は `"<" + text + ">"`）:

| pattern | input | replace |
|---|---|---|
| `\d` | "a1b22" | "a<1>b<2><2>" |
| `x*` | "ab" | "<>a<>b<>" |
| `` | "\u{1F600}a" | "<>\u{1F600}<>a<>" |

`split`（capture は結果に入れない）:

| pattern | input | split |
|---|---|---|
| `,\s*` | "a, b,c" | ["a", "b", "c"] |
| `x*` | "abc" | ["a", "b", "c"] |
| `(-)` | "a-b" | ["a", "b"] |
| `a` | "" | [""] |
| `(?:)` | "" | [] |
| `` | "\u{1F600}b" | ["\u{1F600}", "b"] |
| `b` | "abba" | ["a", "", "a"] |

Run: `cd regex && mise exec -- emela test`
Expected: FAIL

- [ ] **Step 2: 実装する**

ECMA-262 の `RegExp.prototype[@@matchAll]`、`[@@replace]`、`[@@split]`（`u` フラグの AdvanceStringIndex は 1 code point 進める）に従う。`split` は JS の結果から capture の要素を除いたものにする。

Run: `cd regex && mise exec -- emela test`
Expected: PASS

- [ ] **Step 3: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add regex
git commit --no-gpg-sign -m "feat: find_all、replace、split を足す"
```

---

### Task 8: JS の RegExp との差分テスト

**Files:**
- Create: `regex/test/oracle.mjs`
- Create: `regex/test/differential_test.emel`（と、生成器のモジュール）

**Interfaces:**
- Consumes: Task 6、7
- Produces: 差分テスト

- [ ] **Step 1: 正解役を書く**

`regex/test/oracle.mjs`:

```js
// Test-only oracle: JS RegExp with the `u` and `d` flags. Positions are converted from UTF-16 to code point offsets.
const codePoints = (s, index) => [...s.slice(0, index)].length;

// Returns [] when there is no match. Otherwise [start, end] for the whole match and then for each group,
// with [-1, -1] for a group that did not take part.
export function find(pattern, flags, input) {
  const m = new RegExp(pattern, `ud${flags}`).exec(input);
  if (m === null) return [];
  return m.indices.flatMap((span) => (span === undefined ? [-1, -1] : [codePoints(input, span[0]), codePoints(input, span[1])]));
}
```

Emela の側では、`@external(js, "./oracle.mjs", "find")` で `fn(pattern: String, flags: String, input: String) -> Array[Int]` を宣言する（`uses {}` を書いてテストのどこからでも呼べるようにする）。`flags` は `"i"`、`"m"`、`"s"` を並べた文字列。

- [ ] **Step 2: 生成器を書く**

brix の pbt で、受け付ける文法（spec §6）の AST をランダムに作り、pattern の文字列に書き出す生成器を書く。
- 文字は小さな集合から選ぶ: `a`、`b`、`k`、`s`、`\n`、空白、U+017F、U+212A、U+00DF、U+1E9E、U+03A3、U+03C2、U+1F600。
- 構文: 文字、`.`、class（範囲と否定と `\d` `\w` `\s`）、連接、`|`、`*` `+` `?` `{n,m}`（n と m は 0〜3）と最短一致版、`(...)`、`(?:...)`、`(?<name>...)`、`^` `$` `\b` `\B`。深さは 4 まで。
- flag は `ignore_case`、`multiline`、`dot_all` をそれぞれランダムに。
- 入力は同じ文字の集合から長さ 0〜8。

brix の pbt に選択や再帰の組み合わせの関数が無ければ、`Gen` を直接組み立てる。そのこと自体を friction として記録する（行き先は brix。出すのは user）。

- [ ] **Step 3: 差分テストを書いて走らせる**

性質: どの pattern、flag、入力でも、`find` の結果（一致の有無、start、end、各 group の位置）が正解役と同じ。pattern が `RegexSyntax` になったら、それは生成器か syntax のバグなので失敗にする。

Run: `cd regex && mise exec -- emela test`
Expected: PASS。失敗したら、brix が縮めた反例を固定のテストとして `find_test.emel` に足してから、原因（syntax、class、vm、生成器）を直す。直したものと反例を report に書く。

- [ ] **Step 4: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`。commit のときの `emela test` が 1 分を超えるなら、pbt の件数を下げ、件数を report に書く。

```bash
git add regex friction
git commit --no-gpg-sign -m "test: JS の RegExp を正解役にした差分テストを足す"
```

---

### Task 9: 文書と全体設計

**Files:**
- Modify: `regex/README.md`
- Modify: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`
- Modify: `friction/*.md`（この R で書いたもの）

- [ ] **Step 1: regex の README を書く**

`regex/README.md`（日本語、句読点は `，．`。x の `base64/README.md` の形）: 何を受け付けるか（ECMAScript の `u` の正規な部分集合。受け付けないもの），線形時間の保証，使い方の例（`compile`，`find`，`replace`），関数の表，JS と違う点（`split` は capture を挟まない），論文への参照．

- [ ] **Step 2: 全体設計を直す**

`docs/superpowers/specs/2026-11-23-kbdcast-design.md`:
- §7 の「Pome の置き場所（source path）は最初の tag を打つときに決める…」の行を、「汎用の Pome（text、regex、後の pty）は `emela-lang/x` の形で作り、x に出すときに source path を `github.com/emela-lang/x/<name>` に変える。出すのは user」にする。
- §7 のディレクトリの図に `text/` を足す。
- §13 の表に 3 行を足す: 「String の部分文字列と code point からの組み立て」（friction 002 の番号に合わせる。行き先は proposal）、「regex の x への持ち込み」（行き先は x への issue と PR）、「brix の pbt の組み合わせの関数」（Task 8 で記録したときだけ。行き先は brix）。

- [ ] **Step 3: friction のメモを見直す**

この R で書いたメモの欄がすべて埋まっていること、予想した friction（spec §10）がそれぞれ「起きた」か「起きなかった」かが分かることを確かめる。起きなかったものは、メモを作らず report に書く。

- [ ] **Step 4: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add regex/README.md docs/superpowers/specs/2026-11-23-kbdcast-design.md friction
git commit --no-gpg-sign -m "docs: regex の README を書き、全体設計に x への持ち込みと貢献候補を足す"
```
