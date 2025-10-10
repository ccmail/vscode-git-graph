class PushCommitWidget {
	private readonly view: GitGraphView;
	private currentRepo: string | null = null;
	private readonly widgetElem: HTMLElement;
	private readonly contentElem: HTMLElement;
	private readonly confirmBtn: HTMLButtonElement;
	private dockDividerElem: HTMLElement | null = null;
	private appliedDockClass: boolean = false;

	constructor(view: GitGraphView) {
		this.view = view;

		this.widgetElem = document.createElement('div');
		this.widgetElem.id = 'pushCommitWidget';
		this.widgetElem.innerHTML = '<h2>' + tl('Push Commit', '提交级推送') + '</h2>' +
			'<div id="pushCommitDockContent" class="pushCommitDockContent"></div>' +
			'<div class="pushCommitDockFooter"><button id="pushCommitDockConfirm" class="roundedBtn primary" disabled>' + tl('Push', '推送') + '</button></div>' +
			'<div id="pushCommitWidgetClose"></div>';
		document.body.appendChild(this.widgetElem);

		this.contentElem = document.getElementById('pushCommitDockContent')!;
		this.confirmBtn = document.getElementById('pushCommitDockConfirm') as HTMLButtonElement;
		const closeElem = document.getElementById('pushCommitWidgetClose')!;
		closeElem.innerHTML = SVG_ICONS.close;

		closeElem.addEventListener('click', () => this.close());
		this.confirmBtn.addEventListener('click', () => {
			if (this.confirmBtn.disabled) return;
			if (this.view.confirmPushCommit()) {
				this.close(true);
			}
		});
	}

	public show(target: DialogTarget & CommitTarget, initial: PushCommitInitialState) {
		const repo = this.view.getCurrentRepoPath();
		if (typeof repo !== 'string') return;

		this.view.closeSettingsWidget();
		this.view.closeBranchesPanel();
		this.view.cancelPushCommitSession();

		this.currentRepo = repo;
		const hasSettingsDock = document.body.classList.contains('settingsDocked');
		if (!hasSettingsDock) {
			document.body.classList.add('pushCommitDocked');
			this.appliedDockClass = true;
		} else {
			this.appliedDockClass = false;
		}

		this.contentElem.innerHTML = '';
		this.setConfirmEnabled(false);

		alterClass(this.widgetElem, CLASS_TRANSITION, false);
		this.widgetElem.classList.add(CLASS_ACTIVE);
		document.body.classList.add('dockOpen');

		this.applyDockedWidth();
		this.view.startPushCommitDockSession(target, initial, this.contentElem, (enabled) => this.setConfirmEnabled(enabled), () => this.onSessionDisposed());
	}

	public close(skipDispose: boolean = false) {
		if (!this.isVisible()) return;
		this.widgetElem.classList.add(CLASS_TRANSITION);
		this.widgetElem.classList.remove(CLASS_ACTIVE);
		document.body.classList.remove('dockOpen');
		if (this.appliedDockClass) {
			document.body.classList.remove('pushCommitDocked');
			this.appliedDockClass = false;
		}
		this.removeDockDivider();
		this.currentRepo = null;
		this.contentElem.innerHTML = '';
		this.setConfirmEnabled(false);
		if (!skipDispose) {
			this.view.cancelPushCommitSession();
		}
	}

	public isVisible() {
		return this.widgetElem.classList.contains(CLASS_ACTIVE);
	}

	public onSessionDisposed() {
		this.close(true);
	}

	private setConfirmEnabled(enabled: boolean) {
		this.confirmBtn.disabled = !enabled;
		alterClass(this.confirmBtn, CLASS_DISABLED, !enabled);
	}

	private isDockedMode(): boolean {
		return document.body.classList.contains('settingsDocked') || document.body.classList.contains('pushCommitDocked');
	}

	private applyDockedWidth() {
		if (!this.isDockedMode()) return;
		let pct: number | null = null;
		const repoState = this.currentRepo ? this.view.getRepoState(this.currentRepo) : null;
		if (repoState && typeof (repoState as any).settingsDockPct === 'number') {
			pct = (repoState as any).settingsDockPct as number;
		}
		if (pct === null && repoState && typeof (repoState as any).settingsDockWidth === 'number') {
			const oldWidth = (repoState as any).settingsDockWidth as number;
			pct = this.computePctFromWidth(oldWidth);
			if (this.currentRepo !== null) {
				this.view.saveRepoStateValue(this.currentRepo as any, 'settingsDockPct' as any, pct as any);
			}
		}
		if (pct === null) pct = 0.3;
		const width = this.computeDockWidthFromPct(pct);
		document.body.style.setProperty('--gg-docked-settings-width', width + 'px');
		if (this.currentRepo !== null) this.createDockDivider();
	}

	private computeDockWidthFromPct(pct: number) {
		let p = pct;
		if (p < 0.2) p = 0.2;
		if (p > 0.6) p = 0.6;
		let width = Math.round((window.innerWidth || document.documentElement.clientWidth || 0) * p);
		if (width < 260) width = 260;
		if (width > 600) width = 600;
		return width;
	}

	private computePctFromWidth(width: number) {
		const vw = Math.max(window.innerWidth || 0, 1);
		return Math.max(0.2, Math.min(0.6, width / vw));
	}

	private createDockDivider() {
		if (!this.isDockedMode()) return;
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
			const controlsWidth = parseInt(getComputedStyle(document.body).getPropertyValue('--gg-side-toolbar-width')) || 44;
			if (document.body.classList.contains('controlsSideRight')) {
				width = Math.max(260, window.innerWidth - x - controlsWidth);
			} else {
				width = Math.max(260, x - controlsWidth);
			}
			const newPct = this.computePctFromWidth(width);
			document.body.style.setProperty('--gg-docked-settings-width', this.computeDockWidthFromPct(newPct) + 'px');
			applyDividerPos();
			if (this.currentRepo !== null) {
				this.view.saveRepoStateValue(this.currentRepo as any, 'settingsDockPct' as any, newPct as any);
			}
		};
		const onMouseUp = () => {
			dragging = false;
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
		this.dockDividerElem.addEventListener('mousedown', (e) => {
			dragging = true;
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onMouseUp);
			e.preventDefault();
		});
		window.addEventListener('resize', applyDividerPos);
	}

	private removeDockDivider() {
		if (!this.dockDividerElem) return;
		this.dockDividerElem.remove();
		this.dockDividerElem = null;
	}
}
