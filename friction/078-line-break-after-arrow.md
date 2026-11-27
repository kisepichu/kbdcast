# 078 line-break-after-arrow

- 状態: open
- Emela: v0.28.2
- 意図: cli の main（`cli/src/main.emel` の `describe`、サブプロジェクト 1 の計画の Task 6）で、`RecordError` の理由ごとの長いメッセージを、腕のパターンの次の行に書く
  LiveDriver のテスト（`test/live_test.emel`、サブプロジェクト 1 の計画の Task 5 の option A の下書き。commit していない）でも、`with` の項目が 1 行に収まらないので、`,` の後で改行した
- こう書きたかった:
  `wish/main.emel:56-62`。腕の `->` で行を終え、本体の String を次の行から字下げして書いた（Rust の `=>`、Scala の `=>` の後で改行する形のつもり）
  ```emela
  match reason {
    Reason.CannotSend(Unencodable(key, NeedsOtherKeys(level))) ->
      "cannot send ${Notation.print(key)}: it needs modifyOtherKeys level ${level}, which the program has not enabled"
    ...
  }
  ```
  cli の main の wish の `catch` の block の中（`wish/main.emel:42-43`）でも、`SpawnFailed(message) ->` で行を終え、本体の `failure(...)` を次の行に書いた
  実装の途中でも、同じ形で書いた。さらに、`with` の項目が 1 行に収まらないので、`,` の後で改行して続けた（wish では 1 行だった）
  ```emela
  with BunPty(command.argv, tape.cols, tape.rows, directory(path), ["TERM=xterm-256color"]),
    SystemClock,
    SystemStdout {
  ```
  LiveDriver のテスト（Task 5 の option A の下書き、`test/live_test.emel:28-29`）:
  ```emela
  with TestClock, TestStdout, FakePty(echo),
    LiveDriver(tape.cols, tape.rows, tape.command.text) {
  ```
- 診断:
  wish check（v0.28.2）: 腕ごとに、`->` の後ろを指す ``error[E0118]: expected expression`` と、次の行の String の後ろを指す ``error[E0110]: expected `->` `` の 2 つ（3 つの腕で 6）。本体の String を次の腕のパターンと読んでいる。help は無い
  実装の途中の `emela check`（2026-11-28）: 同じ E0118 と E0110 に加えて、String の中の補間ごとに ``error[E0117]: string interpolation is not allowed in a pattern``（5）、``error[E0301]: type mismatch: expected `Reason`, found `String` ``（3）、後ろの腕ごとの ``warning[W0301]: unreachable match arm``（5）。本体をパターンと読んだ後追いで、どれも「`->` の後で改行できない」とは言わない
  `with` の `,` の後の改行: `,` の後ろを指す ``error[E0110]: expected type name`` と ``error[E0110]: expected `{` ``、次の行の `{` を指す ``E0122: expected newline or `}` after statement``、続く項目を指す ``error[E0217]: expected constructor, found handler `SystemClock` ``（項目を式の文と読んだ）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28）: `n match { 0 ->⏎"zero"⏎_ -> "other" }` は E0118、E0110、``E0301: type mismatch: expected `Int`, found `String` `` の 3 つ。`with SystemClock,⏎SystemStdout { ... }` は E0110 が 2、E0122、E0217 の 4 つ。どちらも help は無い
  cli の main の wish の `:42-43` には、診断が届かなかった（`:41` の `} catch {` が先に ``E0122: expected newline or `}` after statement`` になった。016 に数えた）
  LiveDriver のテストの `with` の `,` の後の改行（Task 5 の hook、`task-5-report.md` の「Hook output」の 1）: `emela fmt --check` に、`28:53` の `,` を指す ``error[E0110]: expected type name`` と ``error[E0110]: expected `{` ``、`29:65` の `{` を指す ``error[E0122]: expected newline or `}` after statement`` の 3 つ。`emela check` には、同じ 3 つに加えて `Recorder.Live` の E0205 と、`Live` と `LiveDriver` の E0211 が出た。cli の `with` の E0217 にあたるものは出ていない。help は無い
- 回避策:
  `->` の後ろを block にして、本体を次の行に書いた（`CannotSend(...) -> {⏎"..."⏎}` と `TimedOut(...) -> {⏎"..."⏎}`）。腕を 1 行に書くと幅 100 を超え、fmt は本体でなくパターンの引数の列を割る（`CannotSend(⏎Unencodable(key:, reason:),⏎) -> "..."`、`[fmt.wrap]`）。`CannotSend` の 2 つの腕は、キーを送れない理由の文を `unsendable(reason)` に分けて 1 つの腕にした（同じ前置きの `cannot send <key>:` を 2 度書かないためでもあり、回り道ではない）
  `with` は項目を 1 行に書き、fmt が `BunPty(...)` の引数の列を割る形（`with BunPty(⏎...,⏎), SystemClock, SystemStdout {`）にした
  LiveDriver のテストの `with` も、項目を 1 行に書いて直した（1 行の変更）。commit した `test/live_test.emel:30` は、option C で `LiveDriver` が項目から消えたので、`with TestClock, TestStdout, FakePty(echo) {` の 1 行に収まる
  どれも `[lex.continuation]` の決まった形に直しただけなので、コードに印は付けない
- コスト: block の `{` と `}` の 2 行が 2 つの腕に増えた。普段のコードに基盤レベルは漏れていない。直すには `[lex.continuation]` と `[fmt.wrap]` を引く必要があった。診断は本体をパターン（腕）や項目を式の文と読んだ後追いを重ね、直す所（`->` や `,` の後の改行）を指さない
- spec: `[lex.continuation]`（続くのは、次の行が二項演算子、`.`、`escape`、`match {`、`else`、`->` で始まるとき、名前か `{` が後ろに来る `fails` か `uses` で始まるとき、error の集合の途中の行の次の行が `|` で始まるときと、開いた `(` `[` の中だけ。行末の `->` や `,` では続かない）、`[fmt.wrap]`（「The formatter does not break after the `=` of a binding or after the `->` of an arm, because an expression at the start of a line starts a new statement.」）、`[grammar.expr]`（`with_expr = "with" with_item { "," with_item } block`）、`spec/diagnostics.md` の E0118、E0110
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「match arm newline」「with items line break」「line continuation」を検索。当たったのは、行末の二項演算子が続かないことを docs に書いた PR #274（issue #260）と、別の話題の PR）。続かないことは決まった設計で、#274 は演算子の場合だけを扱う
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: when a line ends right after the `->` of a match arm, E0118 (`expected expression`) could add ``= help: the body of an arm starts on the line of its `->`; to write it on the next line, use a block: `-> {` ... `}` ``, and the line after it should not be read again as the pattern of another arm (E0110, E0117, E0301 and W0301 follow from that reading). In the same way, a line that ends with the `,` of a `with` item list could get ``= help: the items of a with are written on one line; a line break continues only inside `(` `[` ([lex.continuation])``
