# 028 brix-gen-choice

- 状態: open
- Emela: v0.28.2（brix v0.4.0）
- 意図: regex の差分テスト（`regex/test/differential_test.emel`、計画の Task 8）で、受け付ける文法（spec §6）の AST をランダムに作り、pattern の文字列に書き出す生成器を brix の `Gen` で書く。AST の種類（文字、`.`、class、連接、選択、繰り返し、group など）から 1 つを選び、深さ 4 までで再帰し、連接の項（2〜3）、class の item（1〜3）、繰り返しの回数（0〜3）、入力の長さ（0〜8）に上限と下限を付ける
- こう書きたかった:
  `wish/pattern_gen.emel`（brix を読む前に書いた）。候補から選ぶ `gen.element(ALPHABET)`（`:29`、`:36`、`:45`、`:62`）、生成器から選ぶ `gen.one_of([...])`（`:33`、`:41`、`:50`）と重み付きの `gen.frequency([(3, leaf()), ...])`（`:70`）、値から次の生成器を作る `gen.int(0, 3).flat_map(|n| gen.int(n, 3)...)`（`:54`）、長さに上下限のある `gen.list(sub, 2, 3)`（`:44`、`:62`、`:72`、`:90`）、`gen.bool()`（`:44`、`:74`、`:86`）、`gen.option(name_prefix())`（`:75`）。QuickCheck の `elements`、`oneof`、`frequency`、`>>=`、Hedgehog の `Gen.element`、`Gen.choice`、`Gen.frequency`、`Gen.list (Range.linear 0 8)` のつもり
  ```emela
  gen.frequency([
    (3, leaf()),
    (2, gen.list(sub, 2, 3).map(Concat)),
    (1, gen.map2(sub, sub, Alt)),
    ...
  ])
  ```
- 診断:
  wish check（v0.28.2）は import の書き方（`import brix/pbt as gen`、011）で止まり、`gen` の 32 か所はすべて ``error[E0211]: cannot find value `gen` in this scope`` になった。正しい import（`import Brix.Pbt.Gen.{Gen}`）で書いた repo の外の使い捨ての Pome（v0.28.2、brix v0.4.0、2026-11-25）で 8 つ: ``error[E0212]: module `Brix.Pbt.Gen` has no `one_of` ``、同じ形の `frequency`、`element`、`and_then`、`flat_map`、`bool`、`option`、``error[E0305]: wrong number of arguments: `list` takes 1, found 3``。help は付かない
- 回避策:
  `regex/test/pattern_gen.emel` に、brix の `Gen` と `Tree` の構成子を直に使って `and_then` を書いた（`Gen(|seed, size| ...)` の中で 2 つの生成器に seed を順に渡し、`Tree(value, || ...)` の子を、最初の値の縮みごとに同じ seed から 2 つ目の生成器を作り直したものと、2 つ目の値の縮みにする。Hedgehog の bind の縮め方）。その上に `frequency`（重みの合計までの `Gen.int_between` を引き、`and_then` で候補を選ぶ）、`one_of`、`element`、`option`、`list_between`（`Gen.int_between` で長さを引き、`Gen.pair` を n 回重ねる）を書いた。印は先頭のコメントと、各関数の直前のコメントの行の `FRICTION(028)`。`bool` は使い道（flag の文字）に合わせて `element(["", "i"])` にした。`map2`、`map3`、`tuple3` は `Gen.pair` と `Gen.map` で素直に書けたので回り道に数えない
  ```emela
  fn and_then[A, B](gen: Gen[A], f: fn(A) -> Gen[B] fails {} uses {}) -> Gen[B] {
    Gen(|seed, size| {
      (a, s) = Gen.sample(gen, seed, size)
      (b, rest) = Gen.sample(f(a.value), s, size)
      (bound(a, b, f, s, size), rest)
    })
  }
  ```
- コスト:
  - 行数: 生成器のモジュール 288 行のうち 74 行（コメントを含む。`and_then` と、その木を作る `bound`、`frequency` と `pick`、`one_of`、`element`、`option`、`list_between` と `copies`）
  - テストの側が brix の内部の表し方（`Tree` の子を遅延で作る closure、seed を返して次へ渡す形、`Gen.sample` の size の範囲）に依存する。brix がそれを変えると壊れる
  - 選択は `Gen.int_between` を通すので、その偏り（8 回に 1 回ずつ min、max、0（範囲の外なら近い方の端）を出し、残りの 5/8 が一様）を受け継ぎ、`frequency` の重みどおりにならない。最初の候補は `2/8 + 5/8 × 重み/合計`、最後の候補は `1/8 + 5/8 × 重み/合計` で出る（`node` では葉が重み 2/12 で約 35%）。入力の長さ 0〜8 は約 32% が空になる。重みと並び順を、この偏りを見込んで決めた
  - 縮みは、`and_then` が候補の番号を 0 へ縮めて同じ seed から作り直すだけで、節をその部分木に縮める候補が無い。vm を一時的に壊して確かめたとき（`^` が `multiline` でなくても行末文字の後で成り立つ）、`\n^` で済む反例が `("(?:😀)a\\W(?:^|a)", "", "aa😀a\n")`（縮めた回数 498、上限 1000）で止まった
  - 普段のコードに基盤レベルのキーワードは漏れていない
- spec:
  `[test]`（「Helpers for comparing values, generators and property testing are not in std. They are distributed as the Pome `github.com/emela-lang/brix`」）、brix v0.4.0 の README の Modules の表（`Brix.Pbt.Gen` は `int`、`int_between`、`constant`、`map`、`pair`、`list`、`sample`）と `src/pbt/gen.emel`
- 既存:
  brix の issue は Renovate の 1 件だけ（2026-11-25、`gh api repos/emela-lang/brix/issues?state=all`）。brix の main は v0.4.0 と同じ（`src/pbt` は `gen.emel` と `property.emel`）。emela の issue と PR にも無い（2026-11-25、`gh api search/issues` で「brix」「Gen one_of」「pbt generator」）。emela の `tests/laws`（brix の写しで core と std の性質を確かめる）は、整数と List の生成器だけで書かれていて、選択の組み合わせを使っていない（v0.28.2、`git grep`）
- 行き先:
  brix に足りない（Emela の spec ではなく、brix の API）→ brix への issue の下書き（未提出。出すのは user）:
  Title: Gen: choice, generators that depend on a value, and lists with bounded length
  `Brix.Pbt.Gen` has `int`, `int_between`, `constant`, `map`, `pair` and `list` (0 to size values). A generator of a recursive structure (kbdcast generates regex ASTs to test a regex engine against JavaScript's RegExp) also needs: `and_then(gen, f)`, which shrinks the first value and makes `f` of each shrink again from the same seed (Hedgehog's bind); `one_of(gens)`, `frequency(weighted)` and `element(values)`, which shrink toward the first alternative and pick uniformly (a choice through `int_between` inherits the three draws in eight that it spends on its min, its max and 0, so the first of n equal alternatives comes 2/8 + 5/8n of the time); `list_between(gen, min, max)`, whose length does not follow the size; `bool` and `option`. Without them, a user builds `and_then` from the `Gen` and `Tree` constructors, which ties the test to brix's representation (74 lines in kbdcast's `regex/test/pattern_gen.emel`). A way to shrink a node of a recursive generator to its subtrees (Hedgehog's `Gen.recursive`, proptest's `prop_recursive`) would make counterexamples smaller
