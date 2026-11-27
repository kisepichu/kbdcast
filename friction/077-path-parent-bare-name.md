# 077 path-parent-bare-name

- 状態: open
- Emela: v0.28.2
- 意図: cli の main（`cli/src/main.emel`、サブプロジェクト 1 の計画の Task 6）で、録るプロセスの作業ディレクトリを tape のあるディレクトリにする（recorder の spec §2）。`kbdcast rec examples/shell.tape` なら `examples`、`rec /tmp/a/x.tape` なら `/tmp/a`、`rec x.tape` なら今のディレクトリ
- こう書きたかった:
  `wish/main.emel:38`。tape の path を絶対の path にしてから、そのディレクトリを取る（Python の `os.path.dirname(os.path.abspath(p))`、Node の `path.dirname(path.resolve(p))` のつもり）。絶対の path なら親は必ずあるので、結果を String として受けた
  ```emela
  let dir = Path.parent(Path.absolute(path))
  ```
- 診断:
  wish check（v0.28.2）: `let`（004）の行なので、`let` に E0118、`dir` に E0122 の 2 つ。`Path.absolute` と、`Path.parent` を String として使う所には届かなかった（`dir` を使う `:39` には ``E0211: cannot find value `dir` in this scope``）
  `Std.Path` には `join`、`parent`、`file_name`、`extension` の 4 つしか無く（`[api.std.path]`。v0.28.2 の `crates/emela-core/lib/std/path.emel`）、絶対の path にする関数も今のディレクトリを読む関数も無い（`[lib.layers]`: 「there is no normalization (resolving `..`), conversion to an absolute path, or expansion of `~`」。`Std.Env` は `get` だけ）。`Path.parent` は 1 つの段だけの path（`x.tape`）に `None` を返す
- 回避策:
  `Path.parent` の `None` を `"."` にする `directory(path)` を書いた（`cli/src/main.emel` の `directory`、`FRICTION(077)` の印）。相対の path は、Bun が spawn の `cwd` を kbdcast の今のディレクトリから解くので、絶対の path にしなくてよい。確かめたこと（2026-11-28、tape は `run sh -c 'pwd; sleep 0.2'`）: `/tmp` から `rec kbdcast-pwd/pwd.tape`、どこからでも `rec /tmp/kbdcast-pwd/pwd.tape`、`/tmp/kbdcast-pwd` から `rec pwd.tape` の 3 つとも、`pwd` が `/tmp/kbdcast-pwd` を出した
  `None` は、1 つの段だけの path のほかに `/` と空の path でも返るが、どちらも tape のファイルにはならない（`read_text` が先に IsADirectory か FileNotFound で失敗する）ので、`"."` は「ファイルのあるディレクトリ」として正しい
- コスト: 6 行の補助関数 1 つ。普段のコードに基盤レベルは漏れていない。`None` を既定値で上書きする形なので、読む人は「1 つの段だけの path は今のディレクトリにある」ことを知っている必要がある（コメントに書いた）
- spec: `[api.std.path]`（「`None` for a single segment, `/`, or empty」）、`[lib.layers]`（FileSystem の相対の path は今のディレクトリから解く。絶対の path にする変換は無い）、`[api.std.env]`
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「Path parent」「dirname」「absolute path」を検索。当たったのは依存の更新の PR #734 だけで、別の話題）
- 行き先: 前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。ファイルのあるディレクトリを返す `Path.directory(path) -> String`（1 つの段だけなら `"."`、POSIX の `dirname` と同じ）。`parent` は「その path の親」を返すので、1 つの段に `None` を返すのは正しく、別の関数にする。今のディレクトリと絶対の path は、host に触るので `Std.Path`（value の層）でなく `Std.Env` か `Std.FileSystem` の論点になり、このメモの使い道（作業ディレクトリを渡す）では要らなかった
