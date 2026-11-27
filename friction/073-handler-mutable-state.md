# 073 handler-mutable-state

- 状態: open
- Emela: v0.28.2
- 意図: recorder の本番用の handler `LiveDriver`（`src/recorder/live.emel`、サブプロジェクト 1 の計画の Task 5）が、操作をまたいで VT、UTF-8 のデコーダ、tape の時間、cast の `Writer`、プロセスが終わったかどうかを持ち、操作のたびに新しい値に置き換える（recorder の spec §7）。計画の Interfaces は、`LiveDriver` を `init(cols: Int, rows: Int, command: String)` で開き、使うのは `Pty`、`Clock`、`Stdout` だけとしている（Task 6 の cli は `with BunPty(...), SystemClock, SystemStdout, LiveDriver(cols, rows, command.text) { run_tape(tape) }` と書く）
- こう書きたかった:
  `wish/live.emel:24-36`、`:50`、`:93`、`:95`、`:103`、`:118`。欄を handler の本体に `var` で宣言し（Kotlin の class の `var` の property のつもり）、init で初めの値を代入し、操作の中で代入し直す
  ```emela
  pub handler LiveDriver: Driver uses { Pty, Clock, Stdout } {
    var vt: Vt.Terminal
    var tape_ms: Int
    ...
    init(cols: Int, rows: Int, command: String) {
      Stdout.write_line(Cast.header(cols, rows, command))
      vt = Vt.new(cols, rows)
      tape_ms = 0
      ...
    }

    suspend fn idle(d: Duration) -> () fails ProcessExited {
      ...
      tape_ms += d.as_ms()
    }
  ```
- 診断:
  wish check（v0.28.2）は、handler の頭の `uses`（075）の ``E0110: expected `{` `` で handler の宣言を読み損ね、`var` の欄（`:24-28`）には何も出なかった。`:50` の `tape_ms += d.as_ms()` には ``error[E0125]: invalid left-hand side of binding: expected a pattern`` と E0118。欄への代入（`:93` の `decoder = next_decoder`、`:95`、`:103`、`:118`）は新しい束縛として読まれ、代入としての診断は出ない（出たのは、`let`（004）で束ねられなかった右辺の名前の E0211 と、`:103` の何も出ない束縛）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28）:
  - 本体の `var n: Int` に ``error[E0110]: expected `init`, `release`, operation (`fn`) or inner handler (`handler`)``（067 と同じ）、操作の `n = n + 1` の右辺の `n` に ``error[E0211]: cannot find value `n` in this scope``、代入だけの init に ``error[E0301]: type mismatch: expected `Counting`, found `()` ``
  - spec の形の欄（`handler Counting(n: Int): Counter`）を、操作の中で `Counting(n: self.n + 1, ..self)` に置き換えようとすると ``error[E0418]: handler `Counting` can only be constructed in its own `init` ``（``help: use `with Counting { ... }`; `init` and `release` run there``）
  欄は init で 1 度だけ決まり、変えられない。可変の状態は `State[S]` だけで、それを置くのは `State.run(initial, body)` という関数なので、handler の init からは置けない（init は handler の値を返して終わり、with の本体を包めない）
- 回避策:
  計画の Interfaces を変えるので controller と manager に諮り、manager が決めた形（ESCALATION 1 の C）にした。状態を private な `type Recording(vt, decoder, tape_ms, writer, exit_code)` にまとめて `State[Recording]` に置き、`LiveDriver` の操作と、操作を分けた関数がそれを `use` する（handler の要求になる。TestClock の `State[Instant]`、TestStdout の `State[StdoutText]` と同じ形）。`State` を置くために、関数 `pub fn record(tape: Tape) -> () fails RecordError uses { Async, Clock, Pty, Stdout }` を足した。中で、初めの値（private な `recording(cols, rows)`）の `State.run` を開き、その中の `with LiveDriver(...)` の下で `run_tape` を走らせる。大きさは `Tape` の 1 か所から取る。終わりの状態は使わないので捨てる。`LiveDriver`、`Recording`、`recording` は private で、外から見えるのは `record` だけ
  ```emela
  pub fn record(tape: Tape) -> () fails RecordError uses { Async, Clock, Pty, Stdout } {
    (_, _) = State.run(recording(tape.cols, tape.rows), || {
      with LiveDriver(tape.cols, tape.rows, tape.command.text) { Recorder.run_tape(tape) }
    })
  }
  ```
  使う側の cli（Task 6）は `with BunPty(...), SystemClock, SystemStdout { Live.record(tape) }` と書く。test（`test/live_test.emel`）は `TestClock`、`TestStdout`、`FakePty` の下で `Live.record(tape)` を呼び、`State[Recording]` は出てこない。1 つの欄を変えるのに `st.update(|r| Recording(tape_ms: r.tape_ms + window, ..r))`、いくつかを読んで変えるのに `r = st.get()` と `st.set(Recording(vt:, decoder:, ..r))` と書く。印は `src/recorder/live.emel` の 2 つの `FRICTION(073)`: `record` の doc comment の下と、`LiveDriver` のコメントの下
  初めの試作（commit していない。ESCALATION 1 の A）は、`Recording` と `recording` を公開し、使う側が `State.run(Live.recording(cols, rows), || { with ..., LiveDriver(cols, rows, command) { run_tape(tape) } })` と書く形だった。`cols` と `rows` を 2 度渡し、食い違うと VT と header の大きさがずれるので、採らなかった
- コスト:
  - 計画の Interfaces から外れる: 公開するものが handler `LiveDriver` から関数 `record` に変わる。cli（Task 6）は、`with ..., LiveDriver(...)` の下で `run_tape` を呼ぶ代わりに、`Pty`、`Clock`、`Stdout` の handler の下で `Live.record(tape)` を呼ぶ（全体設計 §9 の「`BunPty`、`SystemClock`、`SystemStdout` の下で `run_tape` を走らせる」は、`record` の中で満たす）。recorder の spec §7 と、計画の Task 5、6 の Interfaces は書き直しが要る（manager への一覧に載せる）
  - handler を handler として渡せない: `LiveDriver` は外から `with` で開けないので、ほかの handler と並べることも、`run_tape` でない本体の下で使うこともできない。状態を handler の中に持てれば、handler をそのまま公開できた
  - 状態の置き場所のためだけの関数 `record`（5 行）と、初めの値を作る関数 `recording`。`State.run` が返す終わりの状態は `(_, _)` で捨てる
  - 操作を分けた関数 5 つ（`running`、`read_window`、`wait_screen`、`receive`、`event`）が `State[Recording]` を `uses` に持つ（基盤レベルの keyword。`tools/lint/foundation.allow` の理由に書いた）
- spec:
  `[effect.handler]`（「A handler with state declares fields after its name.」「A handler value (`PostgresUsers(conn: ...)`) can be made only inside that handler's init.」「A record update (`H(n: 1, ..self)`) also makes a value, so it cannot be written in an operation body.」）、`[effect.state]`（「Mutable state is represented by State ... The state lives in the frame of `State.run`」「A handler that uses state is written as a handler that requires State. Test handlers take this form.」）、`[api.std.state]`、`[intro.premises]`（変数は不変）、`spec/diagnostics.md` の E0418
- 既存:
  `spec/open-questions.md` の 21（「there is no Ref. Mutable state is expressed with State[S], an effect with a type parameter, and `State.run`」。決まった設計）。checkout の main（596b6038）の `proposals/generic-handler.md:33` も「Use `State.run` directly for state」。emela の issue と PR に、handler が操作をまたぐ自分の状態を持つ話は無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「handler state」「handler field mutable」「parameterized handler」「handler self update」「State.run handler」を検索。当たったのは C の record の表し方の PR #639 だけで、別の話題）
- 行き先:
  既に知られている制限（open question 21 で決まった）→ 実際の使い道を添えて issue にする材料。下書き（未提出。出すのは user）: A production handler that keeps state across its operations (a recorder's handler of a domain port, which holds a terminal emulator, a UTF-8 decoder, the recording time and a writer, and replaces them on every operation) cannot keep it itself. Its fields are fixed by its init (E0418 on `H(n: ..., ..self)` in an operation), and `State.run` is a function that wraps a body, so an init cannot open a State for the with that the handler belongs to. The state goes to a `State[S]` that the user of the handler provides, `State.run(initial, || with H(...) { ... })`. Either the type of the state and its initial value become part of the handler's public API, and a value that the init also needs (the size of the terminal) is passed twice, or (what we chose) the handler is made private behind a function that opens both, `pub fn record(tape: Tape) -> () fails RecordError { (_, _) = State.run(initial(tape), || { with H(tape) { run(tape) } }) }`, and it is no longer a handler that its users can install next to others. A parameterized handler (Plotkin and Pretnar: each operation receives the current parameter and resumes with the next one), or a State that an init opens for the lifetime of its handler (as it opens a handler member, `[effect.handler]`), would keep the state inside the handler, within the premises (values stay immutable, a continuation resumes once)
