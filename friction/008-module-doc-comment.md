# 008 module-doc-comment

- 状態: open
- Emela: v0.28.2
- 意図: text のモジュール全体の説明（何のためのモジュールか、使い方の例、`[lib.api-rules]` との対応）を、関数の doc とは別にモジュールの doc comment として書き、`emela doc` と language server に出す。計画（Task 2 の Step 6）も「モジュールの doc comment」に書くよう求めている
- こう書きたかった: `wish/text.emel:3-4` の `#!` の 2 行（Rust の `//!` のつもり）
- 診断:
  なし。`#!` はふつうのコメントとして黙って読まれる。確かめたこと（v0.28.2、repo の外の使い捨ての Pome、2026-11-25）:
  - 先頭に `#!` の行、空行、`##` の行、空行、`pub fn first` を置いて `emela check` すると、診断なしで終わる（exit 0）
  - 同じ Pome で `emela doc` を走らせると、空行を挟んだ `##` の行が `first` の doc になる。`##` をファイルの先頭に置いても、モジュールの doc にはならない
  - text の写しで `emela doc` を走らせると、`Lib.html` に出るのは 2 つの fn の `##` だけで、`text/src/lib.emel` の先頭のコメントは出ない
- 回避策:
  std の `core/string.emel:1-2` と x の `base64/src/lib.emel` に揃え、ふつうの `#` のコメントで書いた（`text/src/lib.emel` の先頭、`FRICTION(008)` の印）
  - regex（計画の Task 3 の Step 2、「モジュールの doc comment だけの骨組み」）: `regex/src/lib.emel` の先頭も同じ形（`FRICTION(008)` の印）。wish は書いていない（計画が `#` の形を指定した）
- コスト: 計画の「モジュールの doc comment」を、生成した文書に出ないコメントで代えた。`emela doc` の文書にも hover にもモジュールの説明が出ない。std も同じ書き方なので、std のモジュールの説明も生成した文書には出ない。普段のコードに基盤レベルは漏れていない
- spec:
  `[lex.comment]`（`spec/language/02-lexical.md:14`: 「`##` is a doc comment. It attaches to the declaration, local fn, variant, field, effect operation, or handler item that immediately follows it.」。モジュールは入っていない）、`[lsp.doc]`。`emela doc` の節は `spec/tooling/commands.md` に無い（`04-modules.md:181` と `lsp.md:240` で触れているだけ）
- 既存: emela の issue に無い（「module doc」「doc comment」で検索、2026-11-25）。`proposals/` と `spec/open-questions.md` にも無い。他の言語: Rust の `//!`、Gleam の `////`
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）
