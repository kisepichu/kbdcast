# 015 or-pattern

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel`）で、同じ扱いをする複数のパターンを match の 1 つの腕で受ける。`*`、`+`、`?` はどれも「nothing to repeat」、`(?=` と `(?!` はどちらも「lookahead is not supported」、など
- こう書きたかった:
  `wish/syntax.emel` の 7 か所（`:97`、`:114`、`:120`、`:206`、`:208`、`:220`、`:276`）。`|` で並べる（Rust、OCaml、Gleam の or-pattern）
  ```emela
  (Some('*'), _) | (Some('+'), _) | (Some('?'), _) ->
    raise RegexSyntax(message: "nothing to repeat", offset: s.pos)
  ```
  regex の program（`regex/src/program.emel`、計画の Task 6。wish-first の単位でないので wish は無い）でも、AST の葉の 4 つ（`Literal`、`Dot`、`Class`、`Assert`）を 1 つの腕で受けたかった: `size` の `Literal(_) | Dot | Class(..) | Assert(_) -> 1`、`groups` の `... -> []`、`can_be_empty` の `Literal(_) | Dot | Class(..) -> False`
  regex の差分テストの生成器（`wish/pattern_gen.emel:114`、計画の Task 8）でも、量指定子をそのまま続けてよい AST の節（文字、class、group など）を 1 つの腕で受けたかった: `Literal(_) | Dot | Class(_, _) | Capture(_, _) | NonCapture(_) -> t; _ -> "(?:" ++ t ++ ")"`
  key codec の型（`wish/key.emel:49`、サブプロジェクト 2 の計画の Task 2）でも、同じ代表（`Backspace`）になる制御文字 0x08 と 0x7F を `0x08 | 0x7F -> (Backspace, NO_MODS)` と 1 つの腕にした
- 診断:
  wish check（v0.28.2）では char literal の E0105（013）と混ざって読めなかった。wish の `:97` の `None | Some('|') | Some(')') -> ...` には、match の腕なのに ``error[E0317]: refutable pattern in binding: pattern `None` not covered``（``= help: use `match` to handle the other cases``）が出た
  repo の外の使い捨ての Pome で、char literal を使わずに書いた最小の形（`c match {` の腕 `STAR | PLUS -> 1` と `_ -> 0`。`STAR` と `PLUS` は Int の const、2026-11-25）で 6 つ: ``E0110: expected `->` ``（最初の `|` を指す）、``E0110: expected `|` ``、E0118、``E0122: expected newline or `}` after match arm``、``E0301: type mismatch: expected `Int`, found `fn(Int) -> {unknown}` ``、``E0317: refutable pattern in binding: pattern `_` not covered``。`| PLUS -> 1` を anonymous function と読んでいる。どれも「or-pattern は無い」とは言わない
  program（Task 6）では or-pattern を書かなかった（このメモで無いと分かっていた）ので、診断は無い
  差分テストの生成器（Task 8）の wish では、同じ行の `let`（004）の E0118 と E0122 に埋もれ、or-pattern には届かなかった
  key の wish（Task 2）では、`=` で書いた関数の本体（020）の中にあり、読まれなかった
- 回避策:
  `||` の guard にした（`[c, ..] if c == ASTERISK || c == PLUS || c == QUESTION -> ...`）。腕の終わりの判定（wish の `:97`）は guard を裏返し、`[c, ..] if c != BAR && c != CLOSE_PAREN -> 続ける`、`_ -> 終わる` にした。印は `regex/src/syntax.emel` の 7 か所の `FRICTION(015)`
  program（Task 6）: 葉の腕を 1 つずつ書いた（`size` と `groups` に 4 つずつ、`can_be_empty` に 3 つと `Assert(_) -> True`。3 か所の `FRICTION(015)`）。`_` の腕にまとめれば 1 行で済むが、Node に構成子が増えたとき compiler が抜けを教えなくなる（命令の数を数える `size` と、実際に命令を作る `code` がずれると、展開の上限が正しく効かない）ので、網羅性を残す形にした
  差分テストの生成器（Task 8、`regex/test/pattern_gen.emel` の `write`）: 量指定子を直に付けてよい節の 3 つ（`Atom(_)`、`Group(..)`、`NonCapture(_)`）を、同じ `text` を返す 3 つの腕にし、残りを `_ -> "(?:#{text})"` にした（`FRICTION(015)` の印 1 か所）
  key（Task 2、`src/key.emel` の `representative`）: 0x7F を別の腕にし、0x08 の腕と同じ値を返す（`FRICTION(015)` の印 1 か所）
- コスト:
  行数はほぼ同じ。guard の腕は網羅性の判定に数えられず、下の腕を覆うかどうかも見られない（`[fn.match]`）ので、腕の重なりと抜けを compiler が調べない。長い `||` の guard は `emela fmt` が壊す（019）。普段のコードに基盤レベルは漏れていない。program では 3 つの match に、or-pattern なら 1 行の所が 4 行（`can_be_empty` は 3 行）。key では 1 行の所が 2 行
- spec:
  `[grammar.pattern]`（`|` の形が無い）、`[fn.match]`、`[fn.decl]`（`|x| body` の anonymous function）、`proposals/closure-syntax.md:105`（「There are no or-patterns (`[grammar.pattern]`), so patterns are not affected.」）
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「or-pattern」「or pattern」で検索。当たった #118 は網羅性の検査の PR で、参考文献の題の「for pattern matching」に当たっただけ）。`spec/open-questions.md` にも無い。`proposals/closure-syntax.md` は or-pattern が無いことを前提に、`|` を anonymous function の始まりに使っている。他の言語: Rust、OCaml、Gleam、F# の `|`、Swift の `case` の `,`
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。`|` を anonymous function と衝突させない書き方、guard との組み合わせ、各候補が束縛する名前の揃え方を詰める必要がある）。診断の側（match の腕に「refutable pattern in binding」が出る、6 つの診断がどれも書き換えを示さない）は、単独で診断の改善（emela の `spec/diagnostics.md`）にできる。未提出。出すのは user
