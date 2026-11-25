# 003 scalar-to-string

- 状態: open
- Emela: v0.28.2
- 意図: scalar value だと分かっている code point（String から取ったもの，scalar value だけを作る生成器のもの）から，失敗しない形で String を作る
- こう書きたかった:
  `wish/text.emel` の `String.from_scalars(cps)`（失敗しない）．`from_code_points` は `if List.all(cps, is_scalar_value) { Some(String.from_scalars(cps)) } else { None }`，`slice` は `cps |> List.drop(start) |> List.take(stop - start) |> String.from_scalars`
- 診断: wish check の `error[E0212]: module String has no from_scalars`
- 回避策:
  3 か所（どれも `FRICTION(003)` の印）
  - `Text.from_code_points`（`text/src/lib.emel`）: `cps.filter_map(String.from_code_point)` で 1 つずつ確かめ，残った数が `cps` の数と同じなら `Some(parts.join(""))` にする．落ちたものがあったかを数で見る
  - `Text.slice`（同じファイル）: `from_code_points(...)` の `None` を `panic` にする．code point は `s` から取ったので起きない
  - `code_point`（`text/test/text_test.emel`）: 生成器は scalar value だけを作るので起きない `None` を `panic` にする補助関数
  std も `String.to_ascii_lowercase` と `String.to_ascii_uppercase` で，同じ起きない `None` を `.or("")` で握りつぶしている
- コスト: 補助関数 1 つと，起きない分岐 2 つ（10 行ほど）．`from_code_points` は List の長さを 2 回数える．普段のコードに基盤レベルは漏れていない
- spec: `[api.string]`（`from_code_point`），`[target.string]`（「There is no character type」），`[lib.api-rules]`（「A precondition of the caller is broken: it is a defect」）
- 既存: なし（emela の issue と `proposals/` に無い．002 と同じ検索，2026-11-25）
- 行き先: 前提の範囲内で spec に足りない → 002 の proposal の Open questions に足した．単独の proposal にはしない（`slice` が std に入れば text の 2 か所は消え，残るのはテストの生成器の 1 か所だけになる）
