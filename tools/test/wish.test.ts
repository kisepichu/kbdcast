import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { checkWish, provisionalManifest, readTarget, stripDiagnostics, withDiagnostics } from "../wish";

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

test("a provisional Pome.toml is reported on the first line of the block", () => {
  expect(withDiagnostics(BODY, "0.28.2", "", "text/Pome.toml")).toBe(
    `${BODY}\n# --- wish check (emela 0.28.2) ---\n# (Pome.toml は wish check が仮に置いた: text/Pome.toml)\n# (診断なし)\n# --- end wish check ---\n`,
  );
});

test("a wish-target under the root src gets a provisional manifest for the root Pome", () => {
  expect(provisionalManifest("src/recorder.emel", "0.28.2")).toEqual({
    path: "Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
});

test("a nested wish-target gets a provisional manifest for the directory before the first src or test", () => {
  expect(provisionalManifest("text/src/lib.emel", "0.28.2")).toEqual({
    path: "text/Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast/text"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
  expect(provisionalManifest("regex/test/src/match.emel", "0.28.2")?.path).toBe("regex/Pome.toml");
});

test("a wish-target with neither a src nor a test segment gets no provisional manifest", () => {
  expect(provisionalManifest("notes/a.emel", "0.28.2")).toBeUndefined();
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
