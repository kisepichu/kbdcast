# 011 module-name-help

- 状態: open
- Emela: v0.28.2
- 意図: `regex/src/fold.emel` で、同じ Pome の `src/fold_table.emel` と std の Array を使う
- こう書きたかった: `wish/fold.emel:2` の `import Regex.FoldTable`（Pome の root name `Regex` の下にあると考えた）と、import なしの `Array`（`List` と同じく組み込みだと考えた）
- 診断:
  wish check（emela 0.28.2、`wish/fold.emel` の末尾）。どちらも help が付かず、在るモジュールの名前を示さない
  - ``error[E0205]: undefined module `Regex.FoldTable` ``
  - ``error[E0211]: cannot find type `Array` in this scope`` と ``error[E0211]: cannot find module or trait `Array` in this scope``（3 行で 5 つ）
- 回避策:
  `import FoldTable.{SOURCES, TARGETS}` と `import Std.Array.{Array}`（`regex/src/fold.emel`）。正しい書き方に直しただけなので、コードに印は付けない。テストも Pome の中の名前で `import Fold` と書く（text のテストの `import Lib` と同じ）
- コスト:
  コードのコストは無い。直すには spec を引く必要があった。同じモジュールが、Pome の中では `FoldTable`、依存する側からは `Regex.FoldTable` と、書く場所で名前が変わる。Array は std の値の層にあり（`[lib.layers]`、`proposals/array.md:233` が core に置かない理由を書く）、組み込みの扱いは core の 1 つの segment の名前のモジュールだけ（`[module.resolution]`）
- spec:
  `[module.name]`、`[module.pome]`（「Inside a Pome that is depended on, the module of `src/lib.emel` can be referenced as `Lib`, and other modules by the names given by the rules of `[module.name]`」）、`[module.resolution]`、`[lsp.code-action]`（E0211 には language server が `import` を足す code action を出す。CLI の診断には出ない）、`spec/diagnostics.md` の E0205 と E0211
- 既存: emela の issue に無い（「undefined module」「E0205」「own module name」で検索、2026-11-25。#811 は Windows の language server の別の bug）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: import や型の位置の名前が解決できないとき、在るモジュールが 1 つに決まるなら help で示してほしい。path の先頭がその Pome 自身の root name なら ``help: inside its own Pome, this module is `FoldTable` ``、std のモジュールなら ``help: `Array` is in std: `import Std.Array.{Array}` ``（language server の code action と同じ候補）
