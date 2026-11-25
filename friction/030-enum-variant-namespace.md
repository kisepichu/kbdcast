# 030 enum-variant-namespace

- 状態: open
- Emela: v0.28.2
- 意図: regex の syntax（`regex/src/syntax.emel`、計画の Task 4）の AST で、class の外の `\d` `\w` `\s` とその否定を `Node` の構成子 `Escape(ClassEscape)` として、class の中のものを `ClassItem` の構成子 `Escape(ClassEscape)` として持つ
- こう書きたかった:
  `wish/syntax.emel:27` の `ClassItem` の `Escape(ClassEscape)` と、`wish/syntax.emel:40` の `Node` の `Escape(ClassEscape)`。構成子の名前は enum ごとに分かれていると思っていた（OCaml の型ごとの構成子、Rust の `Node::Escape` と `ClassItem::Escape` のつもり）
  ```emela
  pub enum ClassItem {
    Single(Int)
    Range(Int, Int)
    Escape(ClassEscape)
  }

  pub enum Node {
    Literal(Int)
    Dot
    Escape(ClassEscape)                                     # class の外の \d など
    Class(items: List[ClassItem], negated: Bool)            # [...] と [^...]
    ...
  }
  ```
- 診断:
  wish check（v0.28.2）の診断の節（`wish/syntax.emel:5131-5141`）: ``error[E0213]: `Escape` is defined more than once``。`:40` を指し、`:27` に「`Escape` is first defined here」の label が付く。help も note も付かない
  repo の外の使い捨ての Pome での最小の形（`enum Item { Single(Int) Escape(Int) }` と `enum Node { Escape(Int) Dot }`、2026-11-26）でも同じ 1 つで、2 つの enum の構成子が 1 つの名前空間にあることは言わない
- 回避策: `Node` から `Escape` を除き、class の外の class escape を 1 つの item の `Class` にした（`regex/src/syntax.emel:49-67` の `Node`、`:399-402` の `atom_escape` の `Class(items: [item], negated: False)`）。`\d` は `[\d]` と同じ CharacterSetMatcher なので意味は変わらず、Task 5 と Task 6 が扱う節の種類が 1 つ減った。構成子の名前を変えるのでなく AST の形を変えたが、正しい書き方に直しただけなので、コードに印は付けない（026、029 と同じ）。Task 4 の実装の報告には書いたが、そのときはメモにしなかった（最終レビューの指摘で足した）
- コスト:
  コードのコストは無い。E0213 は 2 つの定義を指すので、どれとどれがぶつかったかは分かるが、なぜぶつかるのか（構成子の名前空間はモジュールに 1 つで、別の enum の構成子どうしも重なる）は `[module.resolution]` を引く必要があった
  読みやすさのコスト（Task 6 のレビューの T6-5）: 構成子の名前空間はモジュールの名前とは別なので、`regex/src/program.emel:26` は `Syntax` から構成子の `Class` を import し、同じファイルでモジュールの `Class`（`regex/src/class.emel`）も使う。`:109` の `Class.single(...)`（モジュールの関数）と `:114` の `Class(items:, negated:)`（構成子のパターン）が数行の中に並び、読む人が二度見する。構成子を enum の名前で修飾して書ければ（`Node.Class(...)`）、どちらも起きない
- spec: `[module.resolution]`（「Two enums in the same module that have variants with the same name are duplicates」。名前空間の表で enum variants は Constructors にあり、モジュールの名前とは別）、`[data.enum]`（「Variants are not types; they are constructors that make values of the parent type」）、`spec/diagnostics.md` の E0213（例は ``duplicate definition of `User` ``）
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"defined more than once"」「E0213」「variant namespace」「duplicate constructor」で検索。当たったのは PR #848（`with` の項目）と #348（trait と impl の型検査）の E0213 と、依存の更新や最適化の PR で、別の話題）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: when E0213 is reported for two enum variants with the same name in different enums, it should add a note such as ``= note: the variants of every enum in a module share one constructor namespace ([module.resolution])`` and ``= help: rename one of the variants, or move one of the enums to its own module``. Today it says only ``error[E0213]: `Escape` is defined more than once``, with labels on both variants and nothing that says why two different enums collide
