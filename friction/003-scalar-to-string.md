# 003 scalar-to-string

- 状態: open
- Emela: v0.28.2
- 意図: scalar value だと分かっている code point（String から取ったもの，scalar value だけを作る生成器のもの）から，失敗しない形で String を作る
- こう書きたかった:
  `wish/text.emel` の `String.from_scalars(cps)`（失敗しない）．`from_code_points` は `if List.all(cps, is_scalar_value) { Some(String.from_scalars(cps)) } else { None }`，`slice` は `cps |> List.drop(start) |> List.take(stop - start) |> String.from_scalars`
  key codec の表記（`wish/notation.emel:134`，`:136`，`:153`，サブプロジェクト 2 の計画の Task 3）: `print` で，`Key` が持つ code point（`Key.key` が scalar value だけを通す）を `String.from_code_point(c)` で String にし，Option であることを忘れてそのまま String として使った
  ストリーム用の UTF-8 デコーダ（`wish/utf8.emel`、サブプロジェクト 3 の計画の Task 1）: 読めた文字を `Char` の型で持ち（`:15`、`:24`、`:63`）、code point を失敗しない `Char.from_int(code_point)` で `Char` にし（`:32`、`:56`）、最後に `String.from_chars(out.reverse())` で 1 つの String にした（`:76`）。WHATWG の decoder が作る code point は、境界の検査で surrogate、U+10FFFF より上、過長を除いた scalar value なので、失敗しない形を想定していた
  VT の parser（`wish/parser.emel:55`、`:79`、`:83`、`:93`、`:99`、サブプロジェクト 3 の計画の Task 3）: `Print` の文字列と中間の文字を、code point を `String.from_code_point(c)` で String にして 1 文字ずつ足す形で書き、Option であることを忘れてそのまま String として使った（`text + String.from_code_point(c)`）。code point は `advance` が受けた String から取ったもの
- 診断: wish check の ``error[E0212]: module `String` has no `from_scalars` ``
  表記の wish check（v0.28.2）では，`:136` の `bracket` の呼び出しに ``error[E0301]: type mismatch: expected `String`, found `(Mods, Option[String])` ``（同じ行の `..m` の E0114 で崩れた引数の後追い）．`:134` と `:153` は前置の match（E0142）の腕にあり，届かなかった
  UTF-8 デコーダの wish check（v0.28.2）: `:76` に ``error[E0212]: module `String` has no `from_chars` ``、`:63` の `List[Char]` に ``error[E0211]: cannot find type `Char` in this scope`` が 2、`:56` の `Char.from_int` に ``error[E0211]: cannot find module or trait `Char` in this scope``。どれも help は付かない。`:15` は char literal（013）の E0105 の行に、`:24` は構成子を並べた `type`（029）の中に、`:32` は `=>` の腕（E0110）の中にあり、届かなかった
  VT の parser の wish check（v0.28.2）では、5 か所とも届かなかった。`:55` は `let`（004）で崩れた `fold` の closure の中、ほかの 4 か所は範囲パターン（038）と or-pattern（015）で崩れた腕の中にあった
- 回避策:
  10 か所（どれも `FRICTION(003)` の印）
  - `Text.slice`（`text/src/lib.emel`）: `from_code_points(...)` の `None` を `panic` にする．code point は `s` から取ったので起きない
  - `code_point`（`text/test/text_test.emel`）: 生成器は scalar value だけを作るので起きない `None` を `panic` にする補助関数
  - `Syntax.group_name`（`regex/src/syntax.emel`，計画の Task 4）: capture group の名前の code point を `Text.from_code_points` で String にし，`None` を `panic` にする．名前は `is_name_character` が ASCII だけを通したもの（014）なので起きない．wish（`wish/syntax.emel:241-243`）は Unicode の名前を考えていたので，`None` を `invalid capture group name` の RegexSyntax にしていた
  - `string_of`（`regex/src/lib.emel`，最終レビューのあとの修正）: 一致，group，`replace` と `split` の部分を，入力の code point の Array の範囲から `Text.from_code_points` で作り，`None` を `panic` にする．code point は入力の String から取ったので起きない．`Text.slice` が文字列の全体をたどるのを避けるためで（002），`Text.slice` の中の 1 か所と同じ回り道を regex に複製した
  - `text_of`（`src/key/notation.emel`，サブプロジェクト 2 の計画の Task 3）: `String.from_code_point(c)` の `None` を `expect`（040）で defect にする．`print` が `Key` の code point を，`string_of`（002）が入力の String から取った code point を渡すので起きない
  - `text_of`（`src/key/encode.emel`、サブプロジェクト 2 の計画の Task 6）: encode は、端末が送る列を String として組み立てて最後に `Bytes.encode_utf8` にかける。`Char` の code point（`Key.key` が scalar value だけを通す）と制御文字の code point を `String.from_code_point(c)` で String にし、起きない `None` をその場の match で defect にした（040）。wish（`wish/encode.emel:71`、`:76`、`:79`）は Int の method の `c.to_utf8()` で、失敗しない形を想定していた（``error[E0313]: type `Int` has no field or function `to_utf8` ``。help は付かない）
  - `character`（`src/utf8.emel`、サブプロジェクト 3 の計画の Task 1）: decoder が作った code point を `String.from_code_point` で 1 文字の String にし、起きない `None` をその場の match で defect にした（040）。`feed` は、その String と U+FFFD の String の List を逆順に作り、最後に `reverse().join("")` でつなぐ
  - `encoded`（`test/utf8_test.emel`、Task 1）: テストの生成器が作った scalar value を `String.from_code_point` で String にし、`Bytes.encode_utf8` で UTF-8 の bytes にする。起きない `None` は `expect`（040）で defect にする
  - `character`（`src/vt/parser.emel`、サブプロジェクト 3 の計画の Task 3）: `advance` が受けた String の code point を、`Print` の文字列（`string_of`、002）と中間の文字（`collect`）にするため `String.from_code_point` で 1 文字の String にし、起きない `None` をその場の match で defect にした（040）。UTF-8 デコーダの `character` と同じ形を、private なのでもう 1 つ書いた
  - `character`（`test/parser_test.emel`、Task 3）: テストが入力を code point の位置で切って String に戻す所（`string_of`、002）と、生成器が U+00A0 までの code point を 1 文字の部品にする所で、起きない `None` を match で defect にする
  `from_code_points` は，wish では `List.all` で確かめてから `String.from_scalars` で組み立てていた．実装は確かめと組み立てを `String.from_code_point` の Option 1 つで済ませたので，そこに残った回り道は Option の List をまとめる関数が無いこと（006）で，ここには数えない
  std も `String.to_ascii_lowercase` と `String.to_ascii_uppercase` で，同じ起きない `None` を `.or("")` で握りつぶしている
- コスト: 補助関数 3 つ（`code_point`，`string_of`，表記の `text_of`．`string_of` は 002 を避けるためでもある）と，起きない分岐 4 つ（25 行ほど）と `expect`（040）の呼び出し 1 つ．普段のコードに基盤レベルは漏れていない
  encode（Task 6）: 補助関数 1 つ（`text_of`、起きない分岐を含めて 6 行）。表記の `text_of` は private で別の module から呼べないので、同じ働きのものをもう 1 つ書いた
  UTF-8 デコーダ（Task 1）: 補助関数 1 つ（`character`、起きない分岐を含めて 6 行）。読めた文字ごとに 1 文字の String を作ってからつなぐ（1,000,000 byte を 4096 byte ずつ読んで 118–165 ms。055 の計測）。テストの生成器にも補助関数 1 つ（`encoded`、3 行）
  VT の parser（Task 3）: 補助関数 1 つ（`character`、起きない分岐を含めて 6 行）。書く文字は code point の List に逆順で持ち、`Print` にする所で 1 文字ずつ String にしてつなぐ。テストにも同じ補助関数 1 つ（6 行）
- spec: `[api.string]`（`from_code_point`），`[target.string]`（「There is no character type」），`[lib.api-rules]`（「A precondition of the caller is broken: it is a defect」）
- 既存: なし（emela の issue と `proposals/` に無い．002 と同じ検索，2026-11-25）
- 行き先: 前提の範囲内で spec に足りない → 002 の proposal の Open questions に足した．単独の proposal にはしない（O(`to - from`) の `slice` が std に入れば，text の 1 か所と regex の `string_of` は消える．残るのはテストの生成器と regex の group の名前の 2 か所で，どちらも String から取ったのではない code point から String を作る）
