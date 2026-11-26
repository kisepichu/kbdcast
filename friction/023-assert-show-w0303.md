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
  key codec の encode のテスト（`test/encode_test.emel` と `test/golden_test.emel`、サブプロジェクト 2 の計画の Task 6）でも、encode が何をしたか（送った bytes の 16 進か、`Unencodable` の理由）を、テストの中の private な enum にした。golden のテストは、表と食い違う組を `(名前, 修飾, mode, 表の言う結果, encode の結果)` の List にして `== []` と比べるので、失敗したときに両辺の値が出ることが要る
  ```emela
  enum Outcome {
    Sent(String)
    Refused(Reason)
  } derive Eq, Show

  assert encoded("<C-S-a>", DEFAULT_MODES) == Refused(NeedsOtherKeys(One))
  ```
- 診断:
  `emela check` と `emela test`（v0.28.2）の ``warning[W0303]: derived `Show` for `Found` is never used``（`Show` を指す）と ``= help: remove it from `derive`; `dbg` then shows `Found` as constructed, and a failed `assert` no longer shows its values``。help は、消せば assert の表示が消えると書いたうえで、消すことを勧める。Show を使うのは 53 の比較の assert の失敗のときの表示だけで、spec はそれを「使った」に数えない
  encode のテスト（v0.28.2）でも、2 つのファイルの `Outcome` に同じ ``warning[W0303]: derived `Show` for `Outcome` is never used`` と同じ help（`emela check` と hook の `tools/check.ts` の出力）。どちらのファイルも、`Outcome` の値は比較の assert の両辺にだけ現れる
- 回避策:
  名前の付いた型をやめ、組 `(Int, Int, String, List[Option[String]])` にした（`regex/test/find_test.emel` の `find`、`FRICTION(023)` の印）。組の Eq と Show は compiler が持つので W0303 は出ず、失敗した assert は値を出す。期待値は `Some((1, 4, "abc", []))` と書く
  選ばなかった候補:
  - `derive Eq` だけにする: 警告は消えるが、失敗した assert が値を出さない
  - `pub type` にする: spec の言うとおり `pub` の型には W0303 が出ないが、他のモジュールから使わせるつもりの無いテストの型に `pub` を書くことになる
  encode のテスト（Task 6）: `test/encode_test.emel` と `test/golden_test.emel` の private な enum をやめ、String にした（送った bytes は 16 進の `"1b5b41"`、送れない理由は `Reason` を補間で書いた `"NeedsOtherKeys(One)"`）。review の後の fix（ESCALATION 3）で、2 つの private な `outcome` を `Golden` の `pub fn outcome(k, modes) -> String` に 1 つにまとめた。そこからは、結果の型を `Golden` の `pub` の enum にすれば W0303 は出ず、2 つのテストのモジュールがその型を使うので、上の「選ばなかった候補」の `pub type` の理由（他のモジュールから使わせるつもりが無い）も当たらなかった。String のままだったのは、manager が決めた `outcome` の型（`-> String`）に従ったため
  最終レビューの後の fix で、manager の決定（ESCALATION 4）により、`Golden` に `pub enum Outcome { Sent(String)  Refused(Reason) } derive Eq, Show` を置き、`outcome` はそれを返す。期待値は `Sent("61")` と `Refused(NeedsOtherKeys(One))` と書く。Emela が強いる回り道はこの所に残らないので、`FRICTION(023)` の印を消し、この所は数えない。印のある所は `regex/test/find_test.emel` の 1 つだけ
- コスト: 期待値の 4 つの欄に名前が付かない（順序は `find` のコメントに書いた）。行数は同じ。普段のコードに基盤レベルは漏れていない
  encode のテストでは、Task 6 から最終レビューの後の fix まで、期待値の 2 つの形（bytes と理由）が型で分かれず、理由の綴りの誤りは型の検査でなくテストの失敗で分かった。find のテストのように組にすることはできなかった（欄の並びでなく、2 つの場合の和なので）。`pub enum Outcome` にした後は、このコストは無い
- spec:
  `[trait.derive]`（`spec/language/10-traits.md:110`: 「The display of dbg and assert (10.6) does not require it, so it is not counted. For a `pub` type, other modules can use it, so the warning is not reported.」）、`[test.assert]`（「if the types of both sides of the comparison satisfy Show, the values of both sides follow」）、`spec/diagnostics.md` の W0303、`spec/history.md:283`（2026-10-20 に、main やテストに届いた error の表示に使う Show を同じ理由で W0303 から外した）
- 既存:
  emela の issue と PR（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「W0303」「derive Show assert」で検索）: #335（W0303 を足した issue、閉じた）、#358（その実装）、#372（error の導出した Show を W0303 から外した spec の PR）。テストの assert の表示のための Show を扱ったものは無い
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。error の Show を外したのと同じ理由で、失敗した assert の表示（`[test.assert]`）に使われうる Show も W0303 の「使った」に数える。少なくとも、テストの root のモジュール（`[test.attr]`）の型、またはその型の値が比較の assert の両辺に現れる型には W0303 を出さない。未提出。出すのは user
