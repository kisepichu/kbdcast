# 005 int-clamp

- 状態: open
- Emela: v0.28.2
- 意図: `Text.slice` で、`from` と `to` を 0 から `s` の code point の数までに収める
- こう書きたかった: `wish/text.emel:41-42` の `start = Int.clamp(from, 0, len)` と `stop = Int.clamp(to, start, len)`（wish では `let` 付き。004）
- 診断:
  wish check は構文エラー（004）で止まり、`Int.clamp` までは届かなかった。repo の外の使い捨ての Pome で `Int.clamp(n, 0, 10)` を `emela check` した結果（v0.28.2、2026-11-25）: ``error[E0212]: module `Int` has no `clamp` ``（help は付かない）
- 回避策:
  `start = Int.max(from, 0)` と `if to <= start { "" }`（`text/src/lib.emel`、`FRICTION(005)` の印）。上の端は `List.drop` と `List.take` が数を収めるので、clamp も `len` も要らない
- コスト:
  なし。行は増えず、`len`（O(n) の数え上げ）を省けたぶん wish より軽い。`to - start` の wrap（Int は 32 bit で wrap する）を防ぐ条件も、clamp が無いから要るのではない。`stop = Int.max(to, start)` でも防げる（実装は `if to <= start` を選んだ）。普段のコードに基盤レベルは漏れていない
- spec: `[api.int]`（`min` と `max` はあるが `clamp` は無い）、`[api.list]` の `take` と `drop`（「All of them if there are fewer; empty if `n` is not positive」）
- 既存: emela の issue に無い（「clamp」で検索、2026-11-25）。`proposals/` と `spec/open-questions.md` にも無い
- 行き先: 前提の範囲内で spec に足りない → 出さない（このコードではコストが無く、提案の根拠にならない）。clamp が要る所が他で出たら、ここに足して見直す
