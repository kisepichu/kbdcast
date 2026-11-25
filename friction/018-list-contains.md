# 018 list-contains

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel` の `class_escape`）で、`\` の次の code point が、`\` で escape するとそれ自身になる文字（SyntaxCharacter と `/`）の List に入っているかを見る
- こう書きたかった: `wish/syntax.emel:296` の `Some(c) if "^$\\.*+?()[]{}|/".code_points().contains(c) -> (Single(c), advance(s, 2))`
- 診断:
  wish check と、repo の外の使い捨ての Pome（v0.28.2、2026-11-25）の両方で ``error[E0313]: type `List[Int]` has no field or function `contains` ``。help は付かない
- 回避策:
  `IDENTITY_ESCAPES.any(|e| e == c)`（`regex/src/syntax.emel`、`FRICTION(018)` の印。`IDENTITY_ESCAPES` は `"^$\\.*+?()[]{}|/".code_points()` の const）。std の `Std.Http.is_token` も ``"!#$%&'*+-.^_`|~".code_points().any(|t| t == c)`` と同じ形で書く
- コスト: 1 行のまま、closure が 1 つ増えた。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.list]`（`any`、`find`、`find_index` はあるが、要素が入っているかを見る関数は無い）。`[api.std.map]` と `[api.std.set]` には `contains` があり、`[api.string]` の `contains` は部分の文字列を探す
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「List.contains」「contains」で検索。#340 は Std.Map と Std.Set の issue で、List には触れていない）。他の言語: Gleam の `list.contains`、Rust の `slice::contains`、Haskell の `elem`
- 行き先: 前提の範囲内で spec に足りない → 出さない（`any` で素直に書け、コストは closure 1 つ）。String、Map、Set にはあって List だけ無いことの材料として残す。別の所で同じ形が出たら、ここに足して見直す
