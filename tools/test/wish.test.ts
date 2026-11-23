import { expect, test } from "bun:test";
import { readTarget, stripDiagnostics, withDiagnostics } from "../wish";

const BODY = "# wish-target: src/a.emel\nfn f() { 1 }\n";

test("the target is read from the header", () => {
  expect(readTarget(BODY)).toBe("src/a.emel");
  expect(readTarget("fn f() { 1 }\n")).toBeUndefined();
});

test("checking again replaces the diagnostics block instead of adding one", () => {
  const once = withDiagnostics(BODY, "0.28.2", "error[E0205]: x\n\n1 error\n");
  expect(once).toBe(`${BODY}\n# --- wish check (emela 0.28.2) ---\n# error[E0205]: x\n#\n# 1 error\n# --- end wish check ---\n`);
  const twice = withDiagnostics(stripDiagnostics(once), "0.28.2", "");
  expect(twice).toBe(`${BODY}\n# --- wish check (emela 0.28.2) ---\n# (診断なし)\n# --- end wish check ---\n`);
});
