# 004 let-binding

- 状態: open
- Emela: v0.28.2
- 意図: `text` の wish（`wish/text.emel` の `slice`）で、関数の中の途中の値に名前を付ける
- こう書きたかった:
  `wish/text.emel:39-42` の 4 行。他の言語（Rust、Swift、OCaml、JavaScript など）の癖で `let` を書いた
  ```emela
  let cps = String.code_points(s)
  let len = List.length(cps)
  let start = Int.clamp(from, 0, len)
  let stop = Int.clamp(to, start, len)
  ```
- 診断:
  wish check（emela 0.28.2、`wish/text.emel:52-155`）。`let` の行ごとに 2 つ出る:
  - `let` に ``error[E0118]: expected expression``
  - 名前（`cps` など）に ``error[E0122]: expected newline or `}` after statement``

  4 行で 8 つ。そのあと、束縛されなかった名前を使う `wish/text.emel:43` に ``error[E0211]: cannot find value `cps` in this scope`` と同じ形のものが 4 つ（`cps`、`start`、`stop`、`start`）続く。wish check の 14 の診断のうち 12 がこの 1 つの誤りから出ている。どれにも help も note も付かず、「Emela に `let` は無い、`x = value` と書く」とは言わない
- 回避策: `let` を消して `start = Int.max(from, 0)` と書いた（`text/src/lib.emel` の `slice`）。正しい構文に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い。直すには spec を引く必要があった。診断から分かるのは `let` が式として読めないことだけで、wish-first（AGENTS.md 規則 1）では spec を読む前に wish を書くので、そのときの手がかりは診断しかない。後に続く 4 つの E0211 は束縛の失敗の後追いで、wish の本当の診断（`String.from_scalars` の E0212、003）を埋もれさせる
- spec:
  `[fn.block]`（「A binding is written `pattern = expr`. There is no declaration keyword.」）、`[kw.future]`（`let` と `var` は将来のための予約語。`spec/language/03-keywords.md:34`）、`spec/diagnostics.md` の E0118、E0122、E0211
- 既存:
  `let` と `var` の専用の診断 E0146（``Emela has no `let`: write `x = value` ``）は、一度 spec に入って取り下げられた。v0.28.2 の `spec/history.md:303`:

  > - 3.3, Appendix A: Withdrew the dedicated diagnostic for `let` and `var` bindings (E0146).

  理由は取り下げた PR #353 の本文にある: 「3.3: `let` と `var` の専用の診断 E0146 を外した．AI 向けの案内は文書と skill で書く（#341）」。実装の PR #347 は「`let x = 1` はこれまでどおり予約語の一般の構文エラーになり，それを確かめるテストを足した」。E0146 の番号は今は `@export` の引数の誤りに使われている。他の言語の書き方に書き換えを示す診断は残っている: E0142（前置の match）、E0144（`impl Trait for Type`）、E0145（`implements`）、E0147（signature の `use`）、E0148（式の `fn(...)`）。emela の issue は E0144〜E0146 を求めた #324（closed）だけ（「let」「E0146」で検索、2026-11-25）
- 行き先:
  自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: E0146 は「AI 向けの案内は文書と skill で書く」として取り下げられたが、spec を読む前に書いたコード（kbdcast は wish-first で、spec を読む前に書く）には文書も skill も届かず、届くのは診断だけだった。4 行の `let` が 12 の診断になり、どれも `x = value` を示さない。E0142 や E0148 と同じように、`let` と `var` に書き換えを示す help を E0118 に付けるか、少なくとも束縛に失敗した名前の E0211 を後に続けないでほしい
