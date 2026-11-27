# 028 brix-gen-choice

- 状態: open
- Emela: v0.28.2（brix v0.4.0）
- 意図: regex の差分テスト（`regex/test/differential_test.emel`、計画の Task 8）で、受け付ける文法（spec §6）の AST をランダムに作り、pattern の文字列に書き出す生成器を brix の `Gen` で書く。AST の種類（文字、`.`、class、連接、選択、繰り返し、group など）から 1 つを選び、深さ 4 までで再帰し、連接の項（2〜3）、class の item（1〜3）、繰り返しの回数（0〜3）、入力の長さ（0〜8）に上限と下限を付ける。kbdcast の regex の spec（`docs/superpowers/specs/2026-11-25-kbdcast-R-regex-design.md` §9、§10）が「brix の pbt の組み合わせの関数」として予想していた friction
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
  key codec のキーの生成器（`test/key_gen.emel`、サブプロジェクト 2 の計画の Task 3。テストの補助なので wish は書いていない）: 候補の List から選ぶ `element` を、`Gen.int_between(0, n - 1)` で引いた位置を `Gen.map` の中で `List.get` で読む形にした（`get` の起きない `None` は 040 の `expect`）。regex の生成器は別の Pome の `test/` にあって使えず、ここでは選んだ後に生成器を作り直す必要が無いので、`and_then` を通さない短い形にした。修飾の 4 つは `bool`（`Gen.int_between(0, 1)` を `n == 1` に写す）を `Gen.pair` で重ねた。印は先頭のコメントと、`element` と `bool` の直前のコメントの行の `FRICTION(028)`
  input modes の生成器（`test/key_gen.emel` の `modes`、サブプロジェクト 2 の計画の Task 6。テストの補助なので wish は書いていない）: DECCKM、LNM、modifyOtherKeys の状態を、同じ `element` で候補の List（`[Normal, Application]`、`[Cr, CrLf]`、`[Off, On(One), On(Two)]`）から選び、`Gen.pair` で重ねた。新しい補助関数は要らなかった
  キーの文字を広げた所（`test/key_gen.emel` の `code`、Task 6 の review の後の fix。テストの補助なので wish は書いていない。印は `code` の直前のコメントの行の `FRICTION(028)` と、先頭のコメントに足した「生成器から選ぶ `one_of`、`frequency` が無い」）: manager の決定で、今の候補（`codes()`）に、scalar value の 4 つの範囲（BMP の surrogate より下の 0x80〜0xD7FF と上の 0xE000〜0xFFFF、私用領域 0xE000〜0xF8FF、補助面 0x10000〜0x10FFFF）を混ぜた。5 つの生成器から 1 つを選ぶ `one_of`／`frequency` が無いので、5 つの生成器のすべてから値を 1 つずつ引き、`Gen.int_between(0, 7)` で引いた `choice` の値で 1 つを選ぶ形にした（`Gen.pair` を 3 段重ね、`Gen.map` の中の match で選ぶ）。`and_then` を Gen の内部で書かずに済み、縮みは `choice` を 0（`codes()`）へ縮めるのと、それぞれの値を範囲の端へ縮めるのになる
  ```emela
  Gen.pair(
    Gen.pair(Gen.int_between(0, 7), element(codes())),
    Gen.pair(
      Gen.pair(Gen.int_between(0x80, 0xD7FF), Gen.int_between(0xE000, 0xFFFF)),
      Gen.pair(Gen.int_between(0xE000, 0xF8FF), Gen.int_between(0x10000, 0x10FFFF)),
    ),
  )
    |> Gen.map(|((choice, listed), ((below, above), (private_use, supplementary)))| { choice match { ... } })
  ```
  UTF-8 デコーダのテストの生成器（`test/utf8_test.emel` の `part`、サブプロジェクト 3 の計画の Task 1。テストの補助なので wish は書いていない。印は `part` の直前のコメントの行の `FRICTION(028)`）: 10 種の部品（1〜4 byte の正しい文字、途中で切れた文字、過長、surrogate、U+10FFFF より上、単独の継続 byte、F5〜FF）から 1 つを選ぶ `one_of` が無いので、キーの文字を広げた所と同じく、種の番号（`Gen.int_between(0, 9)`）と、code point の材料（`Gen.int_between(0, 0x10FFFF)`）と 3 つの 6 bit（`Gen.int_between(0, 0x3F)`）を毎回引き、番号の match で部品を作った。種ごとに範囲の違う生成器を選べないので、範囲は引いた値から `%` で作る（`0x80 + n % (0x800 - 0x80)`、`0xA0 + b % 0x20` など）
- コスト:
  - 行数: 生成器のモジュール 288 行のうち 74 行（コメントを含む。`and_then` と、その木を作る `bound`、`frequency` と `pick`、`one_of`、`element`、`option`、`list_between` と `copies`）
  - テストの側が brix の内部の表し方（`Tree` の子を遅延で作る closure、seed を返して次へ渡す形、`Gen.sample` の size の範囲）に依存する。brix がそれを変えると壊れる
  - 選択は `Gen.int_between` を通すので、その偏り（8 回に 1 回ずつ min、max、0（範囲の外なら近い方の端）を出し、残りの 5/8 が一様）を受け継ぎ、`frequency` の重みどおりにならない。最初の候補は `2/8 + 5/8 × 重み/合計`、最後の候補は `1/8 + 5/8 × 重み/合計` で出る（`node` では葉が重み 2/12 で約 35%）。入力の長さ 0〜8 は約 32% が空になる。重みと並び順を、この偏りを見込んで決めた
  - 縮みは、`and_then` が候補の番号を 0 へ縮めて同じ seed から作り直すだけで、節をその部分木に縮める候補が無い。vm を一時的に壊して確かめたとき（`^` が `multiline` でなくても行末文字の後で成り立つ）、`\n^` で済む反例が `("(?:😀)a\\W(?:^|a)", "", "aa😀a\n")`（縮めた回数 498、上限 1000）で止まった
  - 普段のコードに基盤レベルのキーワードが漏れた。`regex/test/pattern_gen.emel:222`（`and_then`）と `:235`（`bound`）は、引数 `f` の closure の型に `fails {} uses {}` を書いている。brix は `Gen` と `Tree` の中身を、行の閉じた closure の型（`Gen[A](run: fn(Int, Int) -> (Tree[A], Int))`、`Tree[A](value: A, children: fn() -> List[Tree[A]])`）で持ち、`f` はその closure に捕まる。そのため brix の `Gen.map` の `f: fn(A) -> B fails {} uses {}` と同じく、失敗も effect も無いことを型に書く必要がある。lint は `test/` を見ないが、規則 2 では回り道に当たる。この 2 か所は `:219` と `:248` の `FRICTION(028)` の印の間（`and_then` と、その木を作る `bound`）にあり、印が覆う。brix が `and_then` を持てば、2 か所とも消える
  - キーの生成器（Task 3）: 補助関数 2 つ（`element` と `bool`、コメントを含めて 10 行）と `expect`（040）。偏りは同じで、157 個の候補のうち最初の空白と最後の F12 が多く出る（`int_between` が min と max を 8 回に 1 回ずつ出す）。`bool` は `False`（min と 0）が約 9/16 で出る。縮みは位置を 0 へ縮めるので、反例は空白の方へ縮む
  - input modes の生成器（Task 6）: 補助関数は増えない。偏りは同じで、modifyOtherKeys は Off が約 11/24、level 2 が約 8/24、level 1 が約 5/24 で出る（3 つの段階のどれも、2000 の例のうちに数百ずつ出る）
  - キーの文字を広げた所（fix）: 補助関数は増えない（`code` は生成器そのもの）。選ばれない 4 つの値も毎回引き、捨てる。重みは `choice` の値の割り当てで決めるしかなく、`int_between(0, 7)` の偏り（0 が 21/64、7 が 13/64、ほかは 5/64 ずつ）を見込んで、0 と 5〜7 を `codes()`（44/64、約 11/16）、1〜4 を 4 つの範囲（5/64 ずつ）にした。範囲の端は、同じ偏りで min が約 1/4、max が約 1/8 で出る（私用領域なら 0xE000 と 0xF8FF。decode の境と同じ）。性質テストの 2000 例で数えると、`codes()` の外の文字は notation の性質で 617（31%）、encode の性質で 635（32%）。`frequency([(44, listed), (5, below), ...])` があれば、重みを数で書け、捨てる値も無い
  - UTF-8 デコーダのテストの生成器（Task 1）: 補助関数は増えない（`part` は生成器そのもの）。選ばれない値も毎回引き、捨てる。`int_between(0, 9)` の偏りで、ASCII（0）が約 5/16、F5〜FF（9）が約 3/16、ほかの 8 種が約 1/16 ずつ出る。範囲を `%` で作るので、`int_between` の min と max の偏りは範囲の端に届かないことがある（2 byte の文字の `n % 0x780` は、n が 0x10FFFF のとき端にならない）。縮みも `%` の後の値でなく、引いた値の方を 0 へ縮める
- spec:
  `[test]`（「Helpers for comparing values, generators and property testing are not in std. They are distributed as the Pome `github.com/emela-lang/brix`」）、brix v0.4.0 の README の Modules の表（`Brix.Pbt.Gen` は `int`、`int_between`、`constant`、`map`、`pair`、`list`、`sample`）と `src/pbt/gen.emel`
- 既存:
  brix の issue は Renovate の 1 件だけ（2026-11-25、`gh api repos/emela-lang/brix/issues?state=all`）。brix の main は v0.4.0 と同じ（`src/pbt` は `gen.emel` と `property.emel`）。emela の issue と PR にも無い（2026-11-25、`gh api search/issues` で「brix」「Gen one_of」「pbt generator」）。emela の `tests/laws`（brix の写しで core と std の性質を確かめる）は、整数と List の生成器だけで書かれていて、選択の組み合わせを使っていない（v0.28.2、`git grep`）
- 行き先:
  ecosystem の Pome（brix、x）に足りない、または版が遅れている（Emela の spec ではなく、brix の API が足りない）→ brix への issue の下書き（未提出。出すのは user）:
  Title: Gen: choice, generators that depend on a value, and lists with bounded length
  `Brix.Pbt.Gen` has `int`, `int_between`, `constant`, `map`, `pair` and `list` (0 to size values). A generator of a recursive structure (kbdcast generates regex ASTs to test a regex engine against JavaScript's RegExp) also needs: `and_then(gen, f)`, which shrinks the first value and makes `f` of each shrink again from the same seed (Hedgehog's bind); `one_of(gens)`, `frequency(weighted)` and `element(values)`, which shrink toward the first alternative and pick uniformly (a choice through `int_between` inherits the three draws in eight that it spends on its min, its max and 0, so the first of n equal alternatives comes 2/8 + 5/8n of the time); `list_between(gen, min, max)`, whose length does not follow the size; `bool` and `option`. Without them, a user builds `and_then` from the `Gen` and `Tree` constructors, which ties the test to brix's representation (74 lines in kbdcast's `regex/test/pattern_gen.emel`). A way to shrink a node of a recursive generator to its subtrees (Hedgehog's `Gen.recursive`, proptest's `prop_recursive`) would make counterexamples smaller
