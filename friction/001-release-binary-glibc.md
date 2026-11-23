# 001 release-binary-glibc

- 状態: open
- Emela: v0.28.2
- 意図: mise の `github:emela-lang/emela` で公式のリリースを固定し、そのまま使う
- こう書きたかった: `mise.toml` に `"github:emela-lang/emela" = "0.28.2"` と書くだけで、警告なく動く
- 診断:
  呼ぶたびに stderr に `` /…/emela: /lib/x86_64-linux-gnu/libc.so.6: weak version `GLIBC_2.39' not found (required by /…/emela) `` が出る。Ubuntu 22.04（glibc 2.35）。`check` も `run` も動く。要求しているのは weak シンボルの `pidfd_spawnp` と `pidfd_getpid`（`objdump -T` で確認）
- 回避策: `tools/lib/emela.ts` で、この行を stderr から取り除く（`FRICTION(001)` の印）
- コスト: 道具に filter が 1 つ。手で emela を呼ぶと毎回警告が出る
- spec: なし（README の Install は「Linux (x86_64)」とだけ書き、glibc の要件を書いていない）
- 既存: issue は無い（「GLIBC」「glibc」で検索、2026-11-23）。release は `.github/workflows/release-plz.yml` で `ubuntu-latest` を使って build している
- 行き先: spec と実装のずれ → issue（未提出。出す前に user に確認する）
