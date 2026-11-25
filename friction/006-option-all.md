# 006 option-all

- 状態: open
- Emela: v0.28.2
- 意図: `Text.from_code_points` で、code point ごとの `String.from_code_point` の結果（`Option[String]`）をまとめ、1 つでも `None` なら `None`、全部 `Some` なら中身の List にする
- こう書きたかった:
  wish（`wish/text.emel:20-24`）は `List.all(cps, is_scalar_value)` で確かめてから `String.from_scalars(cps)` で組み立てる形で、組み立ての側は 003 の論点。確かめと組み立てを `String.from_code_point` 1 つで済ませるなら、`List[Option[A]]` を `Option[List[A]]` にする関数があれば次のように書ける（名前は Gleam に合わせた仮のもの。wish には無い）
  ```emela
  Option.all(cps.map(String.from_code_point)).map(|parts| parts.join(""))
  ```
- 診断:
  repo の外の使い捨ての Pome で `Option.all(cps.map(String.from_code_point))` を `emela check` した結果（v0.28.2、2026-11-25）: ``error[E0212]: module `Option` has no `all` ``
- 回避策:
  `parts = cps.filter_map(String.from_code_point)` で `None` を落とし、`parts.length() == cps.length()` で落ちたものがあったかを見る（`text/src/lib.emel` の `from_code_points`、`FRICTION(006)` の印）。`List.fold` で `Option[List[String]]` を積んでいく形でも書けるが、`and_then` と `map` が入れ子になって長い
- コスト: 2 行。List の長さを 2 回数える（どちらも O(n)）。最初の `None` で止まらず最後まで回る。普段のコードに基盤レベルは漏れていない
- spec:
  `[api.option]`（`map`、`and_then`、`or`、`is_some`、`is_none`、`or_fail` だけ）、`[api.list]`（`filter_map` は `None` を落とす）、`[intro.premises]`（高カインド型が無いので Haskell の `sequence` のような一般の形は書けないが、Option に限った関数なら前提の範囲内）
- 既存:
  emela の issue に無い（「traverse」「Option List collect」で検索、2026-11-25）。`proposals/` と `spec/open-questions.md` にも無い。他の言語: Gleam の `option.all(list: List(Option(a))) -> Option(List(a))`、Rust の `Iterator::collect::<Option<Vec<_>>>()`
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。使う所は text の 1 か所だけ。regex で同じ形が出たらここに足す）。未提出。出すのは user
