# 055 bytes-fold

- 状態: open
- Emela: v0.28.2
- 意図: ストリーム用の UTF-8 デコーダ（`src/utf8.emel` の `feed`、サブプロジェクト 3 の計画の Task 1）で、PTY から来た 1 つの chunk の bytes を前から 1 byte ずつ、WHATWG の UTF-8 decoder の状態（`Decoder`）と作った文字列の List を持って畳み込む
- こう書きたかった:
  `wish/utf8.emel:75`。Bytes の上の `fold`（Rust の `bytes.iter().fold(...)`、`List.fold` と `Array.fold` と同じ形のつもり）
  ```emela
  let (next, out) = b.fold((d, []), push)
  ```
- 診断:
  wish check（v0.28.2）では、同じ行の `let`（004）の E0118 と E0122 で崩れ、`fold` には届かなかった
  repo の外の使い捨ての Pome での最小の形（`b.fold(0, |acc, x| acc + x)`、`b` は Bytes、2026-11-27）: ``error[E0313]: type `Bytes` has no field or function `fold` ``。help は付かない
- 回避策:
  private な `read(b, at, d, strings)` を書いた。`b.get(at)` が `Some(byte)` なら 1 byte の step を進めて `at + 1` で自分を末尾呼び出しし、`None`（終わり）で止まる（`src/utf8.emel` の `read`、`FRICTION(055)` の印）。std の `decode_utf8` の検査（`valid_utf8_from`）と同じ形。WHATWG の「byte を ioQueue に戻す」（続かない byte を、何も持ち越さない状態で読み直す）は、`at` を進めずに呼ぶことで書けた。wish では fold の callback の `push` が自分を呼び直していた
  初めは `b.to_list().fold((d, []), push)` と書いた（1 行で済み、wish に近い）。bytes を一度 List に写すので、位置で歩く形に変えた
- コスト:
  補助関数 1 つ（11 行。wish の `push` を兼ねるので、行数はほぼ同じ）。位置と Bytes を引数で持ち回る
  性能（bun、repo の外の使い捨ての Pome で、`あ` と `a` を混ぜた 1,000,000 byte を 4096 byte ずつ `feed`、`Std.Clock` の前後の差、2026-11-27）: `to_list().fold` の形が 169–224 ms、`get` で歩く形が 118–165 ms（どちらも 3 回）。`to_list` は chunk ごとに要素ごとの Int の List を作る
  普段のコードに基盤レベルは漏れていない
- spec: `[api.std.bytes]`（`to_list`、`get`、`slice` はあるが、`fold`、`each`、`map` は無い）、`[api.list]` と `[api.std.array]`（どちらも `fold` と `each` がある）
- 既存:
  `proposals/bytes.md`（#457、実装は #466）は Bytes の関数（作る、読む、切る、つなぐ、UTF-8、16 進、base64）を入れ、畳み込みには触れていない。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Bytes fold」「Bytes iterate」「Bytes.each」を検索。当たりなし）。052（Bytes の list のパターン）、043（先頭の 1 つの code point）、044（Bytes を探す）と同じく、Bytes を 1 byte ずつ読む所の 1 つ
- 行き先:
  前提の範囲内で std に足りない → proposal の下書きの材料（まだ書かない）。`Bytes.fold(b, from, f)` と `Bytes.each(b, f)`（`Array.fold` と `Array.each` と同じ形。JS では `Uint8Array` の上の loop にでき、List を作らない）。checksum、byte ごとの状態機械（UTF-8、端末の入力と出力の parser）、16 進の書き出し（std の `to_hex` も `to_list` を経由する）が使い道。未提出。出すのは user
