# 044 bytes-find

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）の spec §7 の 1 で、貼り付けを始める `CSI 200~` の後ろから、終わりの `CSI 201~`（6 byte）を探す
- こう書きたかった:
  `wish/decode.emel:69`。bytes の List を、区切りの List の最初の位置で 2 つに分ける（Rust の `slice::windows` と `position`、Python の `bytes.find`、Go の `bytes.Index`）
  ```emela
  match rest.split_once(PASTE_END) {
    Some((text, more)) -> ...
    None -> ...
  }
  ```
- 診断:
  wish check（v0.28.2）: ``error[E0313]: type `List[Int]` has no field or function `split_once` ``
  repo の外の使い捨ての Pome での最小の形（2026-11-27）: Bytes の `b.index_of(needle)` に ``error[E0313]: type `Bytes` has no field or function `index_of` ``、List の `xs.split_once(sep)` に同じ形の E0313。help は付かない
- 回避策:
  private な `find(b, needle, from)` を書いた。`from` から 1 byte ずつずらし、`b.slice(from, from + needle.size()) == needle` かを、自分への末尾呼び出しで調べる（`src/key/decode.emel` の `find`、`FRICTION(044)` の印）。key codec の spec §9 が予想した「Bytes を 1 byte ずつ読む再帰」は、ここで出た
- コスト:
  補助関数 1 つ（9 行）。offset ごとに 6 byte の Bytes を `slice` で作って比べるので、貼り付けの長さ n に対して 6 byte の Bytes を n 個作る。String には `contains` と `split` があるが、貼り付けの中身は UTF-8 でないこともあり（そのときは `Unknown` にする）、後ろに UTF-8 でない bytes が続くこともあるので、String にしてから探す形は使えない。普段のコードに基盤レベルは漏れていない
- spec: `[api.std.bytes]`（`get`、`slice`、`append`、`concat` だけで、探す関数は無い）、`[api.list]`（`find_index` は要素 1 つの条件だけ）、`[api.string]`（`contains`、`split` は String だけ）、`[fn.loop]`
- 既存:
  `proposals/bytes.md`（#457）は「build, read, slice and join」の関数を入れ、探す関数には触れていない。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Bytes index_of」「Bytes find」を検索。当たりなし）
- 行き先:
  前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない）。`Bytes.index_of(b, needle, from) -> Option[Int]`（Go の `bytes.Index`。JS の `Uint8Array.prototype.indexOf` は 1 byte だけを探す）。String の `contains` と同じく intrinsic にできる。HTTP の multipart の境界、`\r\n` の行の区切りなども同じ形。未提出。出すのは user
