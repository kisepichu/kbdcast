export type Problem = {
  kind: "version" | "emela" | "lint" | "allowlist" | "friction";
  path: string;
  line?: number;
  message: string;
  detail?: string;
};

export function formatProblems(problems: Problem[]): string {
  return problems
    .map((p) => {
      const head = `${p.kind} ${p.line === undefined ? p.path : `${p.path}:${p.line}`}: ${p.message}`;
      if (!p.detail?.trim()) return head;
      const body = p.detail
        .trimEnd()
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      return `${head}\n${body}`;
    })
    .join("\n");
}
