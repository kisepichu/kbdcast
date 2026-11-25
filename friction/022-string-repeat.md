# 022 string-repeat

- 状態: open
- Emela: v0.28.2
- 意図: regex の find のテスト（`regex/test/find_test.emel`、計画の Task 6）で、`a{1000}` と `\w{1000}` に当てる入力（`"a"` の 1000 個、`"x"` の 1001 個）と、期待する一致の text を作る
- こう書きたかった:
  `String.repeat("a", 1000)`（Python の `"a" * 1000`、JavaScript の `"a".repeat(1000)`、Rust の `"a".repeat(1000)`、Kotlin の `"a".repeat(1000)`）。wish には書いていない（テストのコード）
  ```emela
  assert find("a{1000}", NO_FLAGS, String.repeat("a", 1000), 0) == Some(Found(0, 1000, String.repeat("a", 1000), []))
  ```
- 診断:
  `emela check`（v0.28.2）の ``error[E0212]: module `String` has no `repeat` ``（4 か所に 1 つずつ）。help は付かない
- 回避策:
  テストに `copies(s, n)` を足した（`regex/test/find_test.emel`、`FRICTION(022)` の印）
  ```emela
  fn copies(s: String, n: Int) -> String {
    String.concat(List.range(0, n).map(|_| s))
  }
  ```
  `Std.Array.repeat(value, count)` はあるが、String と List には無い
- コスト: 補助の関数 1 つ（印とコメントを含めて 5 行）。テストの中だけで、性能は問題にならない。普段のコードに基盤レベルは漏れていない
- spec: `[api.string]`（`repeat` が無い）、`[api.list]`（`repeat` も無い）、`[api.std.array]`（`repeat` はある）
- 既存: emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「repeat」で検索。当たったのは局所関数、method call、Array、性能の PR など別の話題）。`proposals/` と `spec/open-questions.md` で「repeat」を引くと、`proposals/array.md:140` の `Array.repeat` だけが当たる
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Array.repeat` と同じ形の `String.repeat(s: String, count: Int) -> String` と `List.repeat(value: A, count: Int) -> List[A]` を core に足す。regex のテストの他に、Task 6 の program（`regex/src/program.emel`）が回数付きの繰り返しの本体の命令を `List.range(0, n).flat_map(|_| body)` で並べている。未提出。出すのは user
