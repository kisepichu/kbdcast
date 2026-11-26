# 048 module-declaration

- 状態: open
- Emela: v0.28.2
- 意図: key codec の encode（`src/key/encode.emel`、サブプロジェクト 2 の計画の Task 6）で、ファイルが module `Key.Encode` であることを、ファイルの先頭に書く
- こう書きたかった:
  `wish/encode.emel:2`。Elm、Haskell、OCaml の signature の `module` 宣言のつもりで、import の前に置いた
  ```emela
  module Key.Encode

  import Key.{Key, KeyCode.*, Mods, NO_MODS, f_number}
  ```
- 診断:
  wish check（v0.28.2）: `module` を指す ``error[E0126]: expected declaration`` と、次の行の `import` を指す ``error[E0127]: imports must come before declarations``。help は付かない。E0127 は、import の前に宣言があると言うが、前にあるのは読めなかった `module` の行だけで、宣言は 1 つも無い。直すべき所（`module` の行を消す）でなく、正しい import を指す
  repo の外の使い捨ての Pome での最小の形（`src/lib.emel` に `module Brace`、空行、`import Std.Bytes.{Bytes}`、`pub fn f() -> Bytes { Bytes.empty() }`、2026-11-27）でも、同じ E0126 と E0127 の 2 つ
- 回避策: `module` の行を消した（`src/key/encode.emel`）。module の名前は source root からの path で決まる（`src/key/encode.emel` は `Key.Encode`）。正しい書き方に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった（`[module.name]`）。E0127 は import を動かす方へ誘う（import を後ろに動かしても、`module` の行が残る限り直らない）。普段のコードに基盤レベルは漏れていない
- spec: `[module.name]`（「The path from the source root is converted to PascalCase segment by segment, and the segments are joined with `.`」。名前を宣言する構文は無い）、`[module.import]`（E0127 は import の後の宣言でなく、宣言の後の import）、`[grammar.decl]`、`spec/diagnostics.md` の E0126 と E0127
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「module declaration」「E0127」を検索。「module declaration」は当たりなし。「E0127」で当たったのは、parser に残りの宣言を足した PR #123 で、別の話題）。他の言語の書き方に書き換えを示す診断はある: E0142（前置の match）、E0144（`impl Trait for Type`）、E0147（signature の `use`）、E0148（式の `fn(...)`）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a file that starts with `module Key.Encode` (as in Elm, Haskell or OCaml) gets E0126 on `module`, then E0127 on the next `import`, which says that imports must come before declarations although no declaration precedes it. It should get one diagnostic on the `module` line, ``help: a module is named by its path from the source root (`src/key/encode.emel` is `Key.Encode`); remove this line``, and the unreadable line should not count as a declaration for E0127
