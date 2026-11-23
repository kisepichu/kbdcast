import { describe, expect, test } from "bun:test";
import { lintSource, parseAllowlist } from "../lib/lint";

const lines = (src: string) => lintSource("src/a.emel", src).map((p) => p.line);
const USES = "fn g() -> () uses { Log } { () }";

describe("lintSource", () => {
  test("reports a foundation-level keyword in code", () => {
    expect(lines("effect Log {\n  fn log(text: String) -> ()\n}")).toEqual([1]);
  });

  test("tells use (everyday) from uses (foundation)", () => {
    expect(lines(`fn f() {\n  (use Log).log("x")\n}\n${USES}`)).toEqual([4]);
  });

  test("reports @external and @export", () => {
    expect(lines('@external(js, "f")\nfn f() -> ()\n@export\nfn g() { 1 }')).toEqual([1, 3]);
  });

  test("a FRICTION mark on the same line covers it", () => {
    expect(lines(`${USES} # FRICTION(001)`)).toEqual([]);
  });

  test("a FRICTION mark on the comment line above covers it, across blank lines", () => {
    expect(lines(`# FRICTION(002): reason\n\n${USES}`)).toEqual([]);
  });

  test("a FRICTION mark above another code line does not cover it", () => {
    expect(lines(`# FRICTION(002)\nx = 1\n${USES}`)).toEqual([3]);
  });

  test("a mark without three digits does not count", () => {
    expect(lines(`# FRICTION(NNN)\n${USES}`)).toEqual([2]);
  });
});

describe("parseAllowlist", () => {
  const exists = (p: string) => p === "src/driver.emel";

  test("reads entries with their reasons", () => {
    const result = parseAllowlist("# header\n\nsrc/driver.emel  # the domain port of the recorder\n", "tools/lint/foundation.allow", exists);
    expect(result).toEqual({ entries: [{ path: "src/driver.emel", reason: "the domain port of the recorder" }], problems: [] });
  });

  test("rejects an entry without a reason and a path that does not exist", () => {
    const result = parseAllowlist("src/driver.emel\nsrc/gone.emel  # reason\n", "tools/lint/foundation.allow", exists);
    expect(result.entries).toEqual([]);
    expect(result.problems.map((p) => p.line)).toEqual([1, 2]);
  });
});
