import { createFSBackedSystem, createVirtualTypeScriptEnvironment } from "@typescript/vfs";
import * as ts from "typescript";
import { resolve } from "node:path";

/**
 * Builds a real `ts.LanguageService` backed by a REAL disk-backed system
 * (`createFSBackedSystem`) rooted at `packages/ts-plugin` — this means
 * `node_modules/morphz` resolves through the actual pnpm workspace symlink
 * (verified: `node_modules/morphz` -> `packages/core`'s built `dist/`), so
 * tests exercise real `morphz` type declarations, not a hand-maintained
 * virtual stub that could drift from the real package's actual shape.
 *
 * Only the TEST's own virtual source file(s) are added as an in-memory
 * overlay on top of the real disk — everything else (node_modules, lib.*.d.ts)
 * reads from the real filesystem.
 */
const PROJECT_ROOT = resolve(__dirname, "..");

export interface TestEnv {
  env: ReturnType<typeof createVirtualTypeScriptEnvironment>;
  languageService: ts.LanguageService;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
}

/**
 * `sourceText` becomes a virtual `test.ts` file at the project root,
 * alongside the REAL `node_modules` on disk (real `morphz` package
 * resolves normally through it).
 */
export function createTestEnv(sourceText: string, fileName = "test.ts"): TestEnv {
  const fsMap = new Map<string, string>();
  fsMap.set(fileName, sourceText);

  const system = createFSBackedSystem(fsMap, PROJECT_ROOT, ts);
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  const env = createVirtualTypeScriptEnvironment(system, [fileName], ts, compilerOptions);
  const languageService = env.languageService;
  const program = languageService.getProgram();
  if (!program) throw new Error("test-harness: languageService.getProgram() returned undefined");
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) throw new Error(`test-harness: source file ${fileName} not found in program`);

  return { env, languageService, program, checker, sourceFile };
}

/** Finds the offset of `needle` inside `haystack`, throws if not found (test ergonomics). */
export function positionOf(source: string, needle: string): number {
  const idx = source.indexOf(needle);
  if (idx === -1) throw new Error(`positionOf: "${needle}" not found in source`);
  return idx;
}
