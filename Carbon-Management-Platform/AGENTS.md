# 界面组件约定

- 在本应用新增、删除、重命名或移动项目文件时，必须在同一次修改中同步更新上一级目录的 `项目文件架构图.md`，维护文件树中的路径和用途；影响模块关系时同步更新总体架构图。
- 页面中的筛选、表格、弹窗和表单等可独立维护的区域应抽成组件；服务端按业务领域拆分操作，公共逻辑放在明确的模块中。保持每个文件职责集中，避免继续积累大型混合职责文件。
- 页面布局、导航、排版、表单、反馈和操作优先使用 Ant Design 组件。只有 Ant Design 没有合适组件时才使用原生 HTML 或自定义组件。
- 可编辑表单的必填字段应通过 `Form.Item` 的 `name` 和 `rules` 绑定字段级校验；提交、发布等状态流转必须调用表单校验，并在服务端重复验证业务完整性。允许保存未完成草稿时，应明确区分“保存草稿”和“提交/发布”的校验要求。
- 页面反馈必须从当前组件的 `App.useApp()` 取得 `message`、`notification` 或 `modal` 实例；不要直接导入并调用 Ant Design 的静态 `message`、`notification` 或 `Modal.confirm`。本应用的 `Providers` 使用动态主题，静态调用会在浏览器显示 context 警告。交付前搜索新增代码中的静态反馈调用并验证相关交互。
- 使用当前锁定的 Ant Design API；修改界面后检查浏览器控制台的弃用提示，并清理同类用法。`Drawer` 用 `size`，`Select` 用 `popupRender`，`Space` 用 `orientation`；不要再使用它们的旧属性 `width`、`dropdownRender`、`direction`。
- 使用 Next.js `Link` 处理应用内路由；它可以作为 Ant Design `Menu`、`Button` 等组件的内容。
- 页面与组件自定义样式统一使用 Tailwind CSS 工具类；Ant Design 的组件令牌继续由 `ConfigProvider` 管理。不要新增 CSS Modules 或静态行内样式，也不重复实现 Ant Design 已提供的交互组件。
- 后台视觉风格参考 `/Users/hadancy/workspace/project/ryzk`：深蓝灰侧栏、蓝色主操作色、白色紧凑顶栏和页签、浅灰表格表头、紧凑筛选工具栏。保留本项目的品牌和业务信息，不引入参考项目的 Vue/Element 组件。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
