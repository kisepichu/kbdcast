# 011 module-name-help

- 状態: open
- Emela: v0.28.2
- 意図: `regex/src/fold.emel` で、同じ Pome の `src/fold_table.emel` と std の Array を使う
- こう書きたかった: `wish/fold.emel:2` の `import Regex.FoldTable`（Pome の root name `Regex` の下にあると考えた）と、import なしの `Array`（`List` と同じく組み込みだと考えた）
- 診断:
  wish check（emela 0.28.2、`wish/fold.emel` の末尾）。どちらも help が付かず、在るモジュールの名前を示さない
  - ``error[E0205]: undefined module `Regex.FoldTable` ``
  - ``error[E0211]: cannot find type `Array` in this scope`` と ``error[E0211]: cannot find module or trait `Array` in this scope``（3 行で 5 つ）
  - regex の syntax の wish（`wish/syntax.emel:50`、`:52`、計画の Task 4）でも、import なしの `Map[String, Int]` と `Array[Int]` に ``error[E0211]: cannot find type `Map` in this scope``（2 つ）と ``error[E0211]: cannot find type `Array` in this scope`` が出た。help は付かない
  - regex の class の wish（`wish/class.emel:15`、`:75`、`:100`、計画の Task 5）でも、import なしの `Array[Span]` と `Array[Int]` に ``error[E0211]: cannot find type `Array` in this scope`` が 3 つ出た。help は付かない
  - regex の vm と公開 API の wish（`wish/vm.emel`、`wish/lib.emel`、計画の Task 6）でも、import なしの `Array[...]`（vm に 8 つ）、`Set[(Int, Bool)]`（vm の `:94`）、`Map[String, Int]`（lib の `:19`、`:21`）に ``error[E0211]: cannot find type `Array` in this scope`` と同じ形のものが 11 出た。help は付かない。vm の `Set.empty()` と `Map.empty()` には届かなかった（`let` の 004 の行にあった）
  - regex の差分テストの wish（`wish/pattern_gen.emel:3-5`、`wish/differential.emel:3-7`、計画の Task 8）では、import を path の形で書いた: `import brix/pbt.{Gen}`、`import brix/pbt as gen`、`import regex.{Flags}`、`import regex as Lib`、`import pattern_gen`（Go、Gleam の `/` の path、Pome の名前の小文字、ファイル名のつもり）。8 つの import のどれにも ``error[E0110]: expected module path``（`/` の後ろと `as` には E0122 も）が出て、help は付かず、`Brix.Pbt.Gen`、`Lib`、`PatternGen` を示さない。import なしの `Array[Int]`（`wish/differential.emel:12`）にも ``error[E0211]: cannot find type `Array` in this scope``
  - key codec の encode の wish（`wish/encode.emel`、サブプロジェクト 2 の計画の Task 6）でも、import なしの `Bytes`（返り値の型と `Option[Bytes]`）に ``error[E0211]: cannot find type `Bytes` in this scope`` が 14 出た。help は付かない
  - key codec の decode の wish（`wish/decode.emel`、サブプロジェクト 2 の計画の Task 4）でも、`Std.Bytes` の import が無く、`decode` の引数の型の `Bytes`（`:15`）に ``error[E0211]: cannot find type `Bytes` in this scope`` が 1、`Bytes.from_list`（`:70`、`:72`、`:74`、`:76`）に ``error[E0211]: cannot find module or trait `Bytes` in this scope`` が 4 出た。help は付かない（`Decoded` の `Unknown(Bytes)`（`:12`）は、行の頭の `|`（051）で崩れた行にあり、届かなかった）
  - ストリーム用の UTF-8 デコーダの wish（`wish/utf8.emel`、サブプロジェクト 3 の計画の Task 1）でも、`Std.Bytes` の import が無く、`feed` の引数の型の `Bytes`（`:74`）に ``error[E0211]: cannot find type `Bytes` in this scope`` が 1 出た。help は付かない
- 回避策:
  `import FoldTable.{SOURCES, TARGETS}` と `import Std.Array.{Array}`（`regex/src/fold.emel`、`regex/src/class.emel`）、`import Std.Map.{Map}`（`regex/src/syntax.emel`。Array は使わない形にした）。vm と公開 API（Task 6）は `import Std.Array.{Array}`、`import Std.Map.{Map}`、`import Std.Set.{Set}`（`regex/src/vm.emel`、`regex/src/lib.emel`）。正しい書き方に直しただけなので、コードに印は付けない。テストも Pome の中の名前で `import Fold` と書く（text のテストの `import Lib` と同じ）。差分テスト（Task 8）は `import Brix.Pbt.Gen.{Gen, Tree}`、`import PatternGen`、`import Std.Array.{Array}`（`regex/test/pattern_gen.emel`、`regex/test/differential_test.emel`）
  encode（Task 6）は `import Std.Bytes.{Bytes}`（`src/key/encode.emel`）。decode（Task 4）も同じ（`src/key/decode.emel`）。UTF-8 デコーダ（サブプロジェクト 3 の Task 1）も同じ（`src/utf8.emel`）
- コスト:
  コードのコストは無い。直すには spec を引く必要があった。同じモジュールが、Pome の中では `FoldTable`、依存する側からは `Regex.FoldTable` と、書く場所で名前が変わる。Array は std の値の層にあり（`[lib.layers]`、`proposals/array.md:233` が core に置かない理由を書く）、組み込みの扱いは core の 1 つの segment の名前のモジュールだけ（`[module.resolution]`）
- spec:
  `[module.name]`、`[module.pome]`（「Inside a Pome that is depended on, the module of `src/lib.emel` can be referenced as `Lib`, and other modules by the names given by the rules of `[module.name]`」）、`[module.resolution]`、`[lsp.code-action]`（E0211 には language server が `import` を足す code action を出す。CLI の診断には出ない）、`spec/diagnostics.md` の E0205 と E0211
- 既存: emela の issue に無い（「undefined module」「E0205」「own module name」で検索、2026-11-25。#811 は Windows の language server の別の bug）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: import や型の位置の名前が解決できないとき、在るモジュールが 1 つに決まるなら help で示してほしい。path の先頭がその Pome 自身の root name なら ``help: inside its own Pome, this module is `FoldTable` ``、std のモジュールなら ``help: `Array` is in std: `import Std.Array.{Array}` ``（language server の code action と同じ候補）
