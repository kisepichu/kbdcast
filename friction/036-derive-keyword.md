# 036 derive-keyword

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel`、サブプロジェクト 2 の計画の Task 2）で、`Key`、`KeyCode`、`Mods`、`FKey` に Eq と Show を導出させる（テストの `assert ==` と、失敗したときの表示に要る）
- こう書きたかった:
  `wish/key.emel:4`、`:11`、`:13`、`:18`。Haskell の `deriving` の形
  ```emela
  pub type Mods(ctrl: Bool, alt: Bool, shift: Bool, super: Bool) deriving (Eq, Show)
  ```
  key codec の decode（`wish/decode.emel:13`、サブプロジェクト 2 の計画の Task 4）では、語は `derive` にしたが、Haskell と同じく括弧で囲んだ: `} derive (Eq, Show)`
  VT の parser（`wish/parser.emel:12`、サブプロジェクト 3 の計画の Task 3）でも、`Action` の enum の閉じ括弧の後ろに、Haskell の形の `} deriving (Eq, Show)` と書いた
  VT の画面（`wish/screen.emel:8`、`:13`、`:41`、`:49`、サブプロジェクト 3 の計画の Task 4）では、語と並べ方（`derive Eq, Show`）は合ったが、4 つの enum で、variant の `{ }` の前（名前の直後）に書いた: `pub enum Color derive Eq, Show {`。同じ wish の 2 つの type（`:28` の `Pen`、`:47` の `Cell`）では、宣言の後ろの正しい位置に書いている。Swift の `enum Color: Equatable {` のように、満たす trait を本体の前に書く形と混ざった
- 診断:
  wish check（v0.28.2）の 42 の診断のうち 4。`deriving` の 4 か所に ``error[E0122]: expected newline after declaration``。help も note も付かない
  repo の外の使い捨ての Pome での最小の形（`pub type Mods(ctrl: Bool, shift: Bool) deriving (Eq, Show)`、2026-11-27）でも同じ 1 つ。`derive` という語を示さない
  decode の wish check（v0.28.2）では、`(` を指す ``error[E0110]: expected type name`` と ``error[E0122]: expected newline after declaration`` の 2 つ。括弧を外せとは言わないが、型の名前が来るはずだとは分かる
  VT の parser の wish check（v0.28.2）では、`deriving` に ``error[E0122]: expected newline after declaration`` の 1 つ（最初の wish と同じ）
  VT の画面の wish check（v0.28.2）では、112 の診断のうち 8。enum ごとに、`derive` を指す ``error[E0110]: expected `{` `` と、`{` を指す ``error[E0122]: expected newline after declaration`` の 2 つ。help は付かない。enum の宣言が読めなかったので、後で使う variant にも ``error[E0211]: cannot find constructor `Normal` in this scope`` と同じ形の `WideTail` のものが 2 つ続いた（`Single` などは、読まれなかった本体の中にあった）
- 回避策: `derive Eq, Show` にした（`src/key.emel`。decode の `src/key/decode.emel` の `Decoded` も同じ）。正しい構文に直しただけなので、コードに印は付けない
  VT の parser（`src/vt/parser.emel` の `Action`）も `} derive Eq, Show` にした。印は付けない
  VT の画面（`src/vt/screen.emel` の `Color`、`Intensity`、`Occupancy`、`Erase`）も `} derive Eq, Show` にした。印は付けない
- コスト: コードのコストは無い。直すには spec を引く必要があった（`[trait.derive]` と `[grammar.decl]` の `derive = "derive" type_ref { "," type_ref }`）。wish-first（spec を読む前に wish を書く）では、そのときの手がかりは診断だけで、E0122 は宣言の後ろに何かが続いたことしか言わない
- spec: `[trait.derive]`、`[grammar.decl]`（`derive` は宣言の終わりに書く文脈キーワード）、`[kw.reserved]` の隣の文脈キーワードの表（`spec/language/03-keywords.md:25`）、`spec/diagnostics.md` の E0122
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「deriving」を検索。当たりなし）。他の言語の書き方に書き換えを示す診断はある: E0142（前置の match）、E0144（`impl Trait for Type`）、E0147（signature の `use`）、E0148（式の `fn(...)`）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: a type, enum or error declaration followed by `deriving (Eq, Show)` gets only ``expected newline after declaration``. Like E0142 and E0148, it should get ``help: write `derive Eq, Show` `` when the word after the declaration is `deriving`
  VT の画面（Task 4）の形も同じ下書きに足せる: an enum with `derive Eq, Show` between its name and its `{` gets ``expected `{` `` on `derive`, then the variants used later are not found (E0211). The same help could say that `derive` comes at the end of the declaration, after the `}` of the variants
