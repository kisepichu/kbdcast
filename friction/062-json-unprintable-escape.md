# 062 json-unprintable-escape

- 状態: open
- Emela: v0.28.2
- 意図: cast の writer（`src/cast.emel`、サブプロジェクト 1 の計画の Task 2）で、header の `command` と、イベントの code と data を JSON の文字列にする。asciicast v3 は、`o` と `i` の data を「any non-printable Unicode codepoints encoded as `\uXXXX`」の JSON の文字列にすることを求める。端末の出力には、0x20 未満の制御文字のほかに、DEL（0x7F）と C1 の制御文字（0x80〜0x9F。8 bit の CSI の 0x9B など）も来る
- こう書きたかった:
  `wish/cast.emel:8`、`:17`。`Std.Json` が、印字できない文字をすべて escape する前提で、std の関数を呼ぶだけの形（`Json.String(...)` で包むのは API の形の思い違い。下の診断）
  ```emela
  let cmd = Json.encode(Json.String(command))
  ...
  let line = "[${interval(at_ms - w.last_ms)}, ${Json.encode(Json.String(code))}, ${Json.encode(Json.String(data))}]"
  ```
- 診断:
  wish check（v0.28.2）では、どちらも `let`（004）の行にあり、`Json.String` には届かなかった
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: `Json.encode(Json.String(s))` に ``error[E0212]: module `Std.Json` has no `String` ``。`Json.encode` は `Encode` を持つ値をそのまま受ける（String も持つ）ので、`Json.encode(s)` と書けば済む。これは思い違いを直しただけで、回り道ではない
  escape の形には診断が無い。同じ使い捨ての Pome のテストで、`Json.encode("\u{7f}\u{80}\u{9b}\u{9f}")` が `"\"\u{7f}\u{80}\u{9b}\u{9f}\""`（4 つとも escape されずにそのまま）、`Json.encode("\u{1b}\u{1f}")` が `"\"\\u001b\\u001f\""`（小文字の 16 進）であることを確かめた。v0.28.2 の `std/json.emel:284-298` の `escape_char` は、`"` と `\` と `\n \r \t \b \f` の短い escape のほかは、`p < 32` だけを `\u00XX` にする
- 回避策:
  `Json.encode` が書いた文字列を grapheme cluster に分け（`chars`）、1 つの code point の 0x7F〜0x9F だけを `\u00XX`（小文字の 16 進）に置き換えてつなぎ直す private な `quote` と `escape_unprintable` を書いた（`src/cast.emel`、`FRICTION(062)` の印）。header の `command` も、イベントの code と data も `quote` を通す
  - `Json.encode` の出力に手を入れるのは、その前に escape すると、足した `\` を Json がもう一度 escape するから。Json は 0x7F〜0x9F をそのまま書くので、出力の中のそれらは、元の文字列のそれらと 1 対 1 に対応する
  - 分けるのに `code_points` でなく `chars` を使うのは、code point を String に戻す所（`String.from_code_point` の起きない `None`、003 と 040）を作らないため。DEL と C1 は General_Category が Cc で、UAX #29 の Control なので、GB4 と GB5 によって必ずそれだけで 1 つの grapheme cluster になる（使い捨ての Pome のテストで、`"~\u{7f}\u{80}\u{9f}\u{a0}".chars()` が 5 つに、`"a\u{301}\u{85}e\u{301}".chars()` が `["a\u{301}", "\u{85}", "e\u{301}"]` に分かれることを確かめた）。これは Unicode の版が変わっても変わらない規則だが、grapheme cluster の規則に頼って code point を探すこと自体が遠回り
  - `\u00XX` の 16 進は、Int を 16 進にする関数が無いので、1 byte の Bytes を作って `Bytes.to_hex` にかける private な `hex` で書いた（060。`from_list` の起きない `None` は 040）
  - 0x20 未満の escape の形（短い escape と小文字の 16 進）は v3 と `std/json.emel` で同じなので、Json に任せた
  overlay の合成（`src/overlay.emel:48` の `start`、サブプロジェクト 4 の計画の Task 3）は、出力の header を、入力の header の Dynamic（`with_rows`、085）から `Json.to_string` で書くので、`quote` を通らない。`title` や `command` の DEL と C1 は escape されずにそのまま書かれる（cast の writer は header の `command` も `quote` を通す）。`quote` は `Cast` の private な関数なので、`Overlay` からは呼べない。回避していない所なので、印は付けない
- コスト:
  補助関数 3 つ（`quote`、`escape_unprintable`、`hex`。コメントを含めて 25 行ほど）。`quote` を通す文字列は、Json が code point ごとに 1 文字の String を作ってつなぎ、そのあと `chars` でもう一度 grapheme cluster に分けてつなぐので、2 度たどる。`o` のイベントは PTY の `read` の 1 回ごとに 1 つで、大きくても数 KB なので、今は問題にならない（測っていない）。普段のコードに基盤レベルは漏れていない
  v3 の求める「印字できない文字」は 0x7F と C1 より広い（U+2028、U+2029、U+FEFF、私用領域なども Unicode では印字できない）。kbdcast の spec §5 は、端末の出力に実際に来る 0x7F と C1 だけを足すと決めたので、それより先は書いていない
  overlay の合成の header: 書く所は増えていない。生の DEL と C1 を含んでも JSON としては正しく（RFC 8259 §7 が escape を求めるのは U+0000〜U+001F だけ）、v3 の「印字できない文字は `\uXXXX`」は `o` と `i` の data についての決まりなので、影響はほぼ無い。agg と serde_json は生の C1 を読める（サブプロジェクト 4 の最終レビュー）
- spec: `[api.std.json]`（`to_string` は「A string escapes `"`, `\` and the control characters」。どの範囲を control characters と呼ぶかは書いていない。RFC 8259 §7 の「the control characters (U+0000 through U+001F)」の言い方で、実装もその範囲。Unicode の Cc（0x7F と 0x80〜0x9F も含む）とは読めない）、`[target.string]`、`[target.js.string]`（grapheme cluster は host の `Intl.Segmenter`）、`[api.std.bytes]`（`to_hex`）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「json escape」「Json control」「C1 control」「0x7F」「DEL json」「json to_string string」を検索。当たったのは WebAssembly ターゲットの #251 と playground の #681 で、別の話題）。`Std.Json` を入れた proposal（`proposals/derive-encode-decode-shaped.md`、#503）も、escape の範囲は spec の表と同じ 1 行だけ。checkout の main（596b6038）の `std/json.emel` の `escape_char` も v0.28.2 と同じ
- 行き先:
  1. 自分の誤解に近い所 → 文書の改善（emela の `spec/library/api.md`）。`[api.std.json]` の「the control characters」を「the control characters U+0000 to U+001F」と書けば、0x7F と C1 がそのまま書かれることが読める。未提出。出すのは user
  2. 前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない）。`Std.Json` に、`"` と `\` と 0x20 未満のほかにも escape する文字を選べる書き方（Python の `json.dumps(ensure_ascii=True)`、Go の `encoding/json` が U+2028 と U+2029 を escape するのと同じ種類のもの）。使い道は kbdcast の cast の writer の 1 か所だけなので、今は出さない。未提出。出すのは user
