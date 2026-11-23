import { expect, test } from "bun:test";
import { parseEmelaVersion, pinnedEmelaVersion, stripLoaderWarning } from "../lib/emela";

test("the glibc loader warning is removed and other stderr is kept", () => {
  const stderr =
    "/x/emela: /lib/x86_64-linux-gnu/libc.so.6: weak version `GLIBC_2.39' not found (required by /x/emela)\nerror[E0205]: cannot find module\n";
  expect(stripLoaderWarning(stderr)).toBe("error[E0205]: cannot find module\n");
});

test("the running version and the pinned version are read", () => {
  expect(parseEmelaVersion("emela 0.28.2+9d052d2\n")).toBe("0.28.2");
  expect(pinnedEmelaVersion('[tools]\nbun = "1.4.3"\n"github:emela-lang/emela" = "0.28.2"\n')).toBe("0.28.2");
});
