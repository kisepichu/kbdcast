# 045 glob-import

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）で、`KeyCode` の構成子（`Char`、`Enter`、`Tab`、`Up` など）を素の名前で使う
- こう書きたかった:
  `wish/decode.emel:7`。enum の構成子をまとめて import する（Rust の `use KeyCode::*`、Haskell の `import Key (KeyCode(..))`）
  ```emela
  import Key.KeyCode.*
  ```
  key codec の golden の補助の wish（`wish/golden.emel:3`、サブプロジェクト 2 の計画の Task 5）でも、`import KeyCode.*` と書いた（`Key.{KeyCode}` を import した後の `KeyCode` から始まる path のつもり）
  key codec の encode の wish（`wish/encode.emel:4`、サブプロジェクト 2 の計画の Task 6）でも、import の中に `KeyCode.*` を書いた: `import Key.{Key, KeyCode.*, Mods, NO_MODS, f_number}`
- 診断:
  wish check（v0.28.2）: `*` を指す ``error[E0122]: expected newline after declaration`` の 1 つ。続けて、使った構成子ごとに ``error[E0211]: cannot find constructor `Esc` in this scope`` など（`Esc` が 2、`Insert`、`Delete`、`PageUp`、`PageDown`、`Function`、`Tab`、`Enter`、`Char`。ほかは崩れた行の中で届かなかった）
  repo の外の使い捨ての Pome での最小の形（2026-11-27）: `import Kind.Kind.*` と `import Kind.*`（`Kind` は `pub enum Kind { Small  Large }` の module）は、どちらも `*` に E0122 の 1 つと、構成子の `Large` に E0211。`import Kind.Kind.*` の方は、import が読まれないので ``error[E0211]: cannot find module or trait `Kind` in this scope`` も続く。help は付かない。`import Kind` だけにして `Kind.Large` と module で修飾すれば通る
  golden の補助の wish check（v0.28.2）: `*` を指す E0122 の 1 つ。構成子を使う腕は、`let`（004）で崩れた行の右辺の match の中にあって読まれず、構成子の E0211 は出なかった
  encode の wish check（v0.28.2）: `*` を指す ``error[E0110]: expected `}` `` と ``error[E0122]: expected newline after declaration`` の 2 つ。import の残りの `Mods`、`NO_MODS`、`f_number` も読まれなくなり、``error[E0211]: cannot find type `Mods` in this scope`` が 12、``cannot find constructor `Mods` `` が 12、``cannot find value `NO_MODS` `` が 5、``cannot find value `f_number` `` が 1、`KeyCode` の構成子の E0211 が 16 続いた（295 の error のうち 46）。解決できなかった `NO_MODS` のパターンを、下の腕を覆うと読んだ ``warning[W0301]: unreachable match arm`` も出た（`char` の `:72-79` など）
- 回避策: 使う 14 個の構成子を import の中に 1 つずつ並べた（`src/key/decode.emel` の先頭の `import Key.{...}`）。表記（`src/key/notation.emel`）も、wish の時から同じく並べている。golden の補助（`test/golden.emel`）も、使う 16 個の構成子を並べた（テストの生成器の `test/key_gen.emel` と同じ形）。正しい書き方に直しただけなので、コードに印は付けない
  encode（`src/key/encode.emel`）も、使う 16 個の構成子を import に並べた（`Key`、`Mods`、`NO_MODS` と合わせて 19 の名前）。`f_number` は `Key.f_number(f)` と module で修飾して呼ぶ
- コスト: `import Key.{...}` が 19 行になる（`emela fmt` が 1 行に 1 つの名前にする。うち 14 行が構成子）。golden の補助では 21 行（うち 16 行が構成子）。使う構成子が増えるたびに import を直す。`Key.Up` と module で修飾する形もあるが、パターンの腕が長くなる。普段のコードに基盤レベルは漏れていない
- spec: `[module.import]`（「Only the names listed in braces can be used unqualified. There is no notation that imports everything.」）、`[module.resolution]`（「Variants can be imported individually by name.」）、`[grammar.decl]`（`import_item = lower_name | type_name | upper_name`）、`spec/diagnostics.md` の E0122
- 既存: 決まった設計（`[module.import]`。spec を `spec/` に整理した #388 の時からある文）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「glob import」「import all」「wildcard import」を検索。当たりなし）
- 行き先: 自分の誤解だった（決まった制限）→ 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `import Key.KeyCode.*` gets only ``expected newline after declaration`` on the `*`, and every constructor used later gets E0211. Like E0142 and E0148, it should get ``help: there is no import of every name ([module.import]); list the names, `import Key.{KeyCode, Char, Enter}`, or qualify them, `Key.Enter` `` when an import path ends in `.*`
