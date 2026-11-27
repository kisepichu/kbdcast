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
  - regex の syntax（計画の Task 4）: wish（`wish/syntax.emel:3-5`）はモジュールの説明をファイルの先頭の `##` の 3 行に書いた（`##` は次の宣言に付くので、モジュールの doc にはならない）。`regex/src/syntax.emel` の先頭は `#` のコメントにした（`FRICTION(008)` の印）
  - regex の class（計画の Task 5）: wish（`wish/class.emel:3-5`）も、モジュールの説明をファイルの先頭の `##` の 3 行に書いた（wish check は何も言わない）。`regex/src/class.emel` の先頭は `#` のコメントにした（`FRICTION(008)` の印）
  - regex の vm と公開 API（計画の Task 6）: wish（`wish/vm.emel:3-27`、`wish/lib.emel:3-5`）も、モジュールの説明をファイルの先頭の `##` に書いた（wish check は何も言わない）。計画は「論文のどの節に従うかを、`vm.emel` の doc comment に書く」と求めるが、`regex/src/vm.emel` の先頭は `#` のコメントにした。`regex/src/program.emel` と `regex/src/lib.emel` の先頭も同じ（3 つとも `FRICTION(008)` の印）。`vm.emel` の説明（論文の節、扱う範囲の違い、O(m·n) の m と 1 歩の O(log m)）は印を含めて 39 行あり、`emela doc` にも hover にも出ない
  - key codec の表記（サブプロジェクト 2 の計画の Task 3）: wish（`wish/notation.emel:3`）も、モジュールの説明をファイルの先頭の `##` に書いた（wish check は何も言わない）。`src/key/notation.emel` の先頭は `#` のコメントにした（`FRICTION(008)` の印）
  - key codec の decode（サブプロジェクト 2 の計画の Task 4）: wish（`wish/decode.emel:3-4`）も、モジュールの説明をファイルの先頭の `##` の 2 行に書いた（wish check は何も言わない）。`src/key/decode.emel` の先頭は `#` のコメントにした（`FRICTION(008)` の印）。読む順の規則は、公開の関数の `decode` の doc に書いた
  - key codec の encode（サブプロジェクト 2 の計画の Task 6）: wish（`wish/encode.emel`）にはモジュールの説明を書かず、Elm などの `module Key.Encode` の宣言を書いた（048）。`src/key/encode.emel` の先頭の説明（何を真似るか: WezTerm の既定、termwiz 0.22.0 の xterm の符号化）は `#` のコメントにした（`FRICTION(008)` の印）。真似る相手の版と、表せないキーで失敗することは、公開の関数の `encode` の doc に書いた
  - 幅（サブプロジェクト 3 の計画の Task 2）: wish（`wish/width.emel:2-3`）も、モジュールの説明（何の幅か、avt 0.18.0 に従うことと、その license と URL）をファイルの先頭の `##` の 2 行に書いた（wish check は何も言わない）。`src/vt/width.emel` の先頭は `#` のコメントにした（`FRICTION(008)` の印）
- コスト: 計画の「モジュールの doc comment」を、生成した文書に出ないコメントで代えた。`emela doc` の文書にも hover にもモジュールの説明が出ない。std も同じ書き方なので、std のモジュールの説明も生成した文書には出ない。普段のコードに基盤レベルは漏れていない
- spec:
  `[lex.comment]`（`spec/language/02-lexical.md:14`: 「`##` is a doc comment. It attaches to the declaration, local fn, variant, field, effect operation, or handler item that immediately follows it.」。モジュールは入っていない）、`[lsp.doc]`。`emela doc` の節は `spec/tooling/commands.md` に無い（`04-modules.md:181` と `lsp.md:240` で触れているだけ）
- 既存: emela の issue に無い（「module doc」「doc comment」で検索、2026-11-25）。`proposals/` と `spec/open-questions.md` にも無い。他の言語: Rust の `//!`、Gleam の `////`
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）
