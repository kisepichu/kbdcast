# 022 string-repeat

- 状態: open
- Emela: v0.28.2
- 意図:
  regex の find のテスト（`regex/test/find_test.emel`、計画の Task 6）で、`a{1000}` と `\w{1000}` に当てる入力（`"a"` の 1000 個、`"x"` の 1001 個）と、期待する一致の text を作る
  regex の program（`regex/src/program.emel` の `repeat`、計画の Task 6）で、回数付きの繰り返し（`e{n}`、`e{n,m}`、`e{n,}`）の本体の命令（`List[Inst]`）を n 個並べる
  regex の時間のテスト（`regex/test/linear_test.emel` の `replace_builds_its_result_in_time_proportional_to_the_matches`、最終レビューの修正）で、`replace` と `find_all` に当てる入力（`"a"` の 4000 個）を作る
  VT の parser のテスト（`test/parser_test.emel` の `advance_keeps_the_limits_of_avt_on_parameters`、サブプロジェクト 3 の計画の Task 3）で、avt の引数の数の上限（32）を越える CSI（`"1;"` の 32 個）と、期待する引数の List（`[1]` の 31 個）を作る
  キーの帯（`src/overlay/strip.emel` の `blanks` と `right_end`、サブプロジェクト 4 の計画の Task 2）で、帯の行の残りを既定の pen の空白のセルで埋め、最後の印の右の端の前に、端が半分に切った全角の文字の代わりの空白を置く。テスト（`test/strip_test.emel` の `blanks`）でも、期待する空白のセルを並べる
- こう書きたかった:
  テスト: `String.repeat("a", 1000)`（Python の `"a" * 1000`、JavaScript の `"a".repeat(1000)`、Rust の `"a".repeat(1000)`、Kotlin の `"a".repeat(1000)`）。時間のテストでは `String.repeat("a", 4000)`。wish には書いていない（テストのコード）
  ```emela
  assert find("a{1000}", NO_FLAGS, String.repeat("a", 1000), 0) == Some(Found(0, 1000, String.repeat("a", 1000), []))
  ```
  program: 本体の命令の List を n 個並べて平らにする `List.flatten(List.repeat(iteration, min))`（Haskell の `concat (replicate n xs)`、Python の `xs * n`）。wish には書いていない（program は wish-first の単位でない）。`List.flatten` は std にある（`[api.list]`）ので、足りないのは `List.repeat` だけ
  ```emela
  (None, False) if min > 0 -> {
    last = iteration.length()
    List.flatten(List.repeat(iteration, min)).append([choice(greedy, into: -last, past: 1)])
  }
  ```
  VT の parser のテスト: `String.repeat("1;", 32)` と `List.repeat([1], 31)`。wish には書いていない（テストのコード）
  キーの帯: `wish/strip.emel:90` の `List.repeat(Cell(...), n)` と `:71` の `" ".repeat(cols - 2 - width(end))`（Rust、Kotlin の `repeat`）
- 診断:
  `emela check`（v0.28.2）の ``error[E0212]: module `String` has no `repeat` ``（4 か所に 1 つずつ）。help は付かない
  キーの帯の wish check（v0.28.2）では、2 か所とも `=` で書いた関数の本体（020）の中にあり、届かなかった
- 回避策:
  テストに `copies(s, n)` を足した（`regex/test/find_test.emel`、`FRICTION(022)` の印）
  ```emela
  fn copies(s: String, n: Int) -> String {
    String.concat(List.range(0, n).map(|_| s))
  }
  ```
  program にも `copies(code, n)` を足した（`regex/src/program.emel`、`FRICTION(022)` の印）。`repeat` の 3 つの腕が使う
  ```emela
  fn copies(code: List[Inst], n: Int) -> List[Inst] {
    List.range(0, n).flat_map(|_| code)
  }
  ```
  時間のテストでは、補助の関数を足さずにその場で並べた（`regex/test/linear_test.emel`、`FRICTION(022)` の印）
  ```emela
  input = String.concat(List.range(0, 4000).map(|_| "a"))
  ```
  VT の parser のテストでも、補助の関数を足さずにその場で並べた（`test/parser_test.emel`、`FRICTION(022)` の印）
  ```emela
  semicolons = String.concat(List.range(0, 32).map(|_| "1;"))
  ones = List.range(0, 31).map(|_| [1])
  ```
  キーの帯でも、補助の関数を足さずにその場で並べた（`src/overlay/strip.emel` の `blanks` と `right_end`、`test/strip_test.emel` の `blanks`、どれも `FRICTION(022)` の印）。`blanks` は wish でも関数だった（`row` の 2 つの腕から呼ぶ）。テストの `blanks` は、期待する行を作るための別の関数
  ```emela
  List.range(0, n).map(|_| Cell(0x20, Single, DEFAULT_PEN))
  spaces = String.concat(List.range(0, cols - 2 - width(end)).map(|_| " "))
  ```
  `Std.Array.repeat(value, count)` はあるが、String と List には無い
- コスト:
  テストでは補助の関数 1 つ（印とコメントを含めて 5 行）。テストの中だけで、性能は問題にならない
  program でも補助の関数 1 つ（印とコメントを含めて 5 行）。`List.range` が n 個の Int の List を作って捨てる分だけ余計に割り当てる。並ぶ命令は n × 本体の長さなので、それより小さい
  時間のテストでは 1 行（印を含めて 2 行）。入力を作るのは時間を測る範囲の外なので、測る値には効かない
  VT の parser のテストでは 2 行（印とコメントを含めて 3 行）
  キーの帯では 1 行ずつ（印を含めて 2 行ずつ）。`blanks` は帯の行を作るたびに呼ばれ、`List.range` が n 個（cols 以下）の Int の List を作って捨てる分だけ余計に割り当てる
  どれも、普段のコードに基盤レベルは漏れていない
- spec: `[api.string]`（`repeat` が無い）、`[api.list]`（`repeat` も無い）、`[api.std.array]`（`repeat` はある）
- 既存: emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「repeat」で検索。当たったのは局所関数、method call、Array、性能の PR など別の話題）。`proposals/` と `spec/open-questions.md` で「repeat」を引くと、`proposals/array.md:140` の `Array.repeat` だけが当たる
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Array.repeat` と同じ形の `String.repeat(s: String, count: Int) -> String` と `List.repeat(value: A, count: Int) -> List[A]` を core に足す。regex のテストの他に、Task 6 の program（`regex/src/program.emel:246`）が回数付きの繰り返しの本体の命令を `List.range(0, n).flat_map(|_| code)` で並べている。`List.repeat` は値を n 個並べるので、program は `List.flatten(List.repeat(code, n))` と書く（並べた List を平らにする関数を別に足すほどの理由は、この 1 か所では無い）。未提出。出すのは user
