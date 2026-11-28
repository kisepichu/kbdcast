# 085 dynamic-set-path

- 状態: open
- Emela: v0.28.2
- 意図: overlay の合成（`src/overlay.emel` の `with_rows`、サブプロジェクト 4 の計画の Task 3）で、入力の cast の header（`Cast.read` が読んだ `Header.json` の Dynamic）の `term.rows` だけを rows + 1 にし、ほかの欄（`term.type`、`term.theme`、`title`、`command` など）はそのまま `Json.to_string` で書く。overlay の design spec の §9 が「`Std.Json` の Dynamic の読み書き（header の欄を 1 つだけ変える）」として予想していた friction
- こう書きたかった:
  `wish/overlay.emel:25`。Dynamic の中の 1 つの値を path で差し替える（JavaScript の lodash の `_.set(obj, ["term", "rows"], n)`、Python の `json["term"]["rows"] = n`、Rust の serde_json の `value["term"]["rows"] = json!(n)` や `pointer_mut("/term/rows")`、jq の `.term.rows = n`）。Int から Dynamic を作るのは `Dynamic.from_int`
  ```emela
  let json = Dynamic.set(h.json, ["term", "rows"], Dynamic.from_int(h.rows + 1))
  ```
- 診断:
  wish check（v0.28.2）では、`let`（004）の行にあり、届かなかった
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28、`Json.to_string(Dynamic.set(json, ["term", "rows"], Dynamic.from_int(n)))`）: ``error[E0212]: module `Std.Dynamic` has no `set` `` と ``error[E0212]: module `Std.Dynamic` has no `from_int` ``。どちらも help は付かない（Int から Dynamic を作る `Encode.to_dynamic(n)` を示さない。`n.to_dynamic()` は ``error[E0313]: type `Int` has no field or function `to_dynamic` ``）
- 回避策:
  header と、その `term` を、Dynamic の構成子 `Fields` のパターンで Map として開き、`Map.insert` で値を入れて、`Fields` で 2 段とも作り直した（`src/overlay.emel` の `with_rows`、`FRICTION(085)` の印）。値は `Encode.to_dynamic(rows)`。`Cast.read` は header が object で `term.rows` が 1 以上の整数であることを確かめているが、`Header.json` は Dynamic なのでそれを持たず、object でない header と object でない `term` の 2 つの腕が要る。どちらも `Cast.read` を通らずに作った Header（`Header` は opaque でない）でしか起きないので、defect（panic）にした
  ```emela
  fn with_rows(json: Dynamic, rows: Int) -> Dynamic {
    json match {
      Fields(header) -> header.get("term") match {
        Some(Fields(term)) -> Fields(
          header.insert("term", Fields(term.insert("rows", Encode.to_dynamic(rows)))),
        )
        _ -> panic("the header has no term object: #{Json.to_string(json)}")
      }
      _ -> panic("the header is not a JSON object: #{Json.to_string(json)}")
    }
  }
  ```
- コスト: wish の 1 行が、補助関数 1 つ（コメントを除いて 11 行）になった。path の段の数だけ match と `insert` と `Fields` が入れ子になり、起きない形の腕が段ごとに 1 つずつ要る。読む側（`Dynamic.field` を入れ子にした decoder、`Cast.read` の `dimension`）には欠けた欄と型の違いを 1 つの DecodeError にする形があるが、書く側には無い。性能は変わらない（Map の insert が 2 回）。普段のコードに基盤レベルは漏れていない
  下の行き先の `Dynamic.set … fails DecodeError` があっても、起きない形の腕は 1 つ残る（`escape { DecodeError(..) -> panic(...) }`）。元は、`Header.json` が Dynamic（overlay の design spec の §4）で、`Cast.read` が確かめたこと（header と `term` が object であること）を持たないこと。それを持たせるには `Header` を opaque にし、`cols` と `rows` を読む関数を置く（035）ことになる
  `Json.to_string` は key を Map の順に書くので、出力の header では `version` が最後になる（`{"command":…,"term":{…},"version":3}`）。asciinema は `version` を最初に書く。入力の header の欄の順も残らない（wish は欄を 1 つ変えるだけのつもりだった）。agg 1.9.0 はこの header を読める（Task 4 の smoke）
- spec: `[api.std.dynamic]`（Dynamic は enum で、作るのは `object` と `variant`、読むのは `field`、`lookup`、`index` などの decoder。値を差し替える関数は無い）、`[api.std.map]`（`insert`、`update`）、`[api.std.json]`（`to_string` は Map の順、つまり key の順に書く）
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「Dynamic set」「Dynamic update」「Dynamic path」「json update」を検索して当たりなし。「Dynamic」で当たったのは Std.Dynamic を入れた #503 と #585、field の有無の #653 と #657、std の doc comment の #686 などで、別の話題）。`proposals/derive-encode-decode-shaped.md` にも、作った Dynamic の一部を差し替える形は無い（作るのは `Dynamic.object([...])` と `Encode.to_dynamic`）。v0.29.0-33 の checkout（5ad03e79）の `crates/emela-core/lib/std/dynamic.emel` にも無い
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。読む側の `Segment`（`Key(String)`、`Index(Int)`）を使った `Dynamic.set(value, path: List[Segment], new: Dynamic) -> Dynamic fails DecodeError`（path の途中が Fields や Items でなければ、読む側と同じ DecodeError）か、1 段の `Dynamic.with_field(value, name, new)`。変数は不変（`[intro.premises]`）なので、新しい Dynamic を返す形。この 1 か所だけでは理由として弱いので、ほかの使い道が出たら足す。未提出。出すのは user
