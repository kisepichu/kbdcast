# サブプロジェクト 2: key codec Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キーの型（`Key`）と、vim の表記、encode（WezTerm の既定の符号化）、decode（`i` イベントの bytes）を、root の core の Pome に作る。

**Architecture:** root に最初の Pome `github.com/kisepichu/kbdcast` を置く。`src/key.emel` が正規形の `Key` を持ち、`src/key/notation.emel`、`src/key/decode.emel`、`src/key/encode.emel` がその 3 つの変換を持つ。どれも純粋な関数で、effect を使わない。encode の正解は、WezTerm の端末の層が使う termwiz 0.22.0 を Rust の harness から呼んで生成した表（`test/key_golden.emel`）。

**Tech Stack:** Emela（版は `mise.toml`）、JS ターゲットを Bun で、brix（assert と pbt）、Bun 上の TypeScript（道具）、Rust（termwiz の harness）。

**Spec:** `docs/superpowers/specs/2026-11-27-kbdcast-2-key-codec-design.md`

## Emela のコードを計画に書かない理由

この repo の規則（`AGENTS.md` の wish-first）では、実装する agent が spec を調べる前に自分で「こう書きたい」コードを書き、回り道を記録する。計画に Emela のコードを書くと、その発見が消える。そこで Emela のタスクには、ファイル、公開する名前と型、振る舞い、テストの入力と期待値、手順だけを書く。TypeScript と Rust（道具と正解役）は、完全なコードを書く。生成する Emela の表（データだけ）は、生成する道具のコードの中に書く。

## Global Constraints

- Emela の版を**固定する**のは `mise.toml` の `"github:emela-lang/emela"` だけ。`Pome.toml` の `emela` は必須の欄（その Pome が要る compiler の最小の版）で、値は今の `mise.toml` の版（`0.28.2`）にする。
- `Pome.toml` に `license` は書かない（kbdcast の repo の license は未定）。
- ターゲットは JS（`EMELA_JS_HOST = "bun"`）。`emela` は `mise exec --` で呼ぶ。
- root の Pome: name `github.com/kisepichu/kbdcast`、version `0.1.0`。依存は `[dev-dependencies]` の brix（`"github.com/emela-lang/brix" = "v0.4.0"`、regex と同じ版）だけ。
- module の置き場所と公開する名前と型は、各タスクの Interfaces のとおり。Emela の制約で変える必要があれば、回り道として記録してから `NEEDS_CONTEXT` で止まる（自分で変えない）。
- `src/` には `@external` も effect も置かない。純粋な関数だけ。
- 振る舞いは spec の §4〜§7 で決まる。encode の bytes は golden の表（termwiz）が正。spec §6 の表と golden が食い違ったら golden に従い、食い違いを report に書く（spec を直すのは manager）。
- encode は spec §6 の規則で bytes か `Unencodable` を決める。encode の中で decode を呼んで確かめる形にはしない（そうすると、golden のテストが encode 自身を確かめるだけになる）。「代表」（spec §6 の表）は test の側だけに置く。
- library のエラーメッセージは英語。道具のメッセージと文書は日本語。コードのコメントは英語。
- 位置と offset は code point の単位。
- 新しい単位を書くときは `AGENTS.md` の wish-first に従う（wish を書き、`mise exec -- bun tools/wish.ts check` し、wish だけを commit してから spec を調べて実装する）。回り道は `FRICTION(NNN)` とメモで記録する。黙って回避しない。
- commit は branch `sp2/key-codec` に積み、最後に PR を作って merge commit で main に入れる。message は `type: 日本語の説明`。`git commit --no-gpg-sign` を使う。`--no-verify` は使わない。`git add` はパスを指定する（`-A` や `.` を使わない）。
- emela-lang の repo（emela、x、brix）には、issue、PR、コメントを出さない。

## File Structure

| ファイル | 責務 |
|---|---|
| `tools/wish.ts`、`tools/test/wish.test.ts` | wish の Pome を、上に向かって探さず wish-target から決める（issue #12） |
| `Pome.toml`、`Pome.lock`、`src/lib.emel` | root の Pome。`lib.emel` は library root で、中身を持たない |
| `src/key.emel` | `Key`、`KeyCode`、`Mods`、`FKey` と、正規形を作る関数 |
| `src/key/notation.emel` | vim の表記（`parse`、`print`、`NotationError`） |
| `src/key/decode.emel` | `Decoded`、`decode` |
| `src/key/encode.emel` | `InputModes`、`encode`、`Unencodable` |
| `tools/termwiz-golden/` | termwiz 0.22.0 が送る bytes を出す Rust の harness |
| `tools/gen-key-golden.ts` | harness の出力から `test/key_golden.emel` を作る |
| `test/key_golden.emel` | 生成した golden の表 |
| `test/golden.emel` | golden の行を `Key` と `InputModes` にする補助と、代表（spec §6） |
| `test/key_gen.emel` | pbt の生成器（正規形の `Key`、`InputModes`） |
| `test/*_test.emel` | テスト |
| `friction/NNN-*.md` | 回り道の記録 |

---

### Task 1: wish の Pome を wish-target から決める（issue #12）

root に `Pome.toml` ができると、`tools/wish.ts` は入れ子の新しい Pome（`pty/src/lib.emel` など）の wish で root の `Pome.toml` を見つけ、root で `emela check` する。root は `pty/src/` を読まないので、wish は compile されないまま `# (診断なし)` になる。Pome を上に向かって探すのをやめ、wish-target の最初の `src` か `test` の前のディレクトリを、その wish の Pome とする。

**Files:**
- Modify: `tools/wish.ts`
- Test: `tools/test/wish.test.ts`

**Interfaces:**
- Produces: `pomeDir(target: string): string | undefined`（Pome のディレクトリ。root は `""`）、`provisionalManifest(dir: string, emelaVersion: string): { path: string; text: string }`

- [ ] **Step 1: 失敗するテストを書く**

`tools/test/wish.test.ts` の import と、`provisionalManifest` の 3 つのテストを置き換え、#12 の回帰テストを足す。

import（5 行目）:

```ts
import { checkWish, pomeDir, provisionalManifest, readTarget, stripDiagnostics, withDiagnostics } from "../wish";
```

`node:fs` の import に `readFileSync` を足す:

```ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
```

27〜44 行目の 3 つのテストを、次に置き換える:

```ts
test("a wish-target under the root src or test belongs to the root Pome", () => {
  expect(pomeDir("src/recorder.emel")).toBe("");
  expect(pomeDir("test/key_test.emel")).toBe("");
  expect(provisionalManifest("", "0.28.2")).toEqual({
    path: "Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
});

test("a nested wish-target belongs to the directory before the first src or test", () => {
  expect(pomeDir("text/src/lib.emel")).toBe("text");
  expect(pomeDir("regex/test/src/match.emel")).toBe("regex");
  expect(provisionalManifest("text", "0.28.2")).toEqual({
    path: "text/Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast/text"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
});

test("a wish-target with neither a src nor a test segment belongs to no Pome", () => {
  expect(pomeDir("notes/a.emel")).toBeUndefined();
});

test("a wish for a new nested Pome is compiled even when the root has a Pome.toml (issue #12)", () => {
  const root = mkdtempSync(join(tmpdir(), "kbdcast-wish-test-"));
  try {
    const miseToml = readFileSync(join(import.meta.dir, "..", "..", "mise.toml"), "utf8");
    writeFileSync(join(root, "mise.toml"), miseToml);
    writeFileSync(join(root, "Pome.toml"), provisionalManifest("", "0.28.2").text);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "lib.emel"), "");
    mkdirSync(join(root, "wish"));
    writeFileSync(join(root, "wish", "pty.emel"), "# wish-target: pty/src/lib.emel\nimport Nope\n");
    expect(checkWish(root, "wish/pty.emel")).toContain("error[E0205]: undefined module `Nope`");
    expect(readFileSync(join(root, "wish", "pty.emel"), "utf8")).toContain(
      "# (Pome.toml は wish check が仮に置いた: pty/Pome.toml)",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a wish-target outside every Pome's src and test is rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "kbdcast-wish-test-"));
  try {
    mkdirSync(join(root, "wish"));
    writeFileSync(join(root, "wish", "notes.emel"), "# wish-target: notes/a.emel\nfn f() { 1 }\n");
    expect(() => checkWish(root, "wish/notes.emel")).toThrow("notes/a.emel が Pome の src/ か test/ の下を指していない");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Run: `mise exec -- bun test tools/test/wish.test.ts`
Expected: FAIL（`pomeDir` が export されていない。#12 の回帰テストは、今の実装では出力が `""` になる）

- [ ] **Step 2: 実装する**

`tools/wish.ts` の 4 行目のコメントを次にする:

```ts
// The Pome of a wish is the directory that its wish-target names (see pomeDir); when it has no Pome.toml yet, the copy gets a
// provisional one (see provisionalManifest).
```

34〜52 行目（`provisionalManifest` と `findPome`）を次に置き換える:

```ts
// The directory of the Pome whose src/ or test/ holds `target` (repo-relative, "" for the root): the segments before the first
// `src` or `test` segment. Undefined when the target has neither segment.
export function pomeDir(target: string): string | undefined {
  const segments = target.split("/");
  const at = segments.findIndex((s) => s === "src" || s === "test");
  return at === -1 ? undefined : segments.slice(0, at).join("/");
}

// The Pome.toml that the check places in the copy when the Pome in `dir` does not exist yet.
export function provisionalManifest(dir: string, emelaVersion: string): { path: string; text: string } {
  const name = dir === "" ? "github.com/kisepichu/kbdcast" : `github.com/kisepichu/kbdcast/${dir}`;
  return { path: dir === "" ? "Pome.toml" : `${dir}/Pome.toml`, text: `[pome]\nname = "${name}"\nversion = "0.1.0"\nemela = "${emelaVersion}"\n` };
}
```

`checkWish` の `rel` の検査（65 行目）の直後に、Pome の決定を移す。66〜79 行目を次に置き換える:

```ts
    // The Pome is the one the target names, not the nearest Pome.toml above it: the root's Pome.toml does not read a nested
    // Pome's src/, so checking there would report no diagnostics for a wish that was never compiled (issue #12).
    const dir = pomeDir(rel);
    if (dir === undefined) throw new Error(`${target} が Pome の src/ か test/ の下を指していない`);
    mkdirSync(dirname(placed), { recursive: true });
    writeFileSync(placed, body);
    const pome = join(copy, dir);
    let provisional: string | undefined;
    if (!existsSync(join(pome, "Pome.toml"))) {
      const pinned = pinnedEmelaVersion(readFileSync(join(root, "mise.toml"), "utf8"));
      if (!pinned) throw new Error('mise.toml に "github:emela-lang/emela" の版が書かれていない');
      const manifest = provisionalManifest(dir, pinned);
      writeFileSync(join(copy, manifest.path), manifest.text);
      provisional = manifest.path;
    }
```

（`rel` は正規化した target なので、`./text/src/a.emel` も Pome `text` になる。）

Run: `mise exec -- bun test tools/test`
Expected: PASS

- [ ] **Step 3: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit`
Expected: `tools/check: ok`

```bash
git add tools/wish.ts tools/test/wish.test.ts
git commit --no-gpg-sign -m "fix: wish の Pome を wish-target から決め、root の Pome.toml があっても入れ子の新しい Pome の wish を検査する"
```

---

### Task 2: root の Pome と key の型

**Files:**
- Create: `wish/key.emel`
- Create: `Pome.toml`、`Pome.lock`、`src/lib.emel`、`src/key.emel`
- Test: `test/key_test.emel`

**Interfaces:**
- Produces（module `Key`、`src/key.emel`）:
  - `pub opaque type Key`（code と mods を持つ。作れるのは `key` だけ）
  - `pub enum KeyCode { Char(Int) | Enter | Esc | Tab | Backspace | Delete | Insert | Up | Down | Left | Right | Home | End | PageUp | PageDown | Function(FKey) }`（計画では `F(FKey)` と書いたが、小文字を含まない `F` は `[lex.name]` で構成子の名前にならないので `Function` にした。ESCALATION 1、friction 034）
  - `pub type Mods(ctrl: Bool, alt: Bool, shift: Bool, super: Bool)` と `pub const NO_MODS: Mods`（4 つとも False）
  - `pub opaque type FKey`、`pub fn f_key(n: Int) -> Option[FKey]`（1〜12 のときだけ `Some`）、`pub fn f_number(f: FKey) -> Int`
  - `pub fn key(code: KeyCode, mods: Mods) -> Option[Key]`（spec §4 の正規形にする。`None` は `Char` が scalar value でないときだけ）
  - `pub fn code(k: Key) -> KeyCode`、`pub fn mods(k: Key) -> Mods`
  - `Key`、`KeyCode`、`Mods`、`FKey` の `Eq` と `Show`（テストの `assert ==` と失敗の表示に要る）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/key.emel`（`# wish-target: src/key.emel`）。opaque な `Key` と、正規形を作る `key` の形（Shift の畳み込み、制御文字の扱い）を書く。root に Pome はまだ無いので、wish check が仮の root の `Pome.toml` を置く。

Run: `mise exec -- bun tools/wish.ts check wish/key.emel`

```bash
git add wish/key.emel
git commit --no-gpg-sign -m "wish: key の型の理想形を書く"
```

- [ ] **Step 2: Pome を置き、spec を調べる**

`Pome.toml`:

```toml
[pome]
name = "github.com/kisepichu/kbdcast"
version = "0.1.0"
emela = "0.28.2"
```

brix を足す: `mise exec -- emela pome add --dev github:emela-lang/brix && mise exec -- emela pome install`（`[dev-dependencies]` の版が `v0.4.0` になることを確かめる）

`src/lib.emel` は空のファイルにする（library root。2 では中身を持たない）。空のファイルが通らなければ、回り道として記録する。

Emela の spec は `module.opaque`、`data.type`、`data.enum`、`data.const`、`api.string`（code point）、`type.rules`（Eq と Show の導出）。

- [ ] **Step 3: 失敗するテストを書く**

`test/key_test.emel`。`key(code, mods)` の結果を、`code` と `mods` で確かめる。表の `+` は、その修飾を True にした `Mods`（無ければ `NO_MODS`）。

| 入力 | 結果の code | 結果の mods |
|---|---|---|
| `Char(0x61)` | `Char(0x61)` | なし |
| `Char(0x61)` + shift | `Char(0x41)` | なし |
| `Char(0x41)` + shift | `Char(0x41)` | なし |
| `Char(0x21)`（`!`）+ shift | `Char(0x21)` | なし |
| `Char(0x7E)`（`~`）+ shift | `Char(0x7E)` | なし |
| `Char(0x31)`（`1`）+ shift | `Char(0x31)` | shift |
| `Char(0x20)` + shift | `Char(0x20)` | shift |
| `Char(0xE9)`（`é`）+ shift | `Char(0xE9)` | shift |
| `Up` + shift | `Up` | shift |
| `Char(0x41)` + ctrl | `Char(0x41)` | ctrl |
| `Char(0x61)` + ctrl + shift | `Char(0x41)` | ctrl |
| `Char(0x61)` + alt + shift | `Char(0x41)` | alt |
| `Char(0x61)` + super | `Char(0x61)` | super |
| `Char(0x01)` | `Char(0x61)` | ctrl |
| `Char(0x01)` + alt | `Char(0x61)` | ctrl + alt |
| `Char(0x01)` + shift | `Char(0x41)` | ctrl |
| `Char(0x1A)` | `Char(0x7A)` | ctrl |
| `Char(0x00)` | `Char(0x20)` | ctrl |
| `Char(0x09)` | `Tab` | なし |
| `Char(0x09)` + shift | `Tab` | shift |
| `Char(0x0D)` | `Enter` | なし |
| `Char(0x1B)` | `Esc` | なし |
| `Char(0x08)` | `Backspace` | なし |
| `Char(0x7F)` | `Backspace` | なし |
| `Char(0x0A)` | `Char(0x6A)` | ctrl |
| `Char(0x1C)` | `Char(0x5C)` | ctrl |
| `Char(0x1D)` | `Char(0x5D)` | ctrl |
| `Char(0x1E)` | `Char(0x5E)` | ctrl |
| `Char(0x1F)` | `Char(0x5F)` | ctrl |
| `Char(0x3042)` | `Char(0x3042)` | なし |
| `Char(0x1F600)` | `Char(0x1F600)` | なし |

`None` になるもの: `Char(0xD800)`、`Char(0xDFFF)`、`Char(0x110000)`、`Char(-1)`。

`f_key`: `f_key(0)` と `f_key(13)` は `None`。`f_key(1)` と `f_key(12)` は `Some` で、`f_number` がその数を返す。`key(Function(f), NO_MODS)` は `Some` で、`code` が `Function(f)`。

正規形は 2 回かけても変わらない: 上の表の各行の結果 `k` について、`key(code(k), mods(k)) == Some(k)`。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/key.emel`。spec §4 のとおり。制御文字は、spec §6 の代表の表の代表にし、もとの修飾を足してから、もう一度正規形にする（`Char(0x01)` + shift → `a` と ctrl と shift → `A` と ctrl）。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add Pome.toml Pome.lock src/lib.emel src/key.emel test/key_test.emel
git commit --no-gpg-sign -m "feat: root の Pome を置き、正規形の Key を作る"
```

---

### Task 3: vim の表記（parse と print）

**Files:**
- Create: `wish/notation.emel`、`src/key/notation.emel`
- Create: `test/key_gen.emel`
- Modify: `tools/lint/foundation.allow`
- Test: `test/notation_test.emel`

**Interfaces:**
- Consumes: Task 2 の `Key`、`KeyCode`、`Mods`、`NO_MODS`、`FKey`、`f_key`、`f_number`、`key`、`code`、`mods`
- Produces（module `Key.Notation`、`src/key/notation.emel`）:
  - `pub error NotationError(message: String, offset: Int)`
  - `pub fn parse(s: String) -> List[Key] fails NotationError`
  - `pub fn print(k: Key) -> String`
- Produces（test の module `KeyGen`、`test/key_gen.emel`）: brix の pbt の生成器 `pub fn keys() -> Gen[Key]`（Task 6 も使う）。文字は、ASCII の印字できる文字、`é`（U+E9）、`あ`（U+3042）、`😀`（U+1F600）、制御文字（0x00〜0x1F、0x7F）から選び、特殊キーと F1〜F12 も混ぜる。修飾は 4 つを独立に選ぶ。`key` を通すので、出るのは正規形だけ。brix の使い方は `regex/test/differential_test.emel` と `regex/test/pattern_gen.emel` を見る（選択の関数が無いことは friction 028）
  - 実装では（ESCALATION 3）、文字を scalar value 全体（surrogate を除く BMP、私用領域、補助面）からも選ぶようにし、super を含まない `pub fn keys_without_super() -> Gen[Key]` を足した。

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/notation.emel`（`# wish-target: src/key/notation.emel`）。`parse` の読み方（`<` の 3 通りの扱い、名前と修飾の読み方）と `print` の形を書く。

Run: `mise exec -- bun tools/wish.ts check wish/notation.emel`

```bash
git add wish/notation.emel
git commit --no-gpg-sign -m "wish: 表記の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `error.fail`、`api.string`、`api.list`、`data.enum`、`fn.loop`（再帰の形）。kbdcast の spec は §5。

- [ ] **Step 3: 失敗するテストを書く**

`test/notation_test.emel`。`parse(s)` の結果を `print` した列で確かめる（表の右は `print` の結果を空白で区切ったもの。`<Space>` は空白のキー）。

| `s` | `parse(s).map(print)` |
|---|---|
| `abc` | `a` `b` `c` |
| `a b` | `a` `<Space>` `b` |
| `あ😀` | `あ` `😀` |
| `<CR>` `<cr>` `<Enter>` `<Return>`（別々に） | `<CR>` |
| `<Esc><Tab><BS><Del><Insert>` | `<Esc>` `<Tab>` `<BS>` `<Del>` `<Insert>` |
| `<Up><Down><Left><Right><Home><End><PageUp><PageDown>` | 同じ 8 個 |
| `<F1><f12>` | `<F1>` `<F12>` |
| `<Space><lt><LT>` | `<Space>` `<lt>` `<lt>` |
| `<C-x>` `<c-x>` `<C-X>`（別々に） | `<C-x>` |
| `<C-S-x>` `<S-C-x>` `<C-S-X>`（別々に） | `<C-S-x>` |
| `<M-x>` `<A-x>`（別々に） | `<M-x>` |
| `<M-X>` | `<M-X>` |
| `<S-a>` `<s-A>`（別々に） | `A` |
| `<S-!>` | `!` |
| `<S-1>` | `<S-1>` |
| `<S-Up>` | `<S-Up>` |
| `<D-S-M-C-Up>` | `<C-M-S-D-Up>` |
| `<C-]><C->><C--><C-Space><M-lt><M-あ>` | `<C-]>` `<C->>` `<C-->` `<C-Space>` `<M-lt>` `<M-あ>` |
| `<C-S-1>` | `<C-S-1>` |
| `<C-M-S-a>` | `<C-M-S-a>` |
| `a < b` | `a` `<Space>` `<lt>` `<Space>` `b` |
| `<C-x` | `<lt>` `C` `-` `x` |
| `<<EOF` | `<lt>` `<lt>` `E` `O` `F` |
| `<` | `<lt>` |
| `<>` | `<lt>` `>` |
| `x<CR>` | `x` `<CR>` |
| （空） | （空の List） |

error（`message` は完全に一致させる。`offset` は問題の `<` の code point の offset）:

| `s` | `offset` | `message` |
|---|---|---|
| `<Ecs>` | 0 | `unknown key name: <Ecs>` |
| `ab<Foo>` | 2 | `unknown key name: <Foo>` |
| `<C-Foo>` | 0 | `unknown key name: <C-Foo>` |
| `<Q-x>` | 0 | `unknown key name: <Q-x>` |
| `<x>` | 0 | `unknown key name: <x>` |
| `<F0>` | 0 | `unknown key name: <F0>` |
| `<F13>` | 0 | `unknown key name: <F13>` |
| `あ<C-C-x>` | 1 | `duplicate modifier in <C-C-x>` |

性質（`KeyGen.keys()`、brix の pbt）: すべての `k` で `parse(print(k)) == [k]`。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/key/notation.emel`。spec §5 のとおり。`<C-A>` を `<C-a>` にする小文字化と、`print` の `<C-S-a>` の形は、ASCII の英字だけに当てる（`é` などの大文字と小文字は、そのまま文字として持つ）。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す:

```text
src/key/notation.emel  # 公開 API の parse が NotationError を宣言する（tape の行の誤りを、tape のパーサが行番号を足して外に出す）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/key/notation.emel test/notation_test.emel test/key_gen.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: キーの vim の表記を読み書きする"
```

---

### Task 4: decode

**Files:**
- Create: `wish/decode.emel`、`src/key/decode.emel`
- Test: `test/decode_test.emel`

**Interfaces:**
- Consumes: Task 2 の `Key` の関数、Task 3 の `print`（テストの表示だけ）
- Produces（module `Key.Decode`、`src/key/decode.emel`）:
  - `pub enum Decoded { Key(Key) | Paste(String) | Unknown(Bytes) }`（spec §3 のとおり、`key.emel` でなくここに置く。friction 030）
  - `pub fn decode(b: Bytes) -> List[Decoded]`
  - `Decoded` の `Eq` と `Show`

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/decode.emel`（`# wish-target: src/key/decode.emel`）。bytes を前から読む形（`Bytes.get` と offset の再帰か、`to_list` の List の pattern か）と、CSI の列の切り出しを書く。

Run: `mise exec -- bun tools/wish.ts check wish/decode.emel`

```bash
git add wish/decode.emel
git commit --no-gpg-sign -m "wish: decode の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `api.std.bytes`、`api.list`、`data.enum`。kbdcast の spec は §7（読む順と、読める CSI の列）と §6（代表）。

- [ ] **Step 3: 失敗するテストを書く**

`test/decode_test.emel`。入力は 16 進（`Bytes.hex`）。結果は、`Key(k)` を `print(k)`、`Paste(s)` を `paste(s)`、`Unknown(b)` を `unknown(16 進)` と書いた列で確かめる（この表示はテストの補助関数で作る）。

| 入力 | 結果 |
|---|---|
| （空） | （空） |
| `616263` | `a` `b` `c` |
| `e38182` | `あ` |
| `f09f9880` | `😀` |
| `0d` | `<CR>` |
| `0d0a` | `<CR>` |
| `0d0d` | `<CR>` `<CR>` |
| `0a` | `<C-j>` |
| `09` | `<Tab>` |
| `08` | `<BS>` |
| `7f` | `<BS>` |
| `00` | `<C-Space>` |
| `01` | `<C-a>` |
| `1a` | `<C-z>` |
| `1c` `1d` `1e` `1f`（別々に） | `<C-\>`、`<C-]>`、`<C-^>`、`<C-_>` |
| `1b` | `<Esc>` |
| `1b1b` | `<M-Esc>` |
| `1b61` | `<M-a>` |
| `1b41` | `<M-A>` |
| `1b01` | `<C-M-a>` |
| `1b7f` | `<M-BS>` |
| `1b0d0a` | `<M-CR>` |
| `1be38182` | `<M-あ>` |
| `1b5b` | `<M-[>` |
| `1b4f` | `<M-O>` |
| `1bff` | `<Esc>` `unknown(ff)` |
| `1b5b41` `1b5b42` `1b5b43` `1b5b44`（別々に） | `<Up>`、`<Down>`、`<Right>`、`<Left>` |
| `1b4f41` | `<Up>` |
| `1b5b48` `1b5b46` `1b4f48` `1b4f46`（別々に） | `<Home>`、`<End>`、`<Home>`、`<End>` |
| `1b5b313b3541` | `<C-Up>` |
| `1b5b313b3248` | `<S-Home>` |
| `1b1b5b41` | `<M-Up>` |
| `1b5b327e` `1b5b337e` `1b5b357e` `1b5b367e`（別々に） | `<Insert>`、`<Del>`、`<PageUp>`、`<PageDown>` |
| `1b5b333b357e` | `<C-Del>` |
| `1b4f50` `1b4f53`（別々に） | `<F1>`、`<F4>` |
| `1b5b313b3250` | `<S-F1>` |
| `1b5b31357e` `1b5b31377e` `1b5b32317e` `1b5b32337e` `1b5b32347e`（別々に） | `<F5>`、`<F6>`、`<F10>`、`<F11>`、`<F12>` |
| `1b5b32343b357e` | `<C-F12>` |
| `1b5b5a` | `<S-Tab>` |
| `1b5b313b355a` | `<C-S-Tab>` |
| `1b1b5b5a` | `<M-S-Tab>` |
| `1b5b393b3575` | `<C-Tab>` |
| `1b5b39373b3575` | `<C-a>` |
| `1b5b32373b353b39377e` | `<C-a>` |
| `1b5b32373b353b36357e` | `<C-S-a>` |
| `1b5b32373b353b3130357e` | `<C-i>` |
| `1b5b32373b323b34397e` | `<S-1>` |
| `1b5b32373b323b33327e` | `<S-Space>` |
| `1b5b32373b323b397e` | `<S-Tab>` |
| `1b5b32373b323b31337e` | `<S-CR>` |
| `1b5b32373b323b32377e` | `<S-Esc>` |
| `1b5b32373b323b3132377e` | `<S-BS>` |
| `1b5b32373b353b387e` | `<C-BS>` |
| `1b5b32373b333b3233337e` | `<M-é>` |
| `1b5b3230307e68656c6c6f1b5b3230317e` | `paste(hello)` |
| `1b5b3230307e611b5b3230317e62` | `paste(a)` `b` |
| `1b5b3230307e6162` | `paste(ab)` |
| `1b5b3230307eff1b5b3230317e` | `unknown(1b5b3230307eff1b5b3230317e)` |
| `1b5b3f3175` | `unknown(1b5b3f3175)` |
| `1b5b3f317561` | `unknown(1b5b3f3175)` `a` |
| `1b5b39373a36353b3275` | `unknown(1b5b39373a36353b3275)` |
| `1b5b353733393975` | `unknown(1b5b353733393975)` |
| `1b5b313b3941` | `unknown(1b5b313b3941)` |
| `1b5b31` | `unknown(1b5b31)` |
| `611b5b313b` | `a` `unknown(1b5b313b)` |
| `ff` | `unknown(ff)` |
| `61fffe62` | `a` `unknown(fffe)` `b` |
| `e381` | `unknown(e381)` |

（`1b5b353733393975` は `CSI 57399 u`。`;m` が無いので読めない列。`1b5b39373a36353b3275` は `CSI 97:65;2u` で、`:` の付いた kitty の拡張。`1b5b313b3941` は修飾の番号 9 で、Shift、Alt、Ctrl のほかのビットが立っている。）

実装で足した行（ESCALATION 2、3。spec §7 に規則を足した）: `1b1b5b` → `<M-Esc>` `[`、`1b1b4f` → `<M-Esc>` `O`、`1b5b0d` → `unknown(1b5b)` `<CR>`、`1b5b31203141` → `unknown(1b5b3120)` `1` `A`。私用領域は、`CSI 57399;5u` と `CSI 57344;5u` が unknown、`CSI 63744;5u` が `<C-\u{F900}>`、`CSI 27;5;57399~` が `<C-\u{E037}>`。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/key/decode.emel`。spec §7 のとおり。UTF-8 の検査は `Bytes.decode_utf8` を使う。UTF-8 を 1 byte ずつ自前で読むなら、それは回り道として記録する（`AGENTS.md` の規則 2）。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/key/decode.emel test/decode_test.emel
git commit --no-gpg-sign -m "feat: i イベントの bytes をキーの列に decode する"
```

---

### Task 5: termwiz の golden の表

**Files:**
- Create: `tools/termwiz-golden/Cargo.toml`、`tools/termwiz-golden/Cargo.lock`、`tools/termwiz-golden/src/main.rs`
- Create: `tools/gen-key-golden.ts`
- Create: `test/key_golden.emel`（生成）、`test/golden.emel`
- Modify: `mise.toml`、`AGENTS.md`
- Test: `test/golden_test.emel`

**Interfaces:**
- Consumes: Task 2 の `Key` の関数、Task 4 の `decode` と `Decoded`
- Produces:
  - module `KeyGolden`（`test/key_golden.emel`、生成）: `pub const ROWS: List[(String, Int, List[String])]`。各行は、キー（1 文字か特殊キーの名前）、xterm の修飾のビット（1 Shift、2 Alt、4 Ctrl）、12 の mode での bytes の 16 進。mode の順は `6 × DECCKM + 3 × LNM + modifyOtherKeys`（それぞれ 0 から）
  - module `Golden`（`test/golden.emel`）: `pub fn row_key(name: String, bits: Int) -> Key`（termwiz に渡したのと同じキーを `key` で作る。名前は `Enter`、`Esc`、`Tab`、`Backspace`、`Delete`、`Insert`、`Up`、`Down`、`Left`、`Right`、`Home`、`End`、`PageUp`、`PageDown`、`F1`〜`F12`）

- [ ] **Step 1: Rust の版を固定し、harness を書く**

`mise.toml` の `[tools]` に 1 行足す:

```toml
rust = "1.96.0"
```

Run: `mise install`

`tools/termwiz-golden/Cargo.toml`:

```toml
[package]
name = "termwiz-golden"
version = "0.1.0"
edition = "2021"
publish = false

# termwiz 0.22.0 is the key encoder of WezTerm 20230712-072601-f4abf8fd (term/src/terminalstate/keyboard.rs calls
# KeyCode::encode). Its encode differs from termwiz main (0.24.0) only in F13 to F24, which kbdcast leaves out.
[dependencies]
termwiz = "=0.22.0"
```

`tools/termwiz-golden/src/main.rs`:

```rust
// Prints what termwiz (the key encoder of the WezTerm terminal layer) sends for each key of the kbdcast
// key codec's golden table. tools/gen-key-golden.ts turns the output into test/key_golden.emel.
//
// One line per key and modifier combination, separated by tabs:
//   <key> <mods> <hex of the bytes in each of the 12 modes>
// <key> is `U+XXXX` for a character, or the name of a special key. <mods> is the xterm modifier bits
// (1 Shift, 2 Alt, 4 Ctrl). The modes are in the order of `modes()`.
use termwiz::input::{KeyCode, KeyCodeEncodeModes, KeyboardEncoding, Modifiers};

const SPECIAL: [(&str, KeyCode); 14] = [
    ("Enter", KeyCode::Enter),
    ("Esc", KeyCode::Escape),
    ("Tab", KeyCode::Tab),
    ("Backspace", KeyCode::Backspace),
    ("Delete", KeyCode::Delete),
    ("Insert", KeyCode::Insert),
    ("Up", KeyCode::UpArrow),
    ("Down", KeyCode::DownArrow),
    ("Left", KeyCode::LeftArrow),
    ("Right", KeyCode::RightArrow),
    ("Home", KeyCode::Home),
    ("End", KeyCode::End),
    ("PageUp", KeyCode::PageUp),
    ("PageDown", KeyCode::PageDown),
];

// The printable ASCII characters, three characters outside ASCII (2, 3 and 4 bytes of UTF-8), the special keys and F1 to F12.
fn keys() -> Vec<(String, KeyCode)> {
    let code_points = (0x20u32..=0x7e).chain([0xe9, 0x3042, 0x1f600]);
    let chars = code_points.map(|c| (format!("U+{:04X}", c), KeyCode::Char(char::from_u32(c).unwrap())));
    let special = SPECIAL.iter().map(|(name, code)| (name.to_string(), *code));
    let function = (1u8..=12).map(|n| (format!("F{}", n), KeyCode::Function(n)));
    chars.chain(special).chain(function).collect()
}

fn mods(bits: u8) -> Modifiers {
    let mut mods = Modifiers::NONE;
    if bits & 1 != 0 {
        mods |= Modifiers::SHIFT;
    }
    if bits & 2 != 0 {
        mods |= Modifiers::ALT;
    }
    if bits & 4 != 0 {
        mods |= Modifiers::CTRL;
    }
    mods
}

// DECCKM (Normal, Application) × LNM (Cr, CrLf) × modifyOtherKeys (Off, Level1, Level2), the last one varying fastest.
fn modes() -> Vec<KeyCodeEncodeModes> {
    let mut all = Vec::new();
    for application_cursor_keys in [false, true] {
        for newline_mode in [false, true] {
            for modify_other_keys in [None, Some(1), Some(2)] {
                all.push(KeyCodeEncodeModes {
                    encoding: KeyboardEncoding::Xterm,
                    application_cursor_keys,
                    newline_mode,
                    modify_other_keys,
                });
            }
        }
    }
    all
}

fn hex(s: &str) -> String {
    s.bytes().map(|b| format!("{:02x}", b)).collect()
}

fn main() {
    let modes = modes();
    for (name, code) in keys() {
        for bits in 0u8..8 {
            let encoded: Vec<String> = modes
                .iter()
                .map(|m| hex(&code.encode(mods(bits), *m, true).expect("termwiz could not encode the key")))
                .collect();
            println!("{}\t{}\t{}", name, bits, encoded.join("\t"));
        }
    }
}
```

Run: `cd tools/termwiz-golden && mise exec -- cargo run --release --quiet | wc -l`
Expected: `992`（`Cargo.lock` ができる。`target/` は `.gitignore` の `target/` で無視される）

- [ ] **Step 2: 表を作る道具を書く**

`tools/gen-key-golden.ts`:

```ts
#!/usr/bin/env bun
// Generates test/key_golden.emel from what termwiz 0.22.0 (the key encoder of the WezTerm terminal layer) sends for each key.
// usage: mise exec -- bun tools/gen-key-golden.ts
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "test", "key_golden.emel");
const HARNESS = join(ROOT, "tools", "termwiz-golden", "Cargo.toml");
const MODES = 12;

const run = Bun.spawnSync(["cargo", "run", "--release", "--quiet", "--locked", "--manifest-path", HARNESS], {
  stdout: "pipe",
  stderr: "inherit",
});
if (run.exitCode !== 0) throw new Error("termwiz-golden が失敗した");

// The key as an Emela string literal: a character as `\u{...}` (so that no character needs escaping), a special key by its name.
function key(field: string): string {
  const char = /^U\+([0-9A-F]{4,6})$/.exec(field);
  return char ? `"\\u{${char[1].replace(/^0+/, "")}}"` : `"${field}"`;
}

const rows = run.stdout
  .toString()
  .trimEnd()
  .split("\n")
  .map((line) => {
    const [name, bits, ...bytes] = line.split("\t");
    if (bytes.length !== MODES) throw new Error(`mode の数が ${MODES} でない: ${line}`);
    return `  (${key(name)}, ${bits}, [${bytes.map((b) => `"${b}"`).join(", ")}]),`;
  });

writeFileSync(
  OUT,
  `# Generated by tools/gen-key-golden.ts from termwiz 0.22.0 (tools/termwiz-golden). Do not edit.

## What termwiz sends for each key of the golden table. One entry per key and modifier combination:
## the key (one character, or the name of a special key: Enter, Esc, Tab, Backspace, Delete, Insert,
## Up, Down, Left, Right, Home, End, PageUp, PageDown, F1 to F12), the xterm modifier bits (1 Shift,
## 2 Alt, 4 Ctrl), and the bytes in hexadecimal in each of the 12 modes. The modes are DECCKM
## (Normal, Application) × LNM (Cr, CrLf) × modifyOtherKeys (Off, Level1, Level2), the last one
## varying fastest: index = 6 × DECCKM + 3 × LNM + modifyOtherKeys.
pub const ROWS: List[(String, Int, List[String])] = [
${rows.join("\n")}
]
`,
);
const fmt = Bun.spawnSync(["emela", "fmt", OUT], { stdout: "inherit", stderr: "inherit" });
if (fmt.exitCode !== 0) throw new Error("emela fmt が失敗した");
console.log(`wrote ${OUT}: ${rows.length} rows`);
```

Run: `chmod +x tools/gen-key-golden.ts && mise exec -- bun tools/gen-key-golden.ts`
Expected: `wrote …/test/key_golden.emel: 992 rows`

- [ ] **Step 3: 失敗するテストを書く**

`test/golden_test.emel`（decode だけを確かめる。encode は Task 6）:

- すべての行とすべての mode で、bytes の `decode` が、ちょうど 1 つの `Key(_)` になる（`Paste` も `Unknown` も出ない。termwiz が送るものは、どれも 1 つのキーとして読める）。
- 修飾のビットが 0 の行は、すべての mode で `decode` が `[Key(row_key(name, 0))]` になる（修飾の無いキーは、どの mode でも自分に戻る）。
- `ROWS` は 992 行で、各行の bytes は 12 個。

`test/golden.emel` に `row_key` を書く（Interfaces のとおり）。1 文字の名前は `Char` にし、修飾のビットを `Mods` にして `key` に渡す。

Run: `mise exec -- emela test .`
Expected: FAIL（`Golden` が無い）

- [ ] **Step 4: 補助を実装する**

`test/golden.emel` の `row_key`。

Run: `mise exec -- emela test .`
Expected: PASS。ちょうど 1 つのキーにならない行があれば、それは Task 4 の decode の誤りか、spec §7 の読み方の不足。spec が足りなければ、行と bytes を report に書き、`NEEDS_CONTEXT` で止まる。

- [ ] **Step 5: 文書を直す**

`AGENTS.md` の構成の表の `tools/` の行を次にする:

```markdown
|`tools/`|検査と生成の道具（Bun 上の TypeScript）。key codec の golden を作る Rust の harness（`tools/termwiz-golden/`）|—|
```

- [ ] **Step 6: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test && mise exec -- bun test tools/test`
Expected: `tools/check: ok`、tools のテストが PASS

```bash
git add mise.toml AGENTS.md tools/termwiz-golden/Cargo.toml tools/termwiz-golden/Cargo.lock tools/termwiz-golden/src/main.rs tools/gen-key-golden.ts test/key_golden.emel test/golden.emel test/golden_test.emel
git commit --no-gpg-sign -m "test: termwiz 0.22.0 から key codec の golden の表を生成し、decode を確かめる"
```

---

### Task 6: encode

**Files:**
- Create: `wish/encode.emel`、`src/key/encode.emel`
- Modify: `test/golden.emel`、`test/key_gen.emel`、`tools/lint/foundation.allow`
- Test: `test/encode_test.emel`、`test/golden_test.emel`

**Interfaces:**
- Consumes: Task 2 の `Key` の関数、Task 3 の `parse`（テストだけ）と `KeyGen.keys()`、Task 4 の `decode`（テストだけ）、Task 5 の `ROWS` と `row_key`
- Produces（module `Key.Encode`、`src/key/encode.emel`）:
  - `pub type InputModes(cursor_keys: CursorKeys, newline: Newline, other_keys: OtherKeys)`
  - `pub enum CursorKeys { Normal | Application }`、`pub enum Newline { Cr | CrLf }`、`pub enum Level { One | Two }`、`pub enum OtherKeys { Off | On(Level) }`
  - `pub const DEFAULT_MODES: InputModes`（`Normal`、`Cr`、`Off`）
  - `pub enum Reason { NeedsOtherKeys(Level) | NeedsKitty }`
  - `pub error Unencodable(key: Key, reason: Reason)`
  - `pub fn encode(key: Key, modes: InputModes) -> Bytes fails Unencodable`
- Produces（test の module `Golden` に足す）: `pub fn row_modes(index: Int) -> InputModes`（mode の番号を `InputModes` に）、`pub fn representative(k: Key, other_keys: OtherKeys) -> Key`（spec §6 の代表）。`KeyGen` に `pub fn modes() -> Gen[InputModes]`。実装では、固定の例と golden のテストが共に使う `pub enum Outcome { Sent(String), Refused(Reason) }` と `pub fn outcome(k: Key, modes: InputModes) -> Outcome` も足した（ESCALATION 3、4）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/encode.emel`（`# wish-target: src/key/encode.emel`）。`InputModes` の型と、キーの種類ごとの規則の分け方、`Unencodable` の理由の決め方を書く。

Run: `mise exec -- bun tools/wish.ts check wish/encode.emel`

```bash
git add wish/encode.emel
git commit --no-gpg-sign -m "wish: encode の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `error.fail`、`error.escape`、`api.std.bytes`、`data.type`、`data.enum`。kbdcast の spec は §6。termwiz の規則は、`~/.cargo/registry/src/*/termwiz-0.22.0/src/input.rs` の `KeyCode::encode` と `csi_u_encode`（Task 5 の build で手元にある）と、`wezterm-input-types` の `ctrl_mapping` を読んでよい。

- [ ] **Step 3: 失敗するテストを書く**

`test/encode_test.emel`。キーは `parse` で作る。mode の「既定」は `DEFAULT_MODES`、「Level1」「Level2」は `other_keys` だけを `On(One)`、`On(Two)` にしたもの、「Application」は `cursor_keys` だけ、「CrLf」は `newline` だけを変えたもの。結果は bytes の 16 進か、`Unencodable` の `reason`（`key` は正規形の入力のキー）。

| キー | mode | 結果 |
|---|---|---|
| `a` | 既定 | `61` |
| `A` | 既定 | `41` |
| `あ` | 既定 | `e38182` |
| `<C-a>` | 既定 | `01` |
| `<C-a>` | Level2 | `1b5b32373b353b39377e` |
| `<C-S-a>` | 既定 | `NeedsOtherKeys(One)` |
| `<C-S-a>` | Level1 | `1b5b32373b353b36357e` |
| `<C-i>` | 既定 | `09` |
| `<C-i>` | Level2 | `1b5b32373b353b3130357e` |
| `<C-Space>` | 既定 | `00` |
| `<S-1>` | 既定 | `NeedsOtherKeys(One)` |
| `<S-1>` | Level1 | `1b5b32373b323b34397e` |
| `<M-S-1>` | Level2 | `NeedsKitty` |
| `<C-M-1>` | Level1 | `NeedsOtherKeys(Two)` |
| `<C-é>` | 既定 | `NeedsOtherKeys(One)` |
| `<M-é>` | 既定 | `1bc3a9` |
| `<M-é>` | Level1 | `1b5b32373b333b3233337e` |
| `<M-[>` | 既定 | `1b5b` |
| `<S-Esc>` | Level1 | `NeedsOtherKeys(Two)` |
| `<S-Esc>` | Level2 | `1b5b32373b323b32377e` |
| `<S-CR>` | 既定 | `NeedsOtherKeys(One)` |
| `<CR>` | CrLf | `0d0a` |
| `<M-CR>` | CrLf | `1b0d0a` |
| `<Up>` | 既定 | `1b5b41` |
| `<Up>` | Application | `1b4f41` |
| `<C-Up>` | Application | `1b5b313b3541` |
| `<Tab>` | 既定 | `09` |
| `<S-Tab>` | 既定 | `1b5b5a` |
| `<S-Tab>` | Level1 | `1b5b32373b323b397e` |
| `<C-Tab>` | 既定 | `1b5b393b3575` |
| `<C-S-Tab>` | 既定 | `1b5b313b355a` |
| `<BS>` | 既定 | `7f` |
| `<C-BS>` | 既定 | `08` |
| `<S-BS>` | Level1 | `NeedsOtherKeys(Two)` |
| `<Del>` | 既定 | `1b5b337e` |
| `<F1>` | 既定 | `1b4f50` |
| `<S-F1>` | 既定 | `1b5b313b3250` |
| `<F5>` | 既定 | `1b5b31357e` |
| `<C-F12>` | 既定 | `1b5b32343b357e` |

super: `<D-a>`、`<D-Up>`、`<C-D-x>` は、12 のどの mode（`row_modes(0)`〜`row_modes(11)`）でも `NeedsKitty`。

`test/golden_test.emel` に足す（spec §8）。すべての行 `(name, bits, hexes)` とすべての mode の番号 `i` について、`k = row_key(name, bits)`、`m = row_modes(i)`、`t = Bytes.hex(hexes[i])` とする:

- `decode(t) == [Key(representative(k, m.other_keys))]` なら、`encode(k, m)` は成功して `t` を返す。
- そうでなければ、`encode(k, m)` は `Unencodable(k, reason)` で失敗する。`reason` は、`other_keys` を今より上の段階（Off なら `On(One)` と `On(Two)`、`On(One)` なら `On(Two)`）に順に変えた mode のうち、上の条件を満たす最初の段階の `NeedsOtherKeys`。どれも満たさなければ `NeedsKitty`。

`test/golden.emel` の `representative` は spec §6 の表のとおり。`other_keys` が `On(Two)` なら `k` そのもの。そうでなければ、Alt を外したキーが表の「同じ組」にあれば代表に変え、外した Alt を戻す（表の組は `parse` で作ってよい）。

性質（`KeyGen.keys_without_super()` と `KeyGen.modes()`。super の付いたキーはどれも表せないので除く。ESCALATION 3）: `encode(k, m)` が成功したら、`decode(bytes) == [Key(representative(k, m.other_keys))]`。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/key/encode.emel`。spec §6 のとおり、キーの種類ごとの規則で書く（Global Constraints のとおり decode を呼ばない）。golden のテストが落ちたら、落ちた行の termwiz の bytes と spec §6 の表を見比べ、termwiz に合わせる。spec §6 と違っていたら report に書く。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す:

```text
src/key/encode.emel  # 公開 API の encode が Unencodable を宣言する（今の mode で表せないキーを、recorder が tape の行番号を足して外に出す）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/key/encode.emel test/encode_test.emel test/golden.emel test/golden_test.emel test/key_gen.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: キーを WezTerm の既定と同じ bytes に encode する"
```

---

## Self-Review（計画の作者）

- spec の §4（正規形）は Task 2、§5 は Task 3、§7 は Task 4、§6 と §8 の golden は Task 5 と 6、§9 の #12 は Task 1、§10 の `mise.toml` と AGENTS.md は Task 5。全体設計の更新は spec と同じ commit で済んでいる。
- spec から変えた点（spec も同じ commit で直した）: `Decoded` は `src/key/decode.emel` に置く。`OtherKeys` は `Off | On(Level)`。golden のキーに ASCII でない 3 文字を足し、992 行にした。
- 試作で確かめたこと（2026-11-27）: harness は termwiz 0.22.0 で build でき、992 行を出す。生成した表（968 行の版）は `emela fmt`、`emela check`、`emela test` で 0.3 秒以内。Task 6 の encode の表の値は、すべて試作の harness の出力から取った。#12 は今の `tools/wish.ts` で再現した（出力が `""`）。
