# 071 effect-op-by-name

- 状態: open
- Emela: v0.28.2
- 意図: recorder の `run_tape`（`src/recorder.emel`、サブプロジェクト 1 の計画の Task 4）で、domain の port の effect `Driver` の操作（`press`、`idle`、`wait_for`）を呼ぶ
- こう書きたかった:
  `wish/recorder.emel:45-46`、`:54`、`:61`。module の関数と同じく、effect の名前で修飾して呼んだ（Unison の ability の `Driver.press`、Koka の操作を名前で呼ぶ形のつもり）
  LiveDriver の wish（`wish/live.emel:31`、`:42`、`:48`、`:55`、`:60`、`:62`、`:65`、`:75`、`:79`、`:96`、`:119`、サブプロジェクト 1 の計画の Task 5）でも、host の port の effect の操作を名前で呼んだ: `Stdout.write_line(...)`、`Clock.now()`、`Pty.write(...)`、`Pty.read()`
  cli の main の wish（`wish/main.emel:21`、`:24`、`:50`、サブプロジェクト 1 の計画の Task 6）でも、`Std.Process` の effect の操作を名前で呼んだ: `Args.list()`、`Stderr.write_line(...)`。`FileSystem.read_text(path)`（`:31`）も同じ形
  cli の overlay の wish（`wish/main_overlay.emel:24`、サブプロジェクト 4 の計画の Task 4）でも、`import Std.FileSystem`（module だけ）の後に `FileSystem.read_text(path)` と書いた（サブプロジェクト 1 の cli の main の wish と同じ形）
  ```emela
  keys.each(|key| {
    Driver.press(key)
    Driver.idle(typing)
  }) escape { ... }
  ```
- 診断:
  wish check（v0.28.2）は、4 か所とも `:36` の前置の match（E0142）の `=>` の腕の中にあり、届かなかった。実装をこの形で書いた `emela check`（2026-11-28、match と `=>` だけ直した）: 呼び出しごとに、`Driver` を指す ``error[E0217]: expected module or trait, found effect `Driver` `` と ``help: call the operations of an effect through its capability: `(use Driver).op(...)` `` が 4。直し方を言う
  続けて、その呼び出しの escape の腕に ``warning[W0302]: error `ProcessExited` is never raised here`` が 3 と、同じ形の `WaitTimeout` のものが 1。呼び出しが読めなかったので E が空になった後追いで、腕は正しい
  LiveDriver の wish check（v0.28.2）: `:119` の `Stdout.write_line(line)` に、同じ E0217 と help（`(use Stdout).op(...)`）。`Clock.now()` は、届いた `:55` と `:65` の 2 つに ``error[E0212]: module `Std.Clock` has no `now` ``。help は無い。`import Std.Clock.{Clock, Instant}` は module の `Clock` も持ち込む（`[module.resolution]`）ので、effect の `Clock` でなく module の関数を探し、E0217 の help に届かない。effect と同じ名前の module から effect を import する所（`Std.Clock` の `Clock`）では、同じ誤りでも直し方が出ない。`Pty.write` と `Pty.read` は、wish の時にはまだ pty の Pome に依存していなかった（計画の Step 2 で足す）ので ``E0211: cannot find module or trait `Pty` in this scope`` になり、この論点の診断は出なかった。`:31`、`:48`、`:60`、`:75` は、handler の頭（075）か `let`（004）で崩れた行にあり、届かなかった
  cli の main の wish check（v0.28.2）: `Args.list()` と 2 つの `Stderr.write_line(...)` に、同じ E0217 と help（`(use Args).op(...)`、`(use Stderr).op(...)`）。`FileSystem.read_text` は `let`（004）で崩れた行にあり、届かなかった
  cli の overlay の wish check（v0.28.2）: `FileSystem.read_text` は `let`（004）で崩れた行にあり、届かなかった
- 回避策: `run_steps` の始めで `driver = use Driver` と capability を束ね、`driver.press(key)`、`driver.idle(typing)`、`driver.wait_for(...)` と呼んだ（`src/recorder.emel`）。spec の決まった形に直しただけなので、コードに印は付けない
  LiveDriver（`src/recorder/live.emel`）は、`(use Stdout).print_line(...)`、`(use Clock).now()`、`(use Pty).write(...)` と、閉包に渡す所は `pty = use Pty` と束ねて `|| pty.read()` と書いた。印は付けない
  cli の main（`cli/src/main.emel`）は、`(use Args).list()`、`(use Stderr).print_line(...)`、`(use FileSystem).read_text(path)` と書いた。印は付けない
  cli の overlay（`cli/src/main.emel` の `overlay`、サブプロジェクト 4 の Task 4）も、`(use FileSystem).read_text(path)` と `(use Stdout).print_line(line)` と書き、List の `each` には操作を関数の値のまま `lines.each((use Stdout).print_line)` と渡した。印は付けない。`read_text` の呼び出しは、Task 4 の review の後の fix（`5a4e655`）で、`rec` と共有する `reading` の中に移った（`f((use FileSystem).read_text(path))`。087）
- コスト: 束縛の 1 行。普段のコードに基盤レベルは漏れていない（`use` は基盤レベルの keyword ではない）
- spec: `[effect.use]`（「Operations can be called only through a capability value, in the form `log.info(...)`. There is no form that calls them directly by effect name (`Logger.info(...)`).」）、`spec/diagnostics.md` の E0217 と W0302
- 既存: 決まった設計（`[effect.use]`）
- 行き先: 自分の誤解だった。E0217 の help は十分。診断の改善の下書き（未提出。出すのは user）: when a call cannot be resolved (E0217 on `Driver.press(key)`), its E is unknown, so the arms of an `escape` around it should not get ``W0302: error `ProcessExited` is never raised here``; the arms are correct, and the warnings point away from the one error to fix（061 の `Int64.parse` の W0302 と同じ後追い）
  LiveDriver の分（未提出。出すのは user）: after `import Std.Clock.{Clock}`, `Clock` names both the module `Std.Clock` and the effect, and `Clock.now()` gets ``E0212: module `Std.Clock` has no `now` `` without help, while `Stdout.print_line(...)` after `import Std.Process.{Stdout}` gets E0217 with ``help: call the operations of an effect through its capability``. When the module has no such function but an effect of the same name in scope has the operation, E0212 could carry the same help (``(use Clock).now()``)
