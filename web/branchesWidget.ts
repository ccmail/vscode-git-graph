interface BranchesWidgetState {
	readonly currentRepo: string | null;
	readonly scrollTop: number;
}

class BranchesWidget {
	private readonly view: GitGraphView;

	private currentRepo: string | null = null;
	private scrollTop: number = 0;

	private readonly widgetElem: HTMLElement;
	private readonly contentsElem: HTMLElement;
	private readonly loadingElem: HTMLElement;
	private dockDividerElem: HTMLElement | null = null;
	private selectedLeaf: HTMLElement | null = null;

	constructor(view: GitGraphView) {
		this.view = view;

		this.widgetElem = document.createElement('div');
		this.widgetElem.id = 'branchesWidget';
		this.widgetElem.innerHTML = '<h2>' + t('分支') + '</h2><div id="branchesContent"></div><div id="branchesLoading"></div><div id="branchesClose"></div>';
		document.body.appendChild(this.widgetElem);

		observeElemScroll('branchesWidget', this.scrollTop, (scrollTop) => {
			this.scrollTop = scrollTop;
		}, () => {
			if (this.currentRepo !== null) {
				this.view.saveState();
			}
		});

		this.contentsElem = document.getElementById('branchesContent')!;
		this.loadingElem = document.getElementById('branchesLoading')!;

		const closeBtn = document.getElementById('branchesClose')!;
		closeBtn.innerHTML = SVG_ICONS.close;
		closeBtn.addEventListener('click', () => this.close());
	}

	public show(currentRepo: string, isInitialLoad: boolean = true, scrollTop: number = 0) {
		if (this.currentRepo !== null) return;
		this.currentRepo = currentRepo;
		this.scrollTop = scrollTop;
		const isDocked = this.isDockedMode();
		alterClass(this.widgetElem, CLASS_TRANSITION, isInitialLoad && !isDocked);
		this.widgetElem.classList.add(CLASS_ACTIVE);
		document.body.classList.add('dockOpen');
		this.view.saveState();
		this.applyDockedWidth();
		this.render();
	}

	public refresh() {
		if (this.currentRepo === null) return;
		this.applyDockedWidth();
		this.render();
	}

	public close() {
		if (this.currentRepo === null) return;
		this.currentRepo = null;
		if (!this.isDockedMode()) this.widgetElem.classList.add(CLASS_TRANSITION);
		this.widgetElem.classList.remove(CLASS_ACTIVE);
		this.widgetElem.classList.remove(CLASS_LOADING);
		this.contentsElem.innerHTML = '';
		this.loadingElem.innerHTML = '';
		document.body.classList.remove('dockOpen');
		this.removeDockDivider();
		this.view.saveState();
	}

	public isVisible() { return this.currentRepo !== null; }

	private isDockedMode(): boolean {
		return document.body.classList.contains('settingsDocked');
	}

	private computeDockWidthFromPct(pct: number): number {
		const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
		const controlsWidth = parseInt(getComputedStyle(document.body).getPropertyValue('--gg-side-toolbar-width')) || 44;
		const maxWidth = Math.max(300, vw - (controlsWidth + 140));
		return Math.round(Math.min(maxWidth, Math.max(260, pct * vw)));
	}

	private computePctFromWidth(width: number): number {
		const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
		return Math.max(0.15, Math.min(0.6, width / vw));
	}

	private applyDockedWidth() {
		if (!this.isDockedMode()) return;
		let pct: number | null = null;
		const repoState = this.currentRepo ? this.view.getRepoState(this.currentRepo) : null;
		if (repoState && typeof (repoState as any).settingsDockPct === 'number') pct = (repoState as any).settingsDockPct as number;
		if (pct === null && repoState && typeof (repoState as any).settingsDockWidth === 'number') {
			const oldW = (repoState as any).settingsDockWidth as number;
			pct = this.computePctFromWidth(oldW);
			if (this.currentRepo !== null) this.view.saveRepoStateValue(this.currentRepo as any, 'settingsDockPct' as any, pct as any);
		}
		if (pct === null) pct = 0.3;
		const width = this.computeDockWidthFromPct(pct);
		document.body.style.setProperty('--gg-docked-settings-width', width + 'px');
		if (this.currentRepo !== null) this.createDockDivider();
	}

	private createDockDivider() {
		if (!this.isDockedMode() || this.dockDividerElem) return;
		let divider = document.getElementById('settingsDockDivider');
		if (!divider) {
			divider = document.createElement('div');
			divider.id = 'settingsDockDivider';
			document.body.appendChild(divider);
		}
		this.dockDividerElem = divider as HTMLElement;
		const applyDividerPos = () => {
			const rect = this.widgetElem.getBoundingClientRect();
			if (document.body.classList.contains('controlsSideRight')) {
				this.dockDividerElem!.style.right = (window.innerWidth - rect.left) + 'px';
				this.dockDividerElem!.style.left = 'auto';
			} else {
				this.dockDividerElem!.style.left = rect.right + 'px';
				this.dockDividerElem!.style.right = 'auto';
			}
		};
		applyDividerPos();
		let dragging = false;
		const onMouseMove = (e: MouseEvent) => {
			if (!dragging) return;
			const x = e.clientX;
			let width: number;
			if (document.body.classList.contains('controlsSideRight')) {
				width = Math.max(260, window.innerWidth - x - (parseInt(getComputedStyle(document.body).getPropertyValue('--gg-side-toolbar-width')) || 44));
			} else {
				width = Math.max(260, x - (parseInt(getComputedStyle(document.body).getPropertyValue('--gg-side-toolbar-width')) || 44));
			}
			const pct = this.computePctFromWidth(width);
			document.body.style.setProperty('--gg-docked-settings-width', this.computeDockWidthFromPct(pct) + 'px');
			if (this.currentRepo !== null) this.view.saveRepoStateValue(this.currentRepo as any, 'settingsDockPct' as any, pct as any);
			applyDividerPos();
		};
		const onMouseUp = () => { dragging = false; window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
		this.dockDividerElem.addEventListener('mousedown', (e) => { dragging = true; window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp); e.preventDefault(); });
		window.addEventListener('resize', applyDividerPos);
	}

	private removeDockDivider() {
		if (!this.dockDividerElem) return;
		this.dockDividerElem.remove();
		this.dockDividerElem = null;
	}

	private render() {
		if (this.currentRepo === null) return;
		const branches = this.view.getBranches();
		const config = this.view.getRepoConfig();

		// Partition local and remote branches
		const local: string[] = [];
		const remoteMap: { [remote: string]: string[] } = {};
		for (let i = 0; i < branches.length; i++) {
			const b = branches[i];
			if (b.startsWith('remotes/')) {
				const comps = b.split('/');
				const remote = comps[1] || 'origin';
				const name = comps.slice(2).join('/');
				(remoteMap[remote] = remoteMap[remote] || []).push(name);
			} else {
				local.push(b);
			}
		}

		const renderTree = (names: string[], remoteName: string | null = null) => {
			// Build a simple recursive tree
			interface Node { children: { [k: string]: Node }; leaf?: boolean; full?: string; }
			const root: Node = { children: {} };
			for (const name of names) {
				const parts = name.split('/');
				let cur = root;
				for (let i = 0; i < parts.length; i++) {
					const p = parts[i];
					cur.children[p] = cur.children[p] || { children: {} };
					cur = cur.children[p];
					if (i === parts.length - 1) { cur.leaf = true; cur.full = name; }
				}
			}
			const renderNode = (name: string, node: Node, depth: number): string => {
				const hasChildren = Object.keys(node.children).length > 0 && !node.leaf;
				const indent = depth * 12;
				if (hasChildren) {
					const childHtml = Object.keys(node.children).sort().map((k) => renderNode(k, node.children[k], depth + 1)).join('');
					return '<div class="branchFolder" data-depth="' + depth + '" style="padding-left:' + indent + 'px"><span class="folderToggle" title="' + t('展开/收起') + '">' + SVG_ICONS.branch + '</span><span class="folderName">' + escapeHtml(name) + '</span></div>' +
						'<div class="branchFolderChildren" data-depth="' + depth + '">' + childHtml + '</div>';
				} else {
					const full = node.full || name;
					const datasetRemote = remoteName ? ' data-remote="' + escapeHtml(remoteName) + '"' : '';
					const title = remoteName ? escapeHtml(remoteName + '/' + full) : escapeHtml(full);
					return '<div class="branchLeaf" data-branch="' + escapeHtml(full) + '"' + datasetRemote + ' title="' + title + '" style="padding-left:' + indent + 'px">' + SVG_ICONS.branch + '<span class="branchName">' + escapeHtml(name) + '</span></div>';
				}
			};
			return Object.keys(root.children).sort().map((k) => renderNode(k, root.children[k], 0)).join('');
		};

		let html = '';
		// Head section
		const head = this.view.getBranchHead();
		html += '<div class="branchesSection"><h3>HEAD' + (head ? ' (' + t('当前分支') + ')' : '') + '</h3>' +
			(head ? '<div class="branchLeaf isHead" data-branch="' + escapeHtml(head) + '">' + SVG_ICONS.branch + '<span class="branchName">' + escapeHtml(head) + '</span></div>' : '<div class="noBranch">' + t('未检出任何分支') + '</div>') +
			'</div>';

		// Local branches
		html += '<div class="branchesSection"><h3>' + t('本地') + '</h3>' + (local.length > 0 ? renderTree(local) : '<div class="noBranch">' + t('无本地分支') + '</div>') + '</div>';

		// Remote branches
		const remotes = config?.remotes?.map(r => r.name) || Object.keys(remoteMap);
		for (const remote of remotes) {
			const list = remoteMap[remote] || [];
			html += '<div class="branchesSection"><h3>' + t('远程') + ' · ' + escapeHtml(remote) + '</h3>' + (list.length > 0 ? renderTree(list, remote) : '<div class="noBranch">' + t('无远程分支') + '</div>') + '</div>';
		}

		this.contentsElem.innerHTML = html;

		// Bind interactions
		const selectLeaf = (leaf: HTMLElement) => {
			if (this.selectedLeaf) this.selectedLeaf.classList.remove('selected');
			leaf.classList.add('selected');
			this.selectedLeaf = leaf;
		};
		this.contentsElem.querySelectorAll('.branchLeaf').forEach((el) => {
			el.addEventListener('click', (e) => {
				e.stopPropagation();
				selectLeaf(el as HTMLElement);
			});
			el.addEventListener('dblclick', (e) => {
				e.preventDefault();
				e.stopPropagation();
				selectLeaf(el as HTMLElement);
				const name = (el as HTMLElement).dataset.branch!;
				const remote = (el as HTMLElement).getAttribute('data-remote');
				this.view.openBranchContextMenu(el as HTMLElement, name, remote, e as MouseEvent, this.widgetElem);
			});
			el.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				e.stopPropagation();
				selectLeaf(el as HTMLElement);
				const name = (el as HTMLElement).dataset.branch!;
				const remote = (el as HTMLElement).getAttribute('data-remote');
				this.view.openBranchContextMenu(el as HTMLElement, name, remote, e as MouseEvent, this.widgetElem);
			});
		});
		this.contentsElem.querySelectorAll('.branchFolder').forEach((el) => {
			el.addEventListener('click', () => {
				const next = el.nextElementSibling as HTMLElement | null;
				if (next && next.classList.contains('branchFolderChildren')) {
					next.style.display = next.style.display === 'none' ? 'block' : 'none';
				}
			});
		});
	}
}
