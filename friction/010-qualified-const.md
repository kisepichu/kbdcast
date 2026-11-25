# 010 qualified-const

- 状態: open
- Emela: v0.28.2
- 意図: `regex/src/fold.emel` で、生成した `regex/src/fold_table.emel` の `pub const`（`SOURCES`、`TARGETS`、どちらも `List[Int]`）をモジュール名を付けて読み、同じ表の Array 版に同じ短い名前を付ける
- こう書きたかった: `wish/fold.emel:6-7`
  ```emela
  const SOURCES: Array[Int] = Array.from_list(FoldTable.SOURCES)
  const TARGETS: Array[Int] = Array.from_list(FoldTable.TARGETS)
  ```
- 診断:
  wish check（emela 0.28.2、`wish/fold.emel` の末尾）。`FoldTable.SOURCES` の 1 か所ごとに、構文の 3 つ（``error[E0110]: expected lower name``、``error[E0110]: expected `)` ``、``error[E0122]: expected newline after declaration``）と、名前解決の ``error[E0211]: cannot find constructor `FoldTable` in this scope`` が出る。2 か所で 8 つ（wish check の 21 のうち）。help も note も付かず、「別のモジュールの const は import して使う」とは言わない
- 回避策:
  `import FoldTable.{SOURCES, TARGETS}` で List を取り込み、Array には `SOURCE_ARRAY` と `TARGET_ARRAY` という別の名前を付けた（`regex/src/fold.emel`、`FRICTION(010)` の印）。`regex/test/fold_test.emel` も同じ import を書く
- コスト:
  1 つの表に 2 組の名前が要る。import の形は spec が決めた書き方で、行数は変わらない。直すには spec を引く必要があった（`[grammar.expr]` の `postfix` は `"." lower_name` だけで、`type_ref` も型の名前で終わる）。普段のコードに基盤レベルは漏れていない
- spec:
  `[grammar.expr]`、`[data.const]`（const の名前は uppercase name）、`[lex.name]`（「Lowercase name or uppercase name on the left: access to a value」）、`spec/library/api.md:516`（`Std.Process` の「The constants are named with the prefix `EXIT_` because a const is used through an import, not as a qualified name」）、`spec/diagnostics.md` の E0110
- 既存:
  決まった設計。`proposals/exit-code.md:68` が「A const of another module cannot be written `Process.EXIT_SUCCESS`. ... `Process.SUCCESS` is E0110」と書き、std は const の名前に接頭辞を付けて、素の名前で使われても意味が分かるようにした。emela の issue に無い（「const qualified」で検索、2026-11-25）
- 行き先:
  自分の誤解だった（既に決まった制限） → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: 式の中の `Module.UPPER_NAME` が E0110 の 2 つと E0122 と E0211 になり、どれも書き換えを示さない。E0142（前置の match）や E0148（式の `fn(...)`）のように、``a const of another module is used through an import: `import FoldTable.{SOURCES}` `` という help の付いた 1 つの診断にしてほしい
  kbdcast の側: 表の const の名前（生成器の `SOURCES`、`TARGETS`）は import して素の名前で使われるので、std の `EXIT_` に倣うなら `FOLD_SOURCES` のように接頭辞を付ける形がある。この Task では計画の名前のままにした
