# 042 opaque-constructor-import

- 状態: open
- Emela: v0.28.2
- 意図: key codec の decode（`src/key/decode.emel`、サブプロジェクト 2 の計画の Task 4）で、`Decoded` の構成子 `Key` に、module `Key` の opaque な型 `Key` を持たせる。key codec の spec §7 は、`Key` の record の構成子と `Decoded` の構成子 `Key` が同じ module で重ならないように（030）、`Decoded` を `key.emel` でなく `decode.emel` に置いた
- こう書きたかった:
  `wish/decode.emel:6`、`:9-13`。型を import して素の名前で書く
  ```emela
  import Key.{Key, KeyCode, Mods, NO_MODS, key, f_key}

  pub enum Decoded {
    Key(Key)
    | Paste(String)
    | Unknown(Bytes)
  } derive (Eq, Show)
  ```
- 診断:
  wish check（v0.28.2）: ``error[E0213]: `Key` is defined more than once``。import の `Key` を指し、`Decoded` の `Key(Key)` に「`Key` is first defined here」の label が付く。help も note も付かない
  repo の外の使い捨ての Pome での最小の形（2026-11-27）: module `Thing` の `pub opaque type Thing(n: Int)` を `import Thing.{Thing}` し、同じファイルに `pub enum Wrapped { Thing(Thing)  Other }` を置くと、同じ E0213 の 1 つ。同じ import の後で `Thing(n: 1)` と書くと ``error[E0215]: cannot construct opaque `Thing` outside module `Thing` ``（``= help: `Thing` is opaque: use the functions of module `Thing` to make one``）になるので、import は、外では使えない構成子も名前空間に入れている。`import Thing` だけにして型を `Thing.Thing` と書くと、診断なしに通る
- 回避策:
  型 `Key` を import せず、`Key(Key.Key)` と module で修飾して書いた（`src/key/decode.emel` の `Decoded`、`FRICTION(042)` の印）。同じ module の関数の型も `Key.Key` と書く（`Option[Key.Key]` を返す `csi_key`、`held`、`typed` と、`Key.Key` を返す `pressed`）。`Key.key` と `Key.f_key` は、表記（`src/key/notation.emel`）と同じく module で修飾して呼ぶ
- コスト:
  型を書く 5 か所が `Key.Key` になる。構成子の `Key(k)`、module の関数の `Key.key(...)`、型の `Key.Key` が同じファイルに並び、読む人が二度見する（030 の読みやすさのコストと同じ形）。consumer（overlay、テスト）も、`Decoded` の構成子 `Key` を import するなら、型の `Key` は import できない。普段のコードに基盤レベルは漏れていない
- spec:
  `[module.resolution]`（「Each listed name imports the pub definitions with that name from every namespace that has it (for a type, the type and the constructor).」「Variants and type constructors follow the pub and opaque of their parent type.」「A duplicate in the same namespace is a compile error (E0213).」、名前空間の表）、`[module.opaque]`（opaque な型の構成は、定義した module の中だけ）、`spec/diagnostics.md` の E0213 と E0215
- 既存:
  030（同じ module の 2 つの enum の構成子が重なる）。emela の issue と PR に無い（2026-11-27、`gh search issues --repo emela-lang/emela --include-prs` で「opaque constructor import」「opaque E0213」を検索。当たりなし）
- 行き先:
  spec の読み方が 2 通りある → issue の下書き（未提出。出すのは user）。「Variants and type constructors follow the pub and opaque of their parent type」を「opaque な型の構成子は module の外では pub でない（import されない）」と読めば、実装のずれ。「名前は import され、構成だけが E0215 になる」と読めば、決まった動き。前者なら、opaque な型を import しても構成子は入らず、`Key(Key)` が書ける。後者なら、E0213 に ``= note: importing the opaque type `Key` also imports its constructor, which cannot be used outside module `Key` `` と ``= help: import the module and write the type as `Key.Key` `` を付けてほしい
