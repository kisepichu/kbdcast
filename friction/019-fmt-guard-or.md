# 019 fmt-guard-or

- 状態: open
- Emela: v0.28.2
- 意図: `regex/src/syntax.emel` を `emela fmt` で整える（`tools/check.ts` が `emela fmt --check` を走らせる）。その中に、or-pattern の代わり（015）の長い `||` の guard がある
- こう書きたかった:
  括弧の無い `||` の guard を、幅に収まらないまま書き、fmt に折らせる（`regex/src/syntax.emel` の `group`）
  ```emela
  [OPEN_PAREN, QUESTION, c, ..] if c == SMALL_I || c == SMALL_M || c == SMALL_S || c == HYPHEN -> fail RegexSyntax(
    message: "modifiers are not supported",
    offset: open,
  )
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
- 回避策:
  guard を自分で括弧で囲んだ（`if (c == SMALL_I || c == SMALL_M || c == SMALL_S || c == HYPHEN) -> {`、`regex/src/syntax.emel` の `FRICTION(019)` の印）。fmt は括弧の中を `||` の前で折る
- コスト:
  括弧 1 組。原因の場所を探すのに使い捨ての script が要った。fmt が止まると、ファイルの他の部分も整わない。普段のコードに基盤レベルは漏れていない
- spec:
  `[fmt.wrap]`（「The formatter does not break before `-` or `||` outside brackets ... A chain of `||` that does not fit outside brackets is enclosed in parentheses, and broken before each `||` inside them.」）、`[lex.continuation]`（行頭の `||` は anonymous function を始める）、`[fmt.block]`
- 既存: emela の issue に無い（2026-11-25 に取得した issue と PR の 864 件を、「guard」「ガード」「cannot format this file」「internal error」で検索。当たったのは別の話題）
- 行き先:
  spec と実装がずれている（fmt のバグ）→ issue。下書き（未提出。出すのは user）: `emela fmt` breaks a `||` chain in a match guard that does not fit the width before each `||`, without the parentheses that `[fmt.wrap]` adds outside brackets, and then stops with `internal error: cannot format this file: the output has a syntax error: expected '->'`, leaving the whole file unformatted. The same chain in a function body is enclosed in parentheses, and an `&&` chain in a guard is broken fine. Reproduction: the function above (v0.28.2). The offset in the message is in the formatter's output, so it does not point at the arm in the input either
