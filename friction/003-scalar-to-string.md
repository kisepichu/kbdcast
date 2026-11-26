# 003 scalar-to-string

- 状態: open
- Emela: v0.28.2
- 意図: scalar value だと分かっている code point（String から取ったもの，scalar value だけを作る生成器のもの）から，失敗しない形で String を作る
- こう書きたかった:
  `wish/text.emel` の `String.from_scalars(cps)`（失敗しない）．`from_code_points` は `if List.all(cps, is_scalar_value) { Some(String.from_scalars(cps)) } else { None }`，`slice` は `cps |> List.drop(start) |> List.take(stop - start) |> String.from_scalars`
  key codec の表記（`wish/notation.emel:134`，`:136`，`:153`，サブプロジェクト 2 の計画の Task 3）: `print` で，`Key` が持つ code point（`Key.key` が scalar value だけを通す）を `String.from_code_point(c)` で String にし，Option であることを忘れてそのまま String として使った
- 診断: wish check の ``error[E0212]: module `String` has no `from_scalars` ``
  表記の wish check（v0.28.2）では，`:136` の `bracket` の呼び出しに ``error[E0301]: type mismatch: expected `String`, found `(Mods, Option[String])` ``（同じ行の `..m` の E0114 で崩れた引数の後追い）．`:134` と `:153` は前置の match（E0142）の腕にあり，届かなかった
- 回避策:
  6 か所（どれも `FRICTION(003)` の印）
  - `Text.slice`（`text/src/lib.emel`）: `from_code_points(...)` の `None` を `panic` にする．code point は `s` から取ったので起きない
  - `code_point`（`text/test/text_test.emel`）: 生成器は scalar value だけを作るので起きない `None` を `panic` にする補助関数
  - `Syntax.group_name`（`regex/src/syntax.emel`，計画の Task 4）: capture group の名前の code point を `Text.from_code_points` で String にし，`None` を `panic` にする．名前は `is_name_character` が ASCII だけを通したもの（014）なので起きない．wish（`wish/syntax.emel:241-243`）は Unicode の名前を考えていたので，`None` を `invalid capture group name` の RegexSyntax にしていた
  - `string_of`（`regex/src/lib.emel`，最終レビューのあとの修正）: 一致，group，`replace` と `split` の部分を，入力の code point の Array の範囲から `Text.from_code_points` で作り，`None` を `panic` にする．code point は入力の String から取ったので起きない．`Text.slice` が文字列の全体をたどるのを避けるためで（002），`Text.slice` の中の 1 か所と同じ回り道を regex に複製した
  - `text_of`（`src/key/notation.emel`，サブプロジェクト 2 の計画の Task 3）: `String.from_code_point(c)` の `None` を `expect`（040）で defect にする．`print` が `Key` の code point を，`string_of`（002）が入力の String から取った code point を渡すので起きない
  - `text_of`（`src/key/encode.emel`、サブプロジェクト 2 の計画の Task 6）: encode は、端末が送る列を String として組み立てて最後に `Bytes.encode_utf8` にかける。`Char` の code point（`Key.key` が scalar value だけを通す）と制御文字の code point を `String.from_code_point(c)` で String にし、起きない `None` をその場の match で defect にした（040）。wish（`wish/encode.emel:71`、`:76`、`:79`）は Int の method の `c.to_utf8()` で、失敗しない形を想定していた（``error[E0313]: type `Int` has no field or function `to_utf8` ``。help は付かない）
  `from_code_points` は，wish では `List.all` で確かめてから `String.from_scalars` で組み立てていた．実装は確かめと組み立てを `String.from_code_point` の Option 1 つで済ませたので，そこに残った回り道は Option の List をまとめる関数が無いこと（006）で，ここには数えない
  std も `String.to_ascii_lowercase` と `String.to_ascii_uppercase` で，同じ起きない `None` を `.or("")` で握りつぶしている
- コスト: 補助関数 3 つ（`code_point`，`string_of`，表記の `text_of`．`string_of` は 002 を避けるためでもある）と，起きない分岐 4 つ（25 行ほど）と `expect`（040）の呼び出し 1 つ．普段のコードに基盤レベルは漏れていない
  encode（Task 6）: 補助関数 1 つ（`text_of`、起きない分岐を含めて 6 行）。表記の `text_of` は private で別の module から呼べないので、同じ働きのものをもう 1 つ書いた
- spec: `[api.string]`（`from_code_point`），`[target.string]`（「There is no character type」），`[lib.api-rules]`（「A precondition of the caller is broken: it is a defect」）
- 既存: なし（emela の issue と `proposals/` に無い．002 と同じ検索，2026-11-25）
- 行き先: 前提の範囲内で spec に足りない → 002 の proposal の Open questions に足した．単独の proposal にはしない（O(`to - from`) の `slice` が std に入れば，text の 1 か所と regex の `string_of` は消える．残るのはテストの生成器と regex の group の名前の 2 か所で，どちらも String から取ったのではない code point から String を作る）
