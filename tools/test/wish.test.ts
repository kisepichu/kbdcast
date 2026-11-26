import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { checkWish, pomeDir, provisionalManifest, readTarget, stripDiagnostics, withDiagnostics } from "../wish";

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

test("a wish-target under the root src or test belongs to the root Pome", () => {
  expect(pomeDir("src/recorder.emel")).toBe("");
  expect(pomeDir("test/key_test.emel")).toBe("");
  expect(provisionalManifest("", "0.28.2")).toEqual({
    path: "Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
});

test("a nested wish-target belongs to the directory before the first src or test", () => {
  expect(pomeDir("text/src/lib.emel")).toBe("text");
  expect(pomeDir("regex/test/src/match.emel")).toBe("regex");
  expect(provisionalManifest("text", "0.28.2")).toEqual({
    path: "text/Pome.toml",
    text: '[pome]\nname = "github.com/kisepichu/kbdcast/text"\nversion = "0.1.0"\nemela = "0.28.2"\n',
  });
});

test("a wish-target with neither a src nor a test segment belongs to no Pome", () => {
  expect(pomeDir("notes/a.emel")).toBeUndefined();
});

test("a wish for a new nested Pome is compiled even when the root has a Pome.toml (issue #12)", () => {
  const root = mkdtempSync(join(tmpdir(), "kbdcast-wish-test-"));
  try {
    const miseToml = readFileSync(join(import.meta.dir, "..", "..", "mise.toml"), "utf8");
    writeFileSync(join(root, "mise.toml"), miseToml);
    writeFileSync(join(root, "Pome.toml"), provisionalManifest("", "0.28.2").text);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "lib.emel"), "");
    mkdirSync(join(root, "wish"));
    writeFileSync(join(root, "wish", "pty.emel"), "# wish-target: pty/src/lib.emel\nimport Nope\n");
    expect(checkWish(root, "wish/pty.emel")).toContain("error[E0205]: undefined module `Nope`");
    expect(readFileSync(join(root, "wish", "pty.emel"), "utf8")).toContain(
      "# (Pome.toml は wish check が仮に置いた: pty/Pome.toml)",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a wish-target outside every Pome's src and test is rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "kbdcast-wish-test-"));
  try {
    mkdirSync(join(root, "wish"));
    writeFileSync(join(root, "wish", "notes.emel"), "# wish-target: notes/a.emel\nfn f() { 1 }\n");
    expect(() => checkWish(root, "wish/notes.emel")).toThrow("notes/a.emel が Pome の src/ か test/ の下を指していない");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
