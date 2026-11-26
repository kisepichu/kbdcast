# 052 bytes-list-pattern

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）で、1 つの `i` イベントの bytes を前から歩き、先頭の byte の形（`ESC [`、`ESC O`、CR LF など）を match の腕で分ける。同じ bytes を、切り出して `Unknown` にし、UTF-8 として読む（`Bytes.slice`、`Bytes.decode_utf8`）
- こう書きたかった:
  `wish/decode.emel:15-16`。bytes を一度 List にし（`read(b.to_list())`）、List だけを持って歩き、`Unknown` と UTF-8 の所で `Bytes.from_list` で Bytes に戻す（`:57`、`:70`、`:72`、`:74`、`:76`、`:89`、`:91`）。本当に書きたいのは、Bytes そのものへの list のパターン（Erlang と Elixir の binary のパターン `<<27, $[, rest::binary>>` のつもり。`rest` は残りの Bytes）
  ```emela
  b match {
    [0x1B, 0x5B, ..rest] -> csi(rest, alt)
    ...
  }
  ```
- 診断:
  wish check（v0.28.2）: List だけを持つ形なので、表し方そのものには診断は無い（`Bytes.from_list` の所は、import の無い `Bytes` の E0211（011）が出た）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: `b match { [0x1B, 0x5B, ..rest] -> rest  _ -> b }`（`b: Bytes`、返り値も `Bytes`）に、パターンを指す ``error[E0301]: type mismatch: expected `Bytes`, found `List[?0]` ``、`rest` を指す ``error[E0301]: type mismatch: expected `Bytes`, found `List[Int]` ``、次の腕の ``warning[W0301]: unreachable match arm``。help は付かない
- 回避策:
  元の Bytes も持って歩く形にした。`decode` が `b.to_list()` を一度だけ作り、`items`、`item`、`unprefixed`、`csi` は、`b: Bytes` と offset の `at: Int`（`slice`、`decode_utf8`、`find` のため）と、`at` からの bytes の List の `bs: List[Int]`（パターンのため）の 3 つを並べて受ける。`items` は `at + length` と `bs.drop(length)` を並べて進め、`item` は `at + 1` と `bs.tail()` を並べて渡す（`src/key/decode.emel` の `decode`、`FRICTION(052)` の印）
  Task 4 の報告は、wish との差（List だけを持ち `Bytes.from_list` で戻す形から、元の Bytes と List を並べる形へ）を、`Bytes.from_list` の `Option[Bytes]`（ここでは起きない `None`）を避ける設計として、回り道に数えなかった。friction-review で、Bytes に list のパターンが無いことが、同じ bytes を 2 つの形で持つ理由だとして、ここに記録した
- コスト:
  歩く 4 つの関数で、bytes を表す引数が 1 つでなく 3 つになり、「`bs` は `at` からの bytes」という約束を 3 つの関数のコメントに書いた。2 つを揃えて進める所が 2 つ（`items` と `item`）あり、ずれても型の検査は見ない。bytes 全体を一度 List（要素ごとに Int）に写す。普段のコードに基盤レベルは漏れていない
  050（定数の接頭辞のパターン）、043（先頭の 1 つの code point を読む関数が無い）、044（Bytes を探す関数が無い）と同じく、spec §9 が予想した「Bytes を 1 byte ずつ読む」所の 1 つ。List だけで歩くと、UTF-8 として読む所（043）と探す所（044）ごとに `Bytes.from_list` で Bytes に戻すことになる
- spec: `[grammar.pattern]`（list のパターン `"[" pattern { "," pattern } [ "," ".." [ lower_name ] ] "]"` は List の値にだけ当たる）、`[fn.match]`、`[api.std.bytes]`（`to_list`、`from_list` は `Option[Bytes]`、`slice` は O(`to - from`)）
- 既存: `proposals/bytes.md`（#457、実装は #466）は Bytes の関数を足したが、パターンには触れていない。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「Bytes pattern」「byte pattern」「binary pattern」を検索。当たりなし）
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。Bytes に list のパターンを使えるようにする（`b match { [0x1B, 0x5B, ..rest] -> ... }`。要素は Int、`..rest` は残りの Bytes で、O(1) の切り出しにできれば歩く再帰が素直に書ける）。Erlang の binary のパターンにあたる。端末の入力、バイナリのプロトコルの header、UTF-8 の lead byte の分け方などが使い道。050 の定数の接頭辞のパターンと合わせて詰める。未提出。出すのは user
