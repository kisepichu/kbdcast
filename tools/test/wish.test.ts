import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { checkWish, readTarget, stripDiagnostics, withDiagnostics } from "../wish";

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

test("a wish-target outside the repo is rejected before anything is written", () => {
  const root = mkdtempSync(join(tmpdir(), "kbdcast-wish-test-"));
  // The temp copy is created in tmpdir() too, so `../<name>` from the copy lands at tmpdir()/<name>.
  const probe = `${basename(root)}-escape`;
  const escaped = join(tmpdir(), probe);
  try {
    mkdirSync(join(root, "wish"));
    writeFileSync(join(root, "wish", "escape.emel"), `# wish-target: ../${probe}/a.emel\nfn f() { 1 }\n`);
    expect(() => checkWish(root, "wish/escape.emel")).toThrow(`../${probe}/a.emel が repo の外を指している`);
    expect(existsSync(escaped)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(escaped, { recursive: true, force: true });
  }
});
