# サブプロジェクト 1: recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tape から cast を作る `kbdcast rec <tape>` を、tape のパーサ、cast の writer、ドメインの port の `Driver`、本番用の `LiveDriver`、host の port の `Pty` と Bun の `BunPty`、main で作る。

**Architecture:** root の Pome に `Tape`、`Cast`、`Recorder`（`Driver` と `run_tape`）、`Recorder.Live`（`LiveDriver`）を置く。`pty/` は effect `Pty` の宣言だけ、`pty-bun/` は `Bun.Terminal` の handler（`@external` はここだけ）、`cli/` は main。cast の時刻は tape の時間で刻み、`wait` の間は進めない。

**Tech Stack:** Emela（版は `mise.toml`）、JS ターゲットを Bun で、brix（assert と pbt）、Bun の `Bun.Terminal`（pty-bun の host の側の JS）。

**Spec:** `docs/superpowers/specs/2026-11-27-kbdcast-1-recorder-design.md`

## 実装で変わったこと（PR #20。spec は実装に合わせて直した）

- 固定した Emela 0.28.2 の時間切れは `Fiber.timeout`。下の `Task.timeout` は `Fiber.timeout` と読む。
- Task 3: handler の init は fail できたので、`Exited(127)` の代わりの形は使っていない。`Bun.Terminal` の `exit` callback は呼ばれず、どのプロセスも 100 ms の drain で終わる。`pty/` には `test/` が無い（effect の宣言だけの Pome）。
- Task 4: `Driver.wait_for` は `wait_for(pattern, source, timeout)`（`Regex` から元の文字列を取れない。friction 069）。「最後の step」は、後ろに `Keys`、`Sleep`、`Wait` が無い step。
- Task 5、6: `LiveDriver` の状態は `State[Recording]` に置き（handler は操作の間で field を変えられない。friction 073）、公開するのは `Recorder.Live.record(tape)` だけ（`LiveDriver` と `Recording` は private）。cli は `with BunPty(…), SystemClock, SystemStdout { Live.record(tape) }`。
- Task 6: `examples/vim.tape` の cast は `x` で終わらない（100 ms の drain が最後の窓の 30 ms より長い）。Step 5 の「cast の最後の行が `x` で `"0"`」は計画の誤り。`cli/Pome.toml` の import しない `[dependencies]`（pty、regex、text）は消し、`[replace]` だけを残した。
- Task 1 の後の直し: tape の duration は 2147483647 ms まで（`duration too long`）。

## Emela のコードを計画に書かない理由

この repo の規則（`AGENTS.md` の wish-first）では、実装する agent が spec を調べる前に自分で「こう書きたい」コードを書き、回り道を記録する。計画に Emela のコードを書くと、その発見が消える。そこで Emela のタスクには、ファイル、公開する名前と型、振る舞い、テストの入力と期待値、手順だけを書く。JS（pty-bun の host の側）は、完全なコードを書く。

## Global Constraints

- Emela の版を**固定する**のは `mise.toml` の `"github:emela-lang/emela"` だけ。`Pome.toml` の `emela` は `0.28.2`。ターゲットは JS（`EMELA_JS_HOST = "bun"`）。`emela` は `mise exec --` で呼ぶ。
- `Pome.toml` に `license` は書かない。
- Pome: root（`github.com/kisepichu/kbdcast`）、`pty/`（`github.com/kisepichu/kbdcast/pty`、root name `Pty`）、`pty-bun/`（`github.com/kisepichu/kbdcast/pty-bun`、root name `PtyBun`、`targets = ["js"]`）、`cli/`（`github.com/kisepichu/kbdcast/cli`）。どれも version `0.1.0`。兄弟の Pome は `"<source path>" = "v0.1.0"` と `[replace]` の `{ path = "…" }` で参照する。`[replace]` は、その Pome を build するときだけ効き、依存として読まれるときは無視されるので、各 Pome は依存の依存（regex の text など）にも `[replace]` を書く。brix は `[dev-dependencies]`（`v0.4.0`）。
- pty と pty-bun は x の形（`Pome.toml`、`README.md`（日本語。句読点は `，．`）、`src/`、`test/`）で作る。
- `@external` は `pty-bun/src/` と、その `test/` だけ。root、cli の `src/` には置かない（lint が止める）。cli の `Pome.toml` の `[external] allow` に pty-bun だけを書く。
- module の置き場所と公開する名前と型は、各タスクの Interfaces のとおり。Emela の制約で変える必要があれば、回り道として記録してから `NEEDS_CONTEXT` で止まる（自分で変えない）。
- 振る舞いは spec の §4〜§9 で決まる。cast の時刻は tape の時間（spec §2、§7）。
- 基盤レベルのキーワードは、`tools/lint/foundation.allow` に理由と一緒に登録したモジュールでだけ使う（AGENTS.md 規則 3）。登録の理由は、実際の使い方と合わせる。
- library のエラーメッセージは英語。道具のメッセージと文書は日本語。コードのコメントは英語。
- 新しい単位を書くときは `AGENTS.md` の wish-first に従う（wish を書き、`mise exec -- bun tools/wish.ts check` し、wish だけを commit してから spec を調べて実装する）。回り道は `FRICTION(NNN)` とメモで記録する。黙って回避しない。メモは実装と同じ commit に、パスを指定して入れる。
- commit は branch `sp1/recorder` に積み、最後に PR を作って merge commit で main に入れる。message は `type: 日本語の説明`。`git commit --no-gpg-sign` を使う。`--no-verify` は使わない。`git add` はパスを指定する（`-A` や `.` を使わない）。
- emela-lang の repo（emela、x、brix）には、issue、PR、コメントを出さない。

## File Structure

| ファイル | 責務 |
|---|---|
| `Pome.toml` | root に regex、text、pty への依存を足す |
| `src/tape.emel` | `Tape`: tape のパーサ |
| `src/cast.emel` | `Cast`: asciicast v3 の writer |
| `src/recorder.emel` | `Recorder`: `Driver`、error、`run_tape` |
| `src/recorder/live.emel` | `Recorder.Live`: `LiveDriver` |
| `pty/` | effect `Pty` と `Output` |
| `pty-bun/src/lib.emel`、`pty-bun/src/pty.mjs` | handler `BunPty` と host の側の JS |
| `cli/src/main.emel` | `kbdcast rec <tape>` |
| `examples/*.tape` | E2E の smoke に使う例 |
| `test/test_driver.emel` | `TestDriver`: 呼ばれた操作を記録する test の handler |
| `test/fake_pty.emel` | `FakePty`: 決まった時刻に決まった出力を返す test の handler |
| `test/*_test.emel`、`pty-bun/test/*_test.emel` | テスト |

---

### Task 1: tape のパーサ

**Files:**
- Create: `wish/tape.emel`、`src/tape.emel`
- Modify: `Pome.toml`、`Pome.lock`、`tools/lint/foundation.allow`
- Test: `test/tape_test.emel`

**Interfaces:**
- Consumes: 2 の `Key`（`Key.Notation.parse`、`NotationError`）、R の `Regex`（`compile`、`NO_FLAGS`、`RegexSyntax`）
- Produces（module `Tape`、`src/tape.emel`）:
  - `pub type Tape(cols: Int, rows: Int, typing: Duration, timeout: Duration, command: Command, steps: List[Step])`
  - `pub type Command(line: Int, argv: List[String], text: String)`
  - `pub enum Step { Keys(Int, List[Key]) | Sleep(Int, Duration) | Wait(Int, Regex, String) | SetTyping(Int, Duration) | SetTimeout(Int, Duration) }`（`Int` は行の番号。`Wait` の `String` は pattern の文字列）
  - `pub error TapeError(line: Int, column: Int, message: String)`
  - `pub fn parse(source: String) -> Tape fails TapeError`
  - `Duration` は `Std.Duration`

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/tape.emel`（`# wish-target: src/tape.emel`）。行ごとの読み方、`run` の前と後の区別、シェル風の分け方、error の列の持ち方を書く。

Run: `mise exec -- bun tools/wish.ts check wish/tape.emel`

```bash
git add wish/tape.emel
git commit --no-gpg-sign -m "wish: tape のパーサの理想形を書く"
```

- [ ] **Step 2: 依存を足し、spec を調べる**

`Pome.toml` に足す（regex と text は兄弟の Pome。`[replace]` は依存の依存にも要る）:

```toml
[dependencies]
"github.com/kisepichu/kbdcast/regex" = "v0.1.0"
"github.com/kisepichu/kbdcast/text" = "v0.1.0"

[replace]
"github.com/kisepichu/kbdcast/regex" = { path = "regex" }
"github.com/kisepichu/kbdcast/text" = { path = "text" }
```

Run: `mise exec -- emela pome install`（`Pome.lock` が変わる）

Emela の spec は `api.std.duration`、`api.string`、`error.escape`、`data.type`、`data.enum`。kbdcast の spec は §4 と、全体設計 §6。

- [ ] **Step 3: 失敗するテストを書く**

`test/tape_test.emel`。`Regex` は `Eq` を持たないかもしれないので、`Wait` は行と pattern の文字列で比べ、`Regex` が `Regex.is_match` で効くことを 1 つ確かめる。

正しい tape:

1. 次の tape（`\n` で区切る）:

   ```text
   " demo
   set size 100x30
   set typing 60ms
   run vim 'notes.md'
   wait /notes\.md
   > ihello<Esc>
   sleep 1s
   set timeout 3s
   > :wq<CR>
   ```

   → `cols` 100、`rows` 30、`typing` 60ms、`timeout` 10s、`command` は行 4、`["vim", "notes.md"]`、`"vim 'notes.md'"`。`steps` は `Wait(5, _, "notes\.md")`、`Keys(6, [i h e l l o <Esc>])`、`Sleep(7, 1s)`、`SetTimeout(8, 3s)`、`Keys(9, [: w q <CR>])`。`Wait` の regex は `notes.md` に当たり、`notesXmd` に当たらない。

2. `run x` → `cols` 80、`rows` 24、`typing` 50ms、`timeout` 10s、`argv` `["x"]`、`steps` は空。
3. `run x\nset typing 10ms` → `typing` 50ms、`steps` は `SetTyping(2, 10ms)`。
4. `  " c\n\n  run   a  b ` → `argv` `["a", "b"]`、`text` `"a  b"`（`run` の後の空白と行末の空白は `text` に入れない）。
5. `run x\r\n> a\r\n` → `Keys(2, [a])`（行末の `\r` を捨てる）。
6. `run x\n> a b` → `Keys(2, [a <Space> b])`。`run x\n>  a` → `Keys(2, [<Space> a])`（2 つ目の空白はキー）。
7. `run x\nwait /ready  ` → pattern `"ready  "`（行末の空白も pattern に入る）。
8. `run x\nsleep 0ms\nsleep 2s\nsleep 1500ms` → `Sleep(2, 0ms)`、`Sleep(3, 2000ms)`、`Sleep(4, 1500ms)`。

`run` の引数の分け方（`argv`）:

| `run` の後ろ | `argv` |
|---|---|
| `a b  c` | `["a", "b", "c"]` |
| `'a b' c` | `["a b", "c"]` |
| `"a \"b\" \\ c"` | `["a \"b\" \\ c"]`（Emela の文字列で書いた形。中身は `a "b" \ c`） |
| `a\ b` | `["a b"]` |
| `'it'"'"'s'` | `["it's"]` |
| `''` | `[""]` |
| `sh -c 'printf "%s" x'` | `["sh", "-c", "printf \"%s\" x"]` |

誤った tape（`message` は完全に一致させる。列は 1 から数えた code point）:

| tape | 行 | 列 | `message` |
|---|---|---|---|
| （空） | 1 | 1 | `no run line` |
| `set typing 10ms\n` | 2 | 1 | `no run line` |
| `run a\nrun b` | 2 | 1 | `run appears more than once (first on line 1)` |
| `> a\nrun x` | 1 | 1 | `> must come after run` |
| `wait /x\nrun x` | 1 | 1 | `wait must come after run` |
| `sleep 1s\nrun x` | 1 | 1 | `sleep must come after run` |
| `run x\nset size 10x10` | 2 | 1 | `set size must come before run` |
| `run x\nfoo bar` | 2 | 1 | `unknown command: foo` |
| `set color red\nrun x` | 1 | 5 | `unknown setting: color` |
| `set size 80\nrun x` | 1 | 10 | `size must be <cols>x<rows>: 80` |
| `set size 0x24\nrun x` | 1 | 10 | `size must be from 1x1 to 1000x1000: 0x24` |
| `run x\nsleep 500` | 2 | 7 | `duration needs a unit: 500ms or 500s` |
| `run x\nsleep 500m` | 2 | 7 | `use ms for milliseconds: 500ms` |
| `run x\nsleep fast` | 2 | 7 | `invalid duration: fast` |
| `run x\nsleep` | 2 | 6 | `sleep needs a duration` |
| `set typing\nrun x` | 1 | 11 | `set typing needs a duration` |
| `run` | 1 | 4 | `run needs a command` |
| `run sh -c 'abc` | 1 | 11 | `unterminated quote` |
| `run x\n>abc` | 2 | 2 | `expected a space after >` |
| `run x\n> ` | 2 | 3 | `no keys to send` |
| `run x\n> <Ecs>` | 2 | 3 | `unknown key name: <Ecs>` |
| `run x\n  > ab<Foo>` | 2 | 7 | `unknown key name: <Foo>` |
| `run x\nwait foo` | 2 | 6 | `wait needs /<pattern>` |
| `run x\nwait /a(b` | 2 | 8 | `unterminated group` |

（空の tape と、最後が改行で終わる tape の「行」は、行の数 + 1。`set typing 10ms\n` は 1 行なので 2。）

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/tape.emel`。spec §4 のとおり。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す:

```text
src/tape.emel  # 公開 API の parse が TapeError を宣言する（cli が行と列を付けて利用者に見せる）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add Pome.toml Pome.lock src/tape.emel test/tape_test.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: tape を読んで、正しくない形を表せない Tape にする"
```

---

### Task 2: cast の writer

**Files:**
- Create: `wish/cast.emel`、`src/cast.emel`
- Test: `test/cast_test.emel`

**Interfaces:**
- Produces（module `Cast`、`src/cast.emel`）:
  - `pub fn header(cols: Int, rows: Int, command: String) -> String`
  - `pub opaque type Writer`（前のイベントの時刻）、`pub fn writer() -> Writer`
  - `pub fn event(w: Writer, at_ms: Int, code: String, data: String) -> (Writer, String)`（`at_ms` は録画の始まりからの tape の時間。返す行に改行は付けない）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/cast.emel`（`# wish-target: src/cast.emel`）。interval の書き方と JSON の文字列の作り方を書く。

Run: `mise exec -- bun tools/wish.ts check wish/cast.emel`

```bash
git add wish/cast.emel
git commit --no-gpg-sign -m "wish: cast の writer の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `api.std.json`（文字列の escape の形）、`api.int`、`api.string`。kbdcast の spec は §5。asciicast v3 は https://docs.asciinema.org/manual/asciicast/v3/ 。

- [ ] **Step 3: 失敗するテストを書く**

`test/cast_test.emel`:

| 呼び出し | 結果 |
|---|---|
| `header(80, 24, "vim notes.md")` | `{"version": 3, "term": {"cols": 80, "rows": 24, "type": "xterm-256color"}, "command": "vim notes.md"}` |
| `header(20, 3, "sh -c \"a\"")` | `{"version": 3, "term": {"cols": 20, "rows": 3, "type": "xterm-256color"}, "command": "sh -c \"a\""}` |

`writer()` から `event` を順に呼んだ行（`code` は `o`、data は `x`）:

| `at_ms` | 行 |
|---|---|
| 0 | `[0.000, "o", "x"]` |
| 100 | `[0.100, "o", "x"]` |
| 1234 | `[1.134, "o", "x"]` |
| 1234 | `[0.000, "o", "x"]` |
| 61000 | `[59.766, "o", "x"]` |

data の escape（`event(writer(), 0, "o", data)` の 3 つ目の要素。JSON の文字列の形。短い escape は `\n \r \t \b \f`、ほかの制御文字と 0x7F と C1 は小文字の 16 進の `\u00XX`）:

| data（Emela の文字列） | JSON |
|---|---|
| `"\u{1b}[1m"` | `"\u001b[1m"` |
| `"a\r\n"` | `"a\r\n"` |
| `"\t"` | `"\t"` |
| `"\""` | `"\""` |
| `"\\"` | `"\\"` |
| `"あ😀"` | `"あ😀"` |
| `"\u{0}"` | `"\u0000"` |
| `"\u{7f}"` | `"\u007f"` |
| `"\u{9b}"` | `"\u009b"` |

`i` と `x` の行: `event(writer(), 5, "x", "0")` は `[0.005, "x", "0"]`。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/cast.emel`。文字列は `Std.Json` で書く。`Std.Json` の escape の形が上の表と違う所（大文字の 16 進、0x7F や C1 を escape しないなど）があれば、その所だけを足し、回り道として記録する（AGENTS.md 規則 2。JSON の文字列を自前で書くことになるため）。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/cast.emel test/cast_test.emel
git commit --no-gpg-sign -m "feat: asciicast v3 の header とイベントの行を書く"
```

---

### Task 3: Pty の effect と BunPty

**Files:**
- Create: `wish/pty.emel`、`pty/Pome.toml`、`pty/README.md`、`pty/src/lib.emel`
- Create: `wish/pty_bun.emel`、`pty-bun/Pome.toml`、`pty-bun/Pome.lock`、`pty-bun/README.md`、`pty-bun/src/lib.emel`、`pty-bun/src/pty.mjs`
- Test: `pty-bun/test/bun_pty_test.emel`

**Interfaces:**
- Produces（module `Pty`、`pty/src/lib.emel`）:
  - `pub enum Output { Data(Bytes) | Exited(Int) }`（`Exited` の `Int` は終了コード。signal で終わったら 128 + 番号）
  - `pub effect Pty { suspend fn read() -> Output; fn write(b: Bytes) -> () }`
- Produces（module `PtyBun`、`pty-bun/src/lib.emel`）:
  - `pub error SpawnFailed(message: String)`
  - `pub handler BunPty(…): Pty`。init は `init(argv: List[String], cols: Int, rows: Int, cwd: String, env: List[String]) fails SpawnFailed`（`env` は上書きする `NAME=value` の List。ほかは kbdcast の環境を引き継ぐ）。release でプロセスを止めて端末を閉じる
  - init が fail できないと分かったら、回り道として記録し、`read` が最初に `Exited(127)` を返す形にして、report に書く（spec §8）

- [ ] **Step 1: pty の wish を書いて検査し、commit する**

`wish/pty.emel`（`# wish-target: pty/src/lib.emel`）。

Run: `mise exec -- bun tools/wish.ts check wish/pty.emel`（仮の `pty/Pome.toml` が置かれる。#12 の修正）

```bash
git add wish/pty.emel
git commit --no-gpg-sign -m "wish: Pty の effect の理想形を書く"
```

- [ ] **Step 2: pty の Pome を作る**

`pty/Pome.toml`:

```toml
[pome]
name = "github.com/kisepichu/kbdcast/pty"
version = "0.1.0"
emela = "0.28.2"
```

`pty/src/lib.emel` に Interfaces の `Output` と `Pty`。`pty/README.md` は、何をする Pome か（ターゲットに依らない PTY の effect。handler は別の Pome）と、`read` と `write` の意味（spec §8）を書く。Emela の spec は `effect.decl`、`data.enum`。

Run: `cd pty && mise exec -- emela check .`
Expected: 診断なし

- [ ] **Step 3: pty-bun の wish を書いて検査し、commit する**

`wish/pty_bun.emel`（`# wish-target: pty-bun/src/lib.emel`）。host type、`@external` の宣言、handler の init と release を書く。

Run: `mise exec -- bun tools/wish.ts check wish/pty_bun.emel`

```bash
git add wish/pty_bun.emel
git commit --no-gpg-sign -m "wish: BunPty の理想形を書く"
```

- [ ] **Step 4: host の側の JS を書く**

`pty-bun/src/pty.mjs`（manager が試作で確かめた。spec §8）:

```js
// The host side of BunPty: a process on a pseudo-terminal of Bun (Bun.Terminal and Bun.spawn).
// Bun pushes the output to the `data` callback; this module keeps it until `read` takes it, so that an interrupted
// `read` loses nothing.

// How long `read` keeps waiting for the end of the output after the process has exited. A process that leaves a child
// holding the terminal open would otherwise never let the output end.
const DRAIN_MS = 100;
// How long `close` waits for the process to end after SIGTERM before it sends SIGKILL.
const KILL_MS = 1000;

function wake(pty) {
  if (pty.waiter !== null) {
    const waiter = pty.waiter;
    pty.waiter = null;
    waiter();
  }
}

// Starts `argv` on a new terminal of `cols` × `rows` in `cwd`, with the environment of this process and the
// `NAME=value` entries of `env` over it. When the process cannot start, the result holds the reason (`openError`).
export function open(argv, cols, rows, cwd, env) {
  const pty = { chunks: [], waiter: null, eof: false, exited: false, drained: false, code: -1, error: "", process: null };
  pty.terminal = new Bun.Terminal({
    cols,
    rows,
    data(_terminal, bytes) {
      pty.chunks.push(new Uint8Array(bytes));
      wake(pty);
    },
    exit() {
      pty.eof = true;
      wake(pty);
    },
  });
  const overrides = Object.fromEntries(env.map((entry) => [entry.slice(0, entry.indexOf("=")), entry.slice(entry.indexOf("=") + 1)]));
  try {
    pty.process = Bun.spawn(argv, { terminal: pty.terminal, cwd, env: { ...process.env, ...overrides } });
  } catch (error) {
    pty.terminal.close();
    pty.error = error instanceof Error ? error.message : String(error);
    return pty;
  }
  pty.process.exited.then((code) => {
    pty.exited = true;
    pty.code = code;
    setTimeout(() => {
      pty.drained = true;
      wake(pty);
    }, DRAIN_MS);
    wake(pty);
  });
  return pty;
}

// Why the process could not start, or "" when it started.
export function openError(pty) {
  return pty.error;
}

function ended(pty) {
  return pty.exited && (pty.eof || pty.drained);
}

function take(pty) {
  const out = new Uint8Array(pty.chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of pty.chunks) {
    out.set(c, at);
    at += c.length;
  }
  pty.chunks = [];
  return out;
}

// The output that has arrived, waiting until some arrives. Empty once the process has exited and its output has
// ended. When `signal` aborts (the reading fiber is interrupted), the output stays for the next read.
export function read(pty, signal) {
  if (pty.chunks.length > 0) return take(pty);
  if (ended(pty) || signal.aborted) return new Uint8Array(0);
  return new Promise((resolve) => {
    const onAbort = () => {
      pty.waiter = null;
      resolve(new Uint8Array(0));
    };
    const check = () => {
      if (pty.chunks.length > 0 || ended(pty)) {
        signal.removeEventListener("abort", onAbort);
        resolve(pty.chunks.length > 0 ? take(pty) : new Uint8Array(0));
      } else {
        pty.waiter = check;
      }
    };
    pty.waiter = check;
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function write(pty, bytes) {
  pty.terminal.write(bytes);
}

// The exit code of the process once `read` has returned empty: its code, or 128 + the number of the signal that
// ended it.
export function exitCode(pty) {
  return pty.code;
}

// Ends the process if it is still running (SIGTERM, then SIGKILL after KILL_MS) and closes the terminal.
export async function close(pty) {
  if (pty.process === null) return;
  if (!pty.exited) {
    pty.process.kill("SIGTERM");
    const timer = setTimeout(() => pty.process.kill("SIGKILL"), KILL_MS);
    await pty.process.exited;
    clearTimeout(timer);
  }
  if (!pty.terminal.closed) pty.terminal.close();
}
```

Emela の側の宣言（`pty-bun/src/lib.emel`）。`suspend fn` の external には、runtime が最後の引数に `AbortSignal` を足す（`[ext.call]`）:

| JS | Emela の宣言の形 |
|---|---|
| `open(argv, cols, rows, cwd, env)` | `fn …(argv: Array[String], cols: Int, rows: Int, cwd: String, env: Array[String]) -> Host uses { ProcessHost }` |
| `openError(pty)` | `fn …(h: Host) -> String` |
| `read(pty, signal)` | `suspend fn …(h: Host) -> Bytes`（空なら終わり） |
| `write(pty, bytes)` | `fn …(h: Host, b: Bytes) -> ()` |
| `exitCode(pty)` | `fn …(h: Host) -> Int` |
| `close(pty)` | `suspend fn …(h: Host) -> ()` |

`Host` は `@external type`（`[ext.host-type]`）。`read` が空を返したら、`Exited(exitCode)` にする。

- [ ] **Step 5: pty-bun の Pome を作る**

`pty-bun/Pome.toml`:

```toml
[pome]
name = "github.com/kisepichu/kbdcast/pty-bun"
version = "0.1.0"
emela = "0.28.2"
targets = ["js"]

[dependencies]
"github.com/kisepichu/kbdcast/pty" = "v0.1.0"

[replace]
"github.com/kisepichu/kbdcast/pty" = { path = "../pty" }

[dev-dependencies]
"github.com/emela-lang/brix" = "v0.4.0"
```

Run: `cd pty-bun && mise exec -- emela pome install`

`pty-bun/README.md` は、何をする Pome か（Bun の `Bun.Terminal` で PTY のプロセスを動かす `Pty` の handler。Bun 1.3 から）、使い方（`with BunPty(argv, cols, rows, cwd, env) { … }`）、`[external] allow` に足す必要があることを書く。Emela の spec は `effect.handler`（init、release、fields）、`ext.decl`、`ext.call`、`ext.host-type`、`ext.boundary`、`effect.host`、`module.pome`（`targets`、`[external]`）。

- [ ] **Step 6: 失敗するテストを書く**

`pty-bun/test/bun_pty_test.emel`。どれも本物の PTY。test は Async と ProcessHost を使える（`[test.constraints]`）。`cwd` は `/tmp`。

| 起動するもの | すること | 確かめること |
|---|---|---|
| `["sh", "-c", "printf hello"]` | `Exited` まで `read` | 出力は `hello`、`Exited(0)` |
| `["sh", "-c", "read x; echo got:$x; exit 3"]` | 最初の `read` の前に `write("abc\r")` | 出力に `got:abc` が入る、`Exited(3)` |
| `["sh", "-c", "tput cols; tput lines"]`、33 × 7 | `Exited` まで `read` | 出力は `33\r\n7\r\n` |
| `["sh", "-c", "echo $TERM"]`、`env` は `["TERM=xterm-256color"]` | 同じ | 出力は `xterm-256color\r\n` |
| `["pwd"]` | 同じ | 出力は `/tmp\r\n` |
| `["sh", "-c", "kill -9 $$"]` | 同じ | `Exited(137)` |
| `["sh", "-c", "sleep 0.2; printf late"]` | `Task.timeout(50, read)`（`SystemClock`）が `None`、次の `read` | 次の `read` が `Data("late")`（打ち切った読み込みが出力を失わない） |
| `["sh", "-c", "sleep 5 & echo bye"]` | `Exited` まで `read` | 出力は `bye\r\n`、`Exited(0)`（背景の子が端末を開いたままでも終わる。5 秒待たない） |
| `["sh", "-c", "trap '' TERM; sleep 30"]` | 何も読まずに `with` を出る | `with` が終わる（release が 1 秒後に SIGKILL する） |
| `["no-such-command-kbdcast"]` | `with` に入る | `SpawnFailed`（メッセージに `no-such-command-kbdcast` が入る） |

Run: `cd pty-bun && mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 7: 実装する**

`pty-bun/src/lib.emel`。

Run: `cd pty-bun && mise exec -- emela test .`
Expected: PASS

- [ ] **Step 8: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add pty/Pome.toml pty/README.md pty/src/lib.emel pty-bun/Pome.toml pty-bun/Pome.lock pty-bun/README.md pty-bun/src/lib.emel pty-bun/src/pty.mjs pty-bun/test/bun_pty_test.emel
git commit --no-gpg-sign -m "feat: Pty の effect と、Bun の PTY で動く BunPty を作る"
```

（`pty/Pome.lock` ができたら、それも add する。）

---

### Task 4: Driver と run_tape

**Files:**
- Create: `wish/recorder.emel`、`src/recorder.emel`
- Create: `test/test_driver.emel`
- Modify: `tools/lint/foundation.allow`
- Test: `test/recorder_test.emel`

**Interfaces:**
- Consumes: Task 1 の `Tape`、2 の `Key` と `Key.Encode.Unencodable`、R の `Regex`
- Produces（module `Recorder`、`src/recorder.emel`）:
  - `pub effect Driver { suspend fn press(key: Key) -> () fails Unencodable | ProcessExited; suspend fn idle(d: Duration) -> () fails ProcessExited; suspend fn wait_for(pattern: Regex, timeout: Duration) -> () fails WaitTimeout | ProcessExited }`
  - `pub error ProcessExited(code: Int)`、`pub error WaitTimeout(screen: String)`
  - `pub enum Reason { CannotSend(Unencodable) | Exited(Int) | TimedOut(String, Duration, String) }`（`TimedOut` は pattern の文字列、timeout、画面）
  - `pub error RecordError(line: Int, reason: Reason)`
  - `pub fn run_tape(tape: Tape) -> () fails RecordError uses { Driver }`（`uses` の書き方は wish と spec で決める）
- Produces（test の module `TestDriver`、`test/test_driver.emel`）: `Driver` の handler。呼ばれた操作を `Press(Key)`、`Idle(ms)`、`WaitFor(pattern, ms)` の List として記録し、k 番目（0 から）の呼び出しで決まった error を返すように設定できる（`Regex` は pattern の文字列で記録する。`Regex` から文字列が取れなければ、`run_tape` が渡す pattern の文字列で記録する形を wish で考え、取れないことを friction に書く）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/recorder.emel`（`# wish-target: src/recorder.emel`）。`Driver` の宣言と、`run_tape` が step を順に行い、error に行番号を足す形を書く。

Run: `mise exec -- bun tools/wish.ts check wish/recorder.emel`

```bash
git add wish/recorder.emel
git commit --no-gpg-sign -m "wish: Driver と run_tape の理想形を書く"
```

- [ ] **Step 2: spec を調べる**

Emela の spec は `effect.decl`、`effect.use`、`effect.with`、`effect.handler`、`effect.state`、`error.escape`、`error.fails`。kbdcast の spec は §6、全体設計 §9。

- [ ] **Step 3: 失敗するテストを書く**

`test/recorder_test.emel`。`TestDriver` の下で `run_tape(parse(tape))` を走らせる。

| tape | 記録された操作 | 結果 |
|---|---|---|
| `set typing 100ms\nrun app\nwait /ready\n> ab\nsleep 1s` | `WaitFor("ready", 10000)`、`Press(a)`、`Idle(100)`、`Press(b)`、`Idle(100)`、`Idle(1000)` | 成功 |
| `run app\n> a\nset typing 7ms\n> b\nset timeout 2s\nwait /x` | `Press(a)`、`Idle(50)`、`Press(b)`、`Idle(7)`、`WaitFor("x", 2000)` | 成功 |
| `run app` | なし | 成功 |

error（`TestDriver` を k 番目で失敗するように設定する）:

| tape | 失敗させる呼び出し（k）と error | 結果 |
|---|---|---|
| `run app\nwait /ready\n> a` | 0: `WaitTimeout("screen")` | `RecordError(2, TimedOut("ready", 10s, "screen"))` |
| `run app\n> <D-a>` | 0: `Unencodable(<D-a>, NeedsKitty)` | `RecordError(2, CannotSend(…))` |
| `run app\nsleep 1s\n> q` | 0: `ProcessExited(3)` | `RecordError(2, Exited(3))` |
| `run app\nsleep 1s\n> :q<CR>` | 6（最後の `Idle`）: `ProcessExited(0)` | 成功（最後の step の途中の終了） |
| `run app\n> :q<CR>\nwait /bye` | 6（`WaitFor`）: `ProcessExited(0)` | `RecordError(3, Exited(0))`（最後の step が `wait` なら error） |
| `run app\n> ab` | 1（`a` の後の `Idle`）: `ProcessExited(0)` | 成功（最後の step。残りのキーは送らない） |

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/recorder.emel`。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す（実際に使ったキーワードに合わせて理由を直す）:

```text
src/recorder.emel  # ドメインの port の effect Driver を宣言し、run_tape が Driver を uses して RecordError で失敗する（全体設計 §9 の 2 層の effect）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add src/recorder.emel test/test_driver.emel test/recorder_test.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: tape の意味を Driver の操作の列として書く"
```

---

### Task 5: LiveDriver

**Files:**
- Create: `wish/live.emel`、`src/recorder/live.emel`
- Create: `test/fake_pty.emel`
- Modify: `Pome.toml`、`Pome.lock`、`tools/lint/foundation.allow`
- Test: `test/live_test.emel`

**Interfaces:**
- Consumes: Task 2 の `Cast`、Task 3 の `Pty`（`Output`、`Pty`）、Task 4 の `Recorder`、3 の `Vt` と `Utf8`、2 の `Key.Encode`
- Produces（module `Recorder.Live`、`src/recorder/live.emel`）:
  - `pub handler LiveDriver(…): Driver`。init は `init(cols: Int, rows: Int, command: String)`（header を書く）。使うのは `Pty`、`Clock`（`Std.Clock`）、`Stdout`（`Std.Process`）
- Produces（test の module `FakePty`、`test/fake_pty.emel`）: `Pty` の handler。決まった表に従う:
  - `Emit(at_ms, bytes)`: 仮想時間（`TestClock`。test の始まりを 0 とする）`at_ms` から読める
  - `Exit(at_ms, code)`: `at_ms` 以後、すべての `Emit` を読み終えたら `Exited(code)`
  - echo: 有効なら、`write` した bytes がその時刻にすぐ読める
  - `read` は、今読めるものを全部つないで返す。無ければ、次に読めるようになる時刻まで `Clock.sleep` する。何も予定が無ければ、割り込まれるまで待つ
  - `write` された bytes を順に記録する（返事の確かめに使う）

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/live.emel`（`# wish-target: src/recorder/live.emel`）。handler の状態（VT、デコーダ、tape の時間、`Writer`、終わったか）の持ち方、`idle` と `wait_for` の読み込みの繰り返し、`Task.timeout` の使い方を書く。

Run: `mise exec -- bun tools/wish.ts check wish/live.emel`

```bash
git add wish/live.emel
git commit --no-gpg-sign -m "wish: LiveDriver の理想形を書く"
```

- [ ] **Step 2: 依存を足し、spec を調べる**

`Pome.toml` の `[dependencies]` に `"github.com/kisepichu/kbdcast/pty" = "v0.1.0"`、`[replace]` に `"github.com/kisepichu/kbdcast/pty" = { path = "pty" }` を足す。

Run: `mise exec -- emela pome install`

Emela の spec は `effect.handler`、`effect.state`、`api.std.clock`（`TestClock`）、`api.std.task`（`timeout`）、`api.std.process`（`Stdout`、`TestStdout`）、`api.std.instant`、`api.std.duration`、`task`（割り込み）。kbdcast の spec は §7。

- [ ] **Step 3: 失敗するテストを書く**

`test/live_test.emel`。`TestClock`、`TestStdout`、`FakePty` の下で、`LiveDriver(cols, rows, command.text)` を開き、`run_tape(parse(tape))` を走らせる。cast は `TestStdout` に書かれた行（header とイベント）。表の行の `\e` は ESC。header は `{"version": 3, "term": {"cols": C, "rows": R, "type": "xterm-256color"}, "command": "app"}`。

A. 時間の刻み方（echo 有効）:

```text
set size 20x3
set typing 100ms
run app
wait /ready
> ab
sleep 1s
```

`Emit(500, "ready\r\n")` → cast の header の後:

```text
[0.000, "o", "ready\r\n"]
[0.000, "i", "a"]
[0.000, "o", "a"]
[0.100, "i", "b"]
[0.000, "o", "b"]
```

B. `sleep` の窓の中の時刻: `run app\nsleep 1s\nsleep 1s`、`Emit(300, "x")`、`Emit(1500, "y")`、`Emit(5000, "z")` → `[0.300, "o", "x"]`、`[1.200, "o", "y"]`（`z` は録画の終わりの後なので書かれない）。

C. `wait` の間は進まない: `run app\nwait /b\nsleep 100ms`、`Emit(200, "a")`、`Emit(3000, "b")`、`Emit(3050, "c")` → `[0.000, "o", "a"]`、`[0.000, "o", "b"]`、`[0.050, "o", "c"]`。

D. 返事: `run app\nsleep 100ms`、`Emit(10, "\e[6n\e[c")` → cast は `[0.010, "o", "\u001b[6n\u001b[c"]` だけ（`i` は無い）。`FakePty` に書かれた bytes をつなぐと `\e[1;1R\e[?62;22c`。

E. modifyOtherKeys: `run app\nwait /ok\n> <C-S-a>`、`Emit(0, "\e[>4;1mok")` → `[0.000, "o", "\u001b[>4;1mok"]`、`[0.000, "i", "\u001b[27;5;65~"]`。

F. `wait` の timeout: `set size 10x2\nset timeout 1s\nrun app\nwait /never`、`Emit(100, "hello")` → `RecordError(4, TimedOut("never", 1s, "hello\n"))`、cast は `[0.000, "o", "hello"]`。

G. 最後の行の途中の終了: `set typing 10ms\nrun app\n> q`、echo 無効、`Exit(5, 0)` → 成功、cast は `[0.000, "i", "q"]`、`[0.005, "x", "0"]`。

H. 最後でない行の途中の終了: `run app\nsleep 1s\n> q`、`Exit(500, 3)` → `RecordError(2, Exited(3))`、cast は `[0.500, "x", "3"]`。

I. 送れないキー: `run app\n> <D-a>` → `RecordError(2, CannotSend(…))`、cast は header だけ。

J. UTF-8 が読み込みの間で切れる: `run app\nsleep 100ms`、`Emit(10, bytes e3 81)`、`Emit(20, bytes 82)` → `[0.020, "o", "あ"]` だけ（空の文字列のイベントは書かない）。

Run: `mise exec -- emela test .`
Expected: FAIL

- [ ] **Step 4: 実装する**

`src/recorder/live.emel`。spec §7 のとおり。

Run: `mise exec -- emela test .`
Expected: PASS

- [ ] **Step 5: 検査して commit する**

`tools/lint/foundation.allow` に 1 行足す（実際に使ったキーワードに合わせて理由を直す）:

```text
src/recorder/live.emel  # 本番用の handler LiveDriver（Driver を Pty、Clock、Stdout で実装する adapter。全体設計 §9）
```

Run: `mise exec -- bun tools/check.ts --commit --test`
Expected: `tools/check: ok`

```bash
git add Pome.toml Pome.lock src/recorder/live.emel test/fake_pty.emel test/live_test.emel tools/lint/foundation.allow
git commit --no-gpg-sign -m "feat: Driver を PTY と VT と cast の writer で動かす LiveDriver を作る"
```

---

### Task 6: cli と E2E の smoke

**Files:**
- Create: `wish/main.emel`、`cli/Pome.toml`、`cli/Pome.lock`、`cli/src/main.emel`
- Create: `examples/shell.tape`、`examples/vim.tape`
- Modify: `AGENTS.md`、`tools/lint/foundation.allow`（要るなら）

**Interfaces:**
- Consumes: Task 1〜5 のすべて
- Produces: `cli` の entry（`kbdcast rec <tape>`）。spec §9 のとおり

- [ ] **Step 1: wish を書いて検査し、commit する**

`wish/main.emel`（`# wish-target: cli/src/main.emel`）。引数の読み方、tape の読み込み、`with` に並べる handler、error の出し方を書く。

Run: `mise exec -- bun tools/wish.ts check wish/main.emel`

```bash
git add wish/main.emel
git commit --no-gpg-sign -m "wish: kbdcast の main の理想形を書く"
```

- [ ] **Step 2: cli の Pome を作り、spec を調べる**

`cli/Pome.toml`:

```toml
[pome]
name = "github.com/kisepichu/kbdcast/cli"
version = "0.1.0"
emela = "0.28.2"

[dependencies]
"github.com/kisepichu/kbdcast" = "v0.1.0"
"github.com/kisepichu/kbdcast/pty" = "v0.1.0"
"github.com/kisepichu/kbdcast/pty-bun" = "v0.1.0"
"github.com/kisepichu/kbdcast/regex" = "v0.1.0"
"github.com/kisepichu/kbdcast/text" = "v0.1.0"

[replace]
"github.com/kisepichu/kbdcast" = { path = ".." }
"github.com/kisepichu/kbdcast/pty" = { path = "../pty" }
"github.com/kisepichu/kbdcast/pty-bun" = { path = "../pty-bun" }
"github.com/kisepichu/kbdcast/regex" = { path = "../regex" }
"github.com/kisepichu/kbdcast/text" = { path = "../text" }

[external]
allow = ["github.com/kisepichu/kbdcast/pty-bun"]
```

Run: `cd cli && mise exec -- emela pome install`

Emela の spec は `api.std.process`（`Args`、`Stderr`、`ExitCode`、`Process` の layer）、`api.std.file-system`、`api.std.path`、`effect.with`、`effect.layer`、`module.pome`。kbdcast の spec は §9。

- [ ] **Step 3: 実装する**

`cli/src/main.emel`:

- `rec <tape>` のほかの引数は、`usage: kbdcast rec <tape>` を stderr に書いて終了コード 2。
- tape を読めなければ `<tape>: <reason>` を stderr に書いて 1。
- `TapeError` は `<tape>:<行>:<列>: <message>`、1。
- `with BunPty(argv, cols, rows, <tape のディレクトリ>, ["TERM=xterm-256color"]), SystemClock, SystemStdout, LiveDriver(cols, rows, command.text)` の下で `run_tape`（並べ方は spec を見て決める）。
- `SpawnFailed(message)` は `<tape>:<run の行>: cannot start <argv の最初>: <message>`、1。
- `RecordError` は `<tape>:<行>: <message>`、1。`message`:
  - `CannotSend(Unencodable(key, NeedsOtherKeys(level)))`: `cannot send <print(key)>: it needs modifyOtherKeys level <1 か 2>, which the program has not enabled`
  - `CannotSend(Unencodable(key, NeedsKitty))`: `cannot send <print(key)>: it needs the kitty keyboard protocol, which kbdcast does not support`
  - `Exited(code)`: `the program exited with code <code> before the end of the tape`
  - `TimedOut(pattern, timeout, screen)`: `/<pattern> did not appear within <timeout の秒か ms>`、その後に `screen:` の行と画面の文字列

- [ ] **Step 4: 例の tape を書く**

`examples/shell.tape`:

```text
" kbdcast の最小の例: sh に名前を聞かせて答える
set size 40x5
set typing 40ms
run sh -c 'printf "name? "; read name; echo "hi $name"'
wait /name\?
> kbdcast<CR>
wait /hi kbdcast
```

`examples/vim.tape`:

```text
" vim で 1 行書いて保存する
set size 60x10
set typing 30ms
run vim --clean -n /tmp/kbdcast-example.txt
wait /kbdcast-example
> ihello from kbdcast<Esc>
sleep 300ms
> :wq<CR>
```

- [ ] **Step 5: E2E の smoke を走らせる（permanent な test にしない）**

Run: `rm -f /tmp/kbdcast-example.txt && mise exec -- emela run cli -- rec examples/shell.tape > /tmp/shell.cast; echo "exit $?"`
Expected: `exit 0`。`/tmp/shell.cast` の 1 行目が header。

Run: `mise exec -- emela run cli -- rec examples/vim.tape > /tmp/vim.cast; echo "exit $?"; cat /tmp/kbdcast-example.txt`
Expected: `exit 0`、`hello from kbdcast`。cast の最後の行が `x` で `"0"`。

Run: `mise exec -- emela run cli -- rec /nonexistent.tape; echo "exit $?"` と、誤った tape（`run x\nsleep 5`）を `/tmp` に置いて走らせる。
Expected: 終了コード 1、spec §9 の形のメッセージ。

cast の `o` を順に 3 の VT に通した最後の画面を確かめる。使い捨ての test（commit しないファイル）で、cast の行を `Std.Json` で読み、`Vt.feed` してから `Vt.text` を出す。shell は `hi kbdcast` を含み、vim は `hello from kbdcast` を含む（`:wq` の後の画面）。使い捨てのファイルは消す。tape、cast の行数、最後の画面を report に書く。vim が問い合わせへの返事を待って止まったら、止まった所と問い合わせの bytes を report に書き、`NEEDS_CONTEXT` で止まる（3 の spec を直すかを manager が決める）。

- [ ] **Step 6: 文書を直す**

`AGENTS.md` の構成の表に、`examples/` の行（`|`examples/`|tape の例（E2E の smoke に使う）|—|`）を足す。`cli/`、`pty/`、`pty-bun/` の行が中身と合っているかを確かめる。

- [ ] **Step 7: 検査して commit する**

Run: `mise exec -- bun tools/check.ts --commit --test && mise exec -- bun test tools/test`
Expected: `tools/check: ok`

```bash
git add cli/Pome.toml cli/Pome.lock cli/src/main.emel examples/shell.tape examples/vim.tape AGENTS.md
git commit --no-gpg-sign -m "feat: tape から cast を作る kbdcast rec を作る"
```

（`tools/lint/foundation.allow` を変えたら、それも add する。）

---

## Self-Review（計画の作者）

- spec の §4 は Task 1、§5 は Task 2、§6 は Task 4、§7 は Task 5、§8 は Task 3、§9 は Task 6、§10 のテストは各タスク、§12 の AGENTS.md は Task 6。全体設計の更新は spec と同じ commit で済んでいる。
- 試作で確かめたこと（2026-11-27）: `pty-bun/src/pty.mjs` の形で、出力と入力と終了コード（`exit 3` で 3、`kill -9` で 137）、`TERM` と `cwd`、打ち切った `read` の後も出力が残ること、SIGTERM を無視するプロセスを `close` が 1 秒で SIGKILL すること、背景の子が残っても 100 ms で読み込みが終わること、無いコマンドで `openError` が理由を返すこと。
- Task 5 の A〜J の cast の行は、spec §7 の刻み方から手で計算した。`FakePty` の時刻は `TestClock` の仮想時間なので、決定的に同じ行になる。
