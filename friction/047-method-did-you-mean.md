# 047 method-did-you-mean

- 状態: open
- Emela: v0.28.2
- 意図: key codec の golden の補助（`test/golden.emel` の `row_key`、サブプロジェクト 2 の計画の Task 5）で、1 文字の String（golden の表のキーの名前）の code point を取り出す
- こう書きたかった:
  `wish/golden.emel:25`。1 文字の String の code point を method の形で読む（名前は推測）
  ```emela
  c -> Char(c.code_point())
  ```
- 診断:
  wish check（v0.28.2）では、`let`（004）で崩れた行の右辺の match の腕にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: method の形の `name.code_point()`（`name` は String）は ``error[E0313]: type `String` has no field or function `code_point` `` の 1 つで、help は付かない。同じ名前を module の関数として書いた `String.code_point(name)` は ``error[E0212]: module `String` has no `code_point` `` に ``= help: did you mean `code_points`?`` が付く。綴りを入れ替えただけの `xs.lenght()`（`xs` は List）も E0313 だけで、help は付かない
- 回避策:
  `name.code_points()` を `[c]` のパターンで受けた（`test/golden.emel` の `code`）。1 つの code point の String だけが `Char` になり、そうでない名前は `None` になる。正しい名前に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い（`[c]` のパターンは、wish の形より「1 文字であること」をはっきり書ける）。直すには spec（`[api.string]`）を引く必要があった。method の形（`[type.rules]` の `x.f(a)`）で書くと、module の関数の形なら出る help が出ない。普段のコードに基盤レベルは漏れていない
- spec:
  `spec/diagnostics.md`（「A "did you mean" candidate (`= help: did you mean ...`) is the single closest name among the names that can be looked up at the same location ...」。どの診断に付けるかは書いていない）、E0212、E0312、E0313、`[type.rules]`（method の形で探すのは、型を定義した module の関数と、見えている trait の関数）
  v0.28.2 の実装: 候補を付けるのは名前解決の診断（`crates/emela-driver/src/diagnostic.rs` の `UndefinedName` の E0211 と `UndefinedMember` の E0212）だけで、型検査の診断の `NoFields`（E0313）と `NoFieldOrFunction`（E0312）は候補の欄を持たない（`crates/emela-types/src/diagnostic.rs`）。checkout の main（596b6038）でも同じ
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「E0313」「did you mean」を検索。当たったのは method の形を入れた PR #467 と、名前解決の診断を入れた PR #131。#131 の本文は「未定義の名前には，編集距離で近い名前を `= help: did you mean ...` として出す」。#467 の本文の診断の表は、E0312 の help に `call it as ...`（関数を呼ばずに書いたとき）を挙げ、E0313 には help を挙げない）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: A method call `x.f()` with a misspelled function name gets E0313 (or E0312 for a record type) with no help, while the same name written as `M.f(x)` gets E0212 with ``help: did you mean `code_points`?``. `name.code_point()` on a String and `xs.lenght()` on a List get no help. E0312 and E0313 should give the same "did you mean" candidate, chosen among the fields and the functions that the method lookup (`[type.rules]`) searches: the functions of the module that defines the type, and the functions of the traits that are visible by name
