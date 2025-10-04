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
