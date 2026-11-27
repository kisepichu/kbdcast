# 019 fmt-guard-or

- 状態: filed
- Emela: v0.28.2
- 意図: `regex/src/syntax.emel` を `emela fmt` で整える（`tools/check.ts` が `emela fmt --check` を走らせる）。その中に、or-pattern の代わり（015）の長い `||` の guard がある
  tape のパーサ（`src/tape.emel` の `split_words`、サブプロジェクト 1 の計画の Task 1）でも、`"..."` の中の 2 つの escape を or-pattern の代わり（015）の `||` の guard にした腕が、幅に収まらなかった
- こう書きたかった:
  括弧の無い `||` の guard を、幅に収まらないまま書き、fmt に折らせる（`regex/src/syntax.emel` の `group`）
  ```emela
  [OPEN_PAREN, QUESTION, c, ..] if c == SMALL_I || c == SMALL_M || c == SMALL_S || c == HYPHEN -> fail RegexSyntax(
    message: "modifiers are not supported",
    offset: open,
  )
  ```
  tape のパーサの腕（括弧の無い形）:
  ```emela
  (Quoted(DOUBLE_QUOTE, _), [BACKSLASH, c, ..rest]) if c == DOUBLE_QUOTE || c == BACKSLASH -> go(
  ```
- 診断:
  `emela fmt --check src test` と `emela fmt -`（v0.28.2）が、ファイル全体を整えずに止まる
  ```
  error: internal error: cannot format this file: the output has a syntax error: expected `->` at 11175..11176
     ─[ src/syntax.emel ]
     = note: the file was left unchanged
  ```
  offset は fmt の出力の中の位置で、入力のどこかは示さない。宣言ごとに `emela fmt -` に通す使い捨ての script で探して、`group` の腕だと分かった。repo の外での最小の形（2026-11-25）:
  ```emela
  fn f(xs: List[Int]) -> Int {
    xs match {
      [c, ..] if c == 1111111111 || c == 2222222222 || c == 3333333333 || c == 4444444444 || c == 5555 -> 1
      _ -> 0
    }
  }
  ```
  は ``expected `->` at 72..73``（最初の `||` の直前）で止まる。最後の `|| c == 5555` を消して幅に収めると通る。`||` を `&&` に変えると、`&&` の前で折って通る。guard の外の、幅に収まらない `||` の鎖（関数の本体）は `( ... )` で囲んで折って通る
  tape のパーサ（v0.28.2、2026-11-27）でも、編集のたびの hook の `emela fmt --check src test` が ``error: internal error: cannot format this file: the output has a syntax error: expected `->` at 12321..12322`` で止まった。offset は出力の中の位置だが、入力のファイルの同じ byte の位置がこの腕の guard の中だったので、このメモの形だと分かった（使い捨ての script は要らなかった）
- 回避策:
  guard を自分で括弧で囲んだ（`if (c == SMALL_I || c == SMALL_M || c == SMALL_S || c == HYPHEN) -> {`、`regex/src/syntax.emel` の `FRICTION(019)` の印）。fmt は括弧の中を `||` の前で折る
  tape のパーサ（`src/tape.emel` の `split_words`、`FRICTION(019)` の印）も、guard を `if (c == DOUBLE_QUOTE || c == BACKSLASH)` と括弧で囲んだ。fmt は括弧の中の `||` の前で折った
- コスト:
  括弧 1 組。原因の場所を探すのに使い捨ての script が要った。fmt が止まると、ファイルの他の部分も整わない。普段のコードに基盤レベルは漏れていない
  tape のパーサ: 括弧 1 組
- spec:
  `[fmt.wrap]`（「The formatter does not break before `-` or `||` outside brackets ... A chain of `||` that does not fit outside brackets is enclosed in parentheses, and broken before each `||` inside them.」）、`[lex.continuation]`（行頭の `||` は anonymous function を始める）、`[fmt.block]`
- 既存: emela の issue に無い（2026-11-25 に取得した issue と PR の 864 件を、「guard」「ガード」「cannot format this file」「internal error」で検索。当たったのは別の話題）
- 行き先:
  spec と実装がずれている（fmt のバグ）→ issue: https://github.com/emela-lang/emela/issues/897（2026-11-26 に user が出した。main の 596b603 から build した emela でも同じ形で止まる）。修正の PR: https://github.com/emela-lang/emela/pull/898（2026-11-26、fork の kisepichu/emela から。`if` の条件でも同じ原因で止まることと、手で書いた括弧の形が変わることも直す。`[fmt.wrap]` の文と、括弧の中の改行の実装とのずれは、PR で作者に相談した）
