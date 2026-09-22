# Smoji v0

当前界面的可交互基线，入口 `v0/index.html`。沿用现有布局、字体、主题、密度、
卡片显隐、图片动画及 React 交互。没有采纳消融实验的改版建议。

## 预览

在仓库根目录运行 `python -m http.server 4311 --bind 127.0.0.1 --directory designs`，
访问 `http://localhost:4311/smoji/v0/`。这是独立静态快照，预览不需要 pnpm 或构建。
不要通过 file:// 打开。

## 数据与边界

- 保留 35 个分类；首分类 144 张、其余每类 6 张，共 348 张公开表情样本。
  计数如实反映样本，未冒充完整的 5,830 张生产目录。
- 所有样本图片、JS、CSS、字体与 favicon 均位于 v0 内；图片按生产 SHA-256 校验。
- 使用 `smoji-prototype-v0:*` 存储，与正式工作台分开。文件导出和复制可操作，
  导出的 URL 指向本地演示资源，仅用于交互评审。
- 历史地址迁移表为空，不宣称覆盖旧用户数据恢复。服务端、CI、SDK 发布不在原型范围。
- 本版本为 `needs-review`，不是批准实施的设计。产品实现和原型的批准独立。

## 来源与可维护性

`build-v0.mjs` 复用现有 React 源码，通过构建期转换隔离数据、存储及资源路径。
生产源码没有修改，也不会运行时导入 designs。`source-fingerprint.json` 固定输入；
如果当前源码改变，重建会拒绝，后续应创建 v1，而不是覆盖 v0。

生成方式（依赖使用根 pnpm-lock）：

```powershell
linux-task.ps1 -Mode build -Project 'D:/Forgejo/Smoji' -Command 'pnpm generate:packs && node designs/smoji/build-v0.mjs'
```

将生成的 `designs/smoji/v0/` 及两份 provenance/fingerprint JSON 从查询到的镜像
复制回 Windows 的同名设计目录；仅复制这些设计产物。许可证随快照保留。

UI 入口由 Baoyu-Design 的 `record-asset.mjs` 登记；内容和流程检查由项目级
prototype-first-ui 的验证脚本执行。设计说明和审批信息只在文档/元数据中，
不渲染在产品界面。

## 已完成的验证

- `verify-v0.mjs`：Chromium 153，1440 / 834 / 390 / 320 px。验证加载、键盘网格、
  详情前后切换和关闭回焦、真实 JSON 下载、自选创建/批量加入、撤销重做、删除取消、
  帮助、密度、深色主题，以及加载失败/重试和存储失败提示。
- 正常流程无页面脚本异常、失败资源请求或外部资源请求；生产存储哨兵未被改写。
- 内容清单：1,312 个字符串已分类；结构、UI 契约、来源及设计范围检查通过。
- 43 份原始 DOM 采集（包括所有位置）压缩保存在
  `evidence/v0/dom-captures.json.gz`；解压后是以原文件名为键的 JSON 对象。
  可访问性树保留为同目录 `*.a11y.txt`，代表性截图也在该目录。
- 文案分类是对已有操作文案的审查，不是用户设计批准；导出预览的超长 JSON 文本
  在 DOM 采集器中截断，下载内容另有解析断言。常规输入值按采集器规则不收集。
- 已在 Windows 的 Codex 内置浏览器打开并检查预览，控制台无错误或警告。

尚未单独验证真实 Safari/手机、屏幕阅读器、实际系统剪贴板写入和拖拽；没有将
这些结果宣称为完整产品回归或上线验收。v0 重现原界面的已知行为，包括图片动画
和 28 px 快捷操作，不把改版混进基线。
