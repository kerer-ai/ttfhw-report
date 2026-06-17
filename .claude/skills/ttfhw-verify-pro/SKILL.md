---
name: ttfhw-verify-pro
description: TTFHW仓库验证 - 模拟外部新手开发者，从README入口阅读理解仓库，依据文档指导在容器中完成构建/单元测试/样例执行验证。
---

# TTFHW 仓库验证

## 核心定位

**模拟一个外部新手开发者**：拿到一个陌生仓库，从 README 入口出发，依据文档中的索引和链接逐步理解仓库，了解镜像要求、依赖安装、编译入口、UT/样例如何执行，然后严格按文档指导在容器中一步步操作并记录结果。

## 镜像选择

- **优先使用文档推荐的镜像**：如果 README 或关联文档中明确推荐了某个镜像（如 Dockerfile 的 FROM、文档中写明的环境要求），使用该镜像。
- **文档未说明时，默认使用 openEuler 24.03 LTS 镜像**：`hub.oepkgs.net/openeuler/openeuler:24.03-lts`
- 镜像选择理由必须记录到报告中。

## 工作流程（8 步）

### 步骤 1：文档阅读理解

从仓库 README 入口开始，按文档中的索引/链接逐层阅读，提取以下信息：

| 提取项 | 搜索关键词/位置 | 未找到时 |
|--------|---------------|---------|
| 推荐镜像/OS | Dockerfile FROM、README 环境要求章节 | 记录"文档未指定，默认使用 openEuler" |
| 架构要求 | "x86", "arm64", "aarch64", "架构" | 默认 x86_64 |
| 构建依赖 | "依赖", "前置条件", "Prerequisites", "Dependencies", CMakeLists.txt `find_package()` | 记录缺失 |
| 构建命令 | "构建", "编译", "Building", "Build" | 记录缺失 |
| UT 命令 | "测试", "单元测试", "Testing", "Tests" | 记录缺失 |
| 样例命令 | "示例", "样例", "Examples", "Quick Start" | 记录缺失 |
| 特殊依赖下载 | "wget", "curl", "下载", "download", pip `-i` / `--index-url` | 记录缺失 |

**关键原则**：只依据文档和构建配置文件中的信息，不猜测。文档没写的依赖不装，没写的命令不执行。

### 步骤 2：静态检查能力扫描（本地执行）

了解仓库当前的静态代码检查能力，在宿主机本地检查以下两类工具配置：

**检查 pre-commit：**
- 检查仓库根目录 `.pre-commit-config.yaml` 是否存在
- 存在 → 安装 `pre-commit`，执行 `pre-commit run --all-files`，记录通过/失败的 hook 数量及耗时
- 不存在 → 记录 `pre_commit.configured: false`

**检查 lint-runner：**
- 搜索仓库根目录及子目录中是否存在 lint-runner 相关配置（如 `.lint-runner.yaml`、`.lint-runner.json`、`lint-runner.config.*` 等）
- 存在 → 安装并执行，记录结果及耗时
- 不存在 → 记录 `lint_runner.configured: false`

**汇总：** 两者都无则记录"仓库未配置静态检查工具"，enabled 为 false。

### 步骤 3：devcontainer 扫描

检查仓库是否具备 devcontainer 开发容器能力：

1. 检查仓库根目录是否存在 `.devcontainer/` 目录
2. 如果存在，列出目录中的配置文件（`devcontainer.json` 或 `.devcontainer.json`）
3. 记录是否具备 devcontainer 能力，以及配置文件内容摘要

### 步骤 4：启动容器并安装依赖

1. 拉取镜像、启动容器，挂载仓库目录到 `/workspace`
2. 收集宿主机和容器规格信息（架构、CPU、内存、磁盘、Docker 版本）
3. 按文档列出的依赖逐项安装，记录每个安装命令和耗时
4. pip 安装遇到网络问题时，依次尝试：清华源 → 阿里云源 → 豆瓣源

容器命名：`ttfhw-<repo名>-env`

### 步骤 5：执行构建

1. 执行文档中的构建命令，用 `time` 命令包裹以记录耗时
2. 编译并发数不超过容器核数的 60%
3. 构建失败时：搜索文档寻找解决方案 → 检查构建配置文件中的隐式依赖 → 安装缺失依赖后重试
4. 记录构建产物（名称、路径、大小）
5. 最大调试时间 30-60 分钟，超时判定"不成功"

### 步骤 6：执行单元测试和样例

1. 用 `time` 命令包裹测试/样例命令，记录耗时
2. 解析测试结果：总数、通过数、失败数、失败详情
3. 每个样例记录执行状态和输出摘要

### 步骤 7：生成报告并清理

1. 停止并删除容器
2. 生成 JSON 报告，输出到 `./verification_report/`

## 报告输出规范

### 输出格式

严格按 `assets/report_template.json` 的字段结构生成报告，一步不差。

### 中文要求

报告中所有总结性文字必须以中文表述，包括但不限于：
- `image_source.selection_reason`：如 "Dockerfile 指定 FROM ubuntu:22.04 → 选择 Ubuntu 24.04"
- `document_reading_summary` 中各项的 value：如 "文档未指定，默认使用 openEuler 24.03 LTS"
- `process_timeline` 中 action/result/details：如 "启动容器，挂载仓库目录"
- `problems_encountered` 中 problem/solution：如 "cmake 未找到 OpenSSL" → "安装 libssl-dev"
- `documentation_gaps`：如 "README 未列出 OpenSSL 依赖，仅在 CMakeLists.txt 中找到"

### 细节要求

- `execution_log` 中每个步骤记录：timestamp、command、success、output、error、returncode、duration_seconds
- `process_timeline` 中每个阶段记录：timestamp、step、action、result、details
- `final_results` 中 build/ut/sample 各自记录 status 和 duration_seconds
- 时间戳统一用 ISO 8601 格式：`YYYY-MM-DDTHH:mm:ss`

### 报告文件名

`verification_report_WSL_<仓库名>_<YYYYMMDD>.json`

## 核心约束

1. **只看文档**：依赖安装、命令执行均以文档为依据，不自行猜测
2. **不改源码**：遇到构建错误不修改仓库文件，先查文档再判定
3. **记录每一步**：命令、输出、耗时、成功/失败，全部录入 execution_log
4. **并发限制**：编译并发 ≤ 容器核数 × 60%
5. **最大调试**：单个问题排查不超过 30-60 分钟
6. **中文总结**：报告中所有解释性、总结性文字用中文

## 绑定资源

### assets/report_template.json

JSON 报告结构模板。生成报告时必须严格匹配此模板的字段和层级结构。
