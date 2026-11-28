# サブプロジェクト 4: overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `i` イベントの入った cast を読み、押したキーを画面の下の 1 行に焼き込んだ cast を書く `kbdcast overlay <cast>` を作り、rec、overlay、agg で GIF を作れるようにする。

**Architecture:** `Cast` に asciicast v3 の reader を足す。`Overlay.Strip` は最近のキーの帯（純粋）、`Overlay` は 3 の VT の画面と帯を合わせて変わった行だけを描き直す fold（純粋）。cli に `overlay` を足し、agg 1.9.0 を `mise.toml` で固定する。

**Tech Stack:** Emela（版は `mise.toml`）、JS ターゲットを Bun で、brix（assert と pbt）、agg 1.9.0（musl 版）、ffmpeg（smoke で frame を PNG にする）。

**Spec:** `docs/superpowers/specs/2026-11-28-kbdcast-4-overlay-design.md`

## Emela のコードを計画に書かない理由

この repo の規則（`AGENTS.md` の wish-first）では、実装する agent が spec を調べる前に自分で「こう書きたい」コードを書き、回り道を記録する。計画に Emela のコードを書くと、その発見が消える。そこで Emela のタスクには、ファイル、公開する名前と型、振る舞い、テストの入力と期待値、手順だけを書く。

## Global Constraints

- Emela の版を**固定する**のは `mise.toml` の `"github:emela-lang/emela"` だけ。ターゲットは JS（`EMELA_JS_HOST = "bun"`）。`emela` は `mise exec --` で呼ぶ。
- 置き場所は root の Pome と `cli/`。新しい Pome や依存は足さない（agg は `mise.toml` の道具）。
- `src/` には `@external` も effect も置かない。reader、帯、合成は純粋な関数。
- module の置き場所と公開する名前と型は、各タスクの Interfaces のとおり。Emela の制約で変える必要があれば、回り道として記録してから `NEEDS_CONTEXT` で止まる（自分で変えない）。
- 振る舞いは spec の §4〜§7 で決まる。帯の時間は 1500 ms。
- 基盤レベルのキーワードは、`tools/lint/foundation.allow` に理由と一緒に登録したモジュールでだけ使う。登録の理由は実際の使い方と合わせる。
- library のエラーメッセージは英語。道具のメッセージと文書は日本語。コードのコメントは英語。
- 新しい単位を書くときは `AGENTS.md` の wish-first に従う（wish を書き、`mise exec -- bun tools/wish.ts check` し、wish だけを commit してから spec を調べて実装する）。回り道は `FRICTION(NNN)` とメモで記録する。黙って回避しない。メモは実装と同じ commit に、パスを指定して入れる。
- commit は branch `sp4/overlay` に積み、最後に PR を作って merge commit で main に入れる。message は `type: 日本語の説明`。`git commit --no-gpg-sign` を使う。`--no-verify` は使わない。`git add` はパスを指定する（`-A` や `.` を使わない）。
- emela-lang の repo（emela、x、brix）には、issue、PR、コメントを出さない。

## File Structure

| ファイル | 責務 |
|---|---|
| `src/cast.emel` | `Cast`: reader を足す（`Header`、`Event`、`CastError`、`read`） |
| `src/overlay/strip.emel` | `Overlay.Strip`: キーの帯 |
| `src/overlay.emel` | `Overlay`: 合成 |
| `cli/src/main.emel` | `overlay` を足す |
| `mise.toml` | agg 1.9.0 |
| `test/cast_read_test.emel`、`test/strip_test.emel`、`test/overlay_test.emel` | テスト |

---

### Task 1: cast の reader

**Files:**
- Create: `wish/cast_read.emel`
- Modify: `src/cast.emel`、`tools/lint/foundation.allow`
- Test: `test/cast_read_test.emel`

**Interfaces:**
- Produces（module `Cast`、`src/cast.emel` に足す）:
  - `pub type Header(cols: Int, rows: Int, json: Dynamic)`（`json` は header の全体。`Std.Dynamic`）
  - `pub enum Event { Output(Int, String) | Input(Int, String) | Marker(Int, String) | Exit(Int, String) }`（`Int` は録画の始まりからのミリ秒）
  - `pub error CastError(line: Int, message: String)`
  - `pub fn read(text: String) -> (Header, List[Event]) fails CastError`

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/cast_read.emel`（`# wish-target: src/cast.emel`。既にある module に足す wish なので、wish の中身は reader の部分だけでよい）。行の読み方、header の欄の取り出し、interval の足し算を書く。

Run: `mise exec -- bun tools/wish.ts check wish/cast_read.emel`

```bash
git add wish/cast_read.emel
git commit --no-gpg-sign -m "wish: cast の reader の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `api.std.json`（`parse`、`Dynamic`）、`api.std.dynamic`、`api.float`（丸め）、`error.fail`。kbdcast の spec は §4。asciicast v3 は https://docs.asciinema.org/manual/asciicast/v3/ 。

- [ ] **Step 3: 失敗するテストを書く**

`test/cast_read_test.emel`。

正しい cast（行は `\n` で区切る）:

```text
{"version": 3, "term": {"cols": 20, "rows": 3, "type": "xterm-256color"}, "title": "t"}
# comment
[0.5, "o", "a"]

[0.25, "i", "b"]
[1.0, "m", "mark"]
[0.0006, "o", "c"]
[0.0004, "o", "d"]
[2, "x", "0"]
[0.1, "q", "unknown"]
```

→ `Header` の `cols` 20、`rows` 3、`json` の `title` は `"t"`。イベントは `Output(500, "a")`、`Input(750, "b")`、`Marker(1750, "mark")`、`Output(1751, "c")`、`Output(1751, "d")`、`Exit(3751, "0")`（`q` は飛ばす。時刻は interval を Float の秒で足してから、ミリ秒に四捨五入する）。

1 の writer との往復: `Cast.header(20, 3, "x")` と、`Cast.event` で時刻 0、100、1234 に書いた `o` の行をつないだものを `read` すると、`Output(0, …)`、`Output(100, …)`、`Output(1234, …)`。

誤った cast（`message` は完全に一致させる。`invalid JSON:` の行は、その接頭辞で始まることだけを確かめる）:

| cast | 行 | `message` |
|---|---|---|
| （空） | 1 | `the cast is empty` |
| `[1]` | 1 | `the header is not a JSON object` |
| `{"version": 2, "width": 80, "height": 24}` | 1 | `only asciicast v3 is supported (this is version 2; asciinema convert -f asciicast-v3 can convert it)` |
| `{"version": 3, "term": {"cols": 0, "rows": 3}}` | 1 | `the header needs term.cols and term.rows of at least 1` |
| `{"version": 3, "term": {"cols": 2}}` | 1 | `the header needs term.cols and term.rows of at least 1` |
| `{"version": 3` | 1 | `invalid JSON: …` |
| 正しい header の後に `[0.1, "o"]` | 2 | `an event is [interval, code, data]` |
| 正しい header の後に `[0.1, 1, "a"]` | 2 | `an event is [interval, code, data]` |
| 正しい header の後に `[-0.1, "o", "a"]` | 2 | `the interval is negative` |
| 正しい header の後に `[0.1, "r", "90x30"]` | 2 | `resize events are not supported` |
| 正しい header、`# c`、`not json` | 3 | `invalid JSON: …` |

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/cast.emel`。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す（実際に使ったキーワードに合わせて理由を直す）:

```text
src/cast.emel  # 公開 API の read が CastError を宣言する（cli が行を付けて利用者に見せる）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/cast.emel test/cast_read_test.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: asciicast v3 の cast を読み、録画の始まりからの時刻のイベントにする"
```

---

### Task 2: キーの帯

**Files:**
- Create: `wish/strip.emel`、`src/overlay/strip.emel`
- Test: `test/strip_test.emel`

**Interfaces:**
- Consumes: 2 の `Key.Notation.print`、`Key.Decode.Decoded`、3 の `Vt.Width.is_wide`、`Vt.Screen`（`Cell`、`Pen`、`DEFAULT_PEN`、`Occupancy`）
- Produces（module `Overlay.Strip`、`src/overlay/strip.emel`）:
  - `pub const FADE_MS: Int = 1500`
  - `pub opaque type Strip`、`pub fn strip() -> Strip`
  - `pub fn press(s: Strip, at_ms: Int, keys: List[Decoded]) -> Strip`
  - `pub fn marks(s: Strip, at_ms: Int) -> List[String]`（見えている印の列。空なら見えていない）
  - `pub fn clears_at(s: Strip) -> Option[Int]`（印があれば、最後の印の時刻 + `FADE_MS`）
  - `pub fn row(marks: List[String], cols: Int) -> List[Cell]`（帯の行の cols 個のセル）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/strip.emel`（`# wish-target: src/overlay/strip.emel`）。

Run: `mise exec -- bun tools/wish.ts check wish/strip.emel`

```bash
git add wish/strip.emel
git commit --no-gpg-sign -m "wish: キーの帯の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

kbdcast の spec は §5。Emela の spec は `api.list`、`api.string`、`data.type`。

- [ ] **Step 3: 失敗するテストを書く**

`test/strip_test.emel`。キーは `Key.Notation.parse` で作り、`Decoded` の `Key` に包む。反転の pen は `Pen(inverse: True, ..DEFAULT_PEN)`。

印と時間:

| 操作 | 確かめること |
|---|---|
| `strip()` | `marks(_, 0)` は空、`clears_at` は `None` |
| `press(strip(), 0, [Key(a), Key(<Esc>), Paste("x"), Unknown(ff)])` | `marks(_, 0)` は `["a", "<Esc>", "<Paste>"]`、`clears_at` は `Some(1500)` |
| 続けて `press(_, 1000, [Key(b)])` | `marks(_, 1000)` と `marks(_, 2499)` は `["a", "<Esc>", "<Paste>", "b"]`、`marks(_, 2500)` は空、`clears_at` は `Some(2500)` |
| 続けて `press(_, 2500, [Key(c)])` | `marks(_, 2500)` は `["c"]`（1500 ms 経ったので並べ直す） |
| `press(s, 100, [Unknown(ff)])`（s は 1 行目の後） | 帯は変わらない（`clears_at` は `Some(1500)` のまま） |
| `press(strip(), 0, [Key(<C-S-a>), Key(<Space>)])` | `["<C-S-a>", "<Space>"]` |

`row`（反転の部分を `[…]` と書く。残りは既定の pen の空白）:

| `marks` | cols | セル |
|---|---|---|
| `[]` | 5 | 空白 5 つ |
| `["a", "<Esc>"]` | 10 | `[ a<Esc> ]` の 8 セルと空白 2 つ |
| `["abc", "<Esc>", "<CR>"]` | 10 | `[ …<CR> ]` の 7 セルと空白 3 つ（`abc` と `<Esc>` を落とす） |
| `["<PageDown>"]` | 6 | `[…own> ]` の 6 セル |
| `["あい"]` | 6 | `[ あい ]`（空白、`あ` の左と右、`い` の左と右、空白） |
| `["ああああ"]` | 6 | `[…ああ ]` |
| `["ああああ"]` | 5 | `[… あ ]`（端が全角の途中にかかるので、その文字の代わりに空白） |
| `["x"]` | 2 | 空白 2 つ（cols が 3 より小さい） |

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/overlay/strip.emel`。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/overlay/strip.emel test/strip_test.emel
git commit --no-gpg-sign -m "feat: 最近のキーを vim の表記で並べる帯を作る"
```

---

### Task 3: 合成

**Files:**
- Create: `wish/overlay.emel`、`src/overlay.emel`
- Test: `test/overlay_test.emel`

**Interfaces:**
- Consumes: Task 1 の `Cast`（`Header`、`Event`、`writer`、`event`）、Task 2 の `Overlay.Strip`、3 の `Vt`、2 の `Key.Decode.decode`
- Produces（module `Overlay`、`src/overlay.emel`）:
  - `pub opaque type Overlay`
  - `pub fn start(h: Header) -> (Overlay, String)`（出力の header の行。`h.json` の `term.rows` だけを rows + 1 にした JSON）
  - `pub fn step(o: Overlay, e: Event) -> (Overlay, List[String])`（出力の行。改行は付けない）
  - `pub fn finish(o: Overlay) -> List[String]`

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/overlay.emel`（`# wish-target: src/overlay.emel`）。状態、行の比べ方、SGR の組み立てを書く。

Run: `mise exec -- bun tools/wish.ts check wish/overlay.emel`

```bash
git add wish/overlay.emel
git commit --no-gpg-sign -m "wish: overlay の合成の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

kbdcast の spec は §6。Emela の spec は `api.std.dynamic`、`api.std.json`（`to_string`）、`api.list`、`data.type`。

- [ ] **Step 3: 失敗するテストを書く**

`test/overlay_test.emel`。header は `{"version": 3, "term": {"cols": 6, "rows": 2}}` を `Cast.read` したもの。表の `\e` は ESC。出力の行は `Cast.event` の形（`[<interval>, "<code>", <JSON の文字列>]`）で、data は JSON の文字列の中身（Emela の文字列で書いた形）。

header: `start` の行を `Std.Json.parse` すると、`term.cols` が 6、`term.rows` が 3、`version` が 3（欄の順は問わない）。

順に `step` した出力:

| イベント | 出力の行の data（interval） |
|---|---|
| `Output(0, "ab")` | `\e[1;1H\e[0mab    \e[0m\e[1;3H`（0.000） |
| `Input(100, "x")` | `\e[3;1H\e[0;7m x \e[0m   \e[0m\e[1;3H`（0.100） |
| `Output(200, "")` | 行なし（何も変わらない） |
| `Output(200, "c")` | `\e[1;1H\e[0mabc   \e[0m\e[1;4H`（0.100） |
| `Marker(300, "m1")` | `[0.100, "m", "m1"]` の行 |
| `finish` | `\e[3;1H\e[0m      \e[0m\e[1;4H`（1.300。最後の印の 100 + 1500 = 1600） |

ほかの固定の例（それぞれ新しい `start` から）:

| イベント | 確かめること |
|---|---|
| `Input(0, "a")`、`Output(2000, "z")` | 2 つ目の `step` の出力は 2 行。時刻 1500 の帯を消す行（`\e[3;1H\e[0m      \e[0m\e[1;1H`）、時刻 2000 の `z` の行 |
| `Output(0, "\e[?25l")` | data は `\e[1;1H\e[?25l`（行は変わらず、見え方だけ） |
| `Output(0, "\e[1;31;44mA\e[0m")` | data は `\e[1;1H\e[0;1;31;44mA\e[0m     \e[0m\e[1;2H` |
| `Output(0, "\e[38;5;196m\e[48;2;1;2;3mB")` | 行は `\e[0;38;5;196;48;2;1;2;3mB` で始まる |
| `Output(0, "あ")` | data は `\e[1;1H\e[0mあ    \e[0m\e[1;3H` |
| `Input(0, "x")`、`Exit(10, "0")` | `Exit` の `step` の出力は `[0.010, "x", "0"]` の行だけ |
| `Input(0, "\u{1b}[200~hi\u{1b}[201~")` | 帯の行は `[ <Paste> ]` |

性質（brix の pbt）: 3 の `VtGolden.CASES` から行を選び、入力をランダムな位置で 1〜4 つの `Output` に分ける（時刻は 0 から 10 ms ずつ増やす）。間にランダムに `Input`（`a`、`\r`、`\u{1b}`、`\u{1b}[A` のどれか）を挟む。`start` から順に `step` し `finish` した出力のうち、`o` の data を順に `Vt.new(cols, rows + 1)` に `feed` する。各イベントの後で:

- 上の rows 行の `Vt.lines` が、同じ時刻までの `Output` を `Vt.new(cols, rows)` に `feed` した `Vt.lines` と等しい。
- 最後の行が、その時刻の `Strip.row(Strip.marks(…), cols)` と等しい。
- `Vt.cursor` が等しい（列は `cols - 1` に丸めて比べる）。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/overlay.emel`。spec §6 のとおり。`h.json` の `term.rows` を変えるのに `Std.Dynamic` を作り直す回り道が要れば、記録する。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/overlay.emel test/overlay_test.emel
git commit --no-gpg-sign -m "feat: VT の画面とキーの帯を合わせ、変わった行だけを描き直す cast を書く"
```

---

### Task 4: cli の overlay と E2E の smoke

**Files:**
- Create: `wish/main_overlay.emel`
- Modify: `cli/src/main.emel`、`mise.toml`、`AGENTS.md`（要るなら）

**Interfaces:**
- Consumes: Task 1〜3
- Produces: `kbdcast overlay <cast>`（spec §7）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/main_overlay.emel`（`# wish-target: cli/src/main.emel`。`overlay` の部分だけ）。

Run: `mise exec -- bun tools/wish.ts check wish/main_overlay.emel`

```bash
git add wish/main_overlay.emel
git commit --no-gpg-sign -m "wish: kbdcast overlay の理想形を書く"
```

- [ ] **Step 2: agg を固定する**

`mise.toml` の `[tools]` に 1 行足す（glibc 版は GLIBC 2.38 を要り、この環境で動かない。spec §2）:

```toml
"github:asciinema/agg" = { version = "1.9.0", asset_pattern = "agg-x86_64-unknown-linux-musl" }
```

Run: `mise install && mise exec -- agg --version`
Expected: `agg 1.9.0`

- [ ] **Step 3: 実装する**

`cli/src/main.emel` に `overlay <cast>` を足す（spec §7）。cast を読み（`Std.FileSystem`）、`Cast.read`、`Overlay.start`、各イベントの `step`、`finish` の行を、その都度 stdout に書く。`CastError` は `<cast>:<行>: <message>`、終了コード 1。使い方は `usage: kbdcast rec <tape> | kbdcast overlay <cast>`、終了コード 2。

- [ ] **Step 4: E2E の smoke を走らせる（permanent な test にしない）**

```bash
rm -f /tmp/kbdcast-example.txt
mise exec -- emela run cli -- rec examples/vim.tape > /tmp/vim.cast
mise exec -- emela run cli -- overlay /tmp/vim.cast > /tmp/vim.keys.cast
mise exec -- agg /tmp/vim.keys.cast /tmp/vim.gif
```

Expected: どれも終了コード 0。`/tmp/vim.keys.cast` の header の `term.rows` は 11。

frame を PNG にして見る（`read` の tool で画像を開ける）:

```bash
ffmpeg -loglevel error -y -i /tmp/vim.gif -vf "select=eq(n\,10)" -frames:v 1 /tmp/vim-typing.png
ffmpeg -loglevel error -y -i /tmp/vim.gif -vf reverse -frames:v 1 /tmp/vim-last.png
```

（frame の番号は GIF の frame の数を見て、`ihello from kbdcast` を打っている途中の 1 枚を選ぶ。）

確かめること: 打っている途中の frame の最後の行に、反転した `ihello<Space>from…` のようなキーの帯がある。最後の frame の画面は vim の `written` の行で、帯は消えているか `:wq<CR>` を含む（agg の `--last-frame-duration` の前の状態による）。全角の文字が化けていない（`examples/` に全角を打つ tape は無いので、使い捨ての tape で `> あ` を打って確かめてよい）。見たものを report に書き、使い捨てのファイルを消す。

`/nonexistent.cast`、v2 の cast（`{"version": 2, "width": 80, "height": 24}` の 1 行）、`r` を含む cast を `overlay` に渡し、spec §4 と §7 の message と終了コード 1 を確かめる。

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test && mise exec -- bun test tools/test`
Expected: `tools/check: ok`

```bash
git add cli/src/main.emel mise.toml
git commit --no-gpg-sign -m "feat: kbdcast overlay を足し、agg 1.9.0 を固定する"
```

（`AGENTS.md` を変えたら、それも add する。）

---

## Self-Review（計画の作者）

- spec の §4 は Task 1、§5 は Task 2、§6 は Task 3、§7 は Task 4、§8 のテストは各タスク、§10 の全体設計は spec と同じ commit で済んでいる。spec §5 の `text` は、計画では `marks` という名前にした（印の列を返すので）。
- 試作で確かめたこと（2026-11-28）: agg 1.9.0 の musl 版が mise の `asset_pattern` で入り、1 で録った `shell.tape` の cast をそのまま GIF にできる。ffmpeg で最後の frame を PNG にして、画面が正しいことを目で確かめた。
- Task 3 の固定の例の data は、spec §6 の書き方から手で組み立てた（6 列 × 2 行と帯の 1 行）。
