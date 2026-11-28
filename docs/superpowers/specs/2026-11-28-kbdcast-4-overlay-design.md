# サブプロジェクト 4: overlay

- 日付: 2026-11-28
- 全体設計: `docs/superpowers/specs/2026-11-23-kbdcast-design.md`（§5 の 4、§10）
- 状態: spec

## 1. 目的と範囲

`i` イベントの入った cast を読み、押したキーを画面の下の 1 行に焼き込んだ cast を書く `kbdcast overlay <cast>` を作る。出力を agg 1.9.0 に通すと、キー表示の入った GIF になる。

- cast の reader（asciicast v3）
- キーの帯（最近のキーを vim の表記で並べる）
- 合成（3 の VT の画面とキーの帯を合わせ、変わった行だけを描き直す出力にする）
- cli の `overlay`、agg の版の固定、rec、overlay、agg の E2E の smoke

## 2. 決めたこと

| 論点 | 決定 | 採らなかった案 |
|---|---|---|
| キーを出す場所 | 画面の下に 1 行足す。出力の cast の大きさは cols × (rows + 1) | アプリの画面に箱を重ねる（アプリの内容を隠しうる） |
| 帯の中身 | 最後に押したキーから 1500 ms 以内に押したキーを、押した順に `Key.Notation.print` でつなぐ（`ihello<Esc>:wq<CR>`。tape に書くのと同じ形）。最後のキーから 1500 ms 経ったら消し、次のキーから並べ直す | 回数でまとめる（`<Esc> ×3`。要るまで足さない）、人向けの表記（2 で vim の表記に決めた） |
| キーでないもの | `Paste` は `<Paste>` の 1 つの印。`Unknown` は出さない | 貼り付けた文字を出す（長い） |
| 入りきらないとき | 古い印から 1 つずつ落とし、先頭に `…` を付ける。最後の印 1 つでも入らなければ、その印の右の端を残す | 印の途中で切る（`sc>` のように読めなくなる） |
| 見た目 | 帯の行は、`" " + 中身 + " "` を反転（SGR 7）で左に寄せ、残りは既定の pen の空白。中身が空なら行全体が空白 | 色を付ける（端末の theme に依る） |
| 描き直し方 | 合成した画面（アプリの rows 行と帯の 1 行）を前の時刻のものと行ごとに比べ、変わった行だけを、行の頭への CUP、セルごとの SGR、文字で書く。最後にカーソルを VT の位置に CUP し、表示が変われば DECTCEM を書く | 全画面を毎回書く（cast が大きくなる）、元の出力を通して帯だけを書き足す（アプリのスクロールや余白が帯を壊す） |
| 出力のイベント | `o`（描き直し）。`m` と `x` はそのまま。`i` は落とす | `i` を残す（asciinema-player の keystrokeOverlay が二重に出す） |
| 入力 | asciicast v3 だけ。v2 は `asciinema convert` を勧める error。`r`（大きさの変更）は error（3 の VT が扱わない）。知らないコードと `#` の行は飛ばす | v2 も読む（要るまで足さない） |
| 時刻 | 入力の interval を Float の秒で足し、録画の始まりからのミリ秒（四捨五入）にする。出力は 1 の `Cast.event` で書く | interval をそのまま写す（描き直しの時刻が入力のイベントとずれる） |
| header | 入力の header の `term.rows` だけを rows + 1 にし、ほかの欄（`term.type`、`term.theme`、`title`、`command` など）はそのまま書く | 1 の `Cast.header` で書き直す（theme などが落ちる） |
| agg | `mise.toml` で `"github:asciinema/agg" = { version = "1.9.0", asset_pattern = "agg-x86_64-unknown-linux-musl" }`。glibc 版は GLIBC 2.38 を要り、Ubuntu 22.04（2.35）で動かない（manager が確かめた）。crates.io の `agg` は別の crate | `cargo:` で入れる（名前が違う crate になる） |

## 3. 置き場所

| 場所 | module | 中身 |
|---|---|---|
| `src/cast.emel` | `Cast` | reader を足す |
| `src/overlay/strip.emel` | `Overlay.Strip` | キーの帯 |
| `src/overlay.emel` | `Overlay` | 合成 |
| `cli/src/main.emel` | — | `overlay` を足す |
| `mise.toml` | — | agg を足す |

型と関数の形は wish で決める。以下の節の書き方は、意味を決めるための仮の形である。

## 4. cast の reader

```emela
pub type Header(cols: Int, rows: Int, json: Dynamic)      # json は header の全体
pub enum Event { Output(Int, String) | Input(Int, String) | Marker(Int, String) | Exit(Int, String) }  # Int は録画の始まりからのミリ秒
pub error CastError(line: Int, message: String)
pub fn read(text: String) -> (Header, List[Event]) fails CastError
```

- 1 行目は header。`version` が 3 でなければ error。`term.cols` と `term.rows` は 1 以上の整数。
- 2 行目からはイベント。空の行と `#` で始まる行は飛ばす。イベントは `[interval, code, data]`（interval は 0 以上の数、code と data は文字列）。
- `o`、`i`、`m`、`x` を読む。`r` は error。ほかの code は飛ばす。
- error のメッセージ（英語。行は 1 から）:

  | 場合 | message |
  |---|---|
  | 空（行が 1 つも無い） | `the cast is empty` |
  | 1 行目が JSON の object でない | `the header is not a JSON object` |
  | `version` が 3 でない（v2 など） | `only asciicast v3 is supported (this is version <n>; asciinema convert -f asciicast-v3 can convert it)` |
  | `term.cols`、`term.rows` が無い、または 1 未満 | `the header needs term.cols and term.rows of at least 1` |
  | イベントの形が違う | `an event is [interval, code, data]` |
  | interval が負 | `the interval is negative` |
  | `r` | `resize events are not supported` |
  | 録画の始まりからの時刻が 2147483647 ms（Int の最大）を超える | `the time is too large (more than 2147483647 ms)` |
  | JSON として読めない | `invalid JSON: <Std.Json の message>` |

## 5. キーの帯

```emela
pub const FADE_MS: Int = 1500
pub opaque type Strip
pub fn strip() -> Strip
pub fn press(s: Strip, at_ms: Int, keys: List[Decoded]) -> Strip
pub fn marks(s: Strip, at_ms: Int) -> List[String]         # 見えている印の列。空なら見えていない
pub fn clears_at(s: Strip) -> Option[Int]                  # 印があれば、最後の印の時刻 + FADE_MS（消えた後も返す）
pub fn row(marks: List[String], cols: Int) -> List[Cell]   # 帯の行のセル
```

- 印は、`Key(k)` が `print(k)`、`Paste(_)` が `<Paste>`。`Unknown` は印にしない。印の無い `press` は帯を変えない。
- `press(s, t, keys)`: 最後の印の時刻から 1500 ms 以上経っていれば、帯を空にしてから印を足す。最後の印の時刻を t にする。
- `marks(s, t)`: t が最後の印の時刻 + 1500 以上なら空。`clears_at` は時刻を見ないので、帯が見えているかは合成の側で `t < clears_at` で決める。
- `row(marks, cols)`: 中身は印をつないだもの。`" " + 中身 + " "` の幅（`Vt.Width`）が cols 以下ならそれ。超えるなら、古い印から落として `" …" + 残り + " "` が cols に入るまで続ける。最後の印 1 つでも入らなければ、その印の右の端を `cols - 2` 列ぶん残し `"…" + 端 + " "` にする（cols が 3 より小さければ、入るだけの空白）。その部分を反転の pen、残りを既定の pen の空白にする。全角の文字は 2 列。

## 6. 合成

```emela
pub opaque type Overlay
pub fn start(h: Header) -> (Overlay, String)               # 出力の header の行
pub fn step(o: Overlay, e: Event) -> (Overlay, List[String])
pub fn finish(o: Overlay) -> List[String]
```

- 状態は、`Vt.new(cols, rows)`、帯、出力の `Cast.Writer`、前に書いた合成の画面（初めは cols × (rows + 1) の空白）と、カーソルの見え方。
- `step(o, e)`（e の時刻を t とする）:
  1. 帯が見えていて、消える時刻 c が t 以下なら、まず時刻 c の合成を書く（帯が消えた画面）。
  2. `Output(t, s)`: `Vt.feed`（返事は捨てる）。`Input(t, s)`: `Key.Decode.decode(Bytes.encode_utf8(s))` を帯に `press`。`Marker`、`Exit`: その行をそのまま時刻 t で書く。
  3. 時刻 t の合成を書く。
- 「時刻 t の合成を書く」: 合成の画面（VT の `lines` と、帯の `row(marks(帯, t), cols)`）を前に書いたものと比べ、変わった行があれば、それらを 1 つの `o` イベントにして書く。カーソルの位置（`Vt.cursor_position`。隠れていても読める）と見え方が変わっただけのときも書く。何も変わらなければ書かない。
- 行の書き方: `CSI <行> ; 1 H` の後、セルを左から書く。行の最初のセルと、pen が前のセルと違うセルの前に `CSI 0 m`（既定の pen）か `CSI 0 ; <属性> m` を書く。属性は、強さ（`1` か `2`）、斜体 `3`、下線 `4`、点滅 `5`、反転 `7`、取り消し線 `9`、前景（番号 0〜7 は `30+n`、8〜15 は `90+n-8`、ほかは `38;5;n`、RGB は `38;2;r;g;b`）、背景（同じく `40+n`、`100+n-8`、`48;5;n`、`48;2;r;g;b`）の順。全角の右のセルは書かない。行の終わりで `CSI 0 m`。
- 1 つの `o` イベントの data は、変わった行を上から順に書いたものの後に、カーソルの `CSI <行+1> ; <min(列, cols-1)+1> H` と、見え方が変わったときだけ `CSI ? 25 h` か `CSI ? 25 l`。
- `finish(o)`: 帯が見えていれば、消える時刻の合成を書く。
- 出力の端末に書くのは kbdcast だけなので、行を書けば agg の画面は合成の画面と同じになる。charset、insert mode、余白は既定のまま使わない。

## 7. cli

- `kbdcast overlay <cast>`: cast を読み、`Overlay` を通した行を stdout に書く。
- error は stderr に書き、終了コード 1。`CastError` は `<cast>:<行>: <message>`。
- 使い方は `usage: kbdcast rec <tape> | kbdcast overlay <cast>`、終了コード 2。

## 8. テスト

| 対象 | 手法 |
|---|---|
| reader（固定） | header、イベントの時刻（interval の足し算と四捨五入）、`#` と空の行、知らないコード、§4 の error の表 |
| 帯（固定） | 印の作り方、1500 ms の消え方と並べ直し、`Paste` と `Unknown`、入りきらないときの落とし方と `…`、全角、cols が小さいとき |
| 合成（固定） | 変わらない行は書かない、帯だけが変わったら帯の行だけを書く、消える時刻の合成、`m` と `x` の行、`i` は書かない、カーソルの見え方 |
| 合成（性質） | 3 の `VtGolden.CASES` の入力を `Output` のイベントにし（ランダムに分け、間に `Input` を挟む）、`Overlay` を通した出力の `o` を順に `Vt.new(cols, rows + 1)` に通す。各時刻の後で、上の rows 行が `Vt.new(cols, rows)` に入力を通した画面と同じ、最後の行が帯の `row` と同じ、カーソルが同じ（列は `cols - 1` に丸める） |
| E2E（smoke） | `examples/vim.tape` を rec、overlay、agg に通して GIF を作り、ffmpeg で途中と最後の frame を PNG にして、帯にキーが出ていることを目で確かめる。permanent な test にはしない |

## 9. 検査の仕組みとの関係

- wish-first の単位: reader、strip、overlay、cli の overlay。
- `tools/lint/foundation.allow`: `src/cast.emel`（`read` が `CastError` を宣言する）を足す。overlay は純粋な fold で、登録は要らない見込み。
- 先に予想しておく friction: `Std.Json` の Dynamic の読み書き（header の欄を 1 つだけ変える）、Float の秒からミリ秒、行の比較と SGR の組み立て、#18（セルを 1 つ読む関数）が要るか。
- PR を出す前に、別の session で friction-review skill を走らせる。

## 10. 周辺の変更

- 全体設計 §10 の「配置、表示する時間、まとめ方、描き直す範囲は 4 の spec で決める」を、この spec の決定に置き換える。§15 に決定の記録を足す。この spec と同じ commit で直す。

## 11. 完了条件

- root の `emela test` が通る（固定の例と性質テスト）。
- `mise exec -- bun tools/check.ts --commit --test`、`mise exec -- bun test tools/test`、`mise exec -- prek run --all-files` が通る。
- E2E の smoke で作った GIF の frame の様子（帯に出たキー）が PR にある。
- 予想した friction と、実際に出た friction がメモになっている。
- friction-review の結果が PR 本文にある。

## 12. リスク

- 長い cast では、毎回 `Vt.lines` で画面全体を List にする。測ると 80 × 24 で 1 イベントあたり約 1.1 ms で、同じ cast を agg で GIF にする方が約 6 倍遅い。遅くないので friction にはしない。
- agg の font に全角の文字が無いと、帯の全角が豆腐になる。E2E で見る。
- 手で録った cast（ConPTY と tmux を通った入力、#16）は、user が録った cast が無いと試せない。この PR では扱わない。
