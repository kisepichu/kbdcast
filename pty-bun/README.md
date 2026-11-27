# pty-bun

Bun の `Bun.Terminal`（Bun 1.3 から）で疑似端末を開き，その上でプロセスを動かす `Pty`（`github.com/kisepichu/kbdcast/pty`）の handler `BunPty` の Pome．JS ターゲット（`EMELA_JS_HOST=bun`）でだけ動く．

```emela
import Pty.{Data, Exited, Pty}
import PtyBun.{BunPty, SpawnFailed}
import Std.Bytes

fn hello() -> Int fails SpawnFailed {
  with BunPty(["sh", "-c", "read x; echo got:$x"], 80, 24, "/tmp", ["TERM=xterm-256color"]) {
    pty = use Pty
    pty.write(Bytes.encode_utf8("abc\r"))
    pty.read() match {
      Data(b) -> Bytes.size(b)
      Exited(code) -> code
    }
  }
}
```

| 宣言 | 形 | 振る舞い |
|---|---|---|
| `BunPty` | `with BunPty(argv, cols, rows, cwd, env) { … }` | `argv`（`List[String]`）を `cols` × `rows` の端末の上で，作業ディレクトリ `cwd` で起動する．環境変数は呼んだプロセスのものを引き継ぎ，`env`（`NAME=value` の `List[String]`）で上書きする．`with` を出るとき，プロセスが残っていれば SIGTERM を送り，1 秒で終わらなければ SIGKILL を送ってから，端末を閉じる |
| `SpawnFailed` | `error SpawnFailed(message: String)` | プロセスを起動できなかった（コマンドが無いなど）．`with` に入るときに失敗し，本体は走らない．`message` は Bun の伝えた理由 |

- `read` は，端末に届いて貯まった出力を全部返す．打ち切られても（`Fiber.timeout`），貯まった出力は次の `read` に残る
- プロセスが終わり，端末の出力も終わったら `Exited`．背景の子が端末を開いたまま残っていても，プロセスの終了から 100 ms で出力の終わりとみなす
- `Exited` の終了コードは，signal で終わったら 128 + signal の番号

## 使うには

この Pome は `@external`（`src/pty.mjs`）を持つ．使う側の Pome は，依存に足したうえで `[external] allow` にも足す．

```toml
[dependencies]
"github.com/kisepichu/kbdcast/pty" = "v0.1.0"
"github.com/kisepichu/kbdcast/pty-bun" = "v0.1.0"

[external]
allow = ["github.com/kisepichu/kbdcast/pty-bun"]
```

## 仕組み

- Bun は出力を `data` の callback に押し込んでくる．`src/pty.mjs` がそれを貯めておき，`read` が貯まった分をまとめて取る（pull 型）．`read` は `@external suspend fn` で，打ち切られると runtime が `AbortSignal` を abort し，JS の側は貯めた出力を残したまま待つのをやめる
- テストは本物の PTY でプロセスを動かす（`test/bun_pty_test.emel`）
