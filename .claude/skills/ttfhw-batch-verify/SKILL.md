---
name: ttfhw-batch-verify
description: |
  批量验证调度器 — 从队列文件中领取一个未验证仓库，在隔离 worktree 中执行
  端到端验证（verify → normalize → build → push），完成后标记队列并归档结果。
  每会话只处理一个仓库，下一个仓库在新窗口中继续。
  Trigger: "批量验证", "继续验证下一个", "跑队列", "/ttfhw-batch-verify"
---

# TTFHW 批量验证调度器

## 核心理念

**每会话一仓，队列文件是唯一共享状态。**

```
会话 1: git pull → 领 repo-A → 验证 → 归档 → 标记完成 → git push
会话 2: git pull → 领 repo-B → 验证 → 归档 → 标记完成 → git push
会话 3: git pull → 领 repo-C → 验证 → 归档 → 标记完成 → git push
...
```

## 队列文件

仓库根目录下的 `verification-queue.md`，格式：

```markdown
# 验证队列

> 最后更新: 2026-06-24
> 状态: 🔄 进行中 | ✅ 完成 | ❌ 失败 | ⏳ 等待

| 状态 | 仓库 | Git URL | 分支 | 备注 |
|------|------|---------|------|------|
| ✅ | amct | https://gitcode.com/cann/amct.git | master | |
| 🔄 | driver | https://gitcode.com/cann/driver.git | master | |
| ⏳ | hccl | https://gitcode.com/cann/hccl.git | master | |
| ⏳ | hcomm | https://gitcode.com/cann/hcomm.git | master | 需要特定依赖 |
```

**状态含义：**
- `⏳` 等待验证
- `🔄` 正在验证（已被某个会话领取）
- `✅` 验证完成
- `❌` 验证失败（需人工介入）

## 工作流程

### 步骤 0：同步队列

```bash
git pull origin main --rebase
```

如果队列文件有冲突，手动解决后继续。

### 步骤 1：领取任务

读取 `verification-queue.md`，找到第一个 `⏳` 状态的行，提取仓库名和 Git URL。

如果没有 `⏳` 的任务：
- 全部 `✅` → 输出 "🎉 所有仓库验证完成！"，结束
- 有 `❌` → 输出失败列表，提示用户决定是否重试

**领取任务后立即标记为 `🔄` 并推送到远端**，防止其他窗口重复领取：

```bash
# 修改队列文件中对应行的状态为 🔄
# commit 并 push
git add verification-queue.md
git commit -m "queue: claim <repo-name> for verification"
git push origin main
```

### 步骤 2：创建隔离 worktree

为当前仓库创建独立 git worktree：

```bash
git worktree add .claude/worktrees/<repo-name> -b verify/<repo-name>
```

进入 worktree 后，所有文件操作都在隔离空间中完成。

### 步骤 3：执行验证

调用 `ttfhw-pipeline` 技能（或 `ttfhw-verify-openeuler`，视仓库类型而定）执行完整验证流水线：

- 仓库验证 → 原始报告写入 `json-org-openeuler/`
- 报告归一化 → 归一化报告写入 `json/`
- 清理重建 → `npm run build`
- 推送到远端

### 步骤 4：归档结果

验证完成后，确认以下文件已正确生成：

```bash
ls json-org-openeuler/verification_report_*_<repo-name>_*.json
ls json/verification_report_*_<repo-name>_*.json
```

### 步骤 5：标记完成

修改 `verification-queue.md` 中对应仓库的状态：

- 验证成功 → `✅`
- 验证失败 → `❌`，在备注列记录失败原因

```bash
git add verification-queue.md json-org-openeuler/ json/ docs/
git commit -m "verify: complete <repo-name> verification

- Status: <success|failed>
- Report: json/verification_report_WSL_<repo-name>_<date>.json

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 步骤 6：清理 worktree

```bash
git worktree remove .claude/worktrees/<repo-name> --force
git branch -D verify/<repo-name>
```

### 步骤 7：输出续接指令

```
╔══════════════════════════════════════════╗
║  ✅ <repo-name> 验证完成                  ║
╠══════════════════════════════════════════╣
║  状态:   <success|failed>                ║
║  报告:   json/.../<repo-name>            ║
║  队列:   X/Y 完成                        ║
╠══════════════════════════════════════════╣
║  下一个: <next-repo>                     ║
║                                          ║
║  请打开新窗口执行:                        ║
║  /ttfhw-batch-verify                     ║
╚══════════════════════════════════════════╝
```

## 异常处理

### 验证失败

- 如果某个仓库验证失败，在 `verification-queue.md` 中标记 `❌`，备注列写原因
- 推送队列状态更新，让用户知道哪个仓库需要关注
- **不阻塞后续仓库**：继续领取下一个 `⏳` 任务

### 队列冲突

- 如果 `git push` 队列状态时发生冲突，说明另一个窗口也在修改队列
- `git pull --rebase` 后重新读取队列，确认自己的任务仍是 `🔄`
- 如果另一个窗口已标记为 `✅`，说明被抢先了，换下一个 `⏳`

### worktree 已存在

- 如果 `.claude/worktrees/<repo-name>` 已存在，先清理：
  ```bash
  git worktree remove .claude/worktrees/<repo-name> --force 2>/dev/null
  git branch -D verify/<repo-name> 2>/dev/null
  ```

## 安全约束

- ⚠️ 步骤 1 领取任务后**必须立即 push**，防止重复领取
- ⚠️ 步骤 5 推送前确认验证报告已正确生成
- ⚠️ 不删除不相关仓库的数据
- ⚠️ worktree 使用完毕后必须清理，避免磁盘堆积
