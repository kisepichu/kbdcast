# 020 fn-expression-body

- 状態: open
- Emela: v0.28.2
- 意図: regex の class（`regex/src/class.emel`、計画の Task 5）で、1 つの式で済む関数（`single`、`range`、`union`、`complement`、`contains`、`dot`、内部の `merge`、`gaps` など）を、本体の block なしで書く
- こう書きたかった:
  `wish/class.emel` の 12 の関数（`:21`、`:24`、`:26`、`:30`、`:33`、`:62`、`:78`、`:81`、`:88`、`:95`、`:100`、`:110`）。Scala、Kotlin、Haskell、OCaml の `=` の後に式を書く形
  ```emela
  pub fn single(c: Int) -> CharSet = CharSet([Span(c, c)])
  pub fn dot(dot_all: Bool) -> CharSet = if dot_all { ALL } else { LINE_TERMINATOR.complement() }
  ```
  key codec の型の wish（`wish/key.emel:20`、`:23`、`:25`、`:27`、`:30`、`:46`、`:59`、サブプロジェクト 2 の計画の Task 2）でも、7 つの関数を `=` の後に式を書く形にした
  VT の parser の wish（`wish/parser.emel:40`、`:42`、`:63`、`:118`、サブプロジェクト 3 の計画の Task 3）でも、4 つの関数（`parser`、`fresh`、`flush`、`param`）を `=` の後に式を書く形にした
  VT の画面の wish（`wish/screen.emel:62`、`:64`、`:66`、`:69`、`:71`、`:73`、`:76`、`:150`、`:153`、サブプロジェクト 3 の計画の Task 4）でも、9 つの関数（`space`、`blank_line`、`blank`、`cols`、`rows`、`lines`、`with_line`、`clear_rows`、`erase`）を `=` の後に式を書く形にした。`blank`、`with_line`、`clear_rows`、`erase` は `=` の次の行から本体を書いた
- 診断:
  wish check（v0.28.2）の 86 の診断のうち 24。関数ごとに、名前を指す ``error[E0130]: a function without a body must be `@external` `` と、`=` を指す ``error[E0122]: expected newline after declaration`` の 2 つ。`=` の後ろの本体は読まれず、その中の誤り（前置の match の E0142、`let` の 004、`spans[mid]` の 009 など）には診断が届かない
  repo の外の使い捨ての Pome での最小の形（`pub fn double(x: Int) -> Int = x * 2`、2026-11-25）も同じ 2 つ。help は付かない。E0130 は「`@external` を付けよ」と読め、本体を `{ ... }` で書くことを示さない
  key の wish check（v0.28.2）では、42 の診断のうち 14（E0130 と E0122 が 7 つずつ）。本体の中の `let`（004）、`CodePoint` の述語（039）、or-pattern（015）、範囲パターン（038）、`Mods { ..mods, ... }`（037）、前置の `match`（E0142）には、どれも診断が届かなかった
  VT の parser の wish check（v0.28.2）では、272 の診断のうち 8（E0130 と E0122 が 4 つずつ）。本体の中の、構成子の名前を `{ }` の前に置いた値（`Parser { state, params: [], inter: "" }`、056）、前置の `match`（E0142）と `=>` の腕には届かなかった
  VT の画面の wish check（v0.28.2）では、112 の診断のうち 18（E0130 と E0122 が 9 つずつ）。本体の中の `Array.fill`（016）、`{ s with ... }`（037）、`s.grid[row]`（009）、`fn(l) { ... }`（E0148）、`=>` の腕、`fill_range`（057）、`min`（016）には届かなかった
- 回避策: 本体を block にした（`pub fn single(c: Int) -> CharSet { range(c, c) }`。`regex/src/class.emel`。key の `src/key.emel` も同じ）。正しい構文に直しただけなので、コードに印は付けない
  VT の parser（`src/vt/parser.emel`、Task 3）も、本体を block にした。印は付けない
  VT の画面（`src/vt/screen.emel`、Task 4）も、本体を block にした。印は付けない
- コスト:
  コードのコストは無い（fmt は 1 行の block を 1 行のまま残す）。直すには spec を引く必要があった（`[fn.decl]` の「The body is a block」と `[grammar.decl]` の `fn_decl` の `[ block ]`）。wish の診断の 4 分の 1 がこの 1 つの誤りから出て、本体の中の別の誤りを隠した。004（`let`）、016（他の言語の名前）と同じく、wish-first（spec を読む前に wish を書く）では、そのときの手がかりは診断だけ
- spec:
  `[fn.decl]`（「The body is a block, and the value of the last expression is the return value.」）、`[grammar.decl]`（`fn_decl = ... "(" [ params ] ")" [ signature ] [ block ]` と「An fn_decl without a body ... allowed only when they have `@external`」）、`spec/diagnostics.md` の E0130 と E0122
- 既存:
  emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pr` のそれぞれを「"expression body"」「E0130」「"without a body"」「expression-bodied」で検索。当たったのは別の話題。E0130 の当たりは parser の実装の PR #123、#134、#136）。`spec/history.md` と `spec/open-questions.md` にも無い。他の言語の書き方に書き換えを示す診断は残っている: E0142（前置の match）、E0147（signature の `use`）、E0148（式の `fn(...)`）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `fn f(x: Int) -> Int = x * 2` は E0130（``a function without a body must be `@external` ``）と E0122 になり、どちらも書き換えを示さない。signature の後ろが `=` のときは、E0148 や E0147 のように 1 つの診断にして ``help: the body of a function is a block: `fn f(x: Int) -> Int { x * 2 }` `` を付けてほしい。`@external` を足す方向の文は、本体を書くつもりの人を誤らせる
