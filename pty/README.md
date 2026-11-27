# pty

疑似端末（PTY）の上で動く 1 つのプロセスを表す effect `Pty` の Pome．宣言だけで，ターゲットに依らずに使える．handler はターゲットごとの別の Pome にある（Bun の `Bun.Terminal` で動かす `BunPty` は `github.com/kisepichu/kbdcast/pty-bun`）．

```emela
import Pty.{Data, Exited, Output, Pty}
import Std.Bytes

fn echo_once() -> Output uses { Pty } {
  pty = use Pty
  pty.write(Bytes.encode_utf8("hello\r"))
  pty.read() # Data(...) か Exited(...)
}
```

| 宣言 | 型 | 振る舞い |
|---|---|---|
| `Output` | `enum Output { Data(Bytes), Exited(Int) }` | `read` が返すもの．`Exited` の `Int` はプロセスの終了コードで，signal で終わったら 128 + signal の番号 |
| `read` | `suspend fn read() -> Output` | 届いた出力を全部 `Data` で返す．何も届いていなければ，届くまで待つ．プロセスが終わり，その出力も終わったら `Exited`．`Exited` の前に，届いた出力はすべて `Data` で返す |
| `write` | `fn write(b: Bytes) -> ()` | `b` をプロセスへの入力として端末に書く |

- `read` を打ち切っても（`Fiber.timeout` の割り込み），届いていた出力は失われず，次の `read` が返す
- プロセスの起動と後始末（`with` を出るときにプロセスを止め，端末を閉じる）は handler の init と release が受け持つ
