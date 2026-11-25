# 022 string-repeat

- 状態: open
- Emela: v0.28.2
- 意図:
  regex の find のテスト（`regex/test/find_test.emel`、計画の Task 6）で、`a{1000}` と `\w{1000}` に当てる入力（`"a"` の 1000 個、`"x"` の 1001 個）と、期待する一致の text を作る
  regex の program（`regex/src/program.emel` の `repeat`、計画の Task 6）で、回数付きの繰り返し（`e{n}`、`e{n,m}`、`e{n,}`）の本体の命令（`List[Inst]`）を n 個並べる
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
  program にも `copies(code, n)` を足した（`regex/src/program.emel`、`FRICTION(022)` の印）。`repeat` の 3 つの腕が使う
  ```emela
  fn copies(code: List[Inst], n: Int) -> List[Inst] {
    List.range(0, n).flat_map(|_| code)
  }
  ```
  `Std.Array.repeat(value, count)` はあるが、String と List には無い
- コスト:
  テストでは補助の関数 1 つ（印とコメントを含めて 5 行）。テストの中だけで、性能は問題にならない
  program でも補助の関数 1 つ（印とコメントを含めて 5 行）。`List.range` が n 個の Int の List を作って捨てる分だけ余計に割り当てる。並ぶ命令は n × 本体の長さなので、それより小さい
  どちらも、普段のコードに基盤レベルは漏れていない
- spec: `[api.string]`（`repeat` が無い）、`[api.list]`（`repeat` も無い）、`[api.std.array]`（`repeat` はある）
- 既存: emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「repeat」で検索。当たったのは局所関数、method call、Array、性能の PR など別の話題）。`proposals/` と `spec/open-questions.md` で「repeat」を引くと、`proposals/array.md:140` の `Array.repeat` だけが当たる
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`Array.repeat` と同じ形の `String.repeat(s: String, count: Int) -> String` と `List.repeat(value: A, count: Int) -> List[A]` を core に足す。regex のテストの他に、Task 6 の program（`regex/src/program.emel`）が回数付きの繰り返しの本体の命令を `List.range(0, n).flat_map(|_| body)` で並べている。未提出。出すのは user
