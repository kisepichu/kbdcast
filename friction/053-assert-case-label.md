# 053 assert-case-label

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型のテスト（`test/key_test.emel` の `key_puts_the_code_and_the_mods_in_normal_form`、サブプロジェクト 2 の計画の Task 2）で、`Key.key` に渡す値と期待する結果の表（`CASES`、31 行）を `each` で回し、1 行ずつ assert する。失敗したときに、どの行の失敗かを出したい
  VT の parser のテスト（`test/parser_test.emel` の `where_a_golden_input_is_cut_does_not_change_the_actions`、サブプロジェクト 3 の計画の Task 3）でも、golden の表の 2012 の入力を `each` で回し、それぞれを brix の性質テストで切る。性質テストが失敗を出すときに見せるのは引いた値（切る位置）だけで、どの入力かは出ない
  VT の公開 API のテスト（`test/vt_test.emel` の `where_a_golden_input_is_cut_does_not_change_the_terminal_or_the_replies`、サブプロジェクト 3 の計画の Task 6）でも、parser のテストと同じく golden の表の 2012 の入力を `each` で回し、それぞれを brix の性質テストで切って `feed` する。性質テストが見せるのは切る位置だけで、どの入力かは出ない
- こう書きたかった:
  wish には書いていない（テストのコード）。Go の `t.Errorf("key(%v, %v) = ...", ...)`、Rust の `assert_eq!(a, b, "case {:?}", input)`、JUnit の `assertEquals(message, expected, actual)` のように、assert に名札を付ける
  ```emela
  CASES.each(|((code, mods), want)| {
    assert Key.key(code, mods).map(|k| (k.code(), k.mods())) == Some(want), "key(#{code}, #{mods})"
  })
  ```
- 診断:
  テストのコードには名札の形を書いていない。repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: テストの中の `assert n + 0 == n, "case #{n}"` に、`,` を指す ``error[E0122]: expected newline or `}` after statement`` の 1 つ。help は付かない
  失敗した比較の assert は、式の source の文と、左右の値を出す。表を回す assert の source の文はどの行でも同じで、左右の値は結果と期待値だけなので、どの入力の失敗かは出ない
- 回避策:
  入力を両辺に置いた: `assert ((code, mods), made) == ((code, mods), Some(want))`。失敗すると、左右の値に入力が出る（`test/key_test.emel` の `key_puts_the_code_and_the_mods_in_normal_form`、`FRICTION(053)` の印）
  同じ所を、表と食い違う行を List に集めて `== []` と比べる形で書いたテストもある（`test/golden_test.emel` の `decode_reads_what_termwiz_sends_as_exactly_one_key`、`encode_sends_what_termwiz_sends_exactly_when_decode_reads_it_as_the_representative`、`test/encode_test.emel` の `encode_needs_kitty_for_super_in_every_mode`）。こちらは食い違う行をすべて出す（`each` の中の assert は、最初の失敗で test 関数ごと止まる）。023 の「失敗した assert が両辺の値を出す」は、この形に要る
  1 つずつ書いた assert（`assert decoded("1b5b0d") == [...]`）は、source の文に入力が入るので、名札は要らない。要るのは表を回す所だけ
  VT の parser のテスト（`FRICTION(053)` の印）: key と同じく、入力を両辺に置いた: `assert (input, cut_and_advanced(input, at)) == (input, joined(actions(input)))`。入力を引いた値にした性質テスト（`where_random_output_is_cut_does_not_change_the_actions`）は、brix が反例として入力を出すので、要らない
  VT の公開 API のテスト（`FRICTION(053)` の印）: parser のテストと同じく、入力を両辺に置いた: `assert (input, seen(pieces), more) == (input, seen(whole), replies)`
- コスト: コードのコストは小さい（1 行の assert の両辺に入力が増える）。読む人には、両辺の同じ値が何のためかが分からないので、コメントが 1 行要った。普段のコードに基盤レベルは漏れていない
- spec: `[test.assert]`（`assert expr` だけ。比較の assert は失敗すると `assertion failed: <source text>` と `left:`、`right:` を出す。名札や message の形は無い）、`[error.defect]`（失敗した assert は defect で、test 関数はそこで止まる）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「assert message」「assert label」を検索。当たりなし）。v0.28.2 の spec と proposals にも、assert の message の形や、表を回すテスト（table-driven、parameterized）の話は無い（`git grep`）。brix v0.4.0 の `src/assert.emel` は `some` と `none` だけ（016）
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`assert expr, label`（`label` は String の式で、失敗したときだけ評価し、message に足す）。表を回すテストで、どの行が失敗したかを出せる。brix の側で `Assert.eq(actual, expected, label)` のような関数を足す形もありうるが、比較の assert の左右の表示（`[test.assert]`）は compiler が式の形を見て作るので、言語の側が自然。テストの側の回り道なので、優先度は低い。未提出。出すのは user
