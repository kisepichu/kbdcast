# 037 record-update-syntax

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel`、サブプロジェクト 2 の計画の Task 2）で、修飾の 1 つだけを変えた `Mods` を作る（`key` で Shift を外す、Ctrl だけを押した `Mods` の const）
- こう書きたかった:
  `wish/key.emel:39`、`:41`、`:57`。Rust の struct update（`Mods { shift: false, ..mods }`）と JavaScript の spread（`{ ...mods, shift: false }`）を混ぜた形
  ```emela
  Some(Key(code: Char(c - 'a' + 'A'), mods: Mods { ..mods, shift: False }))
  const CTRL: Mods = Mods { ..NO_MODS, ctrl: True }
  ```
  key codec の表記（`wish/notation.emel:136`、サブプロジェクト 2 の計画の Task 3）では、`(...)` の形には近づいたが、`..` を先に書いた: `Mods(..m, shift: true)`（JavaScript の `{ ...m, shift: true }` の順）
- 診断:
  wish check（v0.28.2）の 42 の診断のうち 2。`:57` の `{` に ``error[E0122]: expected newline after declaration`` と、`Mods` に ``error[E0301]: type mismatch: expected `Mods`, found `fn(Bool, Bool, Bool, Bool) -> Mods` ``。`:39` と `:41` は `=` で書いた関数の本体（020）の中にあり、読まれなかった
  repo の外の使い捨ての Pome での最小の形（関数の本体の `Mods { ..mods, shift: False }`、2026-11-27）で 2 つ: ``E0122: expected newline or `}` after statement`` と同じ形の E0301。E0301 は構成子を関数の値として読んでいる。どちらも `Mods(shift: False, ..mods)` を示さない
  表記の wish check（v0.28.2）では、`..m` に ``error[E0114]: `..` must come last`` の 1 つ（同じ行の `true` は 016）。この形には、直し方を言う診断が出た
- 回避策: `Mods(shift: False, ..mods)` と `Mods(ctrl: True, ..NO_MODS)` にした（`src/key.emel`。`test/key_test.emel` の const も同じ形）。表記（`src/key/notation.emel` の `print`）も `Mods(shift: True, ..mods)` にした。正しい構文に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった（`[data.type]` の「writing `..expr` at the end of a constructor call」）。E0301 の「関数が来た」は、構成子の後ろに `(...)` を書く形への手がかりにはなるが、`..` の位置（最後）は分からない
- spec: `[data.type]`、`[grammar.expr]`（`args = arg { "," arg } [ "," ".." expr ]`）、`spec/diagnostics.md` の E0122 と E0301
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「record update」を検索。当たったのは handler の init の `Self(...)` の #623、#646 と、解析のテストの #761 で、別の話題）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a constructor name followed by `{` (`Mods { ..mods, shift: False }`) gets E0122 and a type mismatch that reads the constructor as a function value. It should get one diagnostic with ``help: a value with some fields changed is written `Mods(shift: False, ..mods)` ``, as E0142 and E0148 show the Emela form of a construct from another language
