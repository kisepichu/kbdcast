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
  encode のテスト（`test/golden.emel` の `pub fn outcome`、`FRICTION(023)` の印。Task 6 では `test/encode_test.emel` と `test/golden_test.emel` に同じ private な `outcome` を 1 つずつ置いていた。review の後の fix で、manager の決定により `Golden` の `pub fn outcome(k, modes) -> String` に 1 つにまとめ、2 つのテストが呼ぶ）: enum をやめ、String にした。送った bytes は 16 進（`"1b5b41"`）、送れない理由は `Reason`（`pub` の enum で、導出した Show を持つ）を補間で書いたもの（`"#{reason}"`、`"NeedsOtherKeys(One)"`）。16 進の数字と `Needs` で始まる名前は重ならないので、区別は失われない。期待値は `"NeedsOtherKeys(One)"` と書く。golden のテストの表の側（`expected`）も、`"#{NeedsOtherKeys(level)}"` と `Reason` の値から作る
  fix の後は、結果の型を `Golden` の `pub enum` にすれば W0303 は出ず、2 つのテストのモジュールがその型を使うので、上の「選ばなかった候補」の `pub type` の理由（他のモジュールから使わせるつもりが無い）も当たらない。String のままにしたのは、manager が決めた `outcome` の型（`-> String`）に従ったため。`Golden` に公開の名前（型と 2 つの構成子）を足すかどうかは、manager に返した
- コスト: 期待値の 4 つの欄に名前が付かない（順序は `find` のコメントに書いた）。行数は同じ。普段のコードに基盤レベルは漏れていない
  encode のテストでは、期待値の 2 つの形（bytes と理由）が型で分かれず、理由の綴りの誤りは型の検査でなくテストの失敗で分かる。find のテストのように組にすることはできない（欄の並びでなく、2 つの場合の和なので）。補間で作る所が 3 つ（`Golden.outcome` と、`expected` の 2 つの腕。fix の前は `outcome` が 2 つのファイルにあって 4 つ）。行数は同じ
- spec:
  `[trait.derive]`（`spec/language/10-traits.md:110`: 「The display of dbg and assert (10.6) does not require it, so it is not counted. For a `pub` type, other modules can use it, so the warning is not reported.」）、`[test.assert]`（「if the types of both sides of the comparison satisfy Show, the values of both sides follow」）、`spec/diagnostics.md` の W0303、`spec/history.md:283`（2026-10-20 に、main やテストに届いた error の表示に使う Show を同じ理由で W0303 から外した）
- 既存:
  emela の issue と PR（2026-11-25、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「W0303」「derive Show assert」で検索）: #335（W0303 を足した issue、閉じた）、#358（その実装）、#372（error の導出した Show を W0303 から外した spec の PR）。テストの assert の表示のための Show を扱ったものは無い
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。error の Show を外したのと同じ理由で、失敗した assert の表示（`[test.assert]`）に使われうる Show も W0303 の「使った」に数える。少なくとも、テストの root のモジュール（`[test.attr]`）の型、またはその型の値が比較の assert の両辺に現れる型には W0303 を出さない。未提出。出すのは user
