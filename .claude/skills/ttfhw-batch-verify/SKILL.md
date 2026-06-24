---
name: ttfhw-batch-verify
description: |
  单仓库验证执行器 — 负责在 WSL 本地或远程机器上启动 openEuler 容器执行验证，
  完成后归一化报告。不管理队列，不操作 git，只做验证 + 归一化两件事。
  触发: "/ttfhw-batch-verify", "验证并归一化 XXX"
---

# TTFHW 单仓库验证执行器

## 职责边界

```
ttfhw-batch-verify 只管两件事：
  1. ttfhw-verify-openeuler  → 仓库验证，产出原始 JSON
  2. ttfhw-report-normalizer  → 报告归一化，产出归一化 JSON

不管的事（由 batch-verify.sh 负责）：
  ❌ 队列管理（领取/标记/推送）
  ❌ git 操作（commit/push/pull）
  ❌ worktree 创建/清理
  ❌ 多仓库调度
```

## 输入参数

每次调用必须明确以下信息（由 shell 脚本通过 prompt 传入）：

| 参数 | 必填 | 说明 |
|------|------|------|
| 仓库 URL | ✅ | 如 `https://gitcode.com/openeuler/kernel.git` |
| 分支 | ✅ | 如 `OLK-6.6` 或 `master` |
| 仓库名 | ✅ | 从 URL 提取，如 `kernel` |
| 远程机器 IP | ❌ | 不提供则默认 WSL 本地执行 |
| 远程机器认证 | ❌ | 默认免密 SSH（`ssh <ip>` 直接登录） |

## 验证环境

### 模式一：WSL 本地（默认）

当未提供远程机器 IP 时，在本地 WSL 环境中启动容器验证。

```
宿主机 (WSL2)
  └─ docker run --name <repo>-ttfhw ...
       └─ openEuler 24.03 LTS 容器
            ├─ dnf install 依赖
            ├─ 编译（并发 = CPU核数 × 20%）
            └─ UT / 样例
```

**前置检查：**

```bash
# 1. 检查 Docker 是否可用
docker version 2>&1

# 2. 如果 Docker 不可用，尝试启动 dockerd
# WSL2 中可能需要: sudo service docker start
# 如果都不行，报告"Docker 不可用，请提供远程机器 IP"
```

### 模式二：远程机器

当提供远程机器 IP 时，SSH 到远程机器执行。

```
本地 WSL2                             远程机器 (如 10.x.x.x)
  │                                       │
  ├─ ssh <ip> "docker version" ──────────→│ 检查 Docker
  ├─ rsync 仓库代码到远程 ───────────────→│
  ├─ ssh <ip> "docker run --name           │
  │    <repo>-ttfhw ..." ────────────────→│ 启动容器验证
  │                                       │ 编译（并发 = 远程CPU核数 × 20%）
  │                                       │ UT / 样例
  ├─ scp 验证报告回本地 ←────────────────│
  └─ docker rm <repo>-ttfhw               │ 清理容器
```

**前置检查：**

```bash
# 验证免密 SSH 连通性
ssh -o ConnectTimeout=5 -o BatchMode=yes <ip> "echo OK"

# 检查远程 Docker 可用性
ssh <ip> "docker version"

# 获取远程机器规格（CPU 核数、内存）
ssh <ip> "nproc && free -g | awk '/Mem:/{print \$2}'"
```

## ⚠️ 强制约束

### 容器命名

**必须使用 `<仓库名>-ttfhw` 格式**，防止同一机器上并发验证冲突：

```bash
# 正确
docker run --name kernel-ttfhw ...
docker run --name iSulad-ttfhw ...
docker run --name A-Tune-ttfhw ...

# 错误
docker run --name ttfhw-kernel ...     # 不是这个格式
docker run --name verification_kernel  # 不是这个格式
```

启动前先清理同名残留容器：

```bash
docker rm -f <repo>-ttfhw 2>/dev/null; true
docker run -d --name <repo>-ttfhw \
  -v $(pwd):/workspace \
  hub.oepkgs.net/openeuler/openeuler:24.03-lts \
  sleep infinity
```

### 编译并发限制

**强制：容器内编译并发数 = CPU 核数 × 20%（向下取整，至少为 1）**

```bash
# 获取容器可用的 CPU 核数
CPUS=$(docker exec <repo>-ttfhw nproc)
# 计算编译并发（20%，至少 1）
JOBS=$(( CPUS / 5 ))
[ $JOBS -lt 1 ] && JOBS=1

# 所有 make / cmake / cargo build 等编译命令必须带此并发限制
make -j$JOBS
cmake --build . -- -j$JOBS
cargo build -j$JOBS
```

### 远程执行规范

所有远程命令通过 `ssh <ip> "..."` 包装执行：

```bash
# 代码同步（排除 .git 减小传输量，或用 git clone）
rsync -az --exclude='.git' ./ <ip>:/tmp/<repo>-verify/

# 在远程启动容器
ssh <ip> "docker rm -f <repo>-ttfhw 2>/dev/null; true"
ssh <ip> "docker run -d --name <repo>-ttfhw \
  -v /tmp/<repo>-verify:/workspace \
  hub.oepkgs.net/openeuler/openeuler:24.03-lts \
  sleep infinity"

# 在远程容器内执行命令
ssh <ip> "docker exec <repo>-ttfhw bash -c 'cd /workspace && make -j\$(nproc)'"

# 取回验证报告
scp -r <ip>:/tmp/<repo>-verify/verification_report_*.json ./json-org-openeuler/
```

## 工作流程

### 步骤 1：确定环境并检查

```
有远程 IP？
  ├─ 是 → 检查 SSH 连通性 → 检查远程 Docker → 获取远程机器规格
  └─ 否 → 检查本地 Docker  → 获取本地机器规格
```

无法满足则直接报告失败原因，不降级、不猜测。

### 步骤 2：准备代码

**本地模式：** 当前目录即仓库代码，直接挂载。

**远程模式：** 将代码同步到远程机器：

```bash
# 方式一：rsync 当前目录
rsync -az --exclude='.git' --exclude='node_modules' --exclude='.next' \
  ./ <ip>:/tmp/<repo>-verify/

# 方式二：让远程机器直接 git clone（推荐，保证代码干净）
ssh <ip> "git clone --depth 1 --branch <branch> <repo-url> /tmp/<repo>-verify"
```

### 步骤 3：启动容器

```bash
# 拉取镜像（本地或远程）
docker pull hub.oepkgs.net/openeuler/openeuler:24.03-lts

# 清理同名残留
docker rm -f <repo>-ttfhw 2>/dev/null; true

# 启动容器
docker run -d --name <repo>-ttfhw \
  --cpus=<CPU核数> \
  -v /tmp/<repo>-verify:/workspace \
  -w /workspace \
  hub.oepkgs.net/openeuler/openeuler:24.03-lts \
  sleep infinity
```

### 步骤 4：执行验证

调用 `ttfhw-verify-openeuler` 技能流程，在容器内完成：

- 文档阅读理解（步骤 1-3 在宿主机完成）
- 依赖安装（容器内 dnf）
- 编译（容器内，并发 = 20% CPU）
- UT / 样例（容器内）

所有容器内命令通过 `docker exec <repo>-ttfhw bash -c '...'` 执行。

### 步骤 5：收集报告

验证完成后，原始 JSON 报告在容器挂载目录中：

```bash
# 本地模式：报告已在 json-org-openeuler/ 下
ls json-org-openeuler/verification_report_WSL_<repo>_*.json

# 远程模式：从远程取回报告
scp <ip>:/tmp/<repo>-verify/verification_report_*.json ./json-org-openeuler/
```

### 步骤 6：归一化

调用 `ttfhw-report-normalizer` 技能，传入刚生成的原始文件名，产出归一化 JSON 到 `json/` 目录。

### 步骤 7：清理容器

```bash
docker rm -f <repo>-ttfhw

# 远程模式额外清理代码目录
ssh <ip> "rm -rf /tmp/<repo>-verify"
```

## 状态输出

完成后输出结构化结果供 shell 脚本解析：

```
[TTFHVV_RESULT]
repo=<repo-name>
build=<success|failed|not_run>
ut=<success|failed|partial_success|not_run>
sample=<success|failed|partial_success|not_run>
raw_report=json-org-openeuler/verification_report_WSL_<repo>_<date>.json
norm_report=json/verification_report_WSL_<repo>_<date>.json
environment=<local|remote:<ip>>
duration=<seconds>
```
