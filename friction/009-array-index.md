# 009 array-index

- 状態: open
- Emela: v0.28.2
- 意図: `Fold.canonicalize`（`regex/src/fold.emel`）で、`SOURCES` を 2 分探索して見つけた位置の `TARGETS` の値を読む。`TARGETS` は生成器（`tools/gen-case-folding.ts`）が同じ対の列から作るので `SOURCES` と同じ長さで、その位置は範囲外にならない
- こう書きたかった: `wish/fold.emel:14` の `TARGETS[i]`（同じ行の `=>` と、13 行目の前置の match は別の誤りで、診断のとおりに直した）
  ```emela
  match Array.binary_search(SOURCES, c) {
    Some(i) => TARGETS[i]
    None => c
  }
  ```
- 診断:
  wish check（emela 0.28.2）の 14 行目の診断は `=>` のもの（``error[E0110]: expected `->` `` ほか 2 つ）だけで、`TARGETS[i]` には何も出なかった。`[grammar.expr]` の `postfix` に添字の形は無く、位置で読むのは `Array.get(a, index) -> Option[A]` だけ
- 回避策:
  `TARGET_ARRAY.get(i) match { Some(folded) -> folded; None -> panic(...) }`（`regex/src/fold.emel`、`FRICTION(009)` の印）。`None` は表が壊れたときだけ起きるので、`Option.or(c)` で探索の失敗と混ぜずに defect にした
- コスト:
  起きない分岐 1 つ（3 行）。普段のコードに基盤レベルは漏れていない。std も同じ形を書いている: `Std.Array` の `bisect` と `binary_search`（`crates/emela-core/lib/std/array.emel:154-174`）は、範囲内と分かっている `get(a, mid)` の `None` を `_` の腕に混ぜる。`proposals/array.md:76` の例は `Array.get(counts, b) |> Option.or(0)` で既定値にする
- spec:
  `[api.std.array]`（`get` は範囲外で `None`、`set` は範囲外で defect）、`[lib.api-rules]`（「Not found, or out of range: return an Option」と「A precondition of the caller is broken: it is a defect」）、`proposals/array.md:100`（読み出しの範囲外は not found、書き込みの範囲外は defect）と `:226`（`set` を Option にしなかった理由）、`[grammar.expr]`
- 既存:
  emela の issue に無い（「Array get index」「unchecked」で検索、2026-11-25。#855 は compiler が範囲を誤って証明する bug で、API の話ではない）。`proposals/` と `spec/open-questions.md` にも無い。003（scalar value と分かっている code point の String）と同じく、呼ぶ側が前提を知っているのに Option が返る形
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`set` と同じく範囲外を defect にする読み出し（仮に `Array.at(a, index) -> A`）があれば、wish の形に近く書ける。regex の vm（命令の Array を位置で読む）で同じ形が出たら、ここに足してから下書きにする。未提出。出すのは user
