#!/usr/bin/env bun
// Claude Code hook entry. `post`: after Edit/Write/MultiEdit; `stop`: when Claude is about to end its turn.
// Exit 2 shows stderr to Claude (PostToolUse) or keeps it working (Stop).
import { relative, resolve } from "node:path";
import { ROOT, runCheck } from "../check";
import { formatProblems } from "../lib/report";

const RELEVANT = /(\.emel|(^|\/)Pome\.toml)$|^(friction|wish)\/|^tools\/lint\/foundation\.allow$/;

async function main(): Promise<number> {
  const mode = process.argv[2];
  const input = JSON.parse((await Bun.stdin.text()) || "{}");
  if (mode === "post") {
    const filePath = input?.tool_input?.file_path;
    if (typeof filePath !== "string" || !RELEVANT.test(relative(ROOT, resolve(ROOT, filePath)))) return 0;
  } else if (mode === "stop") {
    if (input?.stop_hook_active === true) return 0;
  } else {
    console.error("usage: bun tools/hooks/claude.ts post|stop");
    return 1;
  }
  const problems = runCheck(ROOT);
  if (problems.length === 0) return 0;
  console.error(`tools/check.ts が失敗した。直すか、回り道なら FRICTION(NNN) とメモで記録する。\n${formatProblems(problems)}`);
  return 2;
}

process.exit(await main());
