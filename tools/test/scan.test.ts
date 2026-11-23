import { describe, expect, test } from "bun:test";
import { scan } from "../lib/scan";

const words = (src: string) => scan(src).words.map((w) => `${w.line}:${w.text}`);

describe("scan", () => {
  test("keywords in comments and strings are not words", () => {
    expect(words(["# effect in a comment", 'x = "handler in a string"', "fn f() { 1 }"].join("\n"))).toEqual(["2:x", "3:fn", "3:f"]);
  });

  test("code inside an interpolation is read, including nested strings", () => {
    expect(words('x = "a #{ uses("b #{effect}") } c"')).toEqual(["1:x", "1:uses", "1:effect"]);
  });

  test("an escaped quote and an escaped hash stay inside the string", () => {
    expect(words('x = "q\\" \\#{ handler } r"\ny = suspend')).toEqual(["1:x", "2:y", "2:suspend"]);
  });

  test("a multiline string ends only at a line holding just the closing quotes", () => {
    expect(words(['x = """', '  layer """ inside', "  #{trait}", '  """', "impl"].join("\n"))).toEqual(["1:x", "3:trait", "5:impl"]);
  });

  test("a comment inside an interpolation is a comment", () => {
    const result = scan('x = "#{ a # effect\n }"');
    expect(result.words.map((w) => w.text)).toEqual(["x", "a"]);
    expect(result.comments).toEqual([{ text: " effect", line: 1 }]);
  });

  test("annotations are words", () => {
    expect(words('@external(js, "f")\nfn f() -> () uses {}')).toEqual(["1:@external", "1:js", "2:fn", "2:f", "2:uses"]);
  });

  test("code lines exclude blank lines and comment-only lines", () => {
    expect([...scan("# c\n\nx = 1 # d\n").codeLines]).toEqual([3]);
  });
});
