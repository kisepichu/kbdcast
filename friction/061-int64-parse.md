# 061 int64-parse

- 状態: open
- Emela: v0.28.2
- 意図: tape のパーサ（`src/tape.emel` の `duration`、サブプロジェクト 1 の計画の Task 1）で、`sleep 1500ms` や `set timeout 3s` の数字の列を読み、`Std.Duration` にする。Duration の中身は Int64 のミリ秒で、構成子の `milliseconds` と `seconds` は Int64 を受ける
- こう書きたかった:
  `wish/tape.emel:115-116`。数字の列を Int にし、そのまま Duration の構成子に渡す（Int と Int64 の違いを考えていなかった。名前の `ms` と `s` の誤りは 016）
  ```emela
  "${n:digits}ms" -> Duration.ms(Int.parse(n)!)
  "${n:digits}s" -> Duration.s(Int.parse(n)!)
  ```
  Int64 で読むなら `Int64.parse(digits)` と書きたい（`[api.int]` の `parse` と同じ形）
- 診断:
  wish check（v0.28.2）は `Duration.ms` と `Duration.s` の ``error[E0212]: module `Std.Duration` has no `ms` ``（と `s`）で止まり、型の違いには届かなかった
  実装を一時的に `Int64.parse(digits) escape { ParseError(_) -> ... }` に書き換えた `emela check`（v0.28.2、2026-11-27）: ``error[E0212]: module `Int64` has no `parse` `` と、その escape の腕に ``warning[W0302]: error `ParseError` is never raised here``。help は付かない
- 回避策:
  `Int.parse` で Int として読み、`Int64.from_int` で広げてから `Duration.milliseconds` と `Duration.seconds` に渡した（`src/tape.emel` の `count`、`FRICTION(061)` の印）。数字だけの列であることは先に確かめるので、`Int.parse` が失敗するのは Int の範囲を超えたときだけで、それは `invalid duration: <text>` の TapeError にした
- コスト:
  変換の呼び出し 1 つ。読める長さが Int の上限（2147483647）で切られる: `sleep 2147483648ms`（約 24.8 日）は Duration には入るのに `invalid duration` になる。デモの tape では困らない。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.int]`（`parse` は Int だけ）、`[api.int64]`（`from_int` と `to_string` はあるが `parse` は無い）、`[api.std.duration]`（v0.28.2 の構成子は Int64 を受け、文字列から読む関数は無い）
- 既存:
  emela の issue と PR に `Int64.parse` を足すものは無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Int64.parse」「Int64 parse」を検索。当たったのは `Int.parse` と `Float.parse` を足した #191、Instant と Duration を文字列から読む #730、#737、#801、#846 など）。checkout の main（596b6038）の `[api.int64]` にも `parse` は無い
  Duration の側は、v0.29.0 で `Duration.parse` が入った（proposal #737、実装 #846、release #797）。tape の `<整数>ms` と `<整数>s` の形を確かめてから `Duration.parse(text)` に渡せば、Int64 を経ずに Int64 の範囲まで読める
- 行き先:
  版を上げれば Duration の所は解消する（v0.29.0 の `Duration.parse`。上げたらこのメモを見直す）。`Int64.parse` が無いこと自体は、前提の範囲内で spec に足りない → proposal の材料（まだ書かない）。使い道は、10 進の数字の列から Int の範囲を超える数（ミリ秒の時刻や長さ、bytes の大きさ）を読む所。未提出。出すのは user
