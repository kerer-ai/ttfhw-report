---
name: ttfhw-verify-openeuler
description: TTFHW仓库验证 - 模拟外部新手开发者，从README入口阅读理解仓库，依据文档及Dockerfile参考在openEuler容器中一步一步从原生镜像安装依赖并完成构建/单元测试/样例执行验证。
---

# TTFHW 仓库验证（openEuler 原生构建）

## 核心定位

**模拟一个外部新手开发者**：拿到一个陌生仓库，从 README 入口出发，依据文档中的索引和链接逐步理解仓库，了解构建依赖、编译入口、UT/样例如何执行。**强制使用 openEuler 基础镜像，从零开始通过 dnf 安装依赖，一步一步构建出可用的编译环境**，严格按文档指导在容器中操作并记录结果。

## 镜像策略（强制约束）

### 唯一允许的镜像源

**只能使用 openEuler 官方镜像**，禁止使用任何其他发行版（Ubuntu/Debian/CentOS/Alpine 等）的镜像。

| 场景 | 允许的镜像 |
|------|-----------|
| 默认基础镜像 | `hub.oepkgs.net/openeuler/openeuler:24.03-lts` |
| 文档/Dockerfile 指定 openEuler 版本 | 使用指定版本的 openEuler 镜像 |
| 文档/Dockerfile 指定非 openEuler 镜像 | **忽略该镜像推荐**，改用 openEuler 24.03 LTS，并在报告中记录"文档推荐 xxx，改用 openEuler" |

### 禁止行为

- ❌ 禁止直接使用任何预构建的、包含预装依赖的镜像
- ❌ 禁止使用非 openEuler 发行版的镜像
- ❌ 禁止使用 `pip install` 从 PyPI 安装预编译 wheel（必须从源码编译或使用 openEuler 仓库中的包）

### 依赖安装原则

**所有依赖必须从 openEuler 原生仓库安装，一步一步构建环境：**

1. 优先使用 `dnf install` 从 openEuler 官方仓库安装
2. dnf 仓库中版本不满足要求时，从源码编译安装，并记录原因
3. pip 包优先从 openEuler 仓库的 python3-xxx 包安装；仓库中没有的才用 `pip install --no-binary :all:` 从源码编译
4. 每一个依赖的安装命令、耗时、来源必须记录到 execution_log

## 依赖来源参考

确定依赖时，按以下优先级参考：

1. **仓库内的 Dockerfile**（如 `Dockerfile`、`docker/Dockerfile`、`.devcontainer/Dockerfile`）：从中提取 FROM 镜像（仅作参考，实际改用 openEuler）、`RUN dnf install` / `RUN apt-get install` 命令，将其中的包名映射到 openEuler 对应包名
2. **README 及关联文档**：提取文档中列出的依赖列表、环境要求
3. **构建配置文件**：CMakeLists.txt 中的 `find_package()`、setup.py/pyproject.toml 中的 `install_requires`、Makefile 中的依赖检查
4. **CI 配置文件**：`.github/workflows/*.yml`、`.gitee/*.yml` 中的 `dnf install` / `apt-get install` 步骤

### Dockerfile 到 openEuler 映射

当仓库提供的 Dockerfile 基于非 openEuler 镜像时，需将其中的依赖安装指令映射为 openEuler 等效命令：

- `apt-get install <pkg>` → `dnf install -y <openEuler等效包名>`
- `apt-get install libxxx-dev` → `dnf install -y xxx-devel`
- `pip install <pkg>` → 先尝试 `dnf install -y python3-<pkg>`，找不到则 `pip install --no-binary :all: <pkg>`
- 映射过程中遇到的包名差异必须在报告中记录

## 工作流程（8 步）

### 步骤 1：文档阅读理解

从仓库 README 入口开始，按文档中的索引/链接逐层阅读，提取以下信息：

| 提取项 | 搜索关键词/位置 | 未找到时 |
|--------|---------------|---------|
| 推荐镜像/OS | Dockerfile FROM、README 环境要求章节 | 记录"文档未指定，使用 openEuler 24.03 LTS" |
| 架构要求 | "x86", "arm64", "aarch64", "架构" | 默认 x86_64 |
| 构建依赖 | "依赖", "前置条件", "Prerequisites", "Dependencies", CMakeLists.txt `find_package()`, Dockerfile `RUN` 指令 | 记录缺失 |
| 构建命令 | "构建", "编译", "Building", "Build" | 记录缺失 |
| UT 命令 | "测试", "单元测试", "Testing", "Tests" | 记录缺失 |
| 样例命令 | "示例", "样例", "Examples", "Quick Start" | 记录缺失 |
| 特殊依赖下载 | "wget", "curl", "下载", "download", pip `-i` / `--index-url` | 记录缺失 |

**特别步骤 — Dockerfile 依赖提取**：
- 如果仓库中存在任何 Dockerfile，逐一阅读，提取其中所有 `RUN` 安装指令
- 将安装指令翻译为 openEuler 等效命令
- 记录翻译映射关系，包括无法直接映射的包名

**关键原则**：只依据文档、Dockerfile 和构建配置文件中的信息，不猜测。文档没写的依赖不装，没写的命令不执行。

### 步骤 2：静态检查能力扫描（本地执行）

了解仓库当前的静态代码检查能力，在宿主机本地检查以下两类工具配置。

**通用原则：缺少依赖必须先安装，不得直接标记失败。**

**检查 pre-commit：**
- 检查仓库根目录 `.pre-commit-config.yaml` 是否存在
- 存在 → 先读取 `.pre-commit-config.yaml`，解析出所有 hook 及其依赖的工具（如 clang-format、clang-tidy、shellcheck 等）
- 安装 `pre-commit` 以及各 hook 需要的工具（pip install / dnf 等），全部安装成功后再执行 `pre-commit run --all-files`
- 安装过程中某个工具实在无法安装时，记录该 hook 为失败并说明原因
- 执行后记录每个 hook 的名称、通过/失败状态、耗时、错误信息
- 不存在 → 记录 `pre_commit.configured: false`

**检查 lint-runner：**
- 搜索仓库根目录及子目录中是否存在 lint-runner 相关配置（如 `.lint-runner.yaml`、`.lint-runner.json`、`lint-runner.config.*`、`.lintrunner.toml` 等）
- 存在 → 先读取配置文件，了解需要哪些 linter/工具，逐个安装后再执行
- 执行后记录启用的 linter 列表、通过/失败状态、耗时
- 不存在 → 记录 `lint_runner.configured: false`

**汇总：** 两者都无则记录"仓库未配置静态检查工具"，enabled 为 false。至少一个配置了则 enabled 为 true。

### 步骤 3：devcontainer 扫描

检查仓库是否具备 devcontainer 开发容器能力：

1. 检查仓库根目录是否存在 `.devcontainer/` 目录
2. 如果存在，列出目录中的配置文件（`devcontainer.json` 或 `.devcontainer.json`）
3. 读取 devcontainer 配置中的 Dockerfile 引用，提取依赖信息作为后续 openEuler 环境构建参考
4. 记录是否具备 devcontainer 能力，以及配置文件内容摘要

### 步骤 4：启动 openEuler 容器并逐步安装依赖

**这是本技能的核心步骤。必须从干净的 openEuler 基础镜像开始，一步一步构建环境。**

1. 拉取 openEuler 基础镜像、启动容器，挂载仓库目录到 `/workspace`
2. 收集宿主机和容器规格信息（架构、CPU、内存、磁盘、Docker 版本）
3. **按依赖层级逐步安装**，每一层安装完验证后再进入下一层：

   **第一层 — 系统工具链：**
   ```bash
   dnf install -y gcc gcc-c++ make cmake git python3 python3-pip
   ```

   **第二层 — 文档/Dockerfile 中列出的构建依赖：**
   - 对照步骤 1 提取的依赖列表，逐一用 `dnf install -y <包名>` 安装
   - 如果 Dockerfile 中原为 apt 包名，翻译为 openEuler 等效包名（如 `libssl-dev` → `openssl-devel`）
   - 每次安装记录包名、耗时、成功/失败

   **第三层 — 语言特定依赖：**
   - Python 项目：先 `dnf install -y python3-<xxx>`，找不到则 `pip install --no-binary :all: <包名>`
   - C/C++ 项目：`dnf install -y <xxx>-devel` 安装开发库
   - 记录每个依赖的安装方式和耗时

4. **pip 安装策略**：必须使用 `--no-binary :all:` 从源码编译；遇到网络问题时，依次尝试：清华源 → 阿里云源 → 豆瓣源
5. 每安装完一组依赖后确认安装成功（`dnf list installed <包名>` 或 `pip show <包名>`）

容器命名：`ttfhw-<repo名>-openeuler-env`

### 步骤 5：执行构建

1. 执行文档中的构建命令，用 `time` 命令包裹以记录耗时
2. 编译并发数不超过容器核数的 60%
3. **构建失败时必须先尝试修复环境**：分析错误日志 → 识别缺失的工具/库/依赖 → **使用 dnf 安装 openEuler 仓库中的对应包** → 重试。每次重试前清理构建缓存（如 `make clean`、删除 `build/` 目录等），避免缓存污染。重试至少 2 次，记录每次重试的命令、耗时和结果。
4. 记录构建产物（名称、路径、大小）
5. 最大调试时间 30-60 分钟（安装依赖的时间不计入），超时判定"不成功"

### 步骤 6：执行单元测试和样例

1. 先检查 UT/样例执行所需的运行时依赖是否已安装（如测试框架、断言库等），缺失则通过 dnf 先安装
2. 用 `time` 命令包裹测试/样例命令，记录耗时
3. 执行失败时先分析错误：缺少依赖则从 openEuler 仓库安装后重试，环境不兼容则记录原因
4. 解析测试结果：总数、通过数、失败数、失败详情
5. 每个样例记录执行状态和输出摘要
6. 构建产物为可安装包（wheel/rpm/deb）时，执行 `pip install` 或等效命令安装后做冒烟测试（smoke test），验证产物可被正常导入/使用

### 步骤 7：生成报告并清理

1. 停止并删除容器
2. 生成 JSON 报告，输出到 `./verification_report/`

## 报告输出规范

### 输出格式

严格按 `assets/report_template.json` 的字段结构生成报告，一步不差。

### 中文要求

报告中所有总结性文字必须以中文表述，包括但不限于：
- `image_source.selection_reason`：如 "仓库 Dockerfile 指定 FROM ubuntu:22.04，改用 openEuler 24.03 LTS"
- `image_source.dependency_mapping`：记录 Dockerfile 依赖到 openEuler 的包名映射
- `document_reading_summary` 中各项的 value：如 "Dockerfile 中 libssl-dev → openssl-devel，libboost-all-dev → boost-devel"
- `process_timeline` 中 action/result/details：如 "从 openEuler 仓库安装构建依赖"
- `problems_encountered` 中 problem/solution：如 "cmake 未找到 OpenSSL" → "dnf install openssl-devel（openEuler 原生包）"
- `documentation_gaps`：如 "Dockerfile 中 apt 包名 libcurl4-openssl-dev 映射为 openEuler 的 libcurl-devel"

### 细节要求

- `execution_log` 中每个步骤记录：timestamp、command、success、output、error、returncode、duration_seconds
- `process_timeline` 中每个阶段记录：timestamp、step、action、result、details
- `final_results` 中 build/ut/sample 各自记录 status 和 duration_seconds
- 时间戳统一用 ISO 8601 格式：`YYYY-MM-DDTHH:mm:ss`

### 报告文件名

`verification_report_WSL_<仓库名>_<YYYYMMDD>.json`

## 核心约束

1. **强制 openEuler**：只能使用 openEuler 基础镜像，禁止其他发行版镜像，禁止使用预构建镜像
2. **从零构建环境**：从干净的 openEuler 镜像开始，通过 dnf 一步一步安装所有依赖
3. **参考 Dockerfile**：读取仓库提供的 Dockerfile，提取依赖信息并映射到 openEuler 等效包
4. **只看文档**：依赖安装、命令执行均以文档、Dockerfile 和构建配置文件为依据，不自行猜测
5. **不改源码**：遇到构建错误不修改仓库文件，先查文档再判定
6. **缺少依赖必须先尝试安装**：pre-commit、lint-runner、构建、UT、样例等任何阶段报错，先分析错误原因，如果是缺少工具/库/依赖，立即从 openEuler 仓库安装后重试，不得直接标记失败。安装失败再记录失败原因。
7. **记录每一步**：命令、输出、耗时、成功/失败，全部录入 execution_log
8. **并发限制**：编译并发 ≤ 容器核数 × 60%
9. **最大调试**：单个问题排查不超过 30-60 分钟，每次重试安装不同依赖不计入超时
10. **中文总结**：报告中所有解释性、总结性文字用中文

## 绑定资源

### assets/report_template.json

JSON 报告结构模板。生成报告时必须严格匹配此模板的字段和层级结构。
