# 029 type-with-variants

- 状態: open
- Emela: v0.28.2
- 意図: regex の差分テストの生成器（`regex/test/pattern_gen.emel`、計画の Task 8）で、生成する AST の節の種類（文字、class、連接、選択、繰り返し、group など）を、構成子を並べた型として宣言する
- こう書きたかった:
  `wish/pattern_gen.emel:10-14` の `pub type Item { ... }` と `:16-26` の `pub type Node { ... }`。OCaml、F# の `type`、Haskell の `data` のつもりで、`enum` でなく `type` と書いた
  ```emela
  pub type Item {
    Single(c: String)
    Range(from: String, to: String)
    Escape(name: String)
  }
  ```
  ストリーム用の UTF-8 デコーダ（`wish/utf8.emel:22-27`、サブプロジェクト 3 の計画の Task 1）でも、1 byte を読んだ結果の種類を `type Step =` の後ろに `|` で構成子を並べて書いた（OCaml、F# の `type step = | Continue of ...`、Haskell の `data Step = ...` のつもり。行の頭の `|` は 051）
- 診断:
  wish check（v0.28.2）: 2 つの型のそれぞれに、型の名前を指す ``error[E0130]: a type without fields must be `@external` `` と、`{` を指す ``error[E0122]: expected newline after declaration``。続けて、構成子を使う所に ``error[E0211]: cannot find constructor `Literal` in this scope`` と同じ形のものが 12 の構成子で 27、構成子をパターンに書いた腕に ``warning[W0301]: unreachable match arm`` が 11
  repo の外の使い捨ての Pome での最小の形（`type Shape { Circle(radius: Int) Empty }` と、それを受ける match、2026-11-25）で、E0130、E0122、E0211 が 2（`Circle`、`Empty`）、W0301 が 1。help は付かず、`enum` を示さない
  UTF-8 デコーダの wish check（v0.28.2）: `Step` を指す E0130 と、`=` を指す ``error[E0122]: expected newline after declaration``。続けて、構成子を使う所に ``error[E0211]: cannot find constructor `ErrorAgain` in this scope`` と同じ形のものが 4 つの構成子で 7、push の腕に W0301 が 3。`:32-48` の構成子は `=>` の腕（E0110）の中にあり、届かなかった。同じ wish の `type Decoder = { ... }`（056）にも同じ E0130 が出た
- 回避策: `enum Node { ... }` にした（`regex/test/pattern_gen.emel`。`Item` は、class の item を書き出した文字列で持つ形にして要らなくなった）。UTF-8 デコーダも `enum Step { ... }` にした（`src/utf8.emel`）。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。E0130 の文言は「`@external` を付けよ」と読め、従うと `@external type`（host の値の型）にする誤った直し方になる。原因に近いのは `{` を指す E0122 だけで、`[data.enum]` を引く必要があった。後に続く E0211 と W0301 が、同じ wish の別の診断を埋もれさせる
- spec: `[data.type]`（`type` は 1 つの構成子の型）、`[data.enum]`、`[ext.host-type]`（「An `@external type` with no fields is an opaque type that represents a host object」）、`spec/diagnostics.md` の E0130（「Missing `@external`: an fn without a body, a top-level suspend fn, or a type without fields」）、E0122、E0211
- 既存: emela の issue と PR に無い（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"type without fields"」「E0130」で検索。当たったのは method call の proposal の PR #454 で、別の話題）。020（`=` で書いた関数の本体）と 026（予約語の名前）でも、E0130 が原因と別の所を指して `@external` を勧める
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `type Name` followed by a `{` block of constructors gets E0130 (``a type without fields must be `@external` ``, which suggests turning it into a host type), E0122 on the `{`, and an E0211 for every use of a constructor. It should get one diagnostic that says ``a type with several constructors is an `enum`: write `enum Name { ... }` `` (`type` declares a single constructor, `[data.type]`), as E0142 and E0148 show the Emela form of a construct from another language
