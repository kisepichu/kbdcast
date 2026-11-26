# 038 range-pattern

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel` の `representative`、サブプロジェクト 2 の計画の Task 2）で、制御文字の代表（spec の §6）を決める match の中で、0x1C〜0x1F（Ctrl と `\` `]` `^` `_`）を 1 つの腕で受ける
- こう書きたかった:
  `wish/key.emel:53`。Rust の範囲パターン
  ```emela
  0x1C..=0x1F -> (Char(c + 0x40), CTRL)
  ```
- 診断:
  wish check（v0.28.2）では、`=` で書いた関数の本体（020）の中にあり、読まれなかった
  repo の外の使い捨ての Pome での最小の形（`c match { 0x1C..=0x1F -> 1  _ -> 0 }`、2026-11-27）で 3 つ: ``E0110: expected `->` `` と ``E0118: expected expression``（どちらも `..` を指す）、``E0122: expected newline or `}` after match arm``。spec の `[fn.match]` は「use a guard instead」と書くが、診断はそれを言わない
- 回避策:
  guard にした（`_ if c >= 0x1C -> ...`。`src/key.emel` の `representative`、`FRICTION(038)` の印）。上の腕が 0x00、0x08、0x09、0x0D、0x1B、0x7F を先に受け、`representative` は制御文字にだけ呼ばれる（`key` が `is_control` で確かめる）ので、下限だけを書いた
- コスト: 行数は同じ。guard の腕は網羅性の判定に数えられない（`[fn.match]`）。範囲の上限の 0x1F は書かず、呼ぶ側の前提に頼る。普段のコードに基盤レベルは漏れていない
- spec: `[fn.match]`（「There are no range patterns (`1..10`) (exhaustiveness checking would have to handle intervals of numbers; use a guard instead).」）、`[grammar.pattern]`、`spec/diagnostics.md` の E0110、E0118、E0122
- 既存: 決まった設計。`spec/open-questions.md` の 17（2026-10-13 に、負の数のパターンと合わせて「There are no range patterns」と決まった）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「range pattern」「range patterns」を検索。当たりなし）
- 行き先: 既に知られている制限 → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `..` or `..=` between two literals in the pattern of an arm gets E0110, E0118 and E0122, none of which says what the spec says. It should get one diagnostic, ``there are no range patterns: use a guard, `n if n >= 0x1C && n <= 0x1F -> ...` ``. 範囲パターンそのものは決まった設計なので、使い道（code point の範囲。013 と合わせて、文字の範囲を書く所）を添えるだけにする
