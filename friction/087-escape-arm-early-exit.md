# 087 escape-arm-early-exit

- 状態: open
- Emela: v0.28.2
- 意図: cli の overlay（`cli/src/main.emel` の `overlay`、サブプロジェクト 4 の計画の Task 4）で、cast のファイルを読み、読めなければ理由を stderr に書いて終了コード 1 で終わる。読めたときだけ、その後ろ（`Cast.read`、`Overlay` を通して stdout に書く所）に進む。サブプロジェクト 1 の `rec` も同じ 5 つのファイルの error を受けるので、腕は 2 つの subcommand で 1 つにしたい
- こう書きたかった:
  `wish/main_overlay.emel:24-30`。失敗の腕から、その場で関数を抜ける（Rust の `let text = match … { Err(e) => return … }`、Kotlin の `?: return`、Swift の `guard let … else { return }`。wish は `Process.exit(1)` で抜けた）。`text` は読めたときだけ束ねられ、後ろの処理は失敗の受け方の外にある
  ```emela
  let text = match FileSystem.read_text(path) {
    Ok(t) -> t
    Err(e) -> {
      IO.eprintln("${path}: ${e}")
      Process.exit(1)
    }
  }
  ```
  Emela の形に直すと、腕が `overlay` を抜ける escape
  ```emela
  text = (use FileSystem).read_text(path) escape {
    FileNotFound(..) -> failure("#{path}: no such file")  # ここで overlay を終わりたい
    ...
  }
  ```
  `let`、前置の match、`Ok` と `Err`、`IO`、`${...}`、`Process.exit` の名前は、004、016、033、011、071 に書いた
- 診断:
  wish check（v0.28.2）では、`:24` は `let`（004）で崩れた行で、`:28` の `Process.exit(1)` を含め、この形には届かなかった（`:17` の `Process.exit(2)` の E0212 は 016）
  repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28、上の Emela の形。`fn show(path: String) -> ExitCode` の中で、5 つの腕が `failure(...)` の ExitCode を返す）: 腕ごとに ``error[E0301]: type mismatch: expected `String`, found `ExitCode` `` が 5。help は付かない。腕の値は元の式と同じ型か Never（`fail` か `panic`）でなければならない（`[error.escape]`）ので、腕から関数の値を返す形は無い
- 回避策:
  ファイルを読む所を `reading(path, f)` にし、5 つの腕をそこに置いた（`cli/src/main.emel` の `reading`、`FRICTION(087)` の印）。`reading` は `f((use FileSystem).read_text(path)) escape { FileNotFound(..) -> failure(...) ... }` と書き、読めたときだけ `f` を呼ぶ。`rec` と `overlay` は、読んだ後の残りを `reading(path, |text| { ... })` の closure として渡し、自分の error（`TapeError`、`CastError`）は、その呼び出しに付けた escape で受ける。腕が関数を抜けられないので、関数の残りを closure にして escape の内側に入れる形（継続を渡す形）になった。Task 4 では、`rec` と `overlay` がそれぞれ、読む所から後ろを 1 つの block にした escape に 5 つの腕を持っていた（サブプロジェクト 1 の `rec` の形。016）。Task 4 の review の後の fix（`5a4e655`）で `reading` にまとめた
  決まった設計の道もある: `proposals/exit-code.md`（#567）は、その場で終わる関数を退け、深い所から終わるには error を `main` まで上げて escape で `ExitCode` にする、と書く。ファイルの error は `path` を持つ（`[api.std.file-system]` の `FileNotFound(path)` など）ので、`main` の 1 つの escape が `FileNotFound(path:) -> failure("#{path}: no such file")` と受けられる。使い捨ての Pome で、返り値の型を書かない `fn show(path: String) { text = (use FileSystem).read_text(path) ... }` と、`main` の escape の 5 つの腕の形が診断なしに通り、無いファイルで `/nonexistent/x.cast: no such file` と終了コード 1 になることを確かめた（v0.28.2、2026-11-28）。この形なら継続を渡す形は要らず、`f` の中のファイルの error もその error の `path` で報告される。代わりに `rec` と `overlay` の返り値の型を書かない（E は推論）か、5 つの error を `fails` に書く（cli の `src/` の基盤レベル。規則 3 の登録が要る）。cli の形は変えていない
- コスト:
  `reading` の補助関数 1 つ（コメントを除いて 9 行。腕の 5 行は、どの形でも要る）。`rec` と `overlay` の本体が closure の中に 1 段深くなる。escape は `read_text` だけでなく `f` の全体を覆うので、`f` の中で起きたファイルの error も cast や tape の `path` の文で報告される（今の 2 つの closure はファイルを読まないので起きない。`reading` の doc に書いた）。escape を `read_text` だけにするには、`Some(read_text(path)) escape { ... -> { failure(...); None } }` と Option にしてから match で分け直す往復が要る。普段のコードに基盤レベルは漏れていない
- spec: `[fn.decl]`（「There is no `return`.」）、`[kw.future]`（`return` は将来のための予約語で、構文は無い）、`[error.escape]`（腕の値は元の式と同じ型か Never。腕のパターンは error の構成子か `_` で、いくつかの error の値には型が無いので、腕の組を関数の値として渡す形も無い）、`[api.std.process]`（`ExitCode` は `main` の返り値で選ぶ。その場で終わる関数は無い）、`[dyn.error]`、`spec/history.md` の 2026-11-15（「No function or effect operation that stops the process on the spot is added.」）、`proposals/exit-code.md` の「A function that stops the process on the spot」と「An effect operation `exit(code)` that does not resume」（どちらも退けた。with の release が走らない、`emela test` の runner が止まる、library が `main` の決めることを決める。代わりは error を `main` まで上げること）、`[api.std.file-system]`（ファイルの error は `path` を持つ）
- 既存:
  `proposals/exit-code.md`（#567、merged）は、wish の `Process.exit(code) -> Never` を退けた。関数の途中で返す形（`return`、Rust の `let … else`、Gleam の `use`）の issue と PR は無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「early return」「return keyword」「process exit」「let else」「use syntax callback」「continuation passing」を検索。「early return」で当たった #100 は LSP の codeAction で別の話題）。v0.28.2 の `spec/open-questions.md` にも無い
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない）。`return` は予約語で、前提（`[intro.premises]`）のどれにも反しない。案は、関数の中から値を持って関数を抜ける式（Never の型の `return e`。抜ける途中の with の release は error と同じく走る、`[dyn.error]`）で、escape の腕からも書ける。`Process.exit(code) -> Never` は #567 で理由つきで退けたので、案にしない。Gleam の `use text <- reading(path)` のような糖衣は、入れ子は消すが escape の範囲は狭めない。使う所は cli の 1 か所で、#567 の道（error を `main` まで上げる）でも返り値の型を推論に任せれば書けるので、理由として弱い。ほかの使い道が出たら足す。未提出。出すのは user
