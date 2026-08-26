/**
 * Pure detection logic, deliberately free of the `vscode` module so it can
 * be unit-tested outside the extension host. Callers (status-bar.ts) do the
 * actual file reading and pass the raw content in here.
 */
export function detectMorphzDependency(packageJsonContent: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    return false;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return false;
  }

  const record = parsed as Record<string, unknown>;
  const deps = record.dependencies;
  const devDeps = record.devDependencies;

  return (
    (typeof deps === "object" && deps !== null && "morphz" in deps) ||
    (typeof devDeps === "object" && devDeps !== null && "morphz" in devDeps)
  );
}
