# 017 option-question

- 状態: open
- Emela: v0.28.2
- 意図: regex の parser（`regex/src/syntax.emel`）で、Option を返す関数の中の途中の Option が `None` なら `None` を返し、`Some` なら中身で続ける。`{n,m}` の数字、`\x` と `\u` の 16 進の桁を読む所
- こう書きたかった:
  `wish/syntax.emel:171`、`:177`（`braces` の `digits(...)?`）、`:325`、`:335`（`hex_digit(peek(s))?`）。Rust の Option への `?`
  ```emela
  let (min, s1) = digits(advance(s, 1), None)?
  ```
- 診断:
  wish check（v0.28.2）: 4 か所の `?` に ``error[E0105]: unrecognized character `?` `` が 1 つずつ（同じ行には `let` の E0118 と E0122 も出た、004）。wish の `?` の E0105 は全部で 18 で、残りの 14 は char literal の `'?'` の中身（013）
  repo の外の使い捨ての Pome での最小の形（`x = digit(a)?`、`y = digit(b)?`、`Some(x * 10 + y)`、2026-11-25）で 8 つ: E0105 が 2、E0122 が 2、`?` を落として読んだ後の E0301（``expected `Option[Int]`, found `Option[Option[Int]]` `` と ``expected `Option[Int]`, found `Int` ``）が 2、E0310（``expected a number (`Int`, `Int64` or `Float`), found `Option[Int]` ``）が 2。どれにも help が付かず、`Option.and_then` も `[error.not]` も示さない
- 回避策:
  - `braces`: 2 つの `?` を、それぞれ `Option.and_then` にした（closure が 2 段の入れ子、`FRICTION(017)` の印）
  - `hex_digits` と `hex_until_brace`: `hex_value(c) match { Some(d) -> 続ける; None -> None }` にした（`FRICTION(017)` の印）。`and_then` の closure の中の呼び出しは自分への末尾呼び出しにならない（`[fn.loop]`）ので、`\u{0000…0041}` のように長さに上限の無い繰り返しには使えない
- コスト:
  行数は wish とほぼ同じ（`None -> None` の腕が 2 つ増えた）。`braces` は closure の入れ子が 2 段になり、後半が右へずれる。上限の無い繰り返しでは `and_then` を選べず、match で書く必要がある。普段のコードに基盤レベルは漏れていない（`Option.or_fail` で error に変えて `escape` で受ける形は、ただの「読めなかった」に error を作ることになるので選ばなかった）
- spec:
  `[error.not]`（「There is no Result type, `?` operator, try / catch, or mapError. Conversion from an Option to a failure is written with an ordinary function such as `Option.or_fail(opt, NotFound(id:))`.」）、`[api.option]`（`and_then`、`or_fail`）、`[fn.loop]`、`spec/diagnostics.md` の E0105
- 既存:
  決まった設計。昔の版には `?` があり、PR #76（「fix: remove non-conformant `?`-on-Option (spec 0011/0042)」）が Option への `?` を外した。そのときの本文は「非 throwing 値への `?` は型検査が `match` / `std.option` を案内して拒否」で、案内があった。v0.28.2 では `?` そのものが字句の誤り E0105 で、案内は無い。emela の issue に `?` を求めるものは無い（2026-11-25 に取得した issue と PR の 864 件を、「`?`」「question mark」で検索。当たったのは #76 と、述語の名前の `?` の proposal #618、#619）
- 行き先:
  自分の誤解だった（既に決まった制限）→ 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: 式のすぐ後ろの `?` が E0105 と E0122 になり、後ろの型の誤りが続く。#76 のときのように案内してほしい: ``= help: Emela has no `?`; use `Option.and_then`, or `Option.or_fail` to fail with an error``。構文の `?` は求めない
