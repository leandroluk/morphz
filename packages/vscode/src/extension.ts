import * as vscode from "vscode";
import { StatusBar } from "./status-bar.js";

/**
 * Activation is deliberately almost empty: `contributes.typescriptServerPlugins`
 * (package.json) is what actually registers the morphz TS Language Service
 * Plugin with VSCode's built-in TypeScript extension — no code here does
 * that. This function only wires the status bar (REQ-003).
 */
export function activate(context: vscode.ExtensionContext): void {
  const statusBar = new StatusBar();

  const updateForActiveEditor = (): void => {
    void statusBar.update(vscode.window.activeTextEditor);
  };

  updateForActiveEditor();

  context.subscriptions.push(
    statusBar,
    vscode.window.onDidChangeActiveTextEditor(updateForActiveEditor),
  );
}

export function deactivate(): void {
  // Disposal is handled via context.subscriptions — nothing else to tear down.
}
