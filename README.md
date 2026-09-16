# Smoji

<p align="center">
  <strong>现代化开源表情库、配置管理工作台与轻量 Web 表情选择器</strong>
</p>

<p align="center">
  <a href="https://smoji.zsh.moe">在线体验</a> ·
  <a href="https://github.com/DejavuMoe/Smoji">源代码</a> ·
  <a href="https://github.com/DejavuMoe/Smoji/issues">问题反馈</a> ·
  <a href="packages/smoji/data.schema.json">JSON Schema 规范</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Dependencies-Zero-success.svg" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/Core_Gzip-%3C1.6KB-brightgreen.svg" alt="Core Bundle Size" />
</p>

---

## 📖 项目简介

**Smoji** 是一套面向个人博客、文档网站与社区论坛的开源图片表情管理与集成工具，由两部分组成：

1. **表情工作台（Web App）**：无需注册账号，纯浏览器端运行。用户可在线浏览高清静态与动态表情，灵活自由地管理自选分组、实时预览多格式导出代码，并一键生成 **Artalk、Twikoo、OwO、Waline、Ecoku / Smoji** 等主流评论系统与 Markdown 文档的配置文件。
2. **轻量表情选择器（Picker SDK）**：采用原生 TypeScript 编写、**零运行时依赖（无框架绑定）**、压缩体积小于 1.6 KB (Gzip) 的 Web 表情选择器组件与严格防注入渲染器，便于前端开发者或网站主直接嵌入自己的网页。

---

## 🎨 工作台使用指南

Smoji 工作台提供直观、高效的表情浏览与挑选体验，支持鼠标拖拽、触控操作与全键盘交互。

### 1. 核心导出模式

工作台提供两种核心操作模式，满足不同的筛选导出需求：

#### ① 整包导出模式 (Packs Mode)
适合直接使用图库现成预设分类（如经典贴吧、阿鲁、小黄脸等）：
- **批量勾选与反选**：在左侧分类导航栏中，点击单个表情包右侧的复选框进行勾选；或通过顶部的「全选 / 反选」与「清空」按钮快速批量切换。
- **分类内单项排除与恢复**：勾选某一分类后，若其中有个别表情不需要，可在表情网格中悬浮点击卡片右上角的 **`−`** 按钮将其排除（排除后卡片呈半透明状态）；再次点击 **`↺`** 按钮即可重新恢复。
- **分类整包快捷控制**：图库顶部提供批量操作按钮，支持一键「排除本包全部表情」或「恢复本包全部表情」。

#### ② 自选分组模式 (Custom Mode)
适合博主精选表情，自由组合专属表情包：
- **创建自定义分组**：
  - 在侧边栏输入「分组名称」（1 ~ 40 个字符，不能含 `]` 符号或控制字符）；
  - 可展开「自定义 ID」输入专属英文标识（允许字母数字开头，包含 `.`、`_`、`-`，最多 64 字符；留空则自动按序号生成）；
  - 单个清单最多支持创建 **64** 个自选分组。
- **添加表情到分组**：
  - **网格点击**：鼠标悬停在表情卡片上，点击右上角的 **`+`** 即可加入当前激活的目标分组；
  - **拖拽投放**：桌面端可直接将网格中的表情卡片拖动到左侧任意自选分组项或展开的托盘中；
  - **整包批量添加**：点击图库顶部的「本分类全部加入」，可将当前源分类内的所有表情一次性加入当前自选分组（自动跳过重复项，严格受容量上限保护）；
  - **从详情弹窗加入**：在表情详情窗口中点击底部「+ 加入当前分组」；若尚未创建分组，点击「+ 创建自选分组并加入」会自动以源分类名创建新分组并将其收录。
- **分组托盘与表情管理**：
  - 点击分组名称下方的计数按钮（如 `12 张 ▾`）可展开该分组的缩略图托盘；
  - **移除表情**：在托盘缩略图右上角点击 **`×`**，即可将表情移出该分组；
  - **托盘内调序**：拖动缩略图直接调换位置；触控端可点击缩略图下方的 **`◀ / ▶`** 移动位置；当处于列表首项或末项时，点击方向按钮可直接将表情跨组转移至相邻分组；
  - **跨组拖拽**：在托盘之间拖动表情，可直接跨分组投放转移。
- **分组高级管理工具**（点击各分组右侧「管理」展开）：
  - **编辑**：修改分组名称与 ID；
  - **复制**：克隆当前分组为独立新副本（自动追加 `_copy` 后缀），便于制作派生变体；
  - **上合并**：将当前分组内的全部表情合并到上一个分组（自动去重）；
  - **拆分**：将当前分组对半拆分为两个新分组（下半部分自动追加 `_part` 后缀）；
  - **上移 / 下移**：调整分组在侧边栏及导出配置文件中的前后顺序；
  - **删除**：移除当前自选分组（弹出对话框确认，防止误触）。
- **视图切换（源分类 / 已入组）**：
  - 在自选分组模式下，图库顶部提供「源分类」与「已入组」视图切换；
  - 切换至「已入组」视图后，网格仅展示当前自选分组已收录的表情，方便集中审查与删减。

---

### 2. 表情详情与多格式快捷复制

点击网格或托盘中的任意表情，即可打开全功能详情窗口：

- **高清与动图播放**：自动展示无损高清原图，动态 WebP / GIF 表情自动循环播放。
- **背景模式切换**：提供 3 种底色背景，便于排查透明通道与深浅边缘：
  - **透明（棋盘格）**：默认棋盘格背景，精确观察半透明像素与边缘透明度；
  - **浅底（纯白）**：白色纯净背景，模拟亮色主题网页阅读体验；
  - **深底（纯黑）**：黑色背景，核验表情在暗色主题下是否存在白边或黑边。
- **5 种格式快捷复制**：内置实时复制控制台，按对应数字快捷键或点击 Tab 切换格式，点击「复制」一键写入剪贴板：
  1. **Markdown**（快捷键 <kbd>1</kbd>）：`![smoji:表情名](图片绝对URL)`（遵循 Smoji 规范标记，直接粘贴至博客评论或文档）
  2. **URL**（快捷键 <kbd>2</kbd>）：图片绝对 HTTP(S) 地址（用于论坛外链、网页设计与图片插入）
  3. **Hugo**（快捷键 <kbd>3</kbd>）：Hugo 短代码 `{{< inTextImg url="..." alt="..." >}}`
  4. **HTML**（快捷键 <kbd>4</kbd>）：标准 HTML 标签 `<img src="..." alt="...">`
  5. **BBCode**（快捷键 <kbd>5</kbd>）：Discuz 等传统论坛格式 `[img]图片绝对URL[/img]`
- **表情切换**：点击窗口左右箭头、键盘按 <kbd>←</kbd> / <kbd>→</kbd>、或在触屏上左右滑动，可无缝切换上一个 / 下一个表情。

---

### 3. 多平台配置导出说明

Smoji 工作台支持将勾选或自选的表情一键导出为各大博客与评论系统所需的配置文件。

#### 导出文件命名规则
> [!NOTE]
> 为避免用户多次导出同名文件时在浏览器下载目录发生静默覆盖，工作台所有导出的下载文件名默认会自动附加 **`YYYYMMDD`** 日期后缀（例如 `smoji-20260913.json`、`waline-20260913.json`）。如目标系统要求固定文件名，使用前只需将日期后缀删除即可。

| 导出格式 | 实际下载文件名示例 | 适用系统 / 使用方式 |
| :--- | :--- | :--- |
| **Smoji v1** | `smoji-YYYYMMDD.json` | **Ecoku** 原生评论系统、Smoji Picker SDK 核心库。采用精简 URL 模板机制，大幅缩减清单文件体积。 |
| **Artalk** | `artalk-YYYYMMDD.json` | **Artalk v2+** 自托管评论系统。导出的 JSON 数组可直接配置在 Artalk 服务端或前端表情设置中。 |
| **Twikoo** | `twikoo-YYYYMMDD.json` | **Twikoo** 无服务器评论系统。导出的对象格式以分组名为键，图片封装在 `container` 中。 |
| **OwO** | `OwO-YYYYMMDD.json` | **Valine** 及各类兼容 OwO 规范的静态博客评论插件。 |
| **Waline** | `waline-YYYYMMDD.json` | **Waline** 官方 `emoji` 配置对象数组。Origin 映射为 `folder`，`items` 保留完整文件名与扩展名，原生支持 WebP / GIF / PNG 混用。 |
| **Markdown** | `smoji-markers-YYYYMMDD.md` | Markdown 格式文档。导出所有选中表情的绝对链接标记，按分类列出，便于留存备忘。 |
| **分组备份** | `smoji-custom-groups-YYYYMMDD.json` | **Smoji 自选分组备份包**。保存完整的自选分组结构、备注与设置，支持在不同设备间无缝导入恢复。 |

#### 导出方式
1. **底部浮动 Dock 栏**：勾选表情后，屏幕底部会自动浮出导出栏。选择目标格式后点击「导出」（或快捷键 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>E</kbd>）即可直接触发下载。
2. **图库快捷导出**：在图库顶部工具栏的「快捷导出」下拉菜单中快速选择格式下载。
3. **数据实时预览窗口**：
   - 点击顶部导航栏的「数据预览」或快捷键 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> 打开预览窗口；
   - 支持在 **当前分类 / 已勾选项目 / 全部表情**（自选模式下为 **当前自选分组 / 全部自选分组**）之间切换数据范围；
   - 实时预览生成的 JSON / Markdown 代码，支持「复制完整代码」与「下载此格式」。

---

### 4. 自选分组导入、导出与备份

在自选分组模式下，展开侧边栏「导入与管理」面板：
- **导出分组**：将当前建立的全部自选分组及其排序完整打包导出为 `smoji-custom-groups-YYYYMMDD.json` 文件；
- **导入分组**：点击「导入分组」选择之前备份的 JSON 文件。若当前已有分组，系统会弹出对话框提示并进行安全合并；重复 ID 将自动重命名，失效的图片地址会自动过滤；
- **填写备注**：支持在「备注」输入框填写描述信息（最多 240 字），该备注会随分组文件一同保存；
- **清空分组**：一键清空全部自选分组（带防误触确认弹窗，误删可按撤销恢复）。

---

### 5. 撤销与重做系统

工作台内置最多 **50 步** 操作历史记录栈：
- 当您误删分组、误移出表情、清空分组或误调顺序时，直接按下 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> 即可撤销操作；
- 按下 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>（或 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Y</kbd>）即可重做。

---

## ⌨️ 快捷键指南

Smoji 针对全键盘操作与无障碍浏览（A11y）进行了严格适配：

| 快捷键 | 作用区域 | 功能说明 |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>1</kbd> | 全局 | 切换至「整包导出」模式 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>2</kbd> | 全局 | 切换至「自选分组」模式 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>E</kbd> | 全局 | 触发底部 Dock 导出当前选中的配置 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>.</kbd> | 全局 | 聚焦到底部 Dock 导出格式下拉选择框 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | 全局 | 打开实时数据预览窗口 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>D</kbd> | 全局 | 切换图库显示密度（紧凑 / 舒适） |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> | 全局 | 撤销最近的移出、删除、修改或清空分组操作 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> | 全局 | 重做已撤销的操作 |
| <kbd>?</kbd> | 全局 | 打开接入与规范说明指南窗口 |
| <kbd>Esc</kbd> | 弹窗 / 浮层 | 关闭当前详情窗口、代码预览、确认对话框或侧边栏 |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | 表情网格 | 网格内键盘漫游移动焦点 |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | 表情网格 | 打开当前聚焦表情的详情窗口 |
| <kbd>←</kbd> / <kbd>→</kbd> | 详情弹窗 | 切换至上一个 / 下一个表情 |
| <kbd>1</kbd> ~ <kbd>5</kbd> | 详情弹窗 | 切换复制格式（1: Markdown, 2: URL, 3: Hugo, 4: HTML, 5: BBCode） |
| <kbd>Space</kbd> | 详情弹窗 | 切换当前表情状态（整包模式：排除/恢复；自选模式：加入/移出） |
| <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | 自选分组列表 | 上移 / 下移调整选中分组的位次 |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | 分组托盘 | 调整当前表情在托盘内的位置（首尾项可直接跨越至相邻分组） |

---

## 📐 规格与约束限制

Smoji 遵循标准的单文件清单规范（遵循 [JSON Schema](packages/smoji/data.schema.json)），工作台与校验器严格执行以下硬性限制：

- **最大表情包分组数**：最多 **64** 个分组（1 ~ 64）
- **每分组表情项上限**：每个分组最多 **600** 项表情（1 ~ 600）
- **单清单总表情数上限**：总计不超过 **6000** 个表情
- **清单文件体积上限**：UTF-8 编码体积不超过 **1024 KiB (1 MiB)**
- **标识符 (ID) 规范**：由字母或数字开头，仅允许字母、数字、`.`、`_`、`-`，长度 1 ~ 64 位
- **标签名 (Label) 规范**：非空，两端去除空格后最多 40 个 Unicode 字符，且不得包含 `]` 符号或 C0/C1 控制字符
- **图片 URL 规范**：必须为 `http:` 或 `https:` 协议绝对地址，禁止包含凭据（用户名/密码）、查询参数（`?`）或片段标识符（`#`）

---

## 🔒 隐私与本地存储

- **无须登录与隐私安全**：Smoji 是纯前端驱动的无状态应用，不向远端服务器发送或存储您的任何个性化配置。
- **本地持久化机制**：所有的自选分组、排除项、勾选状态、界面密度偏好（紧凑/舒适）与主题模式（跟随系统/浅色/深色）均保存在浏览器的 `localStorage` 中。
- **持久化键值**：
  - `smoji-workbench:custom-packs`：自选分组内容与表情列表
  - `smoji-workbench:selected-pack-ids`：整包模式下勾选的分类 ID
  - `smoji-workbench:excluded-srcs`：整包模式下排除的单项表情地址
  - `smoji-workbench:density` / `smoji-theme`：界面密度与主题外观
  - `smoji-workbench:custom-group-extensions`：自选分组的备注与扩展偏好

---

## 🔌 网页表情选择器 SDK 集成

除了在线工作台，本项目还提供了独立的原生轻量表情选择器核心库（`packages/smoji`），可嵌入至个人博客或 Web 页面。

### 特点
- **零外部运行时依赖**：原生纯 JavaScript / TypeScript 编写，不捆绑 React、Vue 或任何大型 UI 框架；
- **极致羽量**：JS 核心压缩后约 3 KB (Gzip 约 1.5 KB)，CSS 约 1.9 KB (Gzip 约 800 B)；
- **防 XSS 注入设计**：渲染器采用严格的 DOM 原生节点构造，**绝不使用 `innerHTML`**，防止恶意脚本注入。

### 1. 基础集成示例

```typescript
import { createSmoji, textTarget } from 'smoji'
import { smojiMarker } from 'smoji/marker'
import 'smoji/style.css'

const triggerBtn = document.querySelector<HTMLButtonElement>('#emoji-button')!
const textarea = document.querySelector<HTMLTextAreaElement>('#comment-input')!

// 初始化选择器
const picker = createSmoji({
  trigger: triggerBtn,
  target: textTarget(textarea, { serialize: smojiMarker }),
  packs: [
    {
      id: 'bilibili',
      label: '哔哩哔哩',
      items: [
        { id: 'smile', label: '微笑', src: 'https://s3-cdn.zsh.moe/smoji/bilibili/smile.webp' },
        { id: 'like', label: '点赞', src: 'https://s3-cdn.zsh.moe/smoji/bilibili/like.webp' },
      ],
    },
  ],
  closeOnSelect: true,
  onSelect: (item, pack) => {
    console.log(`选中表情：${pack.label} - ${item.label}`)
  },
})

// 编程式控制 API
// picker.open()   // 打开面板
// picker.close()  // 关闭面板
// picker.toggle() // 切换展开/关闭
// picker.destroy() // 销毁实例与解绑事件
```

### 2. 加载远程表情清单

```typescript
import { loadSmojiManifest } from 'smoji/manifest'

// 加载清单（内置超时控制、1MB 体积防护与同源图片校验）
const manifest = await loadSmojiManifest('https://s3-cdn.zsh.moe/smoji/smoji.json', {
  timeoutMs: 8000,
})

console.log(`成功加载 ${manifest.packs.length} 个表情包`)
```

清单镜像在站点、图片托管在 CDN 时，可通过 `imageBaseUrl` 指定受信任的图片基准 URL。图片仍须与该 URL 同源；此选项应来自应用配置，不能取自远程清单内容。默认仍按清单请求地址校验。

### 3. 安全渲染评论表情 (Zero XSS)

```typescript
import { renderSmojiContent } from 'smoji/marker'

const commentBox = document.querySelector<HTMLElement>('#comment-body')!
const rawText = '写得太棒了！![smoji:点赞](https://s3-cdn.zsh.moe/smoji/bilibili/like.webp)'
const manifestUrl = 'https://s3-cdn.zsh.moe/smoji/smoji.json'

// 仅与清单图片同源且协议合法的标记会被转为安全 <img> 节点，其他内容作为纯文本节点插入
renderSmojiContent(commentBox, rawText, manifestUrl)
```

---

## 工作台 CI 部署

`master` push 通过 `.woodpecker/verify.yml` 验证后，由 `.woodpecker/deploy.yml` 在 `netcup-nano` 构建并发布站点。发布容器仅挂载 `/var/www/smoji.zsh.moe:/deploy`；宿主机该路径必须是实体目录。

```text
/var/www/smoji.zsh.moe/
├── .deploy.lock
├── html -> releases/<commit>-<pipeline>-<rerun>
└── releases/
    └── <commit>-<pipeline>-<rerun>/
```

Nginx 的站点根目录为 `/var/www/smoji.zsh.moe/html`。发布脚本校验产物、加锁并原子替换 `html`，拒绝旧流水线覆盖新版本；保留旧版本供手动回滚，并延续旧的哈希资源以支持已经打开的页面。发布验证覆盖文件与软链接，线上 HTTP 状态另行检查。

从旧布局迁移时，先确保没有 Smoji 发布任务正在执行或等待执行，再移除 `/var/www/smoji.zsh.moe` 旧软链接、清理 `/var/www/.smoji.zsh.moe-releases` 并创建同名实体站点目录。清理会删除旧静态产物，站点在新 CI 发布完成前暂时不可用。将 Nginx 原有 `root /var/www/smoji.zsh.moe;` 改为 `root /var/www/smoji.zsh.moe/html;`，执行 `sudo nginx -t && sudo systemctl reload nginx`，准备完成后再推送新版 CI；不要重跑旧布局的发布任务。

本地验证：先执行 `pnpm build:workbench`，再运行 `sh -n scripts/publish-site.sh && node scripts/test-publish-site.mjs`。隔离验证使用临时目录并自动清理。`SMOJI_DEPLOY_ROOT` 可覆盖默认 `/deploy`，替代旧的 `SMOJI_DEPLOY_PARENT` / `SMOJI_DEPLOY_SITE`。

---

## 📄 许可证与版权说明

- **代码许可**：本项目代码基于 [MIT License](LICENSE) 开源。
- **字体许可**：工作台内嵌的 IBM Plex 字体遵循 [SIL Open Font License](https://scripts.sil.org/OFL)。
- **素材免责声明**：Smoji 索引并呈现的各类表情包知识产权与版权均归原作者或其合法权利人所有，仅供个人学习、交流与展示使用。商业使用请获得原作者许可。
