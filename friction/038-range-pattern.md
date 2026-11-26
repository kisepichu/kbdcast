# 038 range-pattern

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel` の `representative`、サブプロジェクト 2 の計画の Task 2）で、制御文字の代表（spec の §6）を決める match の中で、0x1C〜0x1F（Ctrl と `\` `]` `^` `_`）を 1 つの腕で受ける
- こう書きたかった:
  `wish/key.emel:53`。Rust の範囲パターン
  ```emela
  0x1C..=0x1F -> (Char(c + 0x40), CTRL)
  ```
  key codec の decode（`wish/decode.emel:156`、サブプロジェクト 2 の計画の Task 4）でも、`CSI n~` の F6〜F10 の番号 17〜21 を `17..=21 -> Some(Function(f_key(n - 11)?))` と 1 つの腕にした
  key codec の encode（`wish/encode.emel:100-101`、`:173`、サブプロジェクト 2 の計画の Task 6）でも、termwiz の `ctrl_mapping` の英字を `'a'..='z' -> Some(c - 'a' + 1)` と `'A'..='Z' -> ...` に、F1〜F4 を `1..=4 -> { ... }` の 1 つの腕にした
- 診断:
  wish check（v0.28.2）では、`=` で書いた関数の本体（020）の中にあり、読まれなかった
  repo の外の使い捨ての Pome での最小の形（`c match { 0x1C..=0x1F -> 1  _ -> 0 }`、2026-11-27）で 3 つ: ``E0110: expected `->` `` と ``E0118: expected expression``（どちらも `..` を指す）、``E0122: expected newline or `}` after match arm``。spec の `[fn.match]` は「use a guard instead」と書くが、診断はそれを言わない
  decode の wish check（v0.28.2）では、最小の形と同じ 3 つ（`:156` の `..` に E0110 と E0118、その後ろに E0122）
  encode の wish check（v0.28.2）では、`:173` の `1..=4` に最小の形と同じ 3 つ（`..` に E0110 と E0118、その後ろに E0122）。腕の本体（`:174-175`）は読まれなかった。`:100-101` は char literal の E0105（013）と混ざった
- 回避策:
  guard にした（`_ if c >= 0x1C -> ...`。`src/key.emel` の `representative`、`FRICTION(038)` の印）。上の腕が 0x00、0x08、0x09、0x0D、0x1B、0x7F を先に受け、`representative` は制御文字にだけ呼ばれる（`key` が `is_control` で確かめる）ので、下限だけを書いた
  decode（`src/key/decode.emel` の `tilde`、`FRICTION(038)` の印）: `_ if n >= 17 && n <= 21 -> function(n - 11)`。こちらは上と下に別の腕（15、23、24）があるので、両端を書いた
  encode（`src/key/encode.emel`、`FRICTION(038)` の印 2 か所）: `ctrl_mapping` は、`@` から `~` を `_ if c >= 0x40 && c <= 0x7E -> Some(c.bit_and(0x1F))` の 1 つの guard にした（英大文字、英小文字と 11 の記号が、低い 5 bit の制御文字になる。termwiz の表を、同じ値になる形でまとめた）。`function` は、F1〜F4 を番号の腕に分け（009）、F6〜F10 を `_ if n <= 10 -> tilde(n + 11, m)` の guard にした（上の腕が 1〜5 を先に受け、下に 11 と 12 の腕がある）
- コスト: 行数は同じ。guard の腕は網羅性の判定に数えられない（`[fn.match]`）。範囲の上限の 0x1F は書かず、呼ぶ側の前提に頼る。普段のコードに基盤レベルは漏れていない
- spec: `[fn.match]`（「There are no range patterns (`1..10`) (exhaustiveness checking would have to handle intervals of numbers; use a guard instead).」）、`[grammar.pattern]`、`spec/diagnostics.md` の E0110、E0118、E0122
- 既存: 決まった設計。`spec/open-questions.md` の 17（2026-10-13 に、負の数のパターンと合わせて「There are no range patterns」と決まった）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「range pattern」「range patterns」を検索。当たりなし）
- 行き先: 既に知られている制限 → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: `..` or `..=` between two literals in the pattern of an arm gets E0110, E0118 and E0122, none of which says what the spec says. It should get one diagnostic, ``there are no range patterns: use a guard, `n if n >= 0x1C && n <= 0x1F -> ...` ``. 範囲パターンそのものは決まった設計なので、使い道（code point の範囲。013 と合わせて、文字の範囲を書く所）を添えるだけにする
