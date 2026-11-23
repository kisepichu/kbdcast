// Reads just enough of Emela's lexical structure to tell code from comments and strings.
// It does not report lexical errors: `emela check` does that.

export type Word = { text: string; line: number };
export type Comment = { text: string; line: number };
export type Scan = { words: Word[]; comments: Comment[]; codeLines: Set<number> };

export function scan(source: string): Scan {
  const scanner = new Scanner(source);
  scanner.code(false);
  return { words: scanner.words, comments: scanner.comments, codeLines: scanner.codeLines };
}

class Scanner {
  readonly words: Word[] = [];
  readonly comments: Comment[] = [];
  readonly codeLines = new Set<number>();
  private i = 0;
  private line = 1;

  constructor(private readonly src: string) {}

  // Reads code to the end of the input, or, inside an interpolation, to the `}` that closes it.
  code(inInterpolation: boolean): void {
    let depth = 0;
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\n" || ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }
      if (ch === "#") {
        this.comment();
        continue;
      }
      this.codeLines.add(this.line);
      if (this.src.startsWith('"""', this.i)) {
        this.multilineString();
      } else if (ch === '"') {
        this.string();
      } else if (ch === "{") {
        depth++;
        this.advance();
      } else if (ch === "}") {
        this.advance();
        if (inInterpolation && depth === 0) return;
        depth--;
      } else if (ch === "@" || /[A-Za-z_]/.test(ch)) {
        this.word();
      } else {
        this.advance();
      }
    }
  }

  private peek(): string {
    return this.src[this.i] ?? "";
  }

  private advance(): string {
    const ch = this.src[this.i++] ?? "";
    if (ch === "\n") this.line++;
    return ch;
  }

  private word(): void {
    const line = this.line;
    let text = this.advance();
    while (/[A-Za-z0-9_]/.test(this.peek())) text += this.advance();
    this.words.push({ text, line });
  }

  private comment(): void {
    const line = this.line;
    this.advance();
    let text = "";
    while (this.i < this.src.length && this.peek() !== "\n") text += this.advance();
    this.comments.push({ text: text.replace(/\r$/, ""), line });
  }

  private string(): void {
    this.advance();
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\n") return; // an unterminated string (E0101) ends at the line break
      if (ch === "\\") {
        this.advance();
        this.advance();
      } else if (ch === '"') {
        this.advance();
        return;
      } else if (this.src.startsWith("#{", this.i)) {
        this.i += 2;
        this.code(true);
      } else {
        this.advance();
      }
    }
  }

  private multilineString(): void {
    this.i += 3;
    while (this.i < this.src.length) {
      const ch = this.peek();
      if (ch === "\\") {
        this.advance();
        this.advance();
      } else if (this.src.startsWith('"""', this.i) && this.onlyIndentBefore()) {
        this.i += 3;
        return;
      } else if (this.src.startsWith("#{", this.i)) {
        this.codeLines.add(this.line);
        this.i += 2;
        this.code(true);
      } else {
        if (ch !== "\n" && ch !== " " && ch !== "\t") this.codeLines.add(this.line);
        this.advance();
      }
    }
  }

  // The closing `"""` of a multiline string stands alone on its line, after the indentation.
  private onlyIndentBefore(): boolean {
    let j = this.i - 1;
    while (j >= 0 && (this.src[j] === " " || this.src[j] === "\t")) j--;
    return j < 0 || this.src[j] === "\n";
  }
}
