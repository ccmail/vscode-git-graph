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

### AI 回复语言规则（强制）
- AI 助手在本仓库的所有回应必须使用中文（简体）。
- 例外：代码、命令、路径、接口名、日志/报错信息可保持原文；当用户明确要求其他语言时可临时切换。
- 文档、提交说明、计划与进度同步等文字性内容一律中文表述，术语可适度保留英文原词（加反引号）。

### AI 回复语言规则（新增）
- AI 助手在本仓库的所有会话中，必须以中文进行回复。
- 例外：代码片段、命令、文件路径、API 标识符可保留英文原文；必要的英文术语可保留，但需配以简短中文说明。
- 若用户明确要求使用其它语言，仍优先以中文答复并可在需要处附英文原文。

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

### 提交级推送（Push Commit）使用说明（2025-10-07）
- 入口：左侧提交表 → 右键任一提交 → “推送(push)此前提交(含选中commit)”。
- 对话框：
  - Remote 下拉：选择远程（默认推断 `origin`）。
  - Branch 组合框（当前为可输入，后续升级为“可输入+候选过滤”）：输入目标远程分支名（不含 remote 前缀）。输入不存在的名称即表示“新建远程分支 <name>”。
  - Mode：Normal（仅快进）/ Force With Lease（强制带租约）/ Force（强制覆盖）。
  - 预览：展示 `<remote>/<branch>..commit` 的提交列表（左对齐卡片）。
- 执行：点击 Push → 后端执行 `git push <remote> <commit>:<branch>`，仅将远端更新到该提交（不会一并推送本地后续提交）。
- 验证：推送完成后刷新视图，关闭“正在执行”。

注意：切换 Remote/Branch 后的预览刷新在低网速/远程不可用时可能延迟；若添加远程时卡住，请在可用网络下重试或先手动验证远程可达性。

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

### 会话收尾约定（重要）
- 每次会话结束前，务必执行以下动作，便于干系人快速验证：
  - 运行 `npm run lint -- --fix`（修复 CRLF 与其它风格问题），随后 `npm run compile` 确认可编译。
  - 运行 `npm run package` 产出最新 VSIX（文件名形如 `git-graph-*.vsix`）。
  - 如进行了批量脚本生成的中间文件，请在打包前清理（避免被打入 VSIX）。

### 会话收尾文档总结规范（规则）
- 每次会话结束前，必须将“当前进度”固化到 `docs/`，采用如下命名与结构：
  - 进度说明：`docs/开发进度说明-YYYY-MM-DD.md`
    - 建议章节：本轮目标与范围、已完成、待解决问题、影响范围、验收建议、下一步计划、开发与构建（备忘）。
    - 要求：中文撰写；条目精炼、可操作；包含实际文件与命令引用（使用反引号标注路径/命令）。
  - 里程碑记录：`docs/YYYY-MM-DD-里程碑-<主题>.md`
    - 建议章节：主要改动、影响范围、验收清单、已知问题、产物。
    - 要求：中文撰写；主题聚焦单一里程碑；命名中的 `<主题>` 简洁明确。
- 命名约定：
  - 日期置前，使用公历 `YYYY-MM-DD`；中文文件名使用半角连字符连接，避免空格。
  - 若当日有多次重要提交，可按主题拆分多个“里程碑”文档；“进度说明”每日仅一份，必要时在同一文件内追记“更新记录”。
- 适用范围：
  - 凡完成“新增功能/修复/可见性优化/打包产物”的会话，均需新增当日文档；
  - 若仅进行微小注释/格式修复，可在最近一次“进度说明”文件中追加“更新记录”。

### 常见坑位
- 行尾与缩进：遵循 CRLF + Tab；若有 Lint 报警，执行 `npm run lint -- --fix`。
- 侧栏布局：采用 fixed 贴边 + 内容边距策略，避免 Grid/float 误引入顶部空白。
- Webview 激活事件：`*` 会有性能提示，后续可按需收紧。

### 参考文档
- 里程碑记录：`docs/2025-10-04-里程碑-Panel侧栏与行为修复.md`
- 里程碑记录：`docs/2025-10-06-里程碑-Docked宽度持久化与交互修复.md`
- 里程碑记录：`docs/2025-10-06-里程碑-分支菜单与Uncommitted降级兜底.md`
- 开发进度说明：`docs/开发进度说明-2025-10-04.md`
- 开发进度说明：`docs/开发进度说明-2025-10-06.md`

### Dock & 菜单与降级（实现约定）
- 右侧 Dock 仅允许一个面板（设置/分支）处于激活态；在显示任一面板前需关闭另一面板。
- Dock 模式关闭/打开不使用“上滑”动画（transition:none）。
- Dock 内上下文菜单使用 `.dockMenu` 类并挂载到 Dock 容器内，提升 z-index，避免被遮挡。
- Uncommitted Changes 请求超过 5 秒未响应时，前端自动切换到“比较视图（HEAD vs Working Tree）”作为兜底；若需要以“提交详情视图（CDV）”兜底，请在任务描述中明确，将在前端合成数据渲染 CDV。
