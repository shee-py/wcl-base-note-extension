# WCL Base Cell Note Workflow

## 项目目标

给飞书多维表格 Base 补一个“每个单元格一段纯文本注释”的能力。这个工具不是评论系统，不需要作者、时间线、回复、已读状态等评论信息，只需要让用户快速查看和维护某个格子的说明文本。

当前线上版本是 Base 扩展方案：用户选中单元格后，插件在自己的面板里显示该格子的完整注释内容，并支持新增、修改、清空。

## 当前资产

- 本地独立仓库：`/Users/ethan/scripts/wcl-base-note-extension`
- GitHub 仓库：`https://github.com/shee-py/wcl-base-note-extension`
- Cloudflare Worker：`royal-cloud-9d63`
- 线上地址：`https://royal-cloud-9d63.forlfc409.workers.dev/`
- 生产分支：`main`
- 构建命令：`npm run build`
- 部署命令：`npx wrangler deploy`

这个仓库已经脱离 Unity / Plastic 工作区，不要把它当作 Unity 项目的一部分维护。

## 当前实现

### 数据模型

插件会在当前 Base 里查找或创建一张表：

- 表名：`单元格注释`
- 字段：`cell_key`
- 字段：`note`

`cell_key` 用来唯一定位一个业务单元格：

```text
baseId:tableId:recordId:fieldId
```

`note` 存放这个单元格的纯文本注释。

### 交互流程

1. 用户打开飞书 Base 中的扩展。
2. 插件检查当前 Base 是否存在 `单元格注释` 表。
3. 如果不存在，插件显示初始化按钮，点击后创建表和字段。
4. 用户在业务表里选中一个具体单元格。
5. 插件监听 `SelectionChange`，生成该格子的 `cell_key`。
6. 插件在 `单元格注释` 表里查找对应记录。
7. 如果找到 `note`，直接完整显示为气泡正文。
8. 如果没有找到，显示“这格还没有注释”。
9. 用户可通过 `新增` / `修改` / `清空` 维护注释。
10. 保存后刷新注释缓存，并回到只读展示态。

### 关键文件

- `src/App.tsx`：插件状态、选区监听、查看和编辑交互。
- `src/lib/base.ts`：Base 表绑定、字段创建、注释读取与保存。
- `src/styles.css`：气泡、编辑区、整体视觉样式。
- `wrangler.jsonc`：Cloudflare Workers Static Assets 部署配置。

## 发布流程

### 本地开发

```bash
cd /Users/ethan/scripts/wcl-base-note-extension
npm install
npm run dev
```

### 本地构建验证

```bash
cd /Users/ethan/scripts/wcl-base-note-extension
npm run build
npx wrangler deploy --dry-run
```

### 推送并自动部署

```bash
cd /Users/ethan/scripts/wcl-base-note-extension
git status --short
git add .
git commit -m "描述本次改动"
git push origin main
```

推送到 `main` 后，Cloudflare Workers Builds 会自动构建并部署到线上地址。

### 部署验证

```bash
curl -I https://royal-cloud-9d63.forlfc409.workers.dev/
```

正常应返回 `HTTP/2 200`。

也可以查看 Cloudflare Dashboard 中 `royal-cloud-9d63` 的部署记录。

## 当前限制

Base 官方扩展方案更适合读取当前选区，不适合实现真正覆盖在表格单元格上的原生批注层。

当前限制包括：

- 触发方式是“选中单元格”，不是鼠标悬浮。
- 气泡显示在插件面板内，不会直接贴在业务表格的单元格旁边。
- 目前没有稳定的官方 API 能拿到单元格屏幕坐标。
- 目前没有稳定的官方 API 能把自定义浮层挂到 Base 表格渲染层上。

因此，当前方案是稳定的“伪批注气泡”，不是 1:1 原生批注。

## 下一步要做什么

### 方案 A：继续优化 Base 扩展版

目标：在官方能力范围内，把当前界面压缩到尽量接近批注气泡。

待办：

- 默认只显示一个小气泡正文，隐藏常驻编辑面板。
- 把 `新增` / `修改` / `清空` 收进一个小按钮或图标菜单。
- 选中无注释格子时，只显示极简空态和一个新增入口。
- 减少标题、说明文字和大面积卡片。
- 让插件面板在窄宽度下也保持紧凑。
- 为长注释设置合理最大高度和滚动策略，避免撑满整个面板。

适用场景：

- 要稳定发给别人用。
- 要继续走 Cloudflare + Base 扩展。
- 不想让安装和维护变复杂。

### 方案 B：另起 Edge / Chrome 扩展版

目标：用 DOM 注入方式实现更接近飞书表格 / Excel 的原生批注体验。

待办：

- 新建浏览器扩展项目。
- 在飞书 Base 页面注入 content script。
- 识别当前鼠标悬浮或选中的表格单元格 DOM。
- 根据单元格位置绘制贴边气泡。
- 做注释角标、悬浮气泡、编辑弹层。
- 设计注释数据存储方式，可选本地存储、远程 API、或继续写回 Base 的 `单元格注释` 表。
- 处理飞书表格虚拟滚动、DOM 结构变更、iframe、页面重渲染。
- 准备 Edge / Chrome 安装和更新流程。

风险：

- 飞书页面 DOM 不是公开稳定接口，页面结构变化可能导致扩展失效。
- 维护成本明显高于 Base 扩展版。
- 分发给别人电脑会比 Cloudflare 页面复杂。
- 需要更仔细处理权限、账号、隐私和兼容性。

适用场景：

- 视觉和交互必须尽量像原生批注。
- 可以接受更高维护成本。
- 使用环境主要是 Edge / Chrome 网页版飞书。

## 推荐路线

短期推荐先做方案 A，把当前 Base 扩展版压缩成极简气泡。这样能快速改善“界面太大”的问题，并保留现有部署链路。

如果极简版仍然达不到预期，再启动方案 B，单独做 Edge / Chrome 扩展原型。方案 B 不建议直接替换当前仓库，最好另起仓库或另起目录，避免把稳定版和激进实验版混在一起。

## 操作纪律

- 当前仓库使用 Git，不使用 Plastic SCM。
- Unity 项目仍然遵守 Plastic SCM 规则；这个仓库不要放回 Unity 工作区。
- 每次改动后至少运行 `npm run build`。
- 涉及 Cloudflare 部署配置时，额外运行 `npx wrangler deploy --dry-run`。
- 推送到 `main` 前确认 `git status --short` 只包含本次相关改动。
