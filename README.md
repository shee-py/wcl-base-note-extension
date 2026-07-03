# Base 单元格注释气泡

这是一个给飞书多维表格用的轻量扩展脚本前端工程。目标不是做评论流，而是给某个单元格挂一段纯文本注释，并在选中该格子时直接把整段内容显示成气泡。

## 当前能力

- 监听 Base 当前选中的单元格
- 自动读取当前格子的注释内容
- 用完整正文渲染一个只读气泡
- 提供新增、修改、清空注释能力
- 首次运行时可自动创建 `单元格注释` 表

## 交互说明

Base 扩展脚本当前更适合监听“选中”而不是原生 `hover`。所以这个版本采用“伪批注气泡”方案：

1. 用户选中一个具体单元格
2. 插件读取 `cell_key = baseId:tableId:recordId:fieldId`
3. 在 `单元格注释` 表里查找对应记录
4. 如果存在 `note`，直接完整显示整段文本

## 注释表结构

插件会查找或创建一张名为 `单元格注释` 的表，并保证存在以下字段：

- `cell_key`
- `note`

## 本地开发

```bash
cd Tools/Feishu/base-note-extension
npm install
npm run dev
```

## 构建

```bash
cd Tools/Feishu/base-note-extension
npm run build
```

构建产物在 `dist/`。把它部署到一个静态站点后，将站点地址配置到飞书 Base 扩展脚本即可。
