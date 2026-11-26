# 035 opaque-field-accessor

- 状態: open
- Emela: v0.28.2
- 意図: key codec の型（`src/key.emel`、サブプロジェクト 2 の計画の Task 2）で、`Key` を正規形だけを持つ opaque な型にし、作るのは `key` だけにする。中身は、ほかのモジュール（表記、encode、decode、テスト）から `code(k)` と `mods(k)` で読む
- こう書きたかった:
  `wish/key.emel:4`、`:25`、`:27`。欄と、それを読む関数に同じ名前を付けた。Kotlin の `class Key private constructor(val code: KeyCode, val mods: Mods)` や Scala の `case class Key private (code: KeyCode, mods: Mods)` のように、作るのだけを制限し、欄は外から読める形のつもり。Emela の opaque は構築、パターン、欄の参照をまとめて隠す（`[module.opaque]` の表）ので、読むための関数を書いた
  ```emela
  pub opaque type Key(code: KeyCode, mods: Mods) deriving (Eq, Show)

  pub fn code(k: Key) -> KeyCode = k.code
  pub fn mods(k: Key) -> Mods = k.mods
  ```
- 診断:
  wish check（v0.28.2）の 42 の診断のうち 2: ``error[E0334]: function `code` has the same name as a field of `Key` ``（`:25`）と、`mods` の同じもの（`:27`）。help は付かない
  repo の外の使い捨ての Pome での最小の形（`pub opaque type Key(code: Int)` と `pub fn code(k: Key) -> Int { k.code }`、2026-11-27）でも同じ 1 つ
- 回避策:
  欄の名前を `key_code` と `key_mods` にした（`src/key.emel` の `Key`、`FRICTION(035)` の印）。読む関数の `code` と `mods` は計画の Interfaces のまま。外からは `Key.code(k)` か `k.code()`（`[type.rules]` の method call）で読む
- コスト:
  読むだけの関数 2 つ（6 行）と、欄の名前の接頭辞。欄は外から見えないので API には出ない。普段のコードに基盤レベルは漏れていない
- spec: `[module.opaque]`、`[data.type]`（「Such a function MUST NOT have the name of a field of that type (E0334)」）、`[type.rules]`（method call の探索の (1) 欄と (2) モジュールの関数）、`proposals/method-call.md:78`、`spec/diagnostics.md` の E0334
- 既存:
  決まった設計。E0334 は method call の proposal（emela PR #454、`proposals/method-call.md:78`）で入った。`x.f(...)` で欄とモジュールの関数の両方が見つからないようにするため。std も同じ所で名前を分けた: `Cause` の private な欄 `raise` の名前を変え、`Request.headers` を `header_values` にした（`proposals/method-call.md:85-87`）。spec の `[module.opaque]` の例も、欄 `value` と読む関数 `to_string` で名前が違う。作るのだけを隠して欄は読める形（private な構築子）は、emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「E0334」「same name as a field」を検索。当たったのは #454、その実装の #467 と、E0334 に触れる別の proposal の #455、#468、#503）
- 行き先: 既に知られている制限（決まった設計） → 使い道を添えた proposal の下書きの材料（まだ書かない）。正規形や検査を通った値を opaque で守ると、中身を読むための関数が欄ごとに要り、欄と同じ名前は付けられない。作るのだけを隠す可視性（構築とパターンだけを定義したモジュールに閉じ、欄の参照は外に開く）があれば、関数も名前の付け替えも要らない。ただし、外のパターンを閉じると網羅性の検査（`[fn.match]` の opaque の例）との関係を詰める必要がある。未提出。出すのは user
