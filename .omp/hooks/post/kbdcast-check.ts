// omp hook: runs tools/check.ts after edits to checked files and before the session stops.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const RELEVANT = /(\.emel|(^|\/)Pome\.toml)$|(^|\/)(friction|wish)\/|tools\/lint\/foundation\.allow$/;
const ADVICE = "tools/check.ts が失敗した。直すか、回り道なら FRICTION(NNN) とメモで記録する。";

export default function kbdcastCheck(pi: ExtensionAPI): void {
  let lastStopReport = "";

  const check = async (cwd: string): Promise<string | undefined> => {
    const result = await pi.exec("mise", ["exec", "--", "bun", "tools/check.ts"], { cwd });
    return result.code === 0 ? undefined : `${result.stdout}${result.stderr}`.trim();
  };

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;
    const input = event.input as { path?: unknown; paths?: unknown };
    const paths = [input.path, ...(Array.isArray(input.paths) ? input.paths : [])].filter((p): p is string => typeof p === "string");
    if (paths.length > 0 && !paths.some((p) => RELEVANT.test(p))) return;
    const report = await check(ctx.cwd);
    if (report !== undefined) return { additionalContext: `${ADVICE}\n${report}` };
  });

  pi.on("session_stop", async (_event, ctx) => {
    const report = await check(ctx.cwd);
    if (report === undefined || report === lastStopReport) {
      lastStopReport = report ?? "";
      return;
    }
    lastStopReport = report;
    return { continue: true, additionalContext: `${ADVICE}\n${report}` };
  });
}
