# 023 assert-show-w0303

- 状態: open
- Emela: v0.28.2
- 意図: regex の find のテスト（`regex/test/find_test.emel`、計画の Task 6）で、`find` の結果（一致の始まり、終わり、text、group の列）を名前の付いた型にまとめ、`assert find(...) == Some(Found(...))` が失敗したときに両辺の値が出るようにする
- こう書きたかった:
  テストのモジュールの中の、`pub` でない型（wish には書いていない。テストのコード）
  ```emela
  type Found(start: Int, end: Int, text: String, groups: List[Option[String]]) derive Eq, Show

  assert find("abc", NO_FLAGS, "xabcx", 0) == Some(Found(1, 4, "abc", []))
  ```
- 診断:
  `emela check` と `emela test`（v0.28.2）の ``warning[W0303]: derived `Show` for `Found` is never used``（`Show` を指す）と ``= help: remove it from `derive`; `dbg` then shows `Found` as constructed, and a failed `assert` no longer shows its values``。help は、消せば assert の表示が消えると書いたうえで、消すことを勧める。Show を使うのは 53 の比較の assert の失敗のときの表示だけで、spec はそれを「使った」に数えない
- 回避策:
  名前の付いた型をやめ、組 `(Int, Int, String, List[Option[String]])` にした（`regex/test/find_test.emel` の `find`、`FRICTION(023)` の印）。組の Eq と Show は compiler が持つので W0303 は出ず、失敗した assert は値を出す。期待値は `Some((1, 4, "abc", []))` と書く
  選ばなかった候補:
  - `derive Eq` だけにする: 警告は消えるが、失敗した assert が値を出さない
  - `pub type` にする: spec の言うとおり `pub` の型には W0303 が出ないが、他のモジュールから使わせるつもりの無いテストの型に `pub` を書くことになる
- コスト: 期待値の 4 つの欄に名前が付かない（順序は `find` のコメントに書いた）。行数は同じ。普段のコードに基盤レベルは漏れていない
- spec:
  `[trait.derive]`（`spec/language/10-traits.md:110`: 「The display of dbg and assert (10.6) does not require it, so it is not counted. For a `pub` type, other modules can use it, so the warning is not reported.」）、`[test.assert]`（「if the types of both sides of the comparison satisfy Show, the values of both sides follow」）、`spec/diagnostics.md` の W0303、`spec/history.md:283`（2026-10-20 に、main やテストに届いた error の表示に使う Show を同じ理由で W0303 から外した）
- 既存:
  emela の issue と PR（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「W0303」「derive Show assert」で検索）: #335（W0303 を足した issue、閉じた）、#358（その実装）、#372（error の導出した Show を W0303 から外した spec の PR）。テストの assert の表示のための Show を扱ったものは無い
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。error の Show を外したのと同じ理由で、失敗した assert の表示（`[test.assert]`）に使われうる Show も W0303 の「使った」に数える。少なくとも、テストの root のモジュール（`[test.attr]`）の型、またはその型の値が比較の assert の両辺に現れる型には W0303 を出さない。未提出。出すのは user
