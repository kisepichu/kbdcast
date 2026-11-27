# 056 record-brace-syntax

- 状態: open
- Emela: v0.28.2
- 意図: ストリーム用の UTF-8 デコーダ（`src/utf8.emel`、サブプロジェクト 3 の計画の Task 1）で、持ち越す状態（WHATWG の UTF-8 code point、bytes needed、bytes seen、lower boundary、upper boundary）を、名前の付いた欄を持つ opaque な型として宣言し、その値を作る
- こう書きたかった:
  `wish/utf8.emel:7-13` の宣言と `:18` の値。TypeScript の `type Decoder = { ... }`、Elm と OCaml の record の型と値（`{ code_point = 0, ... }`）のつもりで、型を `=` の後ろの `{ 欄: 型 }` で宣言し、値を構成子の名前なしの `{ 欄: 値 }` で書いた
  ```emela
  pub opaque type Decoder = {
    code_point: Int,
    needed: Int,
    ...
  }

  pub fn decoder() -> Decoder {
    { code_point: 0, needed: 0, seen: 0, lower: 0x80, upper: 0xBF }
  }
  ```
  VT の parser（`wish/parser.emel:34-38` の宣言と `:42` の値、サブプロジェクト 3 の計画の Task 3）でも、同じく型を `=` の後ろの `{ 欄: 型 }` で宣言した。値は構成子の名前を `{` の前に置き、欄の名前だけで値を渡す Rust の省略形で書いた: `Parser { state, params: [], inter: "" }`
- 診断:
  wish check（v0.28.2）:
  - 宣言: 型の名前を指す ``error[E0130]: a type without fields must be `@external` `` と、`=` を指す ``error[E0122]: expected newline after declaration``。続けて、欄を読む所に ``error[E0313]: type `Decoder` has no field or function `needed` `` と同じ形のものが 5（`needed` が 3、`lower`、`upper`）
  - 値: `0` を指す ``error[E0111]: expected type``、`,` を指す ``error[E0110]: expected `=` ``、``error[E0118]: expected expression``、``error[E0122]: expected newline or `}` after statement``、block 全体を指す ``error[E0301]: type mismatch: expected `Decoder`, found `()` ``。`{` を block と読み、`code_point: 0` を型の注釈の付いた束縛（`code_point: <型> = ...`）と読んでいる
  repo の外の使い捨ての Pome での最小の形（2026-11-27）: `pub type Pair = { a: Int, b: Int }` は E0130 と E0122 の 2 つ。`pub type Pair(a: Int, b: Int)` を返す関数の本体の `{ a: 0, b: 1 }` は、E0111、E0110、E0118、E0122、E0301 の 5 つ。どちらも help は付かない
  VT の parser の wish check（v0.28.2）: 宣言は UTF-8 デコーダと同じく E0130 と E0122 の 2 つと、欄を読む所の ``error[E0313]: type `Parser` has no field or function `state` `` の 1 つ（ほかの欄を読む所は、崩れた腕の中にあった）。値（`:42`）は `=` で書いた関数の本体（020）の中にあり、読まれなかった
- 回避策: 宣言は `pub opaque type Decoder(code_point: Int, bytes_seen: Int, ...)`、値は `Decoder(code_point: 0, bytes_seen: 0, ...)` にした（`src/utf8.emel`。欄の名前は WHATWG の名前に合わせて `bytes_needed`、`lower_boundary` などにした。これは回り道ではない）。正しい書き方に直しただけなので、コードに印は付けない
  VT の parser（`src/vt/parser.emel`）も、宣言は `pub opaque type Parser(state: State, ...)`、値は `Parser(state:, params: [], ...)`（`state:` は欄と同じ名前の変数を渡す省略形、`[fn.args]`）にした。印は付けない
- コスト: コードのコストは無い。E0130 の文言は「`@external` を付けよ」と読め、従うと `@external type`（host の値の型）にする誤った直し方になる（029 と同じ）。値の方の診断は、どれも block の中の束縛の誤りとして出て、構成子の名前が要ることを言わない。直すには `[data.type]` を引く必要があった
- spec: `[data.type]`（「Construction is written `User(id: 1, name: "a")`」「There are no anonymous record types.」）、`[grammar.decl]`、`[grammar.expr]`（`block` と `binding = pattern [ ":" type ] "=" expr`）、`spec/diagnostics.md` の E0130、E0111、E0122
- 既存: 決まった設計（名前で区別する型だけで、無名の record 型は無い）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「struct literal」「record syntax」「anonymous record」「E0111」を検索。当たったのは別の話題の #103、#105 だけ）。029（構成子を並べた `type`）、020（`=` で書いた関数の本体）、026（予約語の名前）でも、E0130 が原因と別の所を指して `@external` を勧める。値の更新を `{ ..d, needed: 1 }` と書いた所は 037
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `type Name = {` with field declarations inside gets E0130 (``a type without fields must be `@external` ``) and E0122, and `{ name: value, ... }` gets E0111, E0110, E0118, E0122 and E0301, which read it as a block with a binding. Both should get one diagnostic with help: ``a type with fields is written `type Decoder(code_point: Int, ...)`, and its value `Decoder(code_point: 0, ...)`; there are no anonymous record types ([data.type])``, as E0142 and E0148 show the Emela form of a construct from another language
