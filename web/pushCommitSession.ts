interface PushCommitSessionInit {
	repo: string;
	commitHash: string;
	currentBranch: string | null;
	initialRemote: string;
	initialBranch: string;
	initialMode: GG.GitPushBranchMode;
}

interface PushCommitSessionHooks {
	mode: 'modal' | 'dock';
	container: HTMLElement;
	initialSize?: { width: number; height: number; };
	onSizeChange?: (size: { width: number; height: number; }) => void;
	setConfirmEnabled?: (enabled: boolean) => void;
	onDisposed?: () => void;
}

class PushCommitSession {
	private readonly view: GitGraphView;
	private readonly hooks: PushCommitSessionHooks;
	private readonly repo: string;
	private readonly commitHash: string;
	private readonly currentBranch: string | null;

	private remote: string;
	private branch: string;
	private mode: GG.GitPushBranchMode;

	private branchCandidates: ReadonlyArray<string> = [];
	private remoteBranchExists: boolean = false;
	private activeTab: 'commits' | 'files' = 'commits';
	private commits: ReadonlyArray<GG.PushCommitPreviewCommit> = [];
	private files: ReadonlyArray<GG.PushCommitPreviewFileChange> = [];
	private previewError: string | null = null;

	private elements: {
		container: HTMLElement;
		content: HTMLElement;
		remoteSelect: HTMLSelectElement;
		modeSelect: HTMLSelectElement;
		branchInput: HTMLInputElement;
		branchHint: HTMLElement;
		branchSuggestions: HTMLElement;
		range: HTMLElement;
		remoteState: HTMLElement;
		tabCommits: HTMLButtonElement;
		tabFiles: HTMLButtonElement;
		previewContent: HTMLElement;
		previewEmpty: HTMLElement;
	} | null = null;

	private resizeObserver: any = null;
	private debounce: number | null = null;
	private pending: { remote: string; branch: string; } | null = null;
	private disposed: boolean = false;

	constructor(view: GitGraphView, init: PushCommitSessionInit, hooks: PushCommitSessionHooks) {
		this.view = view;
		this.hooks = hooks;
		this.repo = init.repo;
		this.commitHash = init.commitHash;
		this.currentBranch = init.currentBranch;
		this.remote = init.initialRemote;
		this.branch = init.initialBranch;
		this.mode = init.initialMode;
	}

	public mount() {
		if (this.disposed) return;
		this.render();
		this.scheduleInitialPreview();
	}

	public dispose() {
		if (this.disposed) return;
		this.disposed = true;
		if (this.resizeObserver !== null && typeof this.resizeObserver.disconnect === 'function') {
			this.resizeObserver.disconnect();
		}
		if (this.elements !== null) {
			this.elements.branchSuggestions.innerHTML = '';
		}
		if (this.hooks.onDisposed) {
			this.hooks.onDisposed();
		}
	}

	public confirm(): GG.RequestPushCommitToBranch | null {
		if (this.branch === '' || this.remote === '') {
			this.updateConfirmEnabled();
			return null;
		}
		this.view.recordPushCommitRecentBranch(this.branch);
		return {
			command: 'pushCommitToBranch',
			repo: this.repo,
			commitHash: this.commitHash,
			remote: this.remote,
			branch: this.branch,
			mode: this.mode
		};
	}

	public handlePreviewResponse(msg: GG.ResponsePushCommitPreview) {
		if (this.disposed || msg.repo !== this.repo || msg.commitHash !== this.commitHash) return;
		if (this.pending !== null) {
			if (this.pending.remote !== msg.remote || this.pending.branch !== msg.branch) {
				return;
			}
		} else if (msg.remote !== this.remote || msg.branch !== this.branch) {
			return;
		}
		this.pending = null;
		this.applyPreviewLoading(false);
		this.previewError = msg.error;
		if (msg.error === null) {
			this.branchCandidates = msg.branchCandidates;
			this.remoteBranchExists = msg.remoteBranchExists;
			this.commits = msg.commits;
			this.files = msg.files;
			this.updateBranchHint();
			this.refreshSuggestions(true);
			this.updateRange();
		} else {
			this.commits = [];
			this.files = [];
		}
		this.renderPreview();
	}

	public getMode() {
		return this.hooks.mode;
	}

	private render() {
		const container = this.hooks.container;
		container.innerHTML = '';
		const wrapper = document.createElement('div');
		wrapper.className = 'pushCommitDialogWrapper';
		if (this.hooks.mode === 'modal' && this.hooks.initialSize) {
			wrapper.style.width = this.hooks.initialSize.width + 'px';
			wrapper.style.height = this.hooks.initialSize.height + 'px';
		}

		const content = document.createElement('div');
		content.className = 'pushCommitDialog';
		if (this.hooks.mode === 'dock') {
			wrapper.classList.add('dock');
			content.classList.add('dock');
		}
		content.innerHTML = this.buildDialogHtml();
		wrapper.appendChild(content);
		container.appendChild(wrapper);

		const remoteSelect = content.querySelector<HTMLSelectElement>('#pushCommitRemote')!;
		this.populateRemotes(remoteSelect);
		remoteSelect.value = this.remote;
		remoteSelect.addEventListener('change', () => {
			this.remote = remoteSelect.value;
			this.remoteBranchExists = this.doesRemoteBranchExist(this.remote, this.branch);
			this.updateRange();
			this.updateBranchHint();
			this.refreshSuggestions(true);
			this.schedulePreview();
		});

		const branchInput = content.querySelector<HTMLInputElement>('#pushCommitBranch')!;
		if (this.branch !== '') branchInput.value = this.branch;
		const branchHint = content.querySelector<HTMLElement>('#pushCommitBranchHint')!;
		const branchSuggestions = content.querySelector<HTMLElement>('#pushCommitBranchSuggestions')!;
		branchInput.addEventListener('input', () => this.onBranchInput(branchInput));
		branchInput.addEventListener('focus', () => {
			this.refreshSuggestions(true);
			this.showSuggestions();
		});
		branchInput.addEventListener('blur', () => window.setTimeout(() => this.hideSuggestions(), 120));
		branchSuggestions.addEventListener('mousedown', (event) => this.onSuggestionClick(event));

		const modeSelect = content.querySelector<HTMLSelectElement>('#pushCommitMode')!;
		modeSelect.value = this.mode;
		modeSelect.addEventListener('change', () => {
			this.mode = <GG.GitPushBranchMode>modeSelect.value;
		});

		const tabCommits = content.querySelector<HTMLButtonElement>('[data-view="commits"]')!;
		const tabFiles = content.querySelector<HTMLButtonElement>('[data-view="files"]')!;
		tabCommits.addEventListener('click', () => {
			if (tabCommits.classList.contains('active')) return;
			this.activeTab = 'commits';
			this.setActiveTab();
			this.renderPreview();
		});
		tabFiles.addEventListener('click', () => {
			if (tabFiles.classList.contains('active')) return;
			this.activeTab = 'files';
			this.setActiveTab();
			this.renderPreview();
		});

		const previewContent = content.querySelector<HTMLElement>('#pushCommitPreviewContent')!;
		const previewEmpty = content.querySelector<HTMLElement>('#pushCommitPreviewEmpty')!;

		this.elements = {
			container: wrapper,
			content: content,
			remoteSelect: remoteSelect,
			modeSelect: modeSelect,
			branchInput: branchInput,
			branchHint: branchHint,
			branchSuggestions: branchSuggestions,
			range: content.querySelector<HTMLElement>('#pushCommitRange')!,
			remoteState: content.querySelector<HTMLElement>('#pushCommitRemoteState')!,
			tabCommits: tabCommits,
			tabFiles: tabFiles,
			previewContent: previewContent,
			previewEmpty: previewEmpty
		};

		this.attachResizeObserver();
		this.setActiveTab();
		this.updateBranchHint();
		this.refreshSuggestions(true);
		this.updateRange();
		this.renderPreview();
		this.updateConfirmEnabled();
	}

	private buildDialogHtml() {
		return '<div class="pushCommitForm">' +
			'<label class="pushCommitLabel" for="pushCommitRemote">' + tl('Remote', '远程') + '</label>' +
			'<select id="pushCommitRemote" class="pushCommitRemote"></select>' +
			'<label class="pushCommitLabel" for="pushCommitBranch">' + tl('Branch', '远程分支') + '</label>' +
			'<div class="pushCommitBranchWrapper">' +
				'<input id="pushCommitBranch" type="text" class="pushCommitBranch" autocomplete="off" spellcheck="false" placeholder="' + tl('Target branch name (without remote prefix)', '目标远程分支名（不含 remote 前缀）') + '"/>' +
				'<div id="pushCommitBranchSuggestions" class="pushCommitBranchSuggestions"></div>' +
			'</div>' +
			'<div id="pushCommitBranchHint" class="pushCommitBranchHint"></div>' +
			'<label class="pushCommitLabel" for="pushCommitMode">' + tl('Push Mode', '推送模式') + '</label>' +
			'<select id="pushCommitMode" class="pushCommitModeSelect">' +
				'<option value="' + GG.GitPushBranchMode.Normal + '">' + tl('普通 · git push', '普通 · git push') + '</option>' +
				'<option value="' + GG.GitPushBranchMode.ForceWithLease + '">' + tl('强制（带租约）· --force-with-lease', '强制（带租约）· --force-with-lease') + '</option>' +
				'<option value="' + GG.GitPushBranchMode.Force + '">' + tl('强制 · --force', '强制 · --force') + '</option>' +
			'</select>' +
		'</div>' +
		'<div class="pushCommitPreviewSection">' +
			'<div class="pushCommitPreviewHeader">' +
				'<span id="pushCommitRange" class="pushCommitRange"></span>' +
				'<span id="pushCommitRemoteState" class="pushCommitRemoteState"></span>' +
			'</div>' +
			'<div class="pushCommitPreviewTabs">' +
				'<button type="button" data-view="commits" class="active">' + tl('Commits', '提交') + '</button>' +
				'<button type="button" data-view="files">' + tl('Files', '文件') + '</button>' +
			'</div>' +
			'<div class="pushCommitPreviewBody">' +
				'<div id="pushCommitPreviewContent" class="pushCommitPreviewContent"></div>' +
				'<div id="pushCommitPreviewEmpty" class="pushCommitPreviewEmpty hidden"></div>' +
			'</div>' +
		'</div>';
	}

	private populateRemotes(select: HTMLSelectElement) {
		const remotes = this.view.getRemotes();
		if (remotes.length === 0) return;
		remotes.forEach((remote) => {
			const option = document.createElement('option');
			option.value = remote;
			option.textContent = remote;
			select.appendChild(option);
		});
		if (!remotes.includes(this.remote)) {
			this.remote = remotes[0];
		}
	}

	private onBranchInput(input: HTMLInputElement) {
		let value = input.value;
		const substitution = initialState.config.dialogDefaults.general.referenceInputSpaceSubstitution;
		if (substitution !== null && /\s/.test(value)) {
			const selectionStart = input.selectionStart;
			const selectionEnd = input.selectionEnd;
			value = value.replace(/\s/g, substitution);
			input.value = value;
			if (selectionStart !== null && selectionEnd !== null) {
				input.selectionStart = selectionStart;
				input.selectionEnd = selectionEnd;
			}
		}
		this.branch = value.trim();
		if (this.branch !== value) {
			input.value = this.branch;
		}
		this.remoteBranchExists = this.doesRemoteBranchExist(this.remote, this.branch);
		this.updateConfirmEnabled();
		this.updateRange();
		this.updateBranchHint();
		this.refreshSuggestions(true);
		this.showSuggestions();
		this.schedulePreview();
	}

	private onSuggestionClick(event: MouseEvent) {
		const target = <HTMLElement>(<HTMLElement>event.target).closest('.pushCommitSuggestion');
		if (target === null) return;
		event.preventDefault();
		this.applyBranchSelection(target.dataset.value || '');
	}

	private applyBranchSelection(branch: string) {
		this.branch = branch.trim();
		if (this.elements !== null) {
			this.elements.branchInput.value = this.branch;
			this.elements.branchInput.focus();
			this.elements.branchInput.setSelectionRange(this.branch.length, this.branch.length);
		}
		this.remoteBranchExists = this.doesRemoteBranchExist(this.remote, this.branch);
		this.updateConfirmEnabled();
		this.updateRange();
		this.updateBranchHint();
		this.hideSuggestions();
		this.schedulePreview();
	}

	private collectBranchOptions() {
		const options: string[] = [];
		const branches = this.view.getBranches();
		const remotePrefix = 'remotes/' + this.remote + '/';
		const remoteBranches = branches.filter((branch) => branch.startsWith(remotePrefix) && !branch.endsWith('/HEAD'))
			.map((branch) => branch.substring(remotePrefix.length));
		const add = (values: ReadonlyArray<string>) => {
			for (let i = 0; i < values.length; i++) {
				const value = values[i].trim();
				if (value !== '' && options.indexOf(value) === -1) {
					options.push(value);
				}
			}
		};
		add(remoteBranches);
		add(this.branchCandidates);
		const head = this.view.getCurrentBranchHead();
		if (head !== null) add([head]);
		add(this.view.getPushCommitRecentBranches());
		return options;
	}

	private doesRemoteBranchExist(remote: string, branch: string) {
		if (branch === '') return false;
		return this.view.getBranches().includes('remotes/' + remote + '/' + branch);
	}

	private refreshSuggestions(showAll: boolean = false) {
		const elems = this.elements;
		if (elems === null) return;
		const options = this.collectBranchOptions();
		const query = this.branch.toLowerCase();
		let matches: string[];
		if (query === '') {
			matches = showAll ? options : [];
		} else {
			matches = options.filter((option) => option.toLowerCase().includes(query));
		}
		const limited = matches.slice(0, 10);
		const suggestions: string[] = [];
		limited.forEach((branch) => {
			suggestions.push('<div class="pushCommitSuggestion" data-value="' + escapeHtml(branch) + '">' + escapeHtml(branch) + '</div>');
		});
		const exactMatch = this.branch !== '' && options.some((option) => option.toLowerCase() === query);
		if (this.branch !== '' && !exactMatch) {
			const label = tl('Create remote branch "{0}"', '新建远程分支“{0}”').replace('{0}', escapeHtml(this.branch));
			suggestions.push('<div class="pushCommitSuggestion new" data-value="' + escapeHtml(this.branch) + '">' + label + '</div>');
		}
		if (suggestions.length === 0) {
			elems.branchSuggestions.innerHTML = '';
			this.hideSuggestions();
		} else {
			elems.branchSuggestions.innerHTML = suggestions.join('');
			if (showAll || query !== '' || limited.length > 0) {
				this.showSuggestions();
			}
		}
	}

	private showSuggestions() {
		const elems = this.elements;
		if (elems === null) return;
		if (elems.branchSuggestions.innerHTML !== '') {
			elems.branchSuggestions.classList.add('visible');
		}
	}

	private hideSuggestions() {
		const elems = this.elements;
		if (elems === null) return;
		elems.branchSuggestions.classList.remove('visible');
	}

	private schedulePreview() {
		if (this.debounce !== null) {
			clearTimeout(this.debounce);
		}
		this.debounce = window.setTimeout(() => {
			this.debounce = null;
			this.requestPreview();
		}, 300);
	}

	private scheduleInitialPreview() {
		if (this.branch === '') {
			this.renderPreview();
			return;
		}
		this.requestPreview();
	}

	private requestPreview() {
		if (this.branch === '') {
			this.pending = null;
			this.commits = [];
			this.files = [];
			this.previewError = null;
			this.branchCandidates = [];
			this.remoteBranchExists = false;
			this.hideSuggestions();
			this.updateConfirmEnabled();
			this.updateRange();
			this.updateBranchHint();
			this.renderPreview();
			return;
		}

		this.remoteBranchExists = this.doesRemoteBranchExist(this.remote, this.branch);
		this.updateBranchHint();
		this.refreshSuggestions(true);
		this.previewError = null;
		this.pending = { remote: this.remote, branch: this.branch };
		this.applyPreviewLoading(true);
		sendMessage({
			command: 'pushCommitPreview',
			repo: this.repo,
			commitHash: this.commitHash,
			remote: this.remote,
			branch: this.branch,
			currentBranch: this.currentBranch
		});
	}

	private applyPreviewLoading(loading: boolean) {
		const elems = this.elements;
		if (elems === null) return;
		alterClass(elems.previewContent, 'loading', loading);
		if (loading) {
			elems.previewContent.innerHTML = '<div class="pushCommitPreviewLoading">' + SVG_ICONS.loading + tl('Loading preview…', '正在加载预览…') + '</div>';
			alterClass(elems.previewEmpty, 'hidden', true);
		}
	}

	private setActiveTab() {
		const elems = this.elements;
		if (elems === null) return;
		if (this.activeTab === 'commits') {
			elems.tabCommits.classList.add('active');
			elems.tabFiles.classList.remove('active');
		} else {
			elems.tabFiles.classList.add('active');
			elems.tabCommits.classList.remove('active');
		}
	}

	private renderPreview() {
		const elems = this.elements;
		if (elems === null) return;
		if (this.previewError !== null) {
			elems.previewContent.innerHTML = '<div class="pushCommitPreviewError">' + escapeHtml(this.previewError).split('\n').join('<br>') + '</div>';
			alterClass(elems.previewEmpty, 'hidden', true);
			return;
		}
		if (this.activeTab === 'commits') {
			if (this.commits.length === 0) {
				alterClass(elems.previewEmpty, 'hidden', false);
				elems.previewEmpty.textContent = tl('No commits to push.', '没有可推送的提交。');
				elems.previewContent.innerHTML = '';
			} else {
				alterClass(elems.previewEmpty, 'hidden', true);
				elems.previewContent.innerHTML = this.renderPreviewCommits(this.commits);
			}
		} else {
			if (this.files.length === 0) {
				alterClass(elems.previewEmpty, 'hidden', false);
				elems.previewEmpty.textContent = tl('No file changes to push.', '没有可推送的文件变更。');
				elems.previewContent.innerHTML = '';
			} else {
				alterClass(elems.previewEmpty, 'hidden', true);
				elems.previewContent.innerHTML = this.renderPreviewFiles(this.files);
			}
		}
	}

	private renderPreviewCommits(commits: ReadonlyArray<GG.PushCommitPreviewCommit>) {
		return commits.map((commit) => '<div class="pushCommitCard">' +
			'<div class="pushCommitCardTitle"><span class="pushCommitHash">' + abbrevCommit(commit.hash) + '</span> ' + escapeHtml(commit.message) + '</div>' +
			'<div class="pushCommitCardMeta">' + escapeHtml(commit.author) + ' · ' + escapeHtml(this.formatDate(commit.date)) + '</div>' +
		'</div>').join('');
	}

	private renderPreviewFiles(files: ReadonlyArray<GG.PushCommitPreviewFileChange>) {
		if (files.length === 0) return '';
		return files.map((file) => {
			let label = '';
			if (file.type === GG.GitFileStatus.Deleted) label = tl('Deleted', '删除');
			else if (file.type === GG.GitFileStatus.Modified) label = tl('Modified', '修改');
			else if (file.type === GG.GitFileStatus.Renamed) label = tl('Renamed', '重命名');
			else if (file.type === GG.GitFileStatus.Added) label = tl('Added', '新增');
			else label = tl('Updated', '更新');
			let pathHtml = '';
			if (file.type === GG.GitFileStatus.Renamed && file.oldFilePath !== null) {
				pathHtml = escapeHtml(file.oldFilePath) + ' → ' + escapeHtml(file.newFilePath);
			} else {
				pathHtml = escapeHtml(file.newFilePath);
			}
			return '<div class="pushCommitCard">' +
				'<div class="pushCommitCardMeta pushCommitFileMeta">' + label + '</div>' +
				'<div class="pushCommitCardTitle">' + pathHtml + '</div>' +
			'</div>';
		}).join('');
	}

	private formatDate(epochSeconds: number) {
		return new Date(epochSeconds * 1000).toLocaleString();
	}

	private updateBranchHint() {
		const elems = this.elements;
		if (elems === null) return;
		const hintElem = elems.branchHint;
		if (this.branch === '') {
			hintElem.textContent = '';
			elems.remoteState.textContent = '';
			return;
		}

		if (this.remoteBranchExists) {
			hintElem.innerHTML = tl(
				'Remote branch <b>{0}/{1}</b> will be updated to this commit.',
				'远程分支 <b>{0}/{1}</b> 将更新到该提交。'
			).replace('{0}', escapeHtml(this.remote)).replace('{1}', escapeHtml(this.branch));
			elems.remoteState.textContent = '';
		} else {
			hintElem.innerHTML = tl(
				'Create new remote branch <b>{0}</b>.',
				'新建远程分支 <b>{0}</b>。'
			).replace('{0}', escapeHtml(this.branch));
			elems.remoteState.textContent = tl('Remote branch does not exist yet.', '远程分支尚不存在。');
		}
	}

	private updateRange() {
		const elems = this.elements;
		if (elems === null) return;
		const branchDisplay = this.branch !== '' ? this.branch : '—';
		elems.range.textContent = this.remote + '/' + branchDisplay + '..' + abbrevCommit(this.commitHash);
	}

	private updateConfirmEnabled() {
		if (this.hooks.setConfirmEnabled) {
			const enabled = this.branch !== '' && this.remote !== '';
			this.hooks.setConfirmEnabled(enabled);
		}
	}

	private attachResizeObserver() {
		if (this.hooks.mode !== 'modal') return;
		const elems = this.elements;
		if (elems === null) return;
		const ResizeObserverClass = (window as any).ResizeObserver;
		if (typeof ResizeObserverClass === 'function') {
			const observer = new ResizeObserverClass((entries: any[]) => {
				if (!entries || entries.length === 0) return;
				const rect = entries[0].contentRect;
				this.onDialogResized(rect.width, rect.height);
			});
			observer.observe(elems.container);
			this.resizeObserver = observer;
		} else {
			elems.container.addEventListener('mouseup', () => {
				this.onDialogResized(elems.container.offsetWidth, elems.container.offsetHeight);
			});
		}
	}

	private onDialogResized(width: number, height: number) {
		if (this.hooks.mode !== 'modal') return;
		const elems = this.elements;
		if (elems === null) return;
		const maxWidth = Math.max(360, (window.innerWidth || document.body.clientWidth) - 40);
		const maxHeight = Math.max(380, (window.innerHeight || document.body.clientHeight) - 40);
		const newWidth = Math.max(360, Math.min(width, maxWidth));
		const newHeight = Math.max(380, Math.min(height, maxHeight));
		elems.container.style.width = newWidth + 'px';
		elems.container.style.height = newHeight + 'px';
		if (this.hooks.onSizeChange) {
			this.hooks.onSizeChange({ width: newWidth, height: newHeight });
		}
	}
}
