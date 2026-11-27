# 012 re-export

- 状態: open
- Emela: v0.28.2
- 意図:
  regex の pattern の構文エラー `RegexSyntax(message: String, offset: Int)` を、使う側が x の `base64` の `Base64Error` と同じく root の module から `import Regex.{RegexSyntax}` で import できるようにする。投げるのは `syntax` モジュールの `parse(pattern: String) -> Ast fails RegexSyntax`（`regex/src/syntax.emel`、計画の Task 4）で、公開 API の `compile`（`regex/src/lib.emel`、Task 6–7）が `parse` を呼ぶ。x の `base64` は 1 つのモジュールなので、宣言と公開が同じ所で済む
- こう書きたかった:
  `wish/syntax.emel:9-11`。`syntax` に宣言し、lib で `pub import` してもう一度公開する
  ```emela
  # regex/src/syntax.emel
  pub error RegexSyntax(message: String, offset: Int)
  # regex/src/lib.emel
  pub import Syntax.{RegexSyntax}
  ```
  VT の公開 API の wish（`wish/vt.emel:14-16`、サブプロジェクト 3 の計画の Task 6）: `feed` が返す `Reply`（`Vt.Terminal` に宣言）と `lines` が返す `Cell`（`Vt.Screen` に宣言）を、root の `Vt` からもう一度公開する。使う側（recorder、`wait`、overlay）が内部のモジュールを知らずに `import Vt.{Terminal, Reply, Cell}` と書けるように
  ```emela
  pub use Vt.Terminal.Reply
  pub use Vt.Screen.Cell
  ```
- 診断:
  repo の外の使い捨ての Pome 2 つ（`cyc` と、それに依存する `cycuser`）で確かめた（v0.28.2、2026-11-25）
  - lib の `pub import Syntax.{RegexSyntax}`: ``error[E0126]: expected declaration``（`import` を指す）。続けて、取り込めなかった名前の ``error[E0211]: cannot find error `RegexSyntax` in this scope`` と ``error[E0211]: cannot find module or trait `Syntax` in this scope``
  - lib の `import Syntax.{RegexSyntax}`（`pub` なし）: lib は通るが、依存する側の `import Cyc.{RegexSyntax}` が ``error[E0212]: module `Cyc` has no `RegexSyntax` ``
  - lib に `pub error RegexSyntax` を宣言し、syntax が `import Lib.{RegexSyntax}`、lib が `import Syntax`（`compile` で `parse` を呼ぶ）: ``error[E0206]: import cycle: Lib → Syntax → Lib``（lib の `import Syntax` を指す）。Task 4 の時点では lib が syntax を import しないので通るが、`compile` を書く Task 6–7 で壊れる
  VT の公開 API の wish check（v0.28.2）: 2 行とも `use` を指す ``error[E0126]: expected declaration``（`use` は予約語で、effect を使う式の keyword）。help は付かない
- 回避策:
  B を選んだ（manager の判断、`.superpowers/sdd/ESCALATION-2-answer.md`）。計画の Interfaces（`import Regex.{RegexSyntax}` と、`Syntax.parse(pattern: String) -> Ast fails RegexSyntax`）をすべて守れるのは B だけだった。`regex/src/syntax.emel` と `regex/src/lib.emel` の両方に同じ形の `pub error RegexSyntax(message: String, offset: Int)` を宣言し、どちらにも `FRICTION(012)` の印を付けた。`compile`（Task 6–7）が `Syntax.parse(pattern) escape { Syntax.RegexSyntax(message:, offset:) -> fail RegexSyntax(message:, offset:) }` で詰め替える（その 3 行にも印を付ける）。`tools/lint/foundation.allow` には、両方のモジュールの `fails` を理由と一緒に登録した
  選ばなかった候補:
  - A. `syntax` にだけ宣言する。使う側は `import Regex.Syntax.{RegexSyntax}` と書く（`Regex` 自体を使うなら `import Regex` も）。回り道のコードは無いが、計画の import の形が変わり、エンジンの内部のモジュールの名前が公開 API に出る。使い捨ての Pome で通ることを確かめた
  - C. `lib` にだけ宣言し、parser も `lib` に置く（`syntax` モジュールを作らない）。計画のモジュールの配置が変わり、lib に parser と公開 API が同居する
  - D. `lib` にだけ宣言し、`parse` は `RegexSyntax` を知らない形にする（`Result` を返す、またはエラーを作る関数を引数で受け取る `parse[E](pattern, error: fn(String, Int) -> E) -> Ast fails E`）。計画の `parse` の型が変わり、詰め替えか引数が回り道になる
  VT の公開 API（`src/vt.emel`、サブプロジェクト 3 の Task 6）は、計画が先に A と同じ形に決めていた（計画の Task 6 の Interfaces: 「Emela に再公開が無いので、`Reply` と `Cell` は使う側が `Vt.Terminal` と `Vt.Screen` から import する」）。`Reply` は `Vt.Terminal` に、`Cell` は `Vt.Screen` に置いたままにし、`Vt` からは公開しない。印は `src/vt.emel` の先頭のコメントの `FRICTION(012)`。`Reply` を `Vt` に宣言すると、`Vt.Terminal.apply` が `Vt` を import し、`Vt` が `Vt.Terminal` を import するので、regex と同じ E0206 の環になる
- コスト:
  再公開が無いので、公開する error を内部のモジュールと共有できない、という実例になった
  - 同じ error の宣言が 2 つ（doc comment と印を合わせて syntax が 5 行、lib が 7 行。lib の doc comment は、offset の単位と `pattern too large` の offset 0 の 2 文が多い）。形を変えるときは 2 か所を揃える必要があり、compiler はずれを教えない（別の名前の型なので、どちらかだけ変えても通る）
  - 詰め替えが印のコメントを含めて 4 行（`regex/src/lib.emel` の `compile`、Task 6 で書いた）。`Syntax.parse(pattern) escape { Syntax.RegexSyntax(message:, offset:) -> fail RegexSyntax(message:, offset:) }`。escape の腕の構成子は `Syntax.RegexSyntax` とモジュール名を付けて書けた（lib の `RegexSyntax` と同じ名前なので、`import Syntax.{RegexSyntax}` はできない、E0213）。2 つの型の欄が同じなので、詰め替えは欄を写すだけで、失敗する場合も情報を落とす場合も無い。性能のコストは無い（失敗したときに 1 つ作り直すだけ）
  - lib は `RegexSyntax` を 2 か所で作る: 詰め替えと、展開した命令列が大きすぎるときの `pattern too large`（offset 0、ESCALATION 3 の判断）。後者は lib の型を直接作るので詰め替えは要らない
  - 2 つは名前で区別される別の型（`[data.type]`）。`Regex.Syntax.parse` を直接呼ぶ人には `Regex.RegexSyntax` ではなく `Regex.Syntax.RegexSyntax` が返り、`import Regex.{RegexSyntax}` の escape の腕では受けられない。regex の Pome の中のテスト（`regex/test/syntax_test.emel`）は `import Syntax.{RegexSyntax}` で syntax の方を受ける
  - Task 4 が判断を待って一度止まった
  - 普段のコードに基盤レベルは漏れていない（`fails` は公開 API の設計として選んだもの）
  - VT の公開 API（Task 6）: 使う側は、`Vt` のほかに `Vt.Terminal`（`Reply` と、match する構成子 `DeviceAttributes`、`Status`、`CursorPosition`）と `Vt.Screen`（`Cell`、`Occupancy` とその構成子、`Pen`、`Color`、`Intensity`）を import する。内部のモジュールの名前が公開 API に出る。型の位置の `Vt.Terminal` は `Vt` の型 `Terminal` を指し、module の `Vt.Terminal`（import すると `Terminal.cursor(...)` と書く）と同じ綴りになる（`test/vt_test.emel` には両方がある）。コードの行と性能のコストは無い
- spec:
  `[module.resolution]`（「Imported names are not re-exported. Other modules can look up only the names that a module defines.」）、`[module.name]`（「A circular reference between modules is a compile error.」、E0206）、`[module.import]`（`as` もまだ無い）、`[module.pome]`（「All modules under a Pome's source root are visible to the depending side.」）、`[error.decl]`、`[data.type]`（nominal）。`spec/history.md:645` は 4.6 の「import and re-export」を Decided としているが、再公開しない理由は書かれていない
- 既存:
  emela の issue に無い（「re-export」「reexport」「import cycle」で検索、2026-11-25）。`spec/open-questions.md` にも無い。proposals では、再公開が無いことを前提の制限として扱っている: `proposals/std-exit.md:162`（enum を再公開できないので、`Std.Fiber` から `Success` と `Failure` を import するコードは移したら壊れる）、`proposals/derive-encode-decode-shaped.md:386`（x/dynamic の `Dynamic` と `Std.Dynamic.Dynamic` は別の型になる）。他の言語: Rust の `pub use`
- 行き先: 既に知られている制限 → 実際の使い道（1 つの Pome の中で、内部のモジュールが投げる error を root から公開する）を添えて issue にする材料。下書き（未提出。出すのは user）:
  Imported names are not re-exported (`[module.resolution]`), and module cycles are E0206. Together they mean that a Pome cannot let its users import, from its root module, an error that one of its internal modules fails with. kbdcast's `regex` Pome has `Syntax.parse(pattern) -> Ast fails RegexSyntax` in `src/syntax.emel`, and its root `src/lib.emel` calls `parse` from `compile`. Users should write `import Regex.{RegexSyntax}`, as they write `import Base64.{Base64Error}` for `emela-lang/x`. Declaring the error in the root makes `Lib → Syntax → Lib` a cycle; declaring it in `Syntax` makes users write `import Regex.Syntax.{RegexSyntax}`. The Pome now declares the same `pub error RegexSyntax(message: String, offset: Int)` twice and converts one into the other in `compile` with a 3-line `escape`. The two are different nominal types, so a caller of `Regex.Syntax.parse` gets one that `import Regex.{RegexSyntax}` cannot handle, and nothing checks that the two declarations stay the same. `proposals/std-exit.md:162` and `proposals/derive-encode-decode-shaped.md:386` meet the same limit in std. Would a re-export of individual names (`pub import Syntax.{RegexSyntax}`, Rust's `pub use`) fit the module system?
