# サブプロジェクト 1: recorder

- 日付: 2026-11-27
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`（§5 の 1、§6、§9）
- 状態: 実装済み（PR #20）

## 1. 目的と範囲

tape から cast を作る `kbdcast rec <tape>` を作る。中身は次のとおり。

- tape のパーサ（全体設計 §6 の言語）
- asciicast v3 の writer
- ドメインの port の effect `Driver` と、tape の意味だけを書いた `run_tape`
- 本番用の `Recorder.Live.record`（中の handler `LiveDriver` が、VT、UTF-8 のデコーダ、key codec の encode、cast の writer をつなぐ）
- host の port の effect `Pty`（`pty/`）と、Bun の PTY の handler `BunPty`（`pty-bun/`）
- main（`cli/`）

cast の reader は overlay（4）で作る。

## 2. 決めたこと

| 論点 | 決定 | 採らなかった案 |
|---|---|---|
| cast の時刻 | tape の時間で刻む。`sleep` と、キーの後の `typing` の間は、窓の始まりからの実際の経過で刻む（窓の長さに丸める）。`wait` の間は時間を進めない | 実際の時刻で刻む（`wait` やアプリの起動にかかった時間が GIF に入り、同じ tape でも GIF の時間が毎回変わる） |
| 端末への返事 | VT の返事は PTY に書き戻すが、`i` イベントには書かない | `i` に書く（overlay がキーでないものを読むことになる） |
| cast の header | `{"version": 3, "term": {"cols": C, "rows": R, "type": "xterm-256color"}, "command": "<run の行の引数の文字列>"}` | timestamp や env を入れる（同じ tape から同じ header にならない。v3 は env を勝手に入れないことを勧める） |
| interval | ミリ秒の精度（小数 3 桁）。tape の時間はミリ秒の整数で進むので、前の時刻との差をそのまま書けば丸めの誤差は出ず、v3 が勧める誤差の持ち越しは要らない | 6 桁で書く（揺れが大きく見えて読みにくい） |
| `o` イベント | PTY の `read` の 1 回を 1 つのイベントにする。bytes は `Utf8` のデコーダで文字列にする。空の文字列は書かない | 時間で束ねる（決める根拠が無い） |
| cast の出力 | 書けた所から stdout に書く（`Std.Process.Stdout`）。全体設計 §9 の `CastSink` は作らない | `CastSink` の effect（`TestStdout` があるので test に要らない） |
| PTY の読み方 | pull 型。Bun が `data` callback に渡す出力を JS の側で貯め、`read` が貯まった分を全部返す。読み込みを打ち切られても貯めた分は残る | push 型の callback を Emela に渡す（fiber 1 本の設計に合わない） |
| プロセスの環境 | 環境変数は kbdcast のものに `TERM=xterm-256color` を上書きする（JS の側で合わせる）。作業ディレクトリは tape のあるディレクトリ | — |
| 起動 | `mise exec -- emela run cli -- rec demo.tape > demo.cast`（`EMELA_JS_HOST=bun` が要る。`mise.toml` にある） | 別の起動用の script を置く（要るまで作らない） |

## 3. 置き場所

| 場所 | module | 中身 |
|---|---|---|
| `src/tape.emel` | `Tape` | tape のパーサ |
| `src/cast.emel` | `Cast` | asciicast v3 の writer |
| `src/recorder.emel` | `Recorder` | `Driver`、`RecordError`、`run_tape` |
| `src/recorder/live.emel` | `Recorder.Live` | `record(tape) -> () fails RecordError`（`Async`、`Clock`、`Pty`、`Stdout` を使う）。`LiveDriver` と状態の `Recording` は private |
| `pty/` | `Pty` | `github.com/kisepichu/kbdcast/pty`。effect `Pty` の宣言だけ |
| `pty-bun/` | `PtyBun` | `github.com/kisepichu/kbdcast/pty-bun`。handler `BunPty` と `src/pty.mjs`。`targets = ["js"]` |
| `cli/` | （entry） | `github.com/kisepichu/kbdcast/cli`。`src/main.emel`。`[external] allow` に pty-bun |

- root の Pome は、regex と pty に `[replace]` で依存する（text は regex を通して）。cli は root と pty-bun に依存する。
- `@external` は pty-bun にだけ置く（全体設計 §7）。pty と pty-bun は x の形（`Pome.toml`、`README.md`、`src/`、`test/`）で作る。

型と関数の形は wish で決める。以下の節の書き方は、意味を決めるための仮の形である。

## 4. tape

```emela
pub type Tape(cols: Int, rows: Int, typing: Duration, timeout: Duration, command: Command, steps: List[Step])
pub type Command(line: Int, argv: List[String], text: String)
pub enum Step {
  Keys(Int, List[Key]) | Sleep(Int, Duration) | Wait(Int, Regex, String)
  | SetTyping(Int, Duration) | SetTimeout(Int, Duration)
}
pub error TapeError(line: Int, column: Int, message: String)
pub fn parse(source: String) -> Tape fails TapeError
```

- 全体設計 §6 の言語。行の番号と列は 1 から数える（列は code point）。行の終わりの `\r` は捨てる。
- `Tape` は、正しくない形を表せない（`run` はちょうど 1 つ、`set size` は `run` の前、ほかの step は `run` の後）。`run` の前の `set typing` と `set timeout` は、`typing` と `timeout` の初めの値にする。`run` の後のものは step にする。
- 既定は `80x24`、`typing 50ms`、`timeout 10s`。大きさは 1 から 1000。duration は 2147483647 ms まで（`<n>s` は n が 2147483 まで）。超えたら `duration too long: <text>`（Int が巻き戻って壊れた cast を書かないため）。
- 行頭の空白は捨てる。`"` で始まる行と空の行は無視する。
- `run` の引数はシェル風に分ける。空白で区切り、`'...'` の中はそのまま、`"..."` の中は `\"` と `\\` だけを escape として読む。引用の外の `\` は次の 1 文字をそのまま読む。閉じない引用は error。`text` は `run` の後ろの文字列そのもの（cast の header の `command`）。
- `wait /<pattern>`: `/` の後ろから行末まで（行末の空白も含む）を regex の Pome の `compile` に flag 無しで渡す。`RegexSyntax` の offset は、行の列に直す。
- `> <keys>`: `>` の後の空白 1 つを区切りにし、残りを `Key.Notation.parse` に渡す。`NotationError` の offset は、行の列に直す。キーが 1 つも無い行は error。
- `<dur>` は `<整数>ms` か `<整数>s`。`500m` は「`ms` と書く」と言う error にする。
- error のメッセージは英語。どの error も、問題の所の列を持つ。

## 5. cast の writer

```emela
pub opaque type Writer                                   # 前のイベントの時刻
pub fn header(cols: Int, rows: Int, command: String) -> String
pub fn writer() -> Writer
pub fn event(w: Writer, at_ms: Int, code: String, data: String) -> (Writer, String)  # 1 行。at は録画の始まりからの tape の時間
```

- 時刻は内部では録画の始まりからのミリ秒の整数で持ち、interval への変換はここだけで行う（全体設計 §8）。interval は前のイベントとの差を秒で小数 3 桁に書く（`1234` ミリ秒の差は `1.234`）。
- 文字列は `Std.Json` で JSON の文字列にする。v3 は印字できない文字を `\uXXXX` にすることを求めるので、`Std.Json` が escape しない印字できない文字（0x7F と C1 の 0x80〜0x9F）があれば、それも `\uXXXX` にする。
- 行の形は、header が `{"version": 3, "term": {"cols": C, "rows": R, "type": "xterm-256color"}, "command": <文字列>}`、イベントが `[<interval>, "<code>", <文字列>]`（区切りは `, ` と `: `。v3 の文書の例と同じ）。
- 書くイベントは `o`、`i`、`x`（`x` の data は終了コードの 10 進）。

## 6. Driver と run_tape

```emela
pub effect Driver {
  suspend fn press(key: Key) -> () fails Unencodable | ProcessExited
  suspend fn idle(d: Duration) -> () fails ProcessExited
  suspend fn wait_for(pattern: Regex, source: String, timeout: Duration) -> () fails WaitTimeout | ProcessExited
}
pub error ProcessExited(code: Int)
pub error WaitTimeout(screen: String)
pub error RecordError(line: Int, reason: Reason)
pub enum Reason { CannotSend(Unencodable) | Exited(Int) | TimedOut(String, Duration, String) }  # pattern、timeout、画面
pub fn run_tape(tape: Tape) -> () fails RecordError uses { Driver }
```

- `run_tape` は step を順に行う。`Keys` はキーを 1 つずつ `press` し、そのたびに `idle(typing)`。`Sleep` は `idle`。`Wait` は `wait_for(pattern, source, timeout)`（`source` は pattern の文字列。`Regex` から元の文字列を取れないため。friction 069）。`SetTyping` と `SetTimeout` は、以後の値を変える。
- Driver の error に、`escape` で tape の行番号を足して `RecordError` にする。
- プロセスの終了（`ProcessExited`）:
  - 最後の step の途中なら、録画を終えて成功にする（`> :wq<CR>`）。ただし最後の step が `Wait` なら error。「最後の step」は、後ろに `Keys`、`Sleep`、`Wait` が無い step（後ろに `set` の行だけが続いてもよい）。
  - 最後でない step の途中なら error（その行）。
- 最後の step が終わったら成功にする。残ったプロセスは、Pty の handler の release で止まる。
- 終了が伝わるのはプロセスの終了から 100 ms 後（§8）なので、最後の step の窓（例えば `typing` の 30 ms）の中では見えないことが多い。そのときは成功のまま `x` を書かない（`examples/vim.tape` の cast は `x` で終わらない）。`x` は GIF の画に効かない。

## 7. record と LiveDriver

`record(tape)` は、状態の `State[Recording]` を `State.run` で開き、その中で `with LiveDriver(…)` の下で `run_tape(tape)` を走らせる。Emela 0.28.2 の handler は、操作の間で自分の field を変えられない（handler の値は init の中でしか作れない。friction 073）ので、変わる状態は `State` に置き、`State` は呼び出し側に見せない。大きさは `Tape` の 1 か所からしか取らない。`LiveDriver` は `Driver` の handler で、`Pty`、`Clock`、`Stdout`、`State[Recording]` を使う。`Recording` は、VT（`Vt.Terminal`）、UTF-8 のデコーダ、tape の時間（ミリ秒）、cast の `Writer`、プロセスが終わったかどうか。

- init で cast の header を書く。
- `press(key)`: 終わっていれば `ProcessExited`。`Key.Encode.encode(key, Vt.input_modes(vt))` の bytes を PTY に書き、tape の時間で `i` イベントを書く（data は bytes を UTF-8 として読んだ文字列）。
- `idle(d)`: 窓の始まりの実際の時刻を `Clock.now` で取り、窓の残りの時間で `Fiber.timeout` して PTY を読むことを繰り返す。読めた bytes は UTF-8 のデコーダと VT に通し、`o` イベントを `tape の時間 + min(窓の始まりからの経過, d)` で書く。ただし同じ窓の前の出力より前の時刻にはしない（壁時計が戻っても cast の時刻が戻らないように）。VT の返事は PTY に書く。窓が終わったら tape の時間を `d` 進める。
- `wait_for(pattern, source, timeout)`: まず今の画面（`Vt.text`）を見る。合わなければ、`timeout` の残りで `Fiber.timeout` して PTY を読み、`feed` のたびに画面を見る。`o` イベントは今の tape の時間で書く（時間を進めない）。`timeout` を過ぎたら `WaitTimeout(画面)`。
- PTY が `Exited(code)` を返したら、`x` イベントを書き、以後の操作はどれも `ProcessExited(code)`。プロセスが kbdcast に止められたときは `x` を書かない。
- 実際の時刻は `Clock.now`（壁時計。friction 032 の飛び）で測るが、経過は窓の長さの中に丸めるので、飛んでも cast の時刻は窓の外に出ない。

## 8. Pty と BunPty

```emela
# pty/
pub enum Output { Data(Bytes) | Exited(Int) }            # Exited の Int は終了コード（signal なら 128 + 番号）
pub effect Pty {
  suspend fn read() -> Output                              # 届いた出力を全部。何も無ければ届くまで待つ
  fn write(b: Bytes) -> ()
}

# pty-bun/
pub handler BunPty(...): Pty                               # init(argv, cols, rows, cwd, env) でプロセスを起動、release で止める
```

- `read` は、貯まった出力があれば全部を返す。無ければ届くまで待つ。打ち切られても（`Fiber.timeout` の割り込み）、届いていた出力は次の `read` に残る。
- プロセスが終わり、PTY の出力も終わったら `Exited`。`Bun.Terminal` の `exit` callback（PTY の EOF）は Bun 1.4.3 では呼ばれなかったので、実際には、どのプロセスもプロセスの終了から 100 ms で出力の終わりとみなす道で終わる（子が端末を開いたまま残っている場合も同じ）。`Exited` の前に、届いた出力はすべて `Data` で返す。Bun の版を上げるときに、`exit` が来るかを見直す。
- release は、プロセスが残っていれば SIGTERM を送り、1 秒で終わらなければ SIGKILL を送り、端末を閉じる。
- 起動できない（コマンドが無い）ときは、init が `SpawnFailed(message)` で失敗する（Emela の handler の init は fail できた。friction 063）。cli は `<tape>:<run の行>: cannot start <argv の最初>: <message>` と出す。`RecordError` ではない。
- JS の側（`pty-bun/src/pty.mjs`）は manager が試作で確かめた（2026-11-27）: 読み込みを打ち切っても出力が残る、SIGTERM を無視するプロセスは 1 秒で SIGKILL、背景の子が残っても 100 ms で終わる。

## 9. cli

- `kbdcast rec <tape>`: tape を読み（`Std.FileSystem`）、parse し、`with BunPty(…), SystemClock, SystemStdout { Live.record(tape) }` を走らせる。cast は stdout に書く。
- error は stderr に書き、終了コード 1。`TapeError` は `<tape>:<行>:<列>: <message>`、`RecordError` は `<tape>:<行>: <message>`。`TimedOut` のときは、その後に画面の文字列を書く。
- 引数の誤りは使い方を stderr に書き、終了コード 2。

## 10. テスト

| 対象 | 手法 |
|---|---|
| tape（固定） | 正しい tape と結果の `Tape`、誤った tape と error の行、列、メッセージの表 |
| cast の writer（固定） | header の文字列、interval の書き方、JSON の escape（制御文字、`"`、`\`、ASCII でない文字） |
| `run_tape` | 呼ばれた操作を記録する `TestDriver`（test の handler）で、操作の並び（`typing` の待ちを含む）、`set` の効き方、error の行番号、最後の行の終了 |
| `record` | 決まった時刻に決まった出力を返す `FakePty`（test の handler）と `TestClock`、`TestStdout` で、cast の全部の行を確かめる。tape の時間の刻み方、`wait` で時間が進まないこと、返事を PTY に書くこと、modifyOtherKeys で encode が変わること、`WaitTimeout` の画面、プロセスの終了と `x` |
| pty-bun（結合） | 本物の PTY で `sh` の小さな script を動かす。出力、入力、終了コード、打ち切った `read` が出力を失わないこと、SIGTERM を無視するプロセスを release が止めること、起動できないコマンド |
| E2E（smoke） | `cli` で、`sh` の script と vim の tape を録り、cast の `o` を順に 3 の VT に通した最後の画面の文字列を確かめる。permanent な test にはしない（時間が揺れる。全体設計 §11 の「E2E は smoke」） |

## 11. 検査の仕組みとの関係

- wish-first の単位: tape、cast、recorder（Driver と run_tape）、live、pty、pty-bun、cli の main。
- `tools/lint/foundation.allow` に登録したもの: `src/tape.emel`（`parse` と、行を読む関数が `TapeError` を宣言して `parse` まで伝える）、`src/recorder.emel`（ドメインの port の effect `Driver` と、`run_tape` の `fails` と `uses`）、`src/recorder/live.emel`（本番用の handler `LiveDriver` と `record`）。cli の main は基盤レベルの keyword を使わなかった。pty と pty-bun は lint の外。
- `tools/wish.ts` は #12 の修正で、`pty/src/…`、`pty-bun/src/…`、`cli/src/…` の wish を仮の Pome で検査する。
- 先に予想しておく friction: handler の状態の持ち方（`State`）、`Fiber.timeout` と割り込み、`@external` の host type と suspend、init の失敗、`Duration` と `Instant` の計算、`Std.Json` で文字列を書く、FileSystem と Path、Pome の間の `[replace]` と `[external] allow`。→ 結果（PR #20）: 割り込み以外は起きた（073 の handler の状態、074 の Int のミリ秒、064 と 066 の host type と suspend、063 の init の失敗、061 と 016 の Duration と Instant、062 の JSON の文字列、077 の Path、081 の Pome ごとの `[replace]`）。割り込みは、`AbortSignal` と `pty.mjs` の貯め方で設計どおりに動いた。
- PR を出す前に、別の session で friction-review skill を走らせる。

## 12. 周辺の変更

- AGENTS.md の構成の表は、`pty/`、`pty-bun/`、`cli/` がもう載っている。中身が違えば直す。
- 全体設計 §9 の図の `CastSink` と `StdoutSink` を、`Stdout`（`SystemStdout`、`TestStdout`）に直す。§6 の「時間の扱い」に、cast の時刻が tape の時間であることを書く。この spec と同じ commit で直す。

## 13. 完了条件

- root、pty、pty-bun、cli の `emela test` が通る。
- `mise exec -- bun tools/check.ts --commit --test`、`mise exec -- bun test tools/test`、`mise exec -- prek run --all-files` が通る。
- E2E の smoke の結果（tape、cast の行数、最後の画面）が PR にある。
- 予想した friction と、実際に出た friction がメモになっている。
- friction-review の結果が PR 本文にある。

## 14. リスク

- Emela の handler の状態、`Fiber.timeout` の割り込み、`suspend fn` の external の組み合わせを、まだ使ったことがない。→ 状態は `State` に置く形にした（§7）。割り込みと external は設計どおりに動いた。
- `Bun.Terminal` は新しい API（Bun 1.3 から）。Bun の版を上げるときに pty-bun の結合テストで確かめる。
- 実際のアプリ（vim など）は、起動のときに問い合わせを送る。3 の返事で足りなければ、E2E の smoke で止まる。止まったら、返事を足すかを決める（3 の spec を直す）。
