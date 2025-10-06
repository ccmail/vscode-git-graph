# 里程碑：分支菜单与 Uncommitted 降级兜底（2025-10-06）

本里程碑聚焦三个方面：
- 分支面板交互完善：双击/右键菜单在 Dock 内可靠弹出；
- Uncommitted Changes 卡加载的降级兜底方案；
- Dock 模式切换动画优化（单面板、无上滑冲突）。

## 主要改动
- 分支面板右键/双击菜单：
  - 双击或右键分支项，弹出 Git Graph 原生上下文菜单（Checkout Branch / Merge / Rebase / Diff with working tree / Pull / Fetch into local / Push / Rename / Delete …）。
  - 修复 Dock 内菜单层级：菜单渲染到 Dock 容器，类名 `.dockMenu`（z-index=100），不会被面板遮挡。

- Uncommitted Changes 降级兜底：
  - 前端请求“未提交变更”详情超过 5s 仍 Loading，则自动切换到“比较视图（HEAD vs Working Tree）”；
  - 优先使用表格中的两行元素（Uncommitted/HEAD）调用 `loadCommitComparison` 按完整流程渲染；若找不到，退回 `requestCommitComparison`。

- Dock 切换动画优化：
  - Dock 模式下（settingsDocked）不使用上滑 transition，避免宽度不一致与双动画；
  - 分支与设置互斥显示，点击一方会关闭另一方。

## 影响范围
- 样式：`web/styles/contextMenu.css`（.dockMenu）、`web/styles/settingsWidget.css`、`web/styles/branchesWidget.css`
- 前端：`web/branchesWidget.ts`、`web/main.ts`

## 验收清单
- 分支面板：双击/右键分支可弹出菜单，菜单不被遮挡；
- 未提交变更：点击 Uncommitted Changes 可看到文件列表；若 5s 内后端无响应，会自动切换到比较视图展示；
- Dock 切换：分支与设置严格互斥，切换时无“上滑”动画冲突。

## 产物
- 版本：1.30.2
- VSIX：`git-graph-1.30.2.vsix`

