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
  <img src="https://img.shields.io/badge/Node.js-24+-orange.svg" alt="Node.js 24+" />
  <img src="https://img.shields.io/badge/pnpm-11.24+-red.svg" alt="pnpm" />
</p>

---

**Smoji** 是一套现代化开源图片表情解决方案，由两大部分组成：

1. **表情库与工作台（Web App）**：面向博主与个人用户，在浏览器中自由浏览高清静态/动态表情、灵活管理自选分组、实时预览多格式数据，一键导出 Artalk、Twikoo、OwO、Waline、Ecoku 等主流博客评论系统的配置文件。
2. **轻量表情选择器（Picker Core SDK）**：面向前端开发者，采用原生 TypeScript 编写、**零运行时依赖（无 React / Vue 绑定）**、核心压缩体积小于 1.6 KB (Gzip) 的 Web 表情选择器组件与严格防注入渲染器。

---

## ✨ 核心特性

### 🎨 现代化表情工作台 (Workbench)
- **双导出模式**：
  - **整包导出**：一键全选、反选或按分类剔除不需要的表情包。
  - **自选分组**：自由创建最多 32 个自定义分组，支持跨组拖拽投放、调序与精准筛选。
- **优异的浏览与预览体验**：缩略图列表极大节省加载流量；详情弹窗支持原图与动图播放，提供透明棋盘格、浅色纯白、深色纯黑 3 种背景预览模式。
- **多格式快捷复制**：内置复制控制台，一键复制 Markdown（`![smoji:标签](url)`）、绝对图片 URL、HTML 标签与 BBCode。
- **数据实时预览与下载**：支持按当前分类、已勾选项目或全部表情范围实时预览导出代码，并支持一键下载。
- **隐私保护与本地持久化**：无需注册任何账号，自选分组、勾选状态、主题与视图密度均自动持久化在浏览器本地（`localStorage`），支持分组配置的 JSON 导入与导出备份。
- **全键盘与无障碍支持 (A11y)**：严格遵循 WAI-ARIA 规范，支持键盘方向键无缝漫游、焦点捕获与丰富快捷键。

### ⚡ 原生极简表情选择器 (`packages/smoji`)
- **零运行时依赖**：原生纯 JavaScript / TypeScript 编写，完全与框架无关。
- **极致羽量级体积**：
  - Core JS: 压缩后 **~3 KB** (Gzip **~1.5 KB**)
  - Core CSS: 压缩后 **~1.9 KB** (Gzip **~800 B**)
- **智能定位算法**：结合 `visualViewport` 与边界碰撞检测，在复杂移动端和滚动页面中精准浮层定位，不越界、不溢出。
- **开箱即用输入适配**：提供 `textTarget` 绑定助手，支持光标位置插入、`InputEvent` 派发与自动失焦恢复。

### 🛡️ 安全规范与持久化设计
- **严格防注入 (Zero XSS)**：富文本渲染器纯 DOM 节点组装，**绝不使用 `innerHTML`**，强制校验图片同源性与 URL 协议，杜绝恶意脚本注入。
- **契约规范化**：提供标准的单文件清单契约 `smoji.json`（遵循 [JSON Schema](packages/smoji/data.schema.json)），单清单最多 64 个分组、单组最多 600 项、总计最多 6000 项、清单体积限制 ≤ 1 MiB（UTF-8）。
- **历史内容永续性**：导出 Markdown 均使用绝对图片链接，未来图库分类调整或个别下架不会破坏历史博客评论的正常渲染。

---

## 📦 支持的导出格式

工作台支持一键将挑选的表情导出为各主流博客评论系统与文档格式：

| 平台 / 格式 | 导出文件名 | 适用系统 / 使用场景 |
| :--- | :--- | :--- |
| **Smoji v1** | `smoji.json` | Ecoku 原生评论系统、Smoji Picker 官方核心库 |
| **Artalk** | `artalk.json` | Artalk 自托管评论系统 (v2+) |
| **Twikoo** | `twikoo.json` | Twikoo 无服务器评论系统 |
| **Waline** | `waline.json` | Waline 的 `emoji` 配置对象数组 |
| **OwO** | `OwO.json` | Valine 及各类兼容 OwO 格式的独立博客系统 |
| **Markdown** | 剪贴板 / 单项复制 | 支持 Markdown 语法的博客文章、即时通讯工具 |
| **URL / HTML / BBCode** | 剪贴板复制 | Discuz、各大论坛、富文本编辑器与网页嵌入 |

> [!NOTE]
> 导出的配置文件需导入到对应评论系统的后台或放置在静态服务中引用。工作台中的「Ecoku 响应示例」用于展示接口数据，非后台导入文件。

---

## 🚀 核心选择器接入指南

`packages/smoji` 提供独立的轻量级表情选择器，可直接用于任何网页或前端项目。

### 1. 基础用法 (Vanilla JS / TS)

```typescript
import { createSmoji, textTarget } from 'smoji'
import { smojiMarker } from 'smoji/marker'
import 'smoji/style.css'

// 绑定触发按钮与输入框
const triggerBtn = document.querySelector('#emoji-btn')
const textarea = document.querySelector('#comment-textarea')

const picker = createSmoji({
  trigger: triggerBtn,
  target: textTarget(textarea, { serialize: smojiMarker }),
  packs: [
    {
      id: 'default',
      label: '默认表情',
      items: [
        { id: 'smile', label: '微笑', src: 'https://s3-cdn.zsh.moe/smoji/smile.webp' },
        { id: 'thumbsup', label: '点赞', src: 'https://s3-cdn.zsh.moe/smoji/thumbsup.webp' },
      ],
    },
  ],
  closeOnSelect: true,
  onSelect: (item, pack) => {
    console.log(`选择了 ${pack.label} 中的 ${item.label}`)
  },
})

// 编程式控制 API
// picker.open()
// picker.close()
// picker.toggle()
// picker.destroy()
```

### 2. 安全加载远程清单

```typescript
import { loadSmojiManifest } from 'smoji/manifest'

// 内置体积限制检查（<= 1MB）、Content-Type 校验与超时控制
const manifest = await loadSmojiManifest('https://s3-cdn.zsh.moe/smoji/smoji.json', {
  timeoutMs: 8000,
})

console.log(manifest.packs)
```

### 3. 安全渲染评论内容 (Zero XSS)

```typescript
import { renderSmojiContent } from 'smoji/marker'

const container = document.querySelector('#comment-content')
const rawComment = '今天天气真好！![smoji:微笑](https://s3-cdn.zsh.moe/smoji/smile.webp)'
const manifestUrl = 'https://s3-cdn.zsh.moe/smoji/smoji.json'

// 仅同源图片会转为安全的 <img> 元素，其他内容均为纯文本，绝不调用 innerHTML
renderSmojiContent(container, rawComment, manifestUrl)
```

---

## ⌨️ 快捷键一览

| 快捷键 | 作用场景 | 说明 |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>1</kbd> / <kbd>2</kbd> | 全局 | 切换「整包导出」与「自选分组」模式 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>E</kbd> | 全局 | 触发底部 Dock 导出当前配置 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>.</kbd> | 全局 | 聚焦底部导出格式选择框 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | 全局 | 打开实时数据预览弹窗 |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>D</kbd> | 全局 | 切换图库显示密度（紧凑 / 舒适） |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> | 全局 | 撤销最近的移出、删除或清空分组操作 |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | 表情网格 | 网格内键盘方向移动 |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | 表情网格 | 打开当前选中表情详情弹窗 |
| <kbd>←</kbd> / <kbd>→</kbd> | 详情弹窗 | 切换上一个 / 下一个表情 |
| <kbd>1</kbd> ~ <kbd>4</kbd> | 详情弹窗 | 快速切换复制格式（Markdown / URL / HTML / BBCode） |
| <kbd>Esc</kbd> | 弹窗 / 浮层 | 关闭当前弹窗或选择器 |
| <kbd>Alt</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | 自选分组 | 列表向上 / 向下移动分组 |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | 自选分组 | 托盘内表情调序（首尾可跨组） |
| <kbd>?</kbd> | 全局 | 打开接入与规范说明指南 |

---

## 🛠️ 本地开发

### 环境要求
- **Node.js**：`24.0.0+`
- **包管理器**：`pnpm 11.24.0+`
- **系统工具**：支持 WebP 的 **ImageMagick 7**（`magick` 命令可用）

### 快速开始

```sh
# 克隆仓库
git clone https://github.com/DejavuMoe/Smoji.git
cd Smoji

# 安装依赖
pnpm install --frozen-lockfile

# 启动本地开发工作台 (基于 Vite 开发服务器)
pnpm dev
```

### 常用命令

```sh
pnpm check         # 全面检查：类型检查、测试、完整构建与体积预算校验
pnpm typecheck     # 运行 TypeScript 类型检查
pnpm test          # 运行 Vitest 单元与集成测试
pnpm build         # 构建核心选择器与工作台静态网站
pnpm build:core    # 仅构建 packages/smoji
pnpm build:demo    # 仅构建 demo 网站，使用当前本地缩略图
pnpm generate:previews # 可选：本地生成缩略图与 data/previews.json，部署 CI 自动执行
pnpm check:size    # 校验核心库与样式体积预算限制
```

构建产物输出：
- 网站应用：`demo/dist/`
- 表情选择器：`packages/smoji/dist/`

---

## 🗂️ 目录结构

```text
Smoji/
├── packages/
│   └── smoji/               # 轻量原生表情选择器核心库 (Zero Runtime Dependency)
│       ├── src/             # 选择器源码 (picker, manifest, marker, types 等)
│       ├── data.schema.json # Smoji v1 单文件清单 JSON Schema 规范
│       └── test/            # 核心库契约与无障碍测试
├── demo/                    # Smoji 在线工作台前端应用 (Vite)
│   ├── src/                 # 工作台交互、导出适配器、状态管理与持久化
│   ├── public/              # 静态资源与缩略图目录 (_previews)
│   └── index.html           # 工作台主入口界面
├── data/                    # 图库元数据、S3 CDN 映射与有效索引
│   ├── hosting.json         # 远程原图 CDN 基地址配置
│   ├── packs.json           # 扫描后的表情包结构数据
│   └── smoji.json           # 最终发布的清单文件
└── scripts/                 # 自动化脚本 (生成清单、生成缩略图、体积检查、发布部署)
```

---

## 🖼️ 图库维护与资产更新

表情原图托管于对象存储 CDN（由 `data/hosting.json` 配置，当前默认指向 `https://s3-cdn.zsh.moe/smoji/`）。`data/` 目录保存有分类、标签与哈希索引，需随代码版本提交。

本地素材更新流程：

百度贴吧收录 89 张 90×90 WebP（已移除立体小黄人系列），托管于 CDN 的 `tieba/` 目录，来自 [Tieba_mobile_emotions](https://github.com/microlong666/Tieba_mobile_emotions/tree/3492cf674c7596773d572708e5681603839c4b9b)（贴吧 Android 11.6.8.2 提取版）。本地 `pnpm dev` 优先读取原图；生产构建使用 CDN 地址，上传时保留 `tieba/` 目录与文件名。

1. **准备素材**：在本地 `packs/` 目录（已由 `.gitignore` 忽略）下创建包名子目录（仅允许小写字母与连字符，如 `packs/my-pack/`），将规范命名的表情放入该目录。
2. **生成清单与缩略图**：
   ```sh
   pnpm generate:packs     # 扫描素材，更新 data/ 中的清单与哈希索引
   pnpm generate:previews  # 可选本地预览；netcup-nano 部署 CI 会自动生成
   ```
3. **上传云端与核对**：将本地原图同步上传至 S3 存储桶的对应路径，验证无误后可删除本地原图；本地手动生成缩略图时，如缺少原图，生成器会从 S3 下载对应文件并核对 SHA-256。
4. **CI 每次全量生成**：提交清单和资源哈希索引后，`netcup-nano` 部署流水线先清空缩略图目录和索引，再从 CDN 下载原图、校验 SHA-256 并重新生成全部所需缩略图，不复用旧缩略图。生成完成后才构建、校验和发布站点；任何一步失败都不会发布。`data/previews.json` 与 `demo/public/_previews/` 均为 Git 忽略的构建产物，不再提交。

   全新检出运行 `pnpm dev`、`pnpm test`、`pnpm typecheck` 或 `pnpm build:demo` 时，会按需初始化空缩略图索引，页面直接使用原图；本地需要缩略图时可执行 `pnpm generate:previews`。验证流水线不下载全量素材，生产缩略图仅在 netcup-nano 生成。
5. **下架表情包**：保留同名的空文件夹并重新运行 `pnpm generate:packs` 即可安全下架，不会破坏既有历史别名。

---

## 🌐 静态站点托管

执行 `pnpm build:demo` 后，将 `demo/dist/` 完整发布到静态站点根目录。HTML 和 `smoji.json` 应使用 `Cache-Control: no-cache`，使客户端在复用缓存前重新验证；`assets/` 和 `_previews/` 内的文件名包含哈希，可长期缓存。

Nginx 示例（`map` 放在 `http` 上下文；域名、证书和根目录按环境配置）：

```nginx
map $uri $smoji_cache_control {
    default                 "no-cache";
    ~^/(assets|_previews)/   "public, max-age=31536000, immutable";
}

server {
    listen 443 ssl;
    http2 on;
    server_name example.com;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    root /path/to/site;
    index index.html;

    expires off;
    add_header Cache-Control $smoji_cache_control;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location ~ /\. {
        return 404;
    }
    location /assets/ {
        try_files $uri =404;
    }
    location /_previews/ {
        try_files $uri =404;
    }
    location / {
        try_files $uri $uri/ =404;
    }
}
```

`add_header` 统一设置在 `server` 层，避免在 `location` 中添加缓存头时丢失上层安全响应头。无需同时设置 `expires 1y`，否则会重复生成 `Cache-Control`。更新站点时应保留旧哈希资源，避免已打开页面加载旧分块失败。

---

## 📄 许可证与版权说明

- **代码许可**：本项目源码基于 [MIT License](LICENSE) 开源。
- **字体许可**：界面内嵌的 IBM Plex 字体遵循 [SIL Open Font License](https://scripts.sil.org/OFL)。
- **素材免责声明**：Smoji 收集并索引的各表情包知识产权与版权均归各自原作者或合法权利人所有，仅供个人交流与展示使用。如需商用请联系相应权利人。

## Ecoku 精简清单导出

```json
{"version":1,"base":"https://s3-cdn.zsh.moe/smoji/{pack}/{id}.webp","packs":[{"id":"douyin-current","label":"抖音","items":[{"id":"fehpikklicec","label":"微笑"}]}]}
```

`base` 是可选 URL 模板，必须包含 `{pack}` 与 `{id}`，分别替换为分组和条目的 ID。省略 `src` 的条目使用该模板；自选分组或不同扩展名可保留 `src` 覆盖。解析后仍得到完整 URL，评论存储格式不变。旧版逐项 `src` 清单继续受支持，未知字段仍被拒绝。

清单与展开后的图片仍须同源，禁止凭据、query 和 fragment。生产清单不要包含 `localhost` 图片地址；Smoji 工作台本地导出会使用配置的 CDN `https://s3-cdn.zsh.moe/smoji/`。JSON 响应需使用 `application/json` 或 `+json` 类型，体积按 UTF-8 字节计算，8 秒超时覆盖正文读取。

v0.2.0 不支持 `base`，且仍限制为 32 包、每包 300 项、总计 2000 项、256 KiB。使用该版本时需保留逐项 `src` 并导出容量内的子集；升级后再切换精简清单。清单和图片均需要发布到 CDN，更换 JSON 不会自动发布代码或修复历史评论 URL。

类型 `SmojiManifestInput` 表示 JSON 输入（含可选模板格式）；`parseSmojiManifest` / `loadSmojiManifest` 返回的 `SmojiManifest` 中，每项 `src` 均为完整 URL。JSON Schema 检查结构；总条目数、UTF-8 字节数、ID 唯一性与 URL 同源约束由运行时校验器检查。

## Waline 导出

选择 Waline 格式下载 `waline.json`，将解析后的数组赋给 `Waline.init({ emoji: presets, ... })` 的 `emoji` 选项。它是[官方支持的配置对象数组](https://waline.js.org/cookbook/customize/emoji.html#使用配置对象)，不是单个目录的 `info.json`，也不是 OwO 格式。

导出保留选中顺序与自选分组；以图片 Origin 为 `folder`，`items` 和 `icon` 使用含扩展名的路径，`prefix` / `type` 留空，因此 PNG、GIF、WebP 可以共存。跨 Origin 的条目按连续区段拆为同名标签页；不同 Origin 出现同一路径时会提示键冲突，避免 Waline 静默覆盖。图片须另行上传，JSON 导出不会上传资源。
