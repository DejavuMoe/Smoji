# Smoji

Smoji 是一个开源表情库和配置工具。在浏览器中挑选表情、整理自己的分组，导出博客评论系统可用的配置，或直接复制图片链接。

**[在线体验](https://smoji.zsh.moe)** · [源代码](https://github.com/DejavuMoe/Smoji) · [反馈问题](https://github.com/DejavuMoe/Smoji/issues)

## 可以做什么

- 浏览静态表情和动图，点击查看原图；列表使用缩略图，减少加载流量。
- 按整包选择、排除不需要的图片，或建立自己的表情分组。
- 调整分组和图片顺序，合并、拆分分组，撤销和重做常用编辑操作。
- 导出 Smoji、Artalk、Twikoo、OwO 配置和 Markdown 标记。
- 复制原图链接、HTML 或 BBCode，插入文章、评论和其他支持图片的地方。
- 在电脑和手机上使用，支持浅色、深色主题与键盘操作。

不需要账号。分组和最近使用记录保存在当前浏览器中，也可以导出分组文件，在其他设备上导入。

## 适合谁

- **博客作者**：给评论区挑选表情，导出对应评论系统的配置。
- **主题开发者**：为博客主题或评论组件准备表情数据。
- **前端开发者**：使用项目中的轻量表情选择器，接入自己的输入框。
- **日常使用者**：整理常用表情，复制图片或分享分组文件。

## 使用方法

打开在线体验，选择左侧的表情包，或切换到「自选分组」逐张添加。选择导出格式，预览内容后下载配置文件。

| 使用场景 | 导出格式 |
| --- | --- |
| Ecoku、Smoji 选择器 | Smoji |
| Artalk | Artalk |
| Twikoo | Twikoo |
| 支持 OwO 配置的评论系统 | OwO |
| 文章、文档 | Markdown 或单张图片链接 |

配置的导入位置取决于所用评论系统。页面中的「Ecoku 响应示例」用于展示接口数据，不是后台导入文件。

## 本地开发

需要 Node.js 24、pnpm 11.24.0，以及支持 WebP 的 ImageMagick 7（`magick`）。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm check       # 类型检查、测试、构建和体积检查
pnpm build       # 构建选择器和网站
```

网站输出到 `demo/dist/`，选择器输出到 `packages/smoji/dist/`。

## 资源维护

原图地址由 `data/hosting.json` 配置，目前使用 `https://s3-cdn.zsh.moe/smoji/`。`data/` 保存分类、标签、资源索引和有效地址映射，需要随源码保存。缩略图在构建时生成到 `demo/public/_previews/`，不纳入 Git；没有本地原图时，生成器从 S3 下载所需文件并核对 SHA-256。

`packs/` 是被 Git 忽略的本地素材目录。更新表情包时，放入对应包的完整图片目录，执行：

```sh
pnpm generate:packs
pnpm generate:previews
```

核对结果后，将原图上传到 S3 的对应目录，并更新 `data/smoji.json` 对应的远程清单。确认上传完成即可删除本地原图；后续构建会根据保存的索引重新生成缩略图。

删除本地包目录只释放磁盘空间，不会下架表情包。需要下架时，保留同名空目录并重新生成清单。

## 表情选择器

`packages/smoji/` 提供 TypeScript 表情选择器，不依赖 React 或 Vue，目前随源码维护，尚未发布为 npm 包。

清单格式见 [JSON Schema](packages/smoji/data.schema.json)。Smoji v1 要求图片与清单同源；接入 S3 原图时，使用同一 S3 域名下的清单地址。

## 许可证

项目代码采用 [MIT License](LICENSE)，保留原项目的版权声明。IBM Plex 字体采用 SIL Open Font License，构建时附带其许可证。表情素材的权利归各自作者或权利人所有。
