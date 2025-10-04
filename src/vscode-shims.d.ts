// Minimal shims for VS Code WebviewView API to allow compiling without latest @types/vscode
import * as vscode from 'vscode';

declare module 'vscode' {
	export interface WebviewView {
		readonly webview: vscode.Webview;
		readonly visible: boolean;
		onDidChangeVisibility: (listener: (...args: any[]) => any, thisArgs?: any, disposables?: vscode.Disposable[]) => vscode.Disposable;
	}

	export interface WebviewViewProvider {
		resolveWebviewView: (webviewView: WebviewView, context: any, token: vscode.CancellationToken) => void;
	}

	export namespace window {
		export function registerWebviewViewProvider(viewId: string, provider: WebviewViewProvider, options?: { webviewOptions?: { retainContextWhenHidden?: boolean } }): vscode.Disposable;
	}
}
