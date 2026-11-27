# 058 list-range-step

- 状態: open
- Emela: v0.28.2
- 意図: VT の解釈（`src/vt/terminal.emel` の `terminal`、サブプロジェクト 3 の計画の Task 5）で、avt 0.18.0 の `Tabs::new` の既定のタブ位置（8 から `cols` 未満までの 8 ごと。Rust の `(8..cols).step_by(8)`）を List にする
- こう書きたかった:
  `wish/terminal.emel:54` の `tabs: range(8, cols, step: 8)`。Python の `range(8, cols, 8)`、Rust の `step_by`、Kotlin の `step` のつもりで、刻みを名前の付いた引数で渡した（`range` に `List.` を付けなかったのは 016）
- 診断:
  wish check（v0.28.2）では、`List.` の無い `range` に ``error[E0211]: cannot find value `range` in this scope`` の 1 つだけで、`step:` には届かなかった
  repo の外の使い捨ての Pome での最小の形（`List.range(8, cols, step: 8)`、v0.28.2、2026-11-27）は ``error[E0306]: no parameter named `step` in `range` `` の 1 つ。help は付かない
- 回避策:
  刻みの数を数える range を 8 倍した: `List.range(1, (cols - 1) / 8 + 1).map(|i| 8 * i)`（`src/vt/terminal.emel` の `terminal`、`FRICTION(058)` の印）。上の端は、`cols` 未満の 8 の倍数の個数 `(cols - 1) / 8` から引き直した
- コスト:
  1 行で済み、性能のコストも無い（List を 1 回写すだけ）。ただ、上の端の式を書くのに、端を含むかどうかと、`cols` が 1、8、9、16、17 のときを確かめる必要があった（Rust の `step_by` と Python の `range` の刻みは、端を考えずに書ける）。golden の表は 1〜10 列なので、タブ位置が 2 つ以上になる幅（17 列以上）は、手で書いた `tabs` の例（20 列）と、使い捨ての avt の例（30 列）でしか確かめていない。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.list]` の `range`（`range(from: Int, to: Int) -> List[Int]`。刻みの引数は無い）、`[fn.args]`（無い名前の引数は E0306）、`spec/diagnostics.md` の E0306
- 既存:
  emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「range step」「step_by」「List.range」を検索。当たったのは `List.range` の上の fold と map を loop にする最適化の PR #634、#638 などで、別の話題）。`spec/open-questions.md` と `proposals/` にも無い
- 行き先:
  前提の範囲内で spec に足りない → 出さない（使い道はこの 1 か所で、`map` で 1 行に書ける）。刻みの range が要る所が他で出たら、ここに足して見直す
