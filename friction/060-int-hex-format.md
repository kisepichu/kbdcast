# 060 int-hex-format

- 状態: open
- Emela: v0.28.2
- 意図: VT の golden のスナップショットを作るテストの補助（`test/vt_snapshot.emel` の `hex`、サブプロジェクト 3 の計画の Task 5）で、RGB の色の 0〜255 の 3 つの値を、harness（`tools/avt-golden/src/main.rs` の `color`）と同じ 2 桁の小文字の 16 進（`#rrggbb`）に書く
- こう書きたかった:
  テストの補助なので wish は書いていない。harness の Rust は `format!("#{:02x}{:02x}{:02x}", r, g, b)`。Emela でも、Int を幅つきの 16 進にする関数で書きたかった
  ```emela
  Some(Rgb(r, g, b)) -> "\##{r.to_hex(2)}#{g.to_hex(2)}#{b.to_hex(2)}"
  ```
  または、基数を取る `Int.to_string_radix(n, 16)` と、左を埋める `String.pad_start(s, 2, "0")`
- 診断:
  wish を書いていないので、wish check の診断は無い。repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）で、3 つとも見つからない: `n.to_hex(2)` に ``error[E0313]: type `Int` has no field or function `to_hex` ``、`Int.to_string_radix(n, 16)` に ``error[E0212]: module `Int` has no `to_string_radix` ``、`String.pad_start(s, 2, "0")` に ``error[E0212]: module `String` has no `pad_start` ``。help は付かない
- 回避策:
  3 つの値の List を `Bytes.from_list` で Bytes にし、`Bytes.to_hex`（1 byte あたり 2 桁の小文字の 16 進）で String にした（`test/vt_snapshot.emel` の `hex`、`FRICTION(060)` の印）。値は Pen の色なので 0〜255 で、`from_list` の起きない `None` はその場の match で panic にした（040。同じ所の `FRICTION(040)` の印）。Int の書式のために、目的の違う型（byte の列）を 1 度作って捨てる。色の 3 つの値は octet なので Bytes で持つのも筋は通るが、Bytes にするのは `to_hex` を使うためだけ
- コスト:
  補助関数 1 つ（コメントを除いて 6 行）と、起きない `None` の panic の腕（040）。テストの中だけで、性能は問題にならない。Bytes に頼れるのは 0〜255 の値だけで、それより大きい Int（`U+XXXX` の code point など）や、2 桁でない幅には使えない。普段のコードに基盤レベルは漏れていない
  std も同じ所で補助を書いている: `Std.Bytes.to_hex` と `Std.Json` の `write`（制御文字の `\u00XX`）は、1 桁を `String.from_code_point` で作る private な `hex_digit` をそれぞれ持ち、`Std.Instant.to_string` は、`"0"` を前に足す再帰の private な `pad` で 0 埋めする（v0.28.2 の `std/bytes.emel:116-123`、`std/json.emel:295-302`、`std/instant.emel:74-82`）
- spec: `[api.int]`（`to_string` は 10 進だけ。`parse` は 16 進の表記を ParseError にする）、`[api.string]`（左や右を埋める関数が無い）、`[api.std.bytes]`（`to_hex` は Bytes の関数）
- 既存: emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「to_hex」「radix」「hexadecimal」「pad_start」「Int format」「zero pad」「padding」を検索。当たったのは Bytes の proposal の #457 と実装の #466（`to_hex` は Bytes の関数）と、別の話題の依存の更新と最適化の PR）。v0.28.2 の `spec/open-questions.md` の 11 は 16 進の literal（`0x`）を決めたもので、書き出しには触れていない。055 の行き先は、16 進の書き出しを Bytes の fold の使い道に挙げている（std の `to_hex` も `to_list` を経由する）
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`[api.int]` に、Int を 16 進（と、0 で埋める幅）で書く関数（たとえば `Int.to_hex(n: Int, width: Int) -> String`、または基数を取る `to_string_radix` と、String の `pad_start`）。std の中の 3 つの private な補助（`Std.Bytes` と `Std.Json` の `hex_digit`、`Std.Instant` の `pad`）と、kbdcast のテストの補助が使い道。kbdcast の使い道はテストの補助の 1 か所だけなので、今は出さない。未提出。出すのは user
