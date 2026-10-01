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

工作台分为三栏：左侧是表情分类，中间是图库，右侧是导出栏。宽度小于 900 px 时，分类收进顶部的横向分类条与「分类」抽屉，导出栏收进底部汇总条，点「导出」展开为底部面板。鼠标、触控与全键盘都可以完成全部操作。

### 1. 两种导出模式

在导出栏顶部（窄屏在底部汇总条）切换「按分类导出」与「自选分组」。

#### ① 按分类导出
适合直接使用现成分类（如经典贴吧、阿鲁、小黄脸等）：
- **勾选分类**：点击分类右侧的勾选框；分类列表顶部提供「全选 / 反选」与「清空」。也可以在图库标题下点「选择本分类导出」。
- **排除单张表情**：分类被选中后，鼠标悬停表情，点右上角的 **`×`** 排除，排除后显示为淡化状态；再点 **`↺`** 恢复。触屏设备在详情窗口中操作。
- **整包排除 / 恢复**：图库标题下的「排除本分类全部」与「恢复本分类全部」。
- **已选分类**：导出栏列出已选分类与保留张数（如 `149/150`），点击可跳到该分类，点 **`×`** 取消选择。

#### ② 自选分组
适合挑选表情组成自己的表情包：
- **新建分组**：在导出栏输入分组名称（1 ~ 40 个字符，不能含 `]` 或控制字符）后点「添加」；展开「自定义 ID」可指定 ID（字母或数字开头，可含 `.`、`_`、`-`，最多 64 个字符，留空则按名称生成）。最多 **64** 个分组，新建的分组自动成为当前分组。
- **加入表情**：
  - 悬停表情点 **`+`**，加入当前分组；再点 **`−`** 移出；
  - 桌面端把表情直接拖到任意分组上；
  - 图库标题下的「本分类全部加入」一次加入当前分类的全部表情（自动跳过重复项，受 600 张上限保护）；
  - 在详情窗口中选择「目标自选分组」后点「加入」。
- **分组托盘**：每个分组下显示缩略图托盘。拖动缩略图可以排序或拖到其他分组；悬停后点 **`×`** 移出，点 **`…`** 可左移、右移、移至其他分组或移出。表情较多时，点托盘末尾的「+N」或「查看全部」进入「已入组」视图。
- **分组操作**（分组右侧 **`…`** 菜单）：编辑名称 / ID、复制分组、上移 / 下移、向上合并（自动去重，超过 600 张时不可用）、拆分分组（对半拆成两组）、删除分组（需确认）。
- **图库范围**：图库标题下切换「当前分类」与「已入组」，后者只显示当前分组已收录的表情，便于集中检查与删减。

### 2. 图库

- **静态预览**：网格只显示静帧，鼠标悬停或键盘聚焦时才播放动图，分类里有大量动图时也不会卡顿。图片只在接近可视区域时加载，加载前显示模糊占位，加载完成后统一以模糊淡出动画显现。
- **快捷复制**：悬停表情点复制按钮，按详情窗口中最近选择的格式直接写入剪贴板。
- **显示密度**：图库右上角切换「紧凑 / 舒适」，舒适模式显示表情名称。
- **渐进渲染**：大分类每次渲染 72 张，滚动到底部自动加载更多。

### 3. 表情详情与复制

点击图库或托盘中的表情打开详情窗口：
- **原图与动图**：展示原图，动态 WebP / GIF 循环播放；加载失败时显示「加载失败」并可重试。
- **预览背景**：透明（棋盘格）、浅底、深底，便于检查透明边缘和深浅主题下的效果。
- **四种格式同时列出**，每行都有「复制」按钮；按 <kbd>1</kbd> ~ <kbd>4</kbd> 选择格式：
  1. **Markdown**：`![smoji:表情名](图片绝对URL)`
  2. **URL**：图片绝对 HTTP(S) 地址
  3. **HTML**：`<img src="..." alt="...">`
  4. **BBCode**：`[img]图片绝对URL[/img]`
- 剪贴板不可用时，内容会放进已全选的输入框，按 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>C</kbd> 手动复制。
- **翻页**：点左右箭头、按 <kbd>←</kbd> / <kbd>→</kbd>，或在触屏上左右滑动。
- **底部操作按钮**随模式变化：选择整个分类导出、从导出中排除 / 恢复到导出，或加入 / 移出当前分组。打开详情后焦点就在这个按钮上，按 <kbd>空格</kbd> 即可执行。

### 4. 多平台配置导出

#### 导出文件命名
> [!NOTE]
> 为避免多次导出时浏览器静默覆盖同名文件，下载文件名会自动附加 **`YYYYMMDD`** 日期后缀（例如 `smoji-20260913.json`、`waline-20260913.json`）。如目标系统要求固定文件名，去掉日期后缀即可。

| 导出格式 | 下载文件名示例 | 适用系统 / 使用方式 |
| :--- | :--- | :--- |
| **Smoji v1** | `smoji-YYYYMMDD.json` | **Ecoku** 原生评论系统、Smoji Picker SDK 核心库。采用精简 URL 模板机制，大幅缩减清单文件体积。 |
| **Artalk** | `artalk-YYYYMMDD.json` | **Artalk v2+** 自托管评论系统。导出的 JSON 数组可直接配置在 Artalk 服务端或前端表情设置中。 |
| **Twikoo** | `twikoo-YYYYMMDD.json` | **Twikoo** 无服务器评论系统。导出的对象格式以分组名为键，图片封装在 `container` 中。 |
| **OwO** | `OwO-YYYYMMDD.json` | **Valine** 及各类兼容 OwO 规范的静态博客评论插件。 |
| **Waline** | `waline-YYYYMMDD.json` | **Waline** 官方 `emoji` 配置对象数组。Origin 映射为 `folder`，`items` 保留完整文件名与扩展名，原生支持 WebP / GIF / PNG 混用。 |
| **分组备份** | `smoji-groups-YYYYMMDD.json` | **Smoji 自选分组备份包**。保存完整的自选分组结构、备注与扩展数据，可在其他设备导入恢复。 |

#### 导出方式
1. **导出栏**：显示分类 / 分组数、表情张数和清单体积（上限 1 MiB）。选好格式后点「导出」，或按 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>E</kbd> 直接下载。没有可导出的表情或超出限制时，导出按钮不可用。
2. **数据预览**：点导出栏的「预览」，或按 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>：
   - 切换格式与范围：按分类模式为「已选择 / 全部 / 当前」，自选模式为「全部自选分组 / 当前分组」；
   - 可复制全部内容或下载当前格式；范围内没有表情时显示原因，复制与下载不可用。

### 5. 自选分组导入、备份与撤销

- 导出栏自选分组标题右侧的 **`…`**（导入与管理）菜单提供：「导入分组」「备份分组」和「清空全部」（需确认）。导入前会弹出确认；清单中找不到的表情会使导入整体取消，以免丢失数据。
- 分组列表下方的备注（最多 240 字）会随备份一同保存。
- 自选分组操作保留最多 **50 步** 历史：<kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> 撤销，<kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>（或 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Y</kbd>）重做，也可以点分组标题旁的撤销 / 重做按钮。

---

## ⌨️ 快捷键指南

按 <kbd>?</kbd> 可以在工作台内随时查看。

| 快捷键 | 作用区域 | 功能说明 |
| :--- | :--- | :--- |
| <kbd>Tab</kbd> | 页面 | 首个 Tab 聚焦「跳到表情图库」；分类列表、图库、分段选项各只占一个 Tab 停靠点 |
| <kbd>↑</kbd> <kbd>↓</kbd> | 分类列表 | 切换分类；<kbd>←</kbd> / <kbd>→</kbd> 在分类与其勾选框之间移动 |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> / <kbd>Home</kbd> <kbd>End</kbd> | 图库 | 在表情之间移动焦点 |
| <kbd>Enter</kbd> / <kbd>空格</kbd> | 图库 | 打开当前表情的详情 |
| <kbd>←</kbd> / <kbd>→</kbd> | 详情窗口 | 上一个 / 下一个表情 |
| <kbd>1</kbd> ~ <kbd>4</kbd> | 详情窗口 | 选择 Markdown、URL、HTML、BBCode（带修饰键时不响应） |
| <kbd>空格</kbd> | 详情窗口 | 执行底部操作：选择 / 排除 / 恢复，或加入 / 移出 |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | 分组托盘 | 在托盘内左右排序 |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | 分组托盘 | 将表情移出分组，焦点移到相邻缩略图 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> | 全局 | 撤销自选分组操作 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> | 全局 | 重做 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | 全局 | 打开或关闭数据预览 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>E</kbd> | 全局 | 下载当前导出配置 |
| <kbd>?</kbd> | 全局 | 打开使用指南 |
| <kbd>Esc</kbd> | 弹窗 / 面板 | 关闭当前弹层，焦点回到打开它的控件 |

全局快捷键在输入框中不响应，也不会在另一个弹窗之上再打开弹窗。

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

Nginx 的站点根目录为 `/var/www/smoji.zsh.moe/html`。发布脚本校验产物、加锁并原子替换 `html`，拒绝旧流水线覆盖新版本；成功后仅保留当前版和刚被替换的上一版，清理更早版本；失败或过期发布不触发清理。当前版仅延续上一版构建清单列出的哈希资源，更早页面需要刷新。发布验证覆盖文件与软链接，线上 HTTP 状态另行检查。

从旧布局迁移时，先确保没有 Smoji 发布任务正在执行或等待执行，再移除 `/var/www/smoji.zsh.moe` 旧软链接、清理 `/var/www/.smoji.zsh.moe-releases` 并创建同名实体站点目录。清理会删除旧静态产物，站点在新 CI 发布完成前暂时不可用。将 Nginx 原有 `root /var/www/smoji.zsh.moe;` 改为 `root /var/www/smoji.zsh.moe/html;`，执行 `sudo nginx -t && sudo systemctl reload nginx`，准备完成后再推送新版 CI；不要重跑旧布局的发布任务。

本地验证：先执行 `pnpm build:workbench`，再运行 `sh -n scripts/publish-site.sh && node scripts/test-publish-site.mjs`。隔离验证使用临时目录并自动清理。`SMOJI_DEPLOY_ROOT` 可覆盖默认 `/deploy`，替代旧的 `SMOJI_DEPLOY_PARENT` / `SMOJI_DEPLOY_SITE`。

---

## 📄 许可证与版权说明

- **代码许可**：本项目代码基于 [MIT License](LICENSE) 开源。
- **字体许可**：工作台内嵌的 IBM Plex 字体遵循 [SIL Open Font License](https://scripts.sil.org/OFL)。
- **素材免责声明**：Smoji 索引并呈现的各类表情包知识产权与版权均归原作者或其合法权利人所有，仅供个人学习、交流与展示使用。商业使用请获得原作者许可。


## 🌐 Web Resources & Aesthetic Symbols Index
- [CROSSED SWORDS](https://occult-rune-symbols-88.pages.dev/symbol/crossed-swords/)
- [SCHOLARLY SCRIPT HUB 43.PAGES.DEV](https://scholarly-script-hub-43.pages.dev/)
- [COQUETTE BOW RIBBON](https://pastel-moe-kaomoji-91.pages.dev/symbol/coquette-bow-ribbon/)
- [COQUETTE BOW RIBBON](https://anime-sparkle-text-44.pages.dev/symbol/coquette-bow-ribbon/)
- [ANGEL WINGS HEART](https://matrix-glitch-text-59.pages.dev/symbol/angel-wings-heart/)
- [ANGEL WINGS HEART](https://chibi-emoticon-vault-12.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://sleek-mono-fonts-61.pages.dev/symbol/black-star/)
- [BLACK STAR](https://neon-gamer-symbols-64.pages.dev/symbol/black-star/)
- [BLACK STAR](https://cyber-clan-tags-41.pages.dev/symbol/black-star/)
- [ANGEL WINGS HEART](https://minimal-star-symbols-20.pages.dev/symbol/angel-wings-heart/)
- [CROSSED SWORDS](https://kawaii-kaomoji-hub-89.pages.dev/symbol/crossed-swords/)
- [GLITCH MATRIX SYMBOLS 22.PAGES.DEV](https://glitch-matrix-symbols-22.pages.dev/)
- [BLACK STAR](https://balletcore-cute-fonts-43.pages.dev/symbol/black-star/)
- [COQUETTE BOW RIBBON](https://neon-glitch-fonts-64.pages.dev/symbol/coquette-bow-ribbon/)
- [CROSSED SWORDS](https://neon-tech-unicode-43.pages.dev/symbol/crossed-swords/)
- [ANGEL WINGS HEART](https://manga-bubble-symbols-54.pages.dev/symbol/angel-wings-heart/)
- [ANGEL WINGS HEART](https://coquette-aesthetic-symbols-72.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://clean-space-text-47.pages.dev/symbol/black-star/)
- [MANGA SPEECH SYMBOLS 65.PAGES.DEV](https://manga-speech-symbols-65.pages.dev/)
- [CROSSED SWORDS](https://vintage-scroll-text-23.pages.dev/symbol/crossed-swords/)
- [RIBBON HEART SYMBOLS 17.PAGES.DEV](https://ribbon-heart-symbols-17.pages.dev/)
- [COQUETTE AESTHETIC SYMBOLS 45.PAGES.DEV](https://coquette-aesthetic-symbols-45.pages.dev/)
- [CLEAN AESTHETIC FONTS 74.PAGES.DEV](https://clean-aesthetic-fonts-74.pages.dev/)
- [ANGEL WINGS HEART](https://synth-crosshair-text-47.pages.dev/symbol/angel-wings-heart/)
- [ANGEL WINGS HEART](https://cyber-clan-tags-65.pages.dev/symbol/angel-wings-heart/)
- [MINIMAL STAR SYMBOLS 22.PAGES.DEV](https://minimal-star-symbols-22.pages.dev/)
- [ANGEL WINGS HEART](https://sleek-mono-fonts-61.pages.dev/symbol/angel-wings-heart/)
- [ANGEL WINGS HEART](https://cyber-clan-tags-55.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://pastel-chibi-emojis-45.pages.dev/symbol/black-star/)
- [BALLETCORE CUTE FONTS 43.PAGES.DEV](https://balletcore-cute-fonts-43.pages.dev/)
- [ANGEL WINGS HEART](https://pastel-chibi-emojis-45.pages.dev/symbol/angel-wings-heart/)
- [KAWAII KAOMOJI HUB 95.PAGES.DEV](https://kawaii-kaomoji-hub-95.pages.dev/)
- [ANGEL WINGS HEART](https://sleek-text-borders-92.pages.dev/symbol/angel-wings-heart/)
- [COQUETTE BOW RIBBON](https://cyber-clan-tags-55.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://gothic-bio-fonts-15.pages.dev/symbol/black-star/)
- [MANGA BUBBLE SYMBOLS 54.PAGES.DEV](https://manga-bubble-symbols-54.pages.dev/)
- [TECH CROSSHAIR SYMBOLS 75.PAGES.DEV](https://tech-crosshair-symbols-75.pages.dev/)
- [COQUETTE BOW RIBBON](https://vintage-scholar-text-78.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://simple-line-fonts-11.pages.dev/symbol/black-star/)
- [COQUETTE BOW RIBBON](https://scholar-rune-symbols-77.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://vintage-lace-fonts-79.pages.dev/symbol/black-star/)
- [ANGEL WINGS HEART](https://gothic-bio-fonts-61.pages.dev/symbol/angel-wings-heart/)
- [SOFT PASTEL UNICODE 78.PAGES.DEV](https://soft-pastel-unicode-78.pages.dev/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-58.pages.dev/symbol/crossed-swords/)
- [COQUETTE BOW RIBBON](https://cyberpunk-clan-tags-49.pages.dev/symbol/coquette-bow-ribbon/)
- [NEON MATRIX SYMBOLS 74.PAGES.DEV](https://neon-matrix-symbols-74.pages.dev/)
- [COQUETTE BOW RIBBON](https://anime-sparkle-text-91.pages.dev/symbol/coquette-bow-ribbon/)
- [COQUETTE BOW RIBBON](https://vintage-scroll-text-23.pages.dev/symbol/coquette-bow-ribbon/)
- [SUBTLE SPARKLE TEXT 86.PAGES.DEV](https://subtle-sparkle-text-86.pages.dev/)
- [BLACK STAR](https://dark-poetry-fonts-30.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-51.pages.dev/symbol/crossed-swords/)
- [ANGEL WINGS HEART](https://kawaii-kaomoji-hub-95.pages.dev/symbol/angel-wings-heart/)
- [COQUETTE BOW RIBBON](https://coquette-aesthetic-symbols-51.pages.dev/symbol/coquette-bow-ribbon/)
- [COQUETTE AESTHETIC SYMBOLS 47.PAGES.DEV](https://coquette-aesthetic-symbols-47.pages.dev/)
- [BLACK STAR](https://synth-crosshair-text-47.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://anime-sparkle-text-44.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://neon-futuristic-symbols-62.pages.dev/symbol/black-star/)
- [BLACK STAR](https://coquette-aesthetic-symbols-51.pages.dev/symbol/black-star/)
- [ANGEL WINGS HEART](https://tech-glitch-symbols-36.pages.dev/symbol/angel-wings-heart/)
- [COQUETTE BOW RIBBON](https://subtle-aesthetic-kaomoji-93.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://kawaii-kaomoji-hub-47.pages.dev/symbol/black-star/)
- [CHIBI BUNNY SYMBOLS 82.PAGES.DEV](https://chibi-bunny-symbols-82.pages.dev/)
- [CROSSED SWORDS](https://matrix-terminal-fonts-30.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://chibi-emoticon-vault-12.pages.dev/symbol/black-star/)
- [BLACK STAR](https://coquette-aesthetic-symbols-62.pages.dev/symbol/black-star/)
- [CLEAN UNICODE TEXT 35.PAGES.DEV](https://clean-unicode-text-35.pages.dev/)
- [COQUETTE BOW RIBBON](https://coquette-aesthetic-symbols-10.pages.dev/symbol/coquette-bow-ribbon/)
- [ANGEL WINGS HEART](https://neon-matrix-fonts-47.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://matrix-glitch-symbols-43.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-40.pages.dev/symbol/crossed-swords/)
- [VINTAGE BOW TEXT 15.PAGES.DEV](https://vintage-bow-text-15.pages.dev/)
- [ANGEL WINGS HEART](https://gothic-bio-fonts-11.pages.dev/symbol/angel-wings-heart/)
- [DOLLY ANGEL FONTS 14.PAGES.DEV](https://dolly-angel-fonts-14.pages.dev/)
- [ANGEL WINGS HEART](https://minimal-star-symbols-89.pages.dev/symbol/angel-wings-heart/)
- [COQUETTE BOW RIBBON](https://kawaii-kaomoji-hub-17.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://zen-spacing-fonts-47.pages.dev/symbol/black-star/)
- [ANGEL WINGS HEART](https://balletcore-cute-fonts-43.pages.dev/symbol/angel-wings-heart/)
- [ANGEL WINGS HEART](https://subtle-aesthetic-kaomoji-93.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://cute-chibi-emoticons-70.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://dolly-angel-fonts-14.pages.dev/symbol/crossed-swords/)
- [MATRIX GLITCH TEXT 59.PAGES.DEV](https://matrix-glitch-text-59.pages.dev/)
- [GOTHIC BIO FONTS 11.PAGES.DEV](https://gothic-bio-fonts-11.pages.dev/)
- [CLEAN LINE EMOJIS 77.PAGES.DEV](https://clean-line-emojis-77.pages.dev/)
- [ANGEL WINGS HEART](https://vintage-scroll-text-23.pages.dev/symbol/angel-wings-heart/)
- [MOE STAR EMOTICONS 13.PAGES.DEV](https://moe-star-emoticons-13.pages.dev/)
- [CYBER CLAN TAGS 65.PAGES.DEV](https://cyber-clan-tags-65.pages.dev/)
- [SOFT ANGEL SYMBOLS 61.PAGES.DEV](https://soft-angel-symbols-61.pages.dev/)
- [SOFT PINK FONT GENERATOR 32.PAGES.DEV](https://soft-pink-font-generator-32.pages.dev/)
- [COQUETTE BOW RIBBON](https://angelic-coquette-text-10.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://cute-pastel-fonts-37.pages.dev/symbol/black-star/)
- [CUTE EMOTICON VAULT 98.PAGES.DEV](https://cute-emoticon-vault-98.pages.dev/)
- [ANGEL WINGS HEART](https://moe-star-kaomoji-60.pages.dev/symbol/angel-wings-heart/)
- [CYBER CLAN TAGS 80.PAGES.DEV](https://cyber-clan-tags-80.pages.dev/)
- [SCHOLARLY RUNE SYMBOLS 33.PAGES.DEV](https://scholarly-rune-symbols-33.pages.dev/)
- [SCHOLARLY TYPE FONTS 40.PAGES.DEV](https://scholarly-type-fonts-40.pages.dev/)
- [BLACK STAR](https://soft-anime-symbols-48.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://glitch-matrix-fonts-28.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://zen-unicode-symbols-89.pages.dev/symbol/black-star/)
- [MINIMAL STAR SYMBOLS 99.PAGES.DEV](https://minimal-star-symbols-99.pages.dev/)
- [COQUETTE BOW RIBBON](https://coquette-aesthetic-symbols-65.pages.dev/symbol/coquette-bow-ribbon/)
- [ANGEL WINGS HEART](https://soft-girl-aesthetic-fonts-19.pages.dev/symbol/angel-wings-heart/)
- [COQUETTE BOW RIBBON](https://soft-anime-symbols-48.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://minimal-star-symbols-95.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://synth-crosshair-text-47.pages.dev/symbol/crossed-swords/)
- [COQUETTE BOW RIBBON](https://anime-sparkle-text-75.pages.dev/symbol/coquette-bow-ribbon/)
- [SANRIO SOFT KAOMOJI 71.PAGES.DEV](https://sanrio-soft-kaomoji-71.pages.dev/)
- [ANGEL WINGS HEART](https://mystic-rune-text-88.pages.dev/symbol/angel-wings-heart/)
- [CROSSED SWORDS](https://arcane-mystic-symbols-22.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://gothic-bio-fonts-69.pages.dev/symbol/black-star/)
- [ANGEL WINGS HEART](https://angelic-aesthetic-text-45.pages.dev/symbol/angel-wings-heart/)
- [BLACK STAR](https://manga-bubble-symbols-54.pages.dev/symbol/black-star/)
- [COQUETTE BOW RIBBON](https://synthwave-fancy-text-33.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://gothic-bio-fonts-11.pages.dev/symbol/black-star/)
- [CROSSED SWORDS](https://cyber-clan-tags-41.pages.dev/symbol/crossed-swords/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-63.pages.dev/symbol/crossed-swords/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-45.pages.dev/symbol/crossed-swords/)
- [CROSSED SWORDS](https://coquette-aesthetic-symbols-47.pages.dev/symbol/crossed-swords/)
- [CROSSED SWORDS](https://kawaii-kaomoji-hub-12.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://baroque-text-decor-84.pages.dev/symbol/black-star/)
- [MOE SOFT EMOTICONS 41.PAGES.DEV](https://moe-soft-emoticons-41.pages.dev/)
- [ANIME SPARKLE TEXT 51.PAGES.DEV](https://anime-sparkle-text-51.pages.dev/)
- [CROSSED SWORDS](https://anime-sparkle-text-51.pages.dev/symbol/crossed-swords/)
- [COQUETTE BOW RIBBON](https://cyber-clan-tags-24.pages.dev/symbol/coquette-bow-ribbon/)
- [CROSSED SWORDS](https://cyber-clan-tags-14.pages.dev/symbol/crossed-swords/)
- [BLACK STAR](https://clean-line-emojis-93.pages.dev/symbol/black-star/)
- [COQUETTE BOW RIBBON](https://soft-manga-emoticons-45.pages.dev/symbol/coquette-bow-ribbon/)
- [ANGEL WINGS HEART](https://vintage-lace-fonts-29.pages.dev/symbol/angel-wings-heart/)
- [SCHOLARLY GOTHIC TEXT 63.PAGES.DEV](https://scholarly-gothic-text-63.pages.dev/)
- [COQUETTE BOW RIBBON](https://minimal-star-symbols-95.pages.dev/symbol/coquette-bow-ribbon/)
- [BLACK STAR](https://subtle-grid-text-34.pages.dev/symbol/black-star/)
