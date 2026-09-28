# Smoji 原型

## 已批准版本 v2（全量前端重设计）

入口：[v2/index.html](v2/index.html)，静态预览：<http://localhost:4311/smoji/v2/>
（仓库根目录运行 `python -m http.server 4311 --bind 127.0.0.1 --directory designs`）。
源码在 `v2-src/`，`node designs/smoji/build-v2.mjs --dev` 在 <http://127.0.0.1:4312/> 提供热更新预览，
不带参数则重新生成 `v2/`。用户按下述修订（去掉搜索、图库静帧、模糊占位）批准实施，状态 `approved`。

- **分工与结构**：左侧分类栏（每个分类带封面表情）→ 中间白色图库“底板”→ 右侧常驻导出栏。
  “按分类导出 / 自选分组”放在导出栏顶部，模式决定导出内容，图库卡片的动作随之变化；原浮动 Dock 取消。
  900 px 以下改为顶部分类条 + 分类抽屉 + 底部导出栏与导出面板。
- **视觉**：暖纸色背景、墨色文字，唯一强调色是荧光黄绿，只用于“已选 / 已入组 / 当前”状态；
  表情不再套边框卡片，悬停时贴纸抬起、倾斜并投影。沿用原 favicon 的撕角贴纸造型，重新配色。
  字体继续使用 IBM Plex Sans / Mono（OFL）与系统中文字体，没有新增依赖。浅色 / 深色 / 跟随系统保留。
- **图片加载**：图库、分类栏、托盘一律显示静态帧，只加载接近视口的图片，同时最多 6 个请求；
  悬停或键盘聚焦卡片时才叠加播放该张原动图，详情页播放原图，减少动态效果偏好下不播放。
  生产使用 CI 生成的 160 px 预览（动图取最清晰的一帧）；没有预览时解码原图，保留首帧的
  192 px 位图（最多缓存 360 张）并立即释放原图。离屏卡片 `content-visibility: auto`；吸顶标题不使用
  背景模糊。加载前显示模糊占位，加载完成后不论快慢都播放同一段模糊淡出；详情页以已缓存的静帧
  模糊图作占位。
- **新增交互**：卡片悬停直接复制（按当前复制格式）；详情页同时列出 4 种复制格式（Markdown、URL、HTML、BBCode），
  各自可复制；加入分组或选择分类时，缩略图飞向目标位置；分类列表合并为一个 Tab 停靠点
  （↑/↓ 切换分类，←/→ 切到勾选框）；触屏分组托盘每张只保留一个菜单，“从分组移出”并入菜单。
- **行为调整**：按分类模式下，只有已选分类的卡片显示排除按钮（历史排除状态照常显示与导出）。
  其余行为全部由生产 reducer、选择器、存储与导出模块驱动，未修改生产代码。
- **保留**：CDN 原图地址、36 个分类及顺序、5,934 张表情、排除 / 恢复、自选分组的新建、编辑、
  复制、合并、拆分、排序、拖放、导入 / 备份、50 步撤销重做、5 种导出格式、
  1 MB 限制、存储失败提示、确认框默认聚焦“取消”、关闭弹层后焦点归还。
- **隔离**：存储键改写为 `smoji-prototype-v2:*`；`data/previews.json` 以空对象替代，图库使用 CDN 原图。

验证（Linux Chromium，`linux-task.ps1 -Mode build -Project 'D:/Forgejo/Smoji' -Command 'node designs/smoji/verify-v2.mjs'`）：
1440 / 834 / 390 / 320 px 均通过加载、无横向溢出、图库无动图原图、仅加载视口附近图片、悬停只播放一张、
网格键盘、详情翻页与格式快捷键、关闭回焦、排除后真实下载 JSON、Twikoo 预览、自选分组、撤销重做、取消删除、帮助、密度、深色主题；
另测加载中、清单失败、重试成功与存储失败。正常流程无页面异常、失败请求或 CDN 以外的外部请求，
生产存储哨兵未被改写。`evidence/v2/` 保存代表性截图、验证结果和各 43 份压缩 DOM / 可访问性采集；
`content-inventory-v2.json` 共 1,215 条字符串，审计零错误零警告。

修订（2026-09-28）：按用户要求移除 Hugo 复制格式，复制格式快捷键改为 1–4；重新验证并批准。
真实手机、Safari、屏幕阅读器、系统剪贴板写入和拖放未单独验证。

## 版本 v1

入口：[v1/index.html](v1/index.html)，预览：<http://localhost:4311/smoji/v1/>。
在仓库根目录运行 `python -m http.server 4311 --bind 127.0.0.1 --directory designs`。

- 「大肥鱼」置于首位，104 张动态 WebP；完整中文描述来自用户指定的
  [上游中文清单](https://github.com/DejavuMoe/deepseek_wale_girl/blob/master/README.zh-CN.md)，
  保存在 `deepseek-wale-girl.json`，文件名逐一匹配本地素材。
- 保留线上全部 35 组、5,830 张表情及顺序，总计 **36 组、5,934 张**。
  `v1/smoji.json` 使用生产 CDN 绝对地址；浏览、复制和导出均指向这些地址。
- `build-v1.mjs` 直接复用当前生产 React 界面，保留样式与交互；仅隔离存储前缀
  `smoji-prototype-v1:*` 并适配静态预览路径。图库使用 CDN 原图，不含 CI 生成的
  缩略图索引；需要联网。`source-fingerprint-v1.json` 固定源码和清单输入。
- Linux 构建命令：`linux-task.ps1 -Mode build -Project 'D:/Forgejo/Smoji' -Command 'node designs/smoji/build-v1.mjs'`。
  此命令用于审批时冻结的源码输入；实施后的工作区应直接预览已保存的 v1，
  不覆盖已批准产物。生产清单由 `pnpm generate:packs` 维护。
- 验证命令：`linux-task.ps1 -Mode build -Project 'D:/Forgejo/Smoji' -Command 'node designs/smoji/verify-v0.mjs v1'`。
  已比对线上全部清单条目，检查 104 个新 CDN 地址的 WebP 响应，并完成
  1440 / 834 / 390 / 320 px 的加载、键盘、详情回焦、JSON 下载、自选分组、
  撤销重做、取消删除、帮助、主题和错误恢复检查。正常流程无失败请求或页面异常。
- `evidence/v1/` 保留截图、可访问性树、验证结果及 43 份压缩 DOM 采集；
  `content-inventory-v1.json` 的 1,102 条文本已分类并通过审查。
  Windows 内置浏览器预览无控制台警告或错误。真实手机、Safari、屏幕阅读器、
  系统剪贴板写入和拖拽未单独验证。
- 用户已批准 v1；状态为 `approved`。实施范围为命名规则兼容、清单生成与首位排序，
  与设计审批分开提交，不包含推送或发布。

生成后仅将 v1 目录、`source-fingerprint-v1.json` 和 `evidence/v1/` 从查询到的
WSL 镜像复制回 Windows 对应设计目录，不回写其他目录。

## 生产实施验证

审批提交：`c659196`。生产清单与 v1 的全部条目、描述、顺序和 CDN URL 完全一致。
编号 WebP 已接入清单生成、开发服务和缩略图生成；既有稳定文件名仍受支持。
ImageMagick 的动画帧 `-clone` 操作已补齐括号，保持最清晰帧的选择逻辑。

- Linux `pnpm check`：136 项测试、类型检查、构建和体积检查通过。
- `scripts/verify-site-output.mjs`：构建产物检查通过。
- Chromium 的 pack/export/responsive/keyboard E2E：39 通过，1 个触屏专用用例跳过。
- `node designs/smoji/verify-v0.mjs production`：四种视口、真实 CDN、导出、键盘、
  回焦、分组与错误恢复通过。截图、43 份 DOM / 可访问性采集与验证结果位于
  `evidence/production/`；内容审查 1,102 条，零警告。
- `cdn-catalog-check.json`：5,934 个 CDN 地址均返回非空图片。
  `cdn-integrity.json`：新增 104 张的 CDN 响应与本地素材逐字节、SHA-256 一致。
- 独立临时目录无本地素材时，104 张动态 WebP 全部从 CDN 下载并生成缩略图。
- Windows 本地 `packs` 已移入回收站；删除后重新生成的全部清单元数据逐字节不变。
  无 `packs` 的 Linux 镜像也再次通过构建和产物检查。

验证不代表部署：未 push，未修改在线站点。当前浏览器结果基于 CDN 原图，
不宣称真实手机、Safari、系统剪贴板、拖拽或所有既有表情缩略图已完整验证。

## 历史版本 v0

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
