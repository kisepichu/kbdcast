# 079 fn-body-brace-newline

- 状態: open
- Emela: v0.28.2
- 意図: recorder（`src/recorder.emel` の `run_steps`、サブプロジェクト 1 の計画の Task 4）で、1 行に収まらない signature（引数、返り値、`fails`、`uses`）を行に分けて書き、本体の `{` を次の行に置く
- こう書きたかった:
  実装の最初の下書き（wish は 1 行の signature だった）。signature を手で包み、本体の `{` を 1 行に置いた（C#、Java、Swift で見る Allman の形のつもり）
  ```emela
  fn run_steps(steps: List[Step], typing: Duration, timeout: Duration) -> ()
    fails RecordError
    uses { Driver }
  {
    driver = use Driver
    ...
  ```
- 診断:
  Task 4 の hook（`task-4-report.md` の「Hook output」の 5）: `src/recorder.emel:58:4` の関数名に ``error[E0130]: a function without a body must be `@external` `` と、`61:1` の `{` に ``error[E0126]: expected declaration``。下書きの文面は残っていないが、位置は `{` だけの行にしか合わない
  repo の外の使い捨ての Pome での同じ形（`pub fn run_steps(...) -> ()`、`  fails Bad`、`  uses { Counter }`、`{`、`  ()`、`}`。v0.28.2、2026-11-28）: `7:8` の関数名に E0130、`10:1` の `{` に E0126 の 2 つ。help は付かない。`uses { Counter }` の行で宣言が終わり、本体の無い fn になる
- 回避策: signature を 1 行に書き、`emela fmt` に包ませた（`fails` と `uses` をそれぞれの行に置き、本体の `{` は `uses` の行の終わり。`src/recorder.emel` の `run_steps`）。`[lex.continuation]` の決まった形に直しただけなので、コードに印は付けない
- コスト: コードのコストは無い。E0130 の文言は「`@external` を付けよ」と読め、従うと host の関数の宣言にする誤った直し方になる（関数の E0130 の 020、026、072 と同じ）。原因の `{` を指すのは E0126 だけで、`{` を前の行の終わりに移せばよいとは言わない。直すには `[lex.continuation]` を引くか、fmt に任せる必要があった。普段のコードに基盤レベルは漏れていない
- spec: `[lex.continuation]`（規則 4: 次の行が `fails` か `uses` で始まり、その後ろが型の名前か `{` なら前の行に続く。「The body's `{` is written on the last line of the signature.」。`{` で始まる行を続ける規則は無い）、`[fmt.signature]`（「The `{` of the body is attached to the last line of the signature.」）、`[grammar.decl]`（`fn_decl = ... [ signature ] [ block ]`、本体の無い fn_decl は `@external` のときだけ）、`spec/diagnostics.md` の E0130、E0126
- 既存: emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「E0130」「E0126」「brace next line」「body brace newline」「signature line break」「関数 本体 改行」を検索。当たったのは parser と formatter の実装の PR #121、#123、#127、#132、#133、#134、#136 だけ）。行末で宣言や腕が終わる別の形は 078（`->` と `with` の `,` の後の改行）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: when an fn declaration without a body is followed by a line that starts with `{`, E0130 (``a function without a body must be `@external` ``) could add ``help: the body's `{` goes at the end of the signature's last line ([lex.continuation])``, and the E0126 on that `{` should not follow
