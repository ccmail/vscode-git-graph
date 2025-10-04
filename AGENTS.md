# 仓库指南

## 项目结构与模块组织
- `src/`：扩展后端（TypeScript），输出至 `out/`。
- `web/`：Webview 前端（TypeScript + CSS），输出至 `media/`。
- `tests/`：Jest 单测（`*.test.ts`），含 `helpers/`、`mocks/`。
- `resources/`：图标与静态资源（由 `package.json` 引用）。
- `.vscode/`：任务与调试配置（F5 运行“Run Extension”）。
- 构建产物与报告（`out/`、`media/`、`coverage/`、`*.vsix`）已被忽略。

## 构建、测试与本地开发
- 安装依赖：`npm install`
- 全量编译（含 lint、clean）：`npm run compile`
- 仅后端编译：`npm run compile-src`
- 仅前端编译：`npm run compile-web` | 调试版：`npm run compile-web-debug`
- 代码检查（零警告）：`npm run lint`
- 运行单测：`npm test` | 覆盖率：`npm run test-and-report-coverage`
- 打包 VSIX：`npm run package` | 打包并安装：`npm run package-and-install`
- 本地调试：在 VS Code 中按 F5 启动扩展宿主。

## 编译与运行（快速指引）
- 版本要求：VS Code ≥ `1.50.0`（面板模式依赖 WebviewView API）。
- 第一次拉取仓库后：先执行 `npm install`，随后 `npm run compile`。
- 常用分步编译：
  - 仅后端（扩展主进程）：`npm run compile-src`
  - 仅前端（Webview）：`npm run compile-web`（或 `npm run compile-web-debug`）
- 调试运行：VS Code 中按 F5，选择“Run Extension”。
- 打包分发：`npm run package` 生成 `*.vsix`，或用 `npm run package-and-install` 本机安装验证。

提示：如本地改动造成 Lint 报错（特别是行尾/缩进），请确保使用 CRLF 行尾与 Tab 缩进，并可运行：`npm run lint -- --fix`。

## 代码风格与命名约定
- 统一使用 TypeScript；制表符缩进；单引号；分号；1TBS 花括号；CRLF 换行。
- 命名：类用 `StrictPascalCase`，函数用 `camelCase`。
- 禁止 `console`/`eval`；需要日志请使用内部工具。
- 使用 ESLint 强制规则；提交前请运行 `npm run lint`。

## 测试规范
- 框架：Jest + ts-jest（见 `jest.config.js`）。测试文件以 `.test.ts` 结尾，存放于 `tests/`。
- 覆盖率：`npm run test-and-report-coverage`，收集 `src/` 与 `src/utils/`。
- 测试应可重复、聚焦；必要时使用 `tests/mocks/` 与 `tests/helpers/`。

## 提交与 Pull Request
- 提交信息使用祈使句，清晰简短；在提交/PR 中关联 Issue（如 `Closes #123`）。
- 每个 PR 聚焦一个逻辑改动；涉及 UI 的变更请附截图或说明。
- 确保本地通过：`npm run lint`、`npm test`、`npm run compile`。
- 请勿提交构建产物（`out/`、`media/`、`coverage/`、`*.vsix`）或仅用于本地包的版本号修改。

## 交流与语言约定
- 项目内“回复与文档”统一使用中文（包括 Issue、PR 描述与本指南）。

## 项目背景与目标（给下一位 AI 工程师）
- 项目类型：VS Code 扩展“Git Graph”的定制版，主要通过 Webview 呈现 Git 历史图与常用操作。
- 定制目标：
  - 汉化 Webview 文案，提高中文可读性；
  - 支持 Panel 模式并优化空间利用（侧栏贴边、缩减顶部空白）；
  - 状态栏入口与打开位置保持一致（editor/panel）；
  - 提供一键打开仓库终端的入口。
- 基线版本：上游 1.30.0；当前项目版本 1.30.1（本地定制）。

### 关键定制点（已落地）
- 新增设置：`git-graph.panel.controlsPosition`（Top | Left | Right，默认 Right）。
- Panel 侧栏：固定贴边的窄栏（左右可选），图标纵向排列；“Branches 下拉/Show Remote Branches”收纳为图标按钮。
- Panel 交互：补齐 `commitDetails` / `compareCommits` / `viewDiff*` / `viewFileAtRevision` 等消息处理，修复提交详情一直 Loading。
- 状态栏：
  - “Git Graph”遵循 `git-graph.viewLocation`；
  - 新增“终端”按钮（命令 `git-graph.openRepoTerminal`），支持多仓库选择。

### Panel 与 Editor 模式差异
- Editor 模式完整逻辑位于 `src/gitGraphView.ts`（消息处理齐全）。
- Panel 模式提供方为 `src/gitGraphPanelView.ts`，本项目已对齐 Editor 的关键消息处理；新增/调整时，记得两侧都要考虑。

### 新功能落点（套路速记）
1) 新设置：
   - `package.json` → `contributes.configuration` 声明；
   - `src/config.ts` 读取；若前端需要，`*View*.ts` 传入 initialState；
   - `web/main.ts` / CSS 消费与渲染。
2) 新命令/入口：
   - `src/commands.ts` 注册；
   - 若与 Webview 交互 → `postMessage`/`onDidReceiveMessage` 前后端各加一侧；
   - 状态栏/侧栏图标分别在 `src/statusBarItem.ts`、`web/main.ts` 处理。

### 验收清单（本地自测）
- 顶部无异常空白；右侧仅留窄侧栏空间；提交图与表头对齐；
- Panel 中点击提交可正确加载详情；
- 状态栏“Git Graph”与 `git-graph.viewLocation` 一致；
- 侧栏图标：分支下拉可打开；眼睛图标可切换远程分支；其余图标正常；
- 打包 VSIX 并可安装（`git-graph-*.vsix`）。

### 常见坑位
- 行尾与缩进：遵循 CRLF + Tab；若有 Lint 报警，执行 `npm run lint -- --fix`。
- 侧栏布局：采用 fixed 贴边 + 内容边距策略，避免 Grid/float 误引入顶部空白。
- Webview 激活事件：`*` 会有性能提示，后续可按需收紧。

### 参考文档
- 里程碑记录：`docs/2025-10-04-里程碑-Panel侧栏与行为修复.md`
- 开发进度说明：`docs/开发进度说明-2025-10-04.md`
