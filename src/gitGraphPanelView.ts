import * as path from 'path';
import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { getConfig } from './config';
import { DataSource, GitConfigKey } from './dataSource';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { RepoFileWatcher } from './repoFileWatcher';
import { RepoManager } from './repoManager';
import { GitGraphViewInitialState, TabIconColourTheme } from './types';
import { UNABLE_TO_FIND_GIT_MSG, openExtensionSettings, openExternalUrl, openFile, showErrorMessage, viewScm, copyFilePathToClipboard, copyToClipboard, viewDiff, viewDiffWithWorkingFile, viewFileAtRevision } from './utils';
import { standardiseCspSource } from './gitGraphView';
import { Disposable } from './utils/disposable';

export class GitGraphPanelViewProvider extends Disposable implements vscode.WebviewViewProvider {
	private webviewView: vscode.WebviewView | null = null;
	private readonly extensionPath: string;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly avatarManager: AvatarManager;
	private readonly repoManager: RepoManager;
	private readonly logger: Logger;
	private readonly repoFileWatcher: RepoFileWatcher;

	private loadViewTo: { repo: string } | null = null;
	private isGraphViewLoaded = false;
	private loadRepoInfoRefreshId = 0;
	private loadCommitsRefreshId = 0;

	constructor(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, repoManager: RepoManager, logger: Logger) {
		super();
		this.extensionPath = extensionPath;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.avatarManager = avatarManager;
		this.repoManager = repoManager;
		this.logger = logger;

		this.repoFileWatcher = new RepoFileWatcher(logger, () => {
			if (this.webviewView?.visible) this.sendMessage({ command: 'refresh' });
		});

		this.registerDisposable(
			this.avatarManager.onAvatar((event) => {
				this.sendMessage({ command: 'fetchAvatar', email: event.email, image: event.image });
			})
		);

		this.registerDisposable(
			this.repoManager.onDidChangeRepos((event) => {
				if (!this.webviewView?.visible) return;
				const loadViewTo = event.loadRepo !== null ? { repo: event.loadRepo } : null;
				if ((event.numRepos === 0 && this.isGraphViewLoaded) || (event.numRepos > 0 && !this.isGraphViewLoaded)) {
					this.loadViewTo = loadViewTo;
					this.update();
				} else {
					this.sendMessage({ command: 'loadRepos', repos: event.repos, loadViewTo: loadViewTo });
				}
			})
		);
	}

	public setLoadViewTo(repo: string | null) {
		this.loadViewTo = repo ? { repo } : null;
	}

	public resolveWebviewView(view: vscode.WebviewView) {
		this.webviewView = view;
		const config = getConfig();
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'media'))]
		};
		(view as any).iconPath = config.tabIconColourTheme === TabIconColourTheme.Colour
			? this.getResourcesUri('webview-icon.svg')
			: { light: this.getResourcesUri('webview-icon-light.svg'), dark: this.getResourcesUri('webview-icon-dark.svg') };

		view.webview.onDidReceiveMessage((msg) => this.respondToMessage(msg));
		view.onDidChangeVisibility(() => { if (view.visible) this.update(); });
		this.update();
		this.logger.log('Created Git Graph Panel View');
	}

	private sendMessage(msg: any) {
		if (!this.webviewView) return;
		this.webviewView.webview.postMessage(msg).then(() => { }, () => { });
	}

	private update() {
		if (!this.webviewView) return;
		this.webviewView.webview.html = this.getHtmlForWebview();
	}

	private getHtmlForWebview() {
		const config = getConfig(), nonce = this.getNonce();
		const initialState: GitGraphViewInitialState = {
			config: {
				commitDetailsView: config.commitDetailsView,
				commitOrdering: config.commitOrder,
				contextMenuActionsVisibility: config.contextMenuActionsVisibility,
				customBranchGlobPatterns: config.customBranchGlobPatterns,
				customEmojiShortcodeMappings: config.customEmojiShortcodeMappings,
				customPullRequestProviders: config.customPullRequestProviders,
				dateFormat: config.dateFormat,
				defaultColumnVisibility: config.defaultColumnVisibility,
				dialogDefaults: config.dialogDefaults,
				enhancedAccessibility: config.enhancedAccessibility,
				fetchAndPrune: config.fetchAndPrune,
				fetchAndPruneTags: config.fetchAndPruneTags,
				fetchAvatars: config.fetchAvatars && this.extensionState.isAvatarStorageAvailable(),
				graph: config.graph,
				includeCommitsMentionedByReflogs: config.includeCommitsMentionedByReflogs,
				initialLoadCommits: config.initialLoadCommits,

				keybindings: config.keybindings,
				loadMoreCommits: config.loadMoreCommits,
				loadMoreCommitsAutomatically: config.loadMoreCommitsAutomatically,
				markdown: config.markdown,
				uiLanguage: config.uiLanguage,
				mute: config.muteCommits,
				onlyFollowFirstParent: config.onlyFollowFirstParent,
				onRepoLoad: config.onRepoLoad,
				referenceLabels: config.referenceLabels,
				repoDropdownOrder: config.repoDropdownOrder,
				showRemoteBranches: config.showRemoteBranches,
				showStashes: config.showStashes,
				showTags: config.showTags
			},
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadViewTo: this.loadViewTo,
			repos: this.repoManager.getRepos(),
			loadRepoInfoRefreshId: this.loadRepoInfoRefreshId,
			loadCommitsRefreshId: this.loadCommitsRefreshId
		};
		const globalState = this.extensionState.getGlobalViewState();
		const workspaceState = this.extensionState.getWorkspaceViewState();

		let body, numRepos = Object.keys(initialState.repos).length, colorVars = '', colorParams = '';
		for (let i = 0; i < initialState.config.graph.colours.length; i++) {
			colorVars += '--git-graph-color' + i + ':' + initialState.config.graph.colours[i] + '; ';
			colorParams += '[data-color="' + i + '"]{--git-graph-color:var(--git-graph-color' + i + ');} ';
		}

		if (this.dataSource.isGitExecutableUnknown()) {
			body = `<body class="unableToLoad">
			<h2>Unable to load Git Graph</h2>
			<p class="unableToLoadMessage">${UNABLE_TO_FIND_GIT_MSG}</p>
			</body>`;
		} else if (numRepos > 0) {
			const controlsPos = config.panelControlsPosition;
			const bodyClass = controlsPos === 'left' ? 'controlsSideLeft' : (controlsPos === 'right' ? 'controlsSideRight' : '');
			body = `<body${bodyClass ? ` class="${bodyClass}"` : ''}>
			<div id="view" tabindex="-1">
				<div id="controls">
					<span id="repoControl"><span class="unselectable">Repo: </span><div id="repoDropdown" class="dropdown"></div></span>
					<span id="branchControl"><span class="unselectable">Branches: </span><div id="branchDropdown" class="dropdown"></div></span>
					<label id="showRemoteBranchesControl"><input type="checkbox" id="showRemoteBranchesCheckbox" tabindex="-1"><span class="customCheckbox"></span>Show Remote Branches</label>
					<div id="branchesBtn" title="Branches"></div>
					<div id="remoteToggleBtn" title="Show Remote Branches"></div>
					<div id="findBtn" title="Find"></div>
					<div id="terminalBtn" title="Open a Terminal for this Repository"></div>
					<div id="settingsBtn" title="Repository Settings"></div>
					<div id="fetchBtn"></div>
					<div id="refreshBtn"></div>
				</div>
				<div id="content">
					<div id="commitGraph"></div>
					<div id="commitTable"></div>
				</div>
				<div id="footer"></div>
			</div>
			<div id="scrollShadow"></div>
			<script nonce="${nonce}">var initialState = ${JSON.stringify(initialState)}, globalState = ${JSON.stringify(globalState)}, workspaceState = ${JSON.stringify(workspaceState)};</script>
			<script nonce="${nonce}" src="${this.getMediaUri('out.min.js')}"></script>
			</body>`;
		} else {
			body = `<body class="unableToLoad">
			<h2>Unable to load Git Graph</h2>
			<p class="unableToLoadMessage">No Git repositories were found in the current workspace when it was last scanned by Git Graph.</p>
			<p>If your repositories are in subfolders of the open workspace folder(s), make sure you have set the Git Graph Setting "git-graph.maxDepthOfRepoSearch" appropriately (read the <a href="https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings#max-depth-of-repo-search" target="_blank">documentation</a> for more information).</p>
			<p><div id="rescanForReposBtn" class="roundedBtn">Re-scan the current workspace for repositories</div></p>
			<script nonce="${nonce}">(function(){ var api = acquireVsCodeApi(); document.getElementById('rescanForReposBtn').addEventListener('click', function(){ api.postMessage({command: 'rescanForRepos'}); }); })();</script>
			</body>`;
		}
		this.isGraphViewLoaded = numRepos > 0;
		this.loadViewTo = null;

		const htmlLang = initialState.config.uiLanguage === 'zh-CN' ? 'zh-CN' : 'en';
		return `<!DOCTYPE html>
		<html lang="${htmlLang}">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${standardiseCspSource(this.webviewView!.webview.cspSource)} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('out.min.css')}">
				<title>Git Graph</title>
				<style>body{${colorVars}} ${colorParams}</style>
			</head>
			${body}
		</html>`;
	}

	private getUri(...pathComps: string[]) {
		return vscode.Uri.file(path.join(this.extensionPath, ...pathComps));
	}
	private getMediaUri(file: string) {
		return this.webviewView!.webview.asWebviewUri(this.getUri('media', file));
	}
	private getResourcesUri(file: string) {
		return this.getUri('resources', file);
	}
	private getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
		return text;
	}

	private async respondToMessage(msg: any) {
		this.repoFileWatcher.mute();
		switch (msg.command) {
			case 'loadRepos':
				if (!msg.check || !await this.repoManager.checkReposExist()) {
					this.sendMessage({ command: 'loadRepos', repos: this.repoManager.getRepos(), loadViewTo: null });
				}
				break;
			case 'loadRepoInfo': {
				this.loadRepoInfoRefreshId = msg.refreshId;
				let repoInfo = await this.dataSource.getRepoInfo(msg.repo, msg.showRemoteBranches, msg.showStashes, msg.hideRemotes), isRepo = true;
				if (repoInfo.error) {
					isRepo = (await this.dataSource.repoRoot(msg.repo)) !== null;
					if (!isRepo) repoInfo.error = null;
				}
				this.sendMessage({ command: 'loadRepoInfo', refreshId: msg.refreshId, ...repoInfo, isRepo });
				if (msg.repo !== null) {
					this.extensionState.setLastActiveRepo(msg.repo);
					this.repoFileWatcher.start(msg.repo);
				}
				break; }
			case 'loadCommits':
				this.loadCommitsRefreshId = msg.refreshId;
				this.sendMessage({
					command: 'loadCommits',
					refreshId: msg.refreshId,
					onlyFollowFirstParent: msg.onlyFollowFirstParent,
					...await this.dataSource.getCommits(msg.repo, msg.branches, msg.maxCommits, msg.showTags, msg.showRemoteBranches, msg.includeCommitsMentionedByReflogs, msg.onlyFollowFirstParent, msg.commitOrdering, msg.remotes, msg.hideRemotes, msg.stashes)
				});
				break;
			case 'loadConfig':
				this.sendMessage({ command: 'loadConfig', repo: msg.repo, ...await this.dataSource.getConfig(msg.repo, msg.remotes) });
				break;
			case 'openExtensionSettings':
				this.sendMessage({ command: 'openExtensionSettings', error: await openExtensionSettings() });
				break;
			case 'openFile':
				this.sendMessage({ command: 'openFile', error: await openFile(msg.repo, msg.path, msg.hash, msg.type) });
				break;
			case 'openExternalUrl':
				this.sendMessage({ command: 'openExternalUrl', error: await openExternalUrl(msg.url) });
				break;
			case 'commitDetails': {
				const data = await Promise.all([
					msg.commitHash === 'UNCOMMITTED'
						? this.dataSource.getUncommittedDetails(msg.repo)
						: msg.stash === null
							? this.dataSource.getCommitDetails(msg.repo, msg.commitHash, msg.hasParents)
							: this.dataSource.getStashDetails(msg.repo, msg.commitHash, msg.stash),
					msg.avatarEmail !== null ? this.avatarManager.getAvatarImage(msg.avatarEmail) : Promise.resolve(null)
				]);
				this.sendMessage({
					command: 'commitDetails',
					...data[0],
					avatar: data[1],
					codeReview: msg.commitHash !== 'UNCOMMITTED' ? this.extensionState.getCodeReview(msg.repo, msg.commitHash) : null,
					refresh: msg.refresh
				});
				break; }
			case 'compareCommits':
				this.sendMessage({
					command: 'compareCommits',
					commitHash: msg.commitHash,
					compareWithHash: msg.compareWithHash,
					...await this.dataSource.getCommitComparison(msg.repo, msg.fromHash, msg.toHash),
					codeReview: msg.toHash !== 'UNCOMMITTED' ? this.extensionState.getCodeReview(msg.repo, msg.fromHash + '-' + msg.toHash) : null,
					refresh: msg.refresh
				});
				break;
			case 'copyFilePath':
				this.sendMessage({ command: 'copyFilePath', error: await copyFilePathToClipboard(msg.repo, msg.filePath, msg.absolute) });
				break;
			case 'copyToClipboard':
				this.sendMessage({ command: 'copyToClipboard', error: await copyToClipboard(msg.data) });
				break;
			case 'viewDiff':
				this.sendMessage({ command: 'viewDiff', error: await viewDiff(msg.repo, msg.fromHash, msg.toHash, msg.oldFilePath, msg.newFilePath, msg.type) });
				break;
			case 'viewDiffWithWorkingFile':
				this.sendMessage({ command: 'viewDiffWithWorkingFile', error: await viewDiffWithWorkingFile(msg.repo, msg.hash, msg.filePath, this.dataSource) });
				break;
			case 'viewFileAtRevision':
				this.sendMessage({ command: 'viewFileAtRevision', error: await viewFileAtRevision(msg.repo, msg.hash, msg.filePath) });
				break;
			case 'showErrorMessage':
				showErrorMessage(msg.message);
				break;
			case 'rescanForRepos':
				this.repoManager.searchWorkspaceForRepos();
				break;
			case 'viewScm':
				await viewScm();
				break;
			case 'editUserDetails':
				const errors = [
					await this.dataSource.setConfigValue(msg.repo, GitConfigKey.UserName, msg.name, msg.location),
					await this.dataSource.setConfigValue(msg.repo, GitConfigKey.UserEmail, msg.email, msg.location)
				];
				this.sendMessage({ command: 'editUserDetails', errors });
				break;
			default:
				// For MVP panel support, not all commands are implemented. Editor mode remains fully featured.
				break;
		}
	}
}

