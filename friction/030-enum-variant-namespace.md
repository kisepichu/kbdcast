# 030 enum-variant-namespace

- 状態: open
- Emela: v0.28.2
- 意図: regex の syntax（`regex/src/syntax.emel`、計画の Task 4）の AST で、class の外の `\d` `\w` `\s` とその否定を `Node` の構成子 `Escape(ClassEscape)` として、class の中のものを `ClassItem` の構成子 `Escape(ClassEscape)` として持つ
  VT の解釈（`src/vt/terminal.emel`、サブプロジェクト 3 の計画の Task 5）で、`Vt.Screen` の `Erase` の variant を、enum の名前で修飾して書く（`Erase.ToEndOfScreen`）。同じ module で、`Vt.Screen` の `Intensity` の `Normal`（SGR の 22）と、`Key.Encode` の `CursorKeys` の `Normal`（DECCKM の reset）を両方使う
- こう書きたかった:
  `wish/syntax.emel:27` の `ClassItem` の `Escape(ClassEscape)` と、`wish/syntax.emel:40` の `Node` の `Escape(ClassEscape)`。構成子の名前は enum ごとに分かれていると思っていた（OCaml の型ごとの構成子、Rust の `Node::Escape` と `ClassItem::Escape` のつもり）
  ```emela
  pub enum ClassItem {
    Single(Int)
    Range(Int, Int)
    Escape(ClassEscape)
  }

  pub enum Node {
    Literal(Int)
    Dot
    Escape(ClassEscape)                                     # class の外の \d など
    Class(items: List[ClassItem], negated: Bool)            # [...] と [^...]
    ...
  }
  ```
  VT の解釈（`wish/terminal.emel:93-95`、`:99-101`、`:115`）: `Erase.ToEndOfScreen`、`Erase.NextChars(n)` など 7 か所を、enum の名前で修飾して書いた（Rust の `Erase::NextChars`、Swift の `.nextChars` のつもり）。`Normal` は、wish では `Intensity` の方だけを import して SGR に書き（`:7`）、`CursorKeys` の方は書かなかった
  recorder（`wish/recorder.emel:41-43`、`:53`、`:59`、サブプロジェクト 1 の計画の Task 4）: match の腕のパターンで、`Tape` の `Step` の variant を enum の名前で修飾して書いた（`Step.SetTyping(_, d)`、`Step.Keys(line, keys)` など 5 か所）
  LiveDriver（`wish/live.emel:91`、`:101`、サブプロジェクト 1 の計画の Task 5）: match の腕のパターンで、`Pty` の `Output` の variant を enum の名前で修飾して書いた（`Output.Data(bytes)`、`Output.Exited(code)`）
  cli の main（`wish/main.emel:56`、`:58`、`:60-61`、サブプロジェクト 1 の計画の Task 6）: match の腕のパターンで、`Recorder` の `Reason` の variant を enum の名前で修飾して書いた（`Reason.CannotSend(...)`、`Reason.Exited(code)`、`Reason.TimedOut(...)`）。同じ module で `Key.Encode` の `Reason` の variant（`NeedsOtherKeys`、`NeedsKitty`）も使う
- 診断:
  wish check（v0.28.2）の診断の節（`wish/syntax.emel:5131-5141`）: ``error[E0213]: `Escape` is defined more than once``。`:40` を指し、`:27` に「`Escape` is first defined here」の label が付く。help も note も付かない
  repo の外の使い捨ての Pome での最小の形（`enum Item { Single(Int) Escape(Int) }` と `enum Node { Escape(Int) Dot }`、2026-11-26）でも同じ 1 つで、2 つの enum の構成子が 1 つの名前空間にあることは言わない
  VT の解釈の wish check（v0.28.2）では、7 か所とも char literal（013）で崩れた CSI の腕の中にあり、届かなかった。repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-27）: import した enum の `Erase.NextChars(1)` と `Erase.WholeLine` は、`Erase` を指す ``error[E0217]: expected module or trait, found enum `Erase` `` が 1 つずつ。2 つの module から `Normal` を import すると、2 つ目を指す ``error[E0213]: `Normal` is defined more than once``（1 つ目に「`Normal` is first defined here」の label）。どちらも help は付かない
  recorder の wish check（v0.28.2）では、5 か所とも前置の match（E0142）の `=>` の腕の中にあり、届かなかった。repo の外の使い捨ての Pome での最小の形（v0.28.2、2026-11-28、`pub enum Step { Keys(Int) Sleep(Int) }` の match の腕 `Step.Keys(n) -> n` と `Step.Sleep(n) -> n`）: 腕ごとに、`Step` を指す ``error[E0217]: expected module or trait, found enum `Step` ``、続けて 2 つ目の腕に ``warning[W0301]: unreachable match arm``（パターンが読めなかった後追い）。help は付かない
  LiveDriver の wish check（v0.28.2）では、wish の時にはまだ pty の Pome に依存していなかった（計画の Step 2 で足す）ので、2 か所とも ``E0211: cannot find module or trait `Output` in this scope`` になり、この論点の E0217 には届かなかった
  cli の main の wish check（v0.28.2）では、wish の時にはまだ cli の Pome が無く、wish check の仮の `Pome.toml` は root に依存しないので、`Kbdcast.Recorder` が ``E0205: undefined module`` になり、4 か所とも ``E0211: cannot find module or trait `Reason` in this scope`` になった。この論点の E0217 には届かなかった
- 回避策: `Node` から `Escape` を除き、class の外の class escape を 1 つの item の `Class` にした（`regex/src/syntax.emel:49-67` の `Node`、`:399-402` の `atom_escape` の `Class(items: [item], negated: False)`）。`\d` は `[\d]` と同じ CharacterSetMatcher なので意味は変わらず、Task 5 と Task 6 が扱う節の種類が 1 つ減った。構成子の名前を変えるのでなく AST の形を変えたが、正しい書き方に直しただけなので、コードに印は付けない（026、029 と同じ）。Task 4 の実装の報告には書いたが、そのときはメモにしなかった（最終レビューの指摘で足した）
  VT の解釈: `Erase` の 7 つの variant を `import Vt.Screen.{..., NextChars, ToEndOfScreen, ...}` で 1 つずつ import して、修飾せずに書いた。`CursorKeys` の `Normal` は import せず、module の名前で `Encode.Normal` と書いた（`[module.resolution]` の「In the `import A.B.{x}` form, B is also brought into scope as a module」と、`[grammar.type]` の `type_ref = [ module_path "." ] type_name`）。正しい書き方に直しただけなので、コードに印は付けない
  recorder（`src/recorder.emel`）: `import Tape.{Tape, Step, Keys, Sleep, Wait, SetTyping, SetTimeout}` で variant を 1 つずつ import して、修飾せずに書いた。正しい書き方に直しただけなので、コードに印は付けない
  LiveDriver（`src/recorder/live.emel`）: `Recorder` からは `Exited` を import しない（`ProcessExited` だけを使う）ので、`import Pty.{Pty, Output, Data, Exited}` で variant を import して、修飾せずに書いた。test（`test/live_test.emel`）は `Recorder` の `Exited` だけを import し、`Pty` の `Exited` は `test/fake_pty.emel` の中だけで使う。正しい書き方に直しただけなので、コードに印は付けない
  cli の main（`cli/src/main.emel` の `describe`）: `import Kbdcast.Recorder.{RecordError, Reason, CannotSend, Exited, TimedOut}` で variant を import して、修飾せずに書いた。`Key.Encode` の `Reason` は型の名前が `Recorder` の `Reason` とぶつかる（E0213）ので import せず、`import Kbdcast.Key.Encode` で module を入れて、引数の型を `Encode.Reason` と書いた（`unsendable`。VT の解釈の `Encode.Normal` と同じ形）。variant の `NeedsOtherKeys`、`NeedsKitty`、`One`、`Two` はぶつからないので import した。正しい書き方に直しただけなので、コードに印は付けない
- コスト:
  コードのコストは無い。E0213 は 2 つの定義を指すので、どれとどれがぶつかったかは分かるが、なぜぶつかるのか（構成子の名前空間はモジュールに 1 つで、別の enum の構成子どうしも重なる）は `[module.resolution]` を引く必要があった
  読みやすさのコスト（Task 6 のレビューの T6-5）: 構成子の名前空間はモジュールの名前とは別なので、`regex/src/program.emel:26` は `Syntax` から構成子の `Class` を import し、同じファイルでモジュールの `Class`（`regex/src/class.emel`）も使う。`:109` の `Class.single(...)`（モジュールの関数）と `:114` の `Class(items:, negated:)`（構成子のパターン）が数行の中に並び、読む人が二度見する。構成子を enum の名前で修飾して書ければ（`Node.Class(...)`）、どちらも起きない
  VT の解釈では、import の列に `Erase` の variant が 7 つ並ぶ。`Normal` は 1 か所だけ `Encode.Normal` と書き、ほかの `Normal`（SGR の 21、22）は `Intensity` のもの。同じ名前の 2 つの variant のどちらかは、import の列を見て確かめる。enum の名前で修飾できれば（`Erase.NextChars`、`CursorKeys.Normal`）、import の列も読み分けも要らない
- spec: `[module.resolution]`（「Two enums in the same module that have variants with the same name are duplicates」。名前空間の表で enum variants は Constructors にあり、モジュールの名前とは別）、`[data.enum]`（「Variants are not types; they are constructors that make values of the parent type」）、`spec/diagnostics.md` の E0213（例は ``duplicate definition of `User` ``）
- 既存: emela の issue と PR に無い（2026-11-26、`gh api search/issues` で `is:issue` と `is:pull-request` のそれぞれを「"defined more than once"」「E0213」「variant namespace」「duplicate constructor」で検索。当たったのは PR #848（`with` の項目）と #348（trait と impl の型検査）の E0213 と、依存の更新や最適化の PR で、別の話題）
- 行き先: 自分の誤解だった → 診断の改善（emela の `spec/diagnostics.md`）。下書き（未提出。出すのは user）: when E0213 is reported for two enum variants with the same name in different enums, it should add a note such as ``= note: the variants of every enum in a module share one constructor namespace ([module.resolution])`` and ``= help: rename one of the variants, or move one of the enums to its own module``. Today it says only ``error[E0213]: `Escape` is defined more than once``, with labels on both variants and nothing that says why two different enums collide
