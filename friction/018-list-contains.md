# 018 list-contains

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel` の `class_escape`）で、`\` の次の code point が、`\` で escape するとそれ自身になる文字（SyntaxCharacter と `/`）の List に入っているかを見る
  key codec の表記（`src/key/notation.emel` の `angle` と `build`、サブプロジェクト 2 の計画の Task 3）でも、`<` の中に書いた修飾（`C-`、`M-` など）の List に、ある修飾が入っているかと、同じ修飾が 2 回入っているか（`<C-C-x>` は error）を見る
- こう書きたかった:
  `wish/syntax.emel:296` の `Some(c) if "^$\\.*+?()[]{}|/".code_points().contains(c) -> (Single(c), advance(s, 2))`
  表記（`wish/notation.emel:122`、`:55`）: `Mods(ctrl: ms.contains(Ctrl), alt: ms.contains(Alt), ...)` と `Some((code, length)) if mods.has_duplicates() => ...`（Rust の itertools の `all_unique` の裏返しのつもり）
- 診断:
  wish check と、repo の外の使い捨ての Pome（v0.28.2、2026-11-25）の両方で ``error[E0313]: type `List[Int]` has no field or function `contains` ``。help は付かない
  表記の wish check（v0.28.2）では、`:122` は `let`（004）の行にあり、`:55` は `let` で束縛されなかった `mods` の ``E0211: cannot find value `mods` in this scope`` の上にあって、どちらも届かなかった。repo の外の使い捨ての Pome での最小の形（`xs.has_duplicates()`、2026-11-27）で ``error[E0313]: type `List[Int]` has no field or function `has_duplicates` ``
- 回避策:
  `IDENTITY_ESCAPES.any(|e| e == c)`（`regex/src/syntax.emel`、`FRICTION(018)` の印。`IDENTITY_ESCAPES` は `"^$\\.*+?()[]{}|/".code_points()` の const）。std の `Std.Http.is_token` も ``"!#$%&'*+-.^_`|~".code_points().any(|t| t == c)`` と同じ形で書く
  表記: 修飾の List を `Std.Set` にし（`held = Set.from_list(written)`）、入っているかを `held.contains(Ctrl)` で、同じ修飾が 2 回あるかを `held.size() < written.length()` で見た（`src/key/notation.emel` の `angle`、`FRICTION(018)` の印。`Modifier` に `derive Eq, Ord` を足した）
- コスト: 1 行のまま、closure が 1 つ増えた。普段のコードに基盤レベルは漏れていない。表記では、4 つの修飾のための Set を作り、`Modifier` に Ord を derive した。重なりを数で見る形（`size() <` `length()`）は、何を確かめているかをコメントで補う必要がある
- spec:
  `[api.list]`（`any`、`find`、`find_index` はあるが、要素が入っているかを見る関数は無い）。`[api.std.map]` と `[api.std.set]` には `contains` があり、`[api.string]` の `contains` は部分の文字列を探す
- 既存:
  emela の issue と PR に無い（2026-11-25 に取得した 864 件を、「List.contains」「contains」で検索。#340 は Std.Map と Std.Set の issue で、List には触れていない）。他の言語: Gleam の `list.contains`、Rust の `slice::contains`、Haskell の `elem`
- 行き先: 前提の範囲内で spec に足りない → 出さない（`any` で素直に書け、コストは closure 1 つ）。String、Map、Set にはあって List だけ無いことの材料として残す。別の所で同じ形が出たら、ここに足して見直す
  表記（Task 3）で 2 か所目が出た。List の `contains` は `any` で、`has_duplicates` は Set の大きさで書けたので、見直しても出さない
