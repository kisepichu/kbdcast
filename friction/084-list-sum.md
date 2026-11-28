# 084 list-sum

- 状態: open
- Emela: v0.28.2
- 意図: キーの帯（`src/overlay/strip.emel` の `width`、サブプロジェクト 4 の計画の Task 2）で、帯に書く String の幅（全角の文字は 2 列、ほかは 1 列）を、文字ごとの幅を足して出す
- こう書きたかった:
  `wish/strip.emel:92`。文字ごとの幅の List にして、その和を取る（Python の `sum(map(width, s))`、Rust の `.map(char_width).sum()`、Kotlin の `sumOf`、Haskell の `sum . map width`）
  ```emela
  fn width(text: String) -> Int = text.chars().map(char_width).sum()
  ```
- 診断:
  wish check（v0.28.2）では、`=` で書いた関数の本体（020）の中にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28、`xs: List[Int]`）: `xs.sum()` に ``error[E0313]: type `List[Int]` has no field or function `sum` ``、`List.sum(xs)` に ``error[E0212]: module `List` has no `sum` ``、`Int.sum(xs)` に ``error[E0212]: module `Int` has no `sum` ``。どれも help は付かない
- 回避策:
  `fold` で足した（`src/overlay/strip.emel` の `width`、`FRICTION(084)` の印）。中間の List を作らないよう、`map` を挟まずに足す
  ```emela
  fn width(text: String) -> Int {
    text.code_points().fold(0, |total, c| total + char_width(c))
  }
  ```
- コスト: 1 行。`fold` の初期値と足し算の closure を書く分だけ長い。性能は変わらない。普段のコードに基盤レベルは漏れていない
- spec: `[api.list]`（`fold` はあり、`sum` は無い）、`[fn.operator]`（数の型を抽象する型引数は無い: 「There are no type parameters that abstract over numeric types」）
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「List.sum」と「sum」を検索。当たったのは loop 式の proposal の #909、sumdb、Duration.parse など別の話題）。`proposals/` と `spec/open-questions.md` にも無い（`proposals/array.md:91` の `sum` は `@external` の例）。v0.29.0-33 の checkout の `crates/emela-core/lib/core/list.emel` と `int.emel` にも無い
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。数の型を抽象する型引数が無い（`[fn.operator]`）ので、`List.sum[A: Num]` の形は取れない。`Int.sum(xs: List[Int]) -> Int`（Int64、Float にも同じ形）を core に足すか、`List.sum_by(xs, f: fn(A) -> Int)`（Kotlin の `sumOf`）を足す。この 1 か所だけでは理由として弱いので、ほかの使い道が出たら足す。未提出。出すのは user
