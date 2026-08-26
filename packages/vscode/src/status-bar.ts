import * as vscode from "vscode";
import { detectMorphzDependency } from "./detect-morphz-dependency.js";

const TS_LANGUAGES = new Set(["typescript", "typescriptreact"]);

/**
 * Best-effort proxy only — VSCode's extension API has no official channel
 * to confirm a contributed TS server plugin actually loaded inside
 * tsserver (see design.md's Risks). "active" here means "this workspace
 * looks like a morphz consumer and the plugin SHOULD be running", not a
 * confirmed load.
 */
export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }

  async update(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor || !TS_LANGUAGES.has(editor.document.languageId)) {
      this.item.hide();
      return;
    }

    const isDependency = await this.workspaceHasMorphz(editor.document.uri);

    if (isDependency) {
      this.item.text = "$(check) morphz";
      this.item.tooltip =
        "morphz TS Language Service Plugin should be active for this workspace (contributed via package.json — actual tsserver load state isn't observable from the extension API).";
    } else {
      this.item.text = "$(circle-slash) morphz";
      this.item.tooltip = "morphz isn't a dependency of the nearest package.json for this file.";
    }
    this.item.show();
  }

  private async workspaceHasMorphz(fileUri: vscode.Uri): Promise<boolean> {
    const found = await vscode.workspace.findFiles(
      new vscode.RelativePattern(vscode.Uri.joinPath(fileUri, ".."), "package.json"),
      "**/node_modules/**",
      1,
    );

    let packageJsonUri = found[0];
    if (!packageJsonUri) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
      if (!workspaceFolder) {
        return false;
      }
      const rootFound = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, "package.json"),
        "**/node_modules/**",
        1,
      );
      packageJsonUri = rootFound[0];
      if (!packageJsonUri) {
        return false;
      }
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(packageJsonUri);
      return detectMorphzDependency(Buffer.from(bytes).toString("utf8"));
    } catch {
      return false;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
