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
  key codec の decode（`wish/decode.emel:65`、`:101-102`、`:109`、サブプロジェクト 2 の計画の Task 4）では、OCaml と F# の `{ r with ... }` を後置にした形で書いた: `mods with { alt: mods.alt || alt }`、`NO_MODS with { shift: true }`
  key codec の encode（`wish/encode.emel:37`、サブプロジェクト 2 の計画の Task 6）でも、`other_keys` だけを上げた `InputModes` を、decode と同じ後置の `with` で書いた: `modes with { other_keys: On(level) }`
  ストリーム用の UTF-8 デコーダ（`wish/utf8.emel:33`、`:34-40`、`:41-47`、`:58`、サブプロジェクト 3 の計画の Task 1）では、構成子の名前も書かない JavaScript の spread の形（`..` は Rust の綴り）で書いた: `{ ..d, needed: 1, code_point: byte & 0x1F }`、`{ ..d, code_point: code_point, seen: seen, lower: 0x80, upper: 0xBF }`。値を作る所の `{ code_point: 0, ... }` は 056
  VT の parser（`wish/parser.emel:71`、`:76`、`:79`、`:83`、`:87`、`:93`、`:95`、`:97`、`:99`、サブプロジェクト 3 の計画の Task 3）でも、UTF-8 デコーダと同じ spread の形で書いた: `{ ..p, state: CsiParam, params: param(p.params, c) }`、`{ ..p, inter: p.inter + String.from_code_point(c) }`
  VT の画面（`wish/screen.emel:77`、`:103`、`:151`、`:170`、`:177`、サブプロジェクト 3 の計画の Task 4）では、OCaml と F# の前置の `{ r with ... }`（欄の値は `:`）で書いた: `{ s with grid: s.grid.set(row, l) }`
  VT の解釈（`wish/terminal.emel:87-88`、`:153`、`:168-171`、`:181-184`、`:195-216`、`:224`、`:233`、`:235-236`、サブプロジェクト 3 の計画の Task 5）では、表記と同じ `(...)` の形で、`..` を先に書いた: `Terminal(..t, col: 0)`、`Terminal(..cursor_down(t, n), col: 0)`、`Terminal(..t, modes: InputModes(..t.modes, other_keys: k))`、`Pen(..p, intensity: Bold)`
- 診断:
  wish check（v0.28.2）の 42 の診断のうち 2。`:57` の `{` に ``error[E0122]: expected newline after declaration`` と、`Mods` に ``error[E0301]: type mismatch: expected `Mods`, found `fn(Bool, Bool, Bool, Bool) -> Mods` ``。`:39` と `:41` は `=` で書いた関数の本体（020）の中にあり、読まれなかった
  repo の外の使い捨ての Pome での最小の形（関数の本体の `Mods { ..mods, shift: False }`、2026-11-27）で 2 つ: ``E0122: expected newline or `}` after statement`` と同じ形の E0301。E0301 は構成子を関数の値として読んでいる。どちらも `Mods(shift: False, ..mods)` を示さない
  表記の wish check（v0.28.2）では、`..m` に ``error[E0114]: `..` must come last`` の 1 つ（同じ行の `true` は 016）。この形には、直し方を言う診断が出た
  decode の wish check（v0.28.2）では、`:65` と `:109` の `with` に ``error[E0110]: expected `)` ``（`:65` は 2 つ）と ``error[E0122]: expected newline or `}` after statement``。`with` が handler を付ける keyword だとは言わない。`:101-102` は `let`（004）の行の match の中にあり、届かなかった
  encode の wish check（v0.28.2）では、`:37` の `with` に ``error[E0110]: expected `)` `` が 2 つ、``error[E0110]: expected `{` ``、``error[E0122]: expected newline or `}` after statement``（4 つとも `with` を指す）。decode と同じく、`with` が handler を付ける keyword だとは言わない
  UTF-8 デコーダの wish check（v0.28.2）では、`:58` の `..` に ``error[E0118]: expected expression``、その次の `d` に ``error[E0122]: expected newline or `}` after statement``、続けて構成子の `Continue` の E0211（029）。`{` を block と読み、`..` から始まる文を読めなかった。`:33`、`:34-40`、`:41-47` は範囲パターン（038）と `=>`（E0110）で崩れた腕の中にあり、届かなかった
  VT の parser の wish check（v0.28.2）では、9 か所とも、範囲パターン（038）と or-pattern（015）と `=>`（E0110）で崩れた腕の中にあり、届かなかった
  VT の画面の wish check（v0.28.2）では、届いた `:170` と `:177` の `with` に ``error[E0122]: expected newline or `}` after statement`` が 1 つずつ。`{` を block と読み、`s` の式の文の後ろに `with` が続いたと言う。`with` が handler を付ける keyword だとも、`Screen(grid: ..., ..s)` とも言わない。`:77` と `:151` は `=` で書いた関数の本体（020）の中に、`:103` は前置の match（E0142）と `=>` で崩れた腕の中にあり、届かなかった
  VT の解釈の wish check（v0.28.2）では、どこにも届かなかった。`:87-88` と `:168-171` は char literal（013）で、`:153`、`:181-184`、`:195-216`、`:233`、`:235-236` は `=>` の腕（E0110）で崩れた腕の中に、`:224` は `=` で書いた関数の本体（020）の中にあった。repo の外の使い捨ての Pome での最小の形（`Terminal(..t, col: n)`、v0.28.2、2026-11-27）は、表記と同じ ``error[E0114]: `..` must come last``（`col: n` を指す）と、`..t` を位置の引数と読んだ ``error[E0301]: type mismatch: expected `Terminal`, found `Int` `` の 2 つ
- 回避策: `Mods(shift: False, ..mods)` と `Mods(ctrl: True, ..NO_MODS)` にした（`src/key.emel`。`test/key_test.emel` の const も同じ形）。表記（`src/key/notation.emel` の `print`）も `Mods(shift: True, ..mods)` にした。decode（`src/key/decode.emel` の `pressed`、`typed` と `csi_key`）も `Mods(alt: mods.alt || alt, ..mods)` と `Mods(shift: True, ..mods)` に、const の `SHIFT` は `Mods(shift: True, ..NO_MODS)` にした。正しい構文に直しただけなので、コードに印は付けない
  encode（`src/key/encode.emel` の `reason`）も `InputModes(other_keys: On(level), ..modes)` にした。encode のテスト（`test/encode_test.emel` の mode の const、`test/golden_test.emel` の `expected`）も同じ形
  UTF-8 デコーダ（`src/utf8.emel` の `step`）も `Decoder(code_point:, bytes_seen:, lower_boundary: 0x80, upper_boundary: 0xBF, ..d)` にした。lead byte の所は、wish の `..d` でなく `..decoder()` にした（`bytes_needed` が 0 の `d` は何も持ち越さない `decoder()` と同じ値で、どこから写すかを明らかにするため。回り道ではない）
  VT の parser（`src/vt/parser.emel` の `collect` と `param`）も `Parser(state:, intermediates: "#{p.intermediates}#{character(c)}", ..p)` と `Parser(state: CsiParam, part: ..., has_params: True, ..p)` の形にした。印は付けない
  VT の画面（`src/vt/screen.emel` の `print`、`with_line`、`clear_rows`、`scroll_up`、`scroll_down`）も `Screen(grid: s.grid.set(row, l), ..s)` と `Screen(grid:, ..s)` の形にした。印は付けない
  VT の解釈（`src/vt/terminal.emel`）も `Terminal(col: 0, ..t)`、`Terminal(modes: InputModes(other_keys: k, ..t.modes), ..t)`、`Pen(intensity: Bold, ..pen)` の形にした。印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった（`[data.type]` の「writing `..expr` at the end of a constructor call」）。E0301 の「関数が来た」は、構成子の後ろに `(...)` を書く形への手がかりにはなるが、`..` の位置（最後）は分からない
- spec: `[data.type]`、`[grammar.expr]`（`args = arg { "," arg } [ "," ".." expr ]`）、`spec/diagnostics.md` の E0122 と E0301
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「record update」を検索。当たったのは handler の init の `Self(...)` の #623、#646 と、解析のテストの #761 で、別の話題）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a constructor name followed by `{` (`Mods { ..mods, shift: False }`) gets E0122 and a type mismatch that reads the constructor as a function value. It should get one diagnostic with ``help: a value with some fields changed is written `Mods(shift: False, ..mods)` ``, as E0142 and E0148 show the Emela form of a construct from another language
