# 076 handler-helper-fn

- 状態: open
- Emela: v0.28.2
- 意図: recorder の handler `LiveDriver`（`src/recorder/live.emel`、サブプロジェクト 1 の計画の Task 5）の 3 つの操作が共有する処理（窓の間 PTY を読む、画面が合うまで読む、読めたものを取り込む、終わっていないか確かめる、イベントを書く）を、handler の中の補助関数にする
- こう書きたかった:
  `wish/live.emel:58-120`。handler の本体に操作と並べて `fn read_window(...)`、`fn wait_screen(...)`、`fn receive(...)`、`fn ensure_running()`、`fn record(...)` を置き、操作から素の名前で呼び、補助関数の中で欄を読み書きする（Kotlin や Java の class の private method のつもり）
  ```emela
  pub handler LiveDriver: Driver ... {
    suspend fn idle(d: Duration) -> () fails ProcessExited {
      ensure_running()
      ...
      read_window(start, d.as_ms())
    }
    ...
    # 窓の残りの間 PTY を読む。
    fn read_window(start: Instant, window: Int) -> () fails ProcessExited { ... }
  ```
- 診断:
  wish check（v0.28.2）は、handler の頭の `uses`（075）で handler の本体を top-level として読んだので、補助関数は top-level の関数として読まれ、handler の中に置いたことへの診断は無い（中の欄の名前に E0211 が出ただけ）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28。`effect Counter { fn tick() -> Int fails Stopped }` の handler の本体に、操作 `tick` と補助 `fn say(text: String) -> () { ... }` を置き、`tick` から `say("tick")` と呼ぶ）: 補助の引数の型に ``error[E0134]: handler operation parameters take their types from the effect``、補助の名前に ``error[E0212]: effect `Counter` has no `say` ``、呼んだ所に ``error[E0211]: cannot find value `say` in this scope`` の 3 つ。どれも、補助関数は handler の外（module の top-level）に置くとは言わない
- 回避策:
  補助関数を module の top-level の private な fn にした（`src/recorder/live.emel` の `running`、`read_window`、`wait_screen`、`receive`、`event`。wish の `ensure_running` と `record` は `running` と `event` にした。`record` は、073 で足した公開の関数の名前）。`self` は見えないが、状態は handler の欄でなく `State[Recording]` にある（073）ので、補助関数もそこから読み書きする。要求（`Async`、`Clock`、`Pty`、`State[Recording]`、`Stdout`）は推論される（`[type.inference]`）が、`src/recorder.emel` の `run_steps` に揃えて `uses` に書いた。正しい書き方に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い。補助関数は handler の外に出るので、どの handler の一部かは名前と置き場所でしか分からない。欄を状態に持つ handler（073 が無くなった後）なら、欄を引数で渡すことになる。`fails` と `uses` は基盤レベルの keyword で、`tools/lint/foundation.allow` の理由に書いた
- spec: `[effect.handler]`（handler の中に書けるのは init、release、操作、inner handler。「implements each operation of the effects after its colon exactly once」）、`[grammar.decl]` の `handler_item`、`[type.inference]`（uses を書かない fn の R は推論する）、`spec/diagnostics.md` の E0134、E0211、E0212
- 既存: 決まった設計（`[grammar.decl]`）。emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「helper function in handler」「handler private function」「E0212 effect has no」を検索。当たりなし）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: in a handler, a `fn` whose name is not an operation of the effect (`fn say(text: String) -> ()` in a handler of `Counter`) gets ``E0212: effect `Counter` has no `say` ``, E0134 on its typed parameters, and E0211 where an operation calls it. One diagnostic on the name with ``help: a handler holds only init, release, operations and inner handlers; a helper is a top-level fn of the module`` would say where it goes
