# 070 escape-arm-binding

- 状態: open
- Emela: v0.28.2
- 意図: recorder の `run_tape`（`src/recorder.emel`、サブプロジェクト 1 の計画の Task 4）で、`Driver.press` が失敗した `Unencodable` を、値のまま `RecordError(line, CannotSend(Unencodable))` に入れる
- こう書きたかった:
  `wish/recorder.emel:48`。escape の腕で error の値そのものを、型を付けた変数に束ねる（Scala の `case e: T =>`、Swift の `catch let e as T`、Kotlin の `catch (e: T)`）
  ```emela
  }) escape {
    e: Unencodable => fail RecordError(line, CannotSend(e))
    ProcessExited(code) => exited(line, code, last)
  }
  ```
  構成子のパターンに名前を付ける形（Rust の `e @ Unencodable { .. }`、Haskell の `e@(Unencodable _ _)`、OCaml と F# の `(Unencodable _ as e)`）でもよい。どれも、束ねた値の型は 1 つの error の型に決まる
- 診断:
  wish check（v0.28.2）は `:36` の前置の match（E0142）の腕の中にあり、届かなかった。実装をこの腕で書いた `emela check`（2026-11-28、`=>` だけ `->` に直した）: `:` を指す ``error[E0110]: expected `->` ``、``error[E0118]: expected expression``、``error[E0122]: expected newline or `}` after match arm`` と、`e` を指す ``error[E0320]: escape arms must match an error constructor or `_` ``。E0320 は何が誤りかを言うが、値を使うには構成子のパターンで欄を取り出して作り直すことは言わない
- 回避策:
  構成子のパターンで欄をすべて取り出し、同じ値を作り直した（`src/recorder.emel` の `run_steps` の `Keys` の腕、`FRICTION(070)` の印）
  ```emela
  Unencodable(key:, reason:) -> fail RecordError(
    line,
    CannotSend(Unencodable(key:, reason:)),
  )
  ```
  test（`test/recorder_test.emel` の `failure`）も、`RecordError` の値でなく `(line, reason)` の組を返す形にした（`test/tape_test.emel` の `failure` と同じ形。test なので印は付けない）
- コスト:
  作り直しの 1 行（fmt で 4 行）。欄をすべて書くので、`Unencodable` に欄が増えれば、この腕は compile error になって直す所が分かる（黙って値を落とすことはない）。作り直した値は元の値と等しい（error の欄は値で、識別に関わらない、`[error.decl]`）。普段のコードに基盤レベルは漏れていない
- spec:
  `[error.escape]`（「The pattern of an arm MUST be an error constructor or the wildcard `_`. A variable cannot be written, because a value of one of several errors has no type (7.1).」）、`[error.decl]`（error の値は、その型のふつうの値として束ね、渡し、データ構造に入れられる）、`[grammar.pattern]`（パターン全体に名前を付ける形が無い）、`spec/diagnostics.md` の E0320
- 既存:
  `proposals/escape-wildcard-arm.md:147` が、error を中身の見えない型の変数に束ねる案（`e -> log(Cause.to_string(e))`）を退けた（「to look at the error, handle it by its constructors」）。構成子で型が 1 つに決まる束ね方には触れていない。emela の issue と PR に無い（2026-11-28、`gh search issues --repo emela-lang/emela --include-prs` で「as pattern」「bind whole」「escape arm」「E0320」を検索。当たったのは `_` の腕の proposal #420 と実装 #509、#512 など）。tape のパーサの wish も、パターンの一部に名前を付ける `as` を書いていた（015 の `['\\', '"' | '\\' as c, ..rest]`）
- 行き先:
  前提の範囲内で spec に足りない → proposal の下書きの材料（まだ書かない。未提出。出すのは user）。構成子のパターン全体に名前を付ける形（`e @ Unencodable(..)` か `Unencodable(..) as e`）を、match と escape の腕に足す案。escape の腕では、束ねた値の型はその構成子の error の型 1 つに決まるので、「a value of one of several errors has no type」に当たらない。それまでの診断の改善の下書き: E0320 に ``help: to use the error itself, take its fields with its constructor and build it again: `Unencodable(key:, reason:) -> ... Unencodable(key:, reason:)` `` を付ける
