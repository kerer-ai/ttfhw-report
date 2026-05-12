# TTFHW Build Verification Dashboard

TTFHW 仓库编译验证结果可视化仪表盘，覆盖 7 个社区、46 个仓库的编译/UT 验证数据。

## 技术栈

- Next.js 16 (App Router)
- React 18 + TypeScript
- Tailwind CSS + Recharts
- 静态站点生成 (SSG)

## 快速开始

```bash
npm install
npm run dev      # 开发模式 → http://localhost:3000
npm run build    # 生产构建
npm run start    # 生产运行
```

## 数据

`json/` 目录下为各仓库的编译验证报告 JSON，按社区分类：

| 社区 | 仓库数 |
|------|--------|
| MindIE | 4 |
| MindSpeed | 3 |
| PyTorch | 3 |
| openEuler | 4 |
| UBSCore | 10 |
| HPCKit | 7 |
| CANN | 15 |

## 项目结构

```
app/              # Next.js 页面 (首页 + 详情页)
components/       # React 组件 (图表/卡片/表格/筛选)
lib/              # 数据加载/类型定义/工具函数
json/             # 编译验证报告数据
```
