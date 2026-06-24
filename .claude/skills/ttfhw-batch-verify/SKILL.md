---
name: ttfhw-batch-verify
description: |
  批量验证调度器 — 从队列文件中领取一个未验证仓库，在隔离 worktree 中执行
  端到端验证（verify → normalize → build → push），完成后标记队列并归档结果。
  每会话只处理一个仓库，通过外部 shell 循环驱动，每个仓库获得全新独立 session。
  触发: "批量验证", "继续验证下一个", "跑队列", "/ttfhw-batch-verify"
---

# TTFHW 批量验证调度器

## 运行模式

**自动循环模式（推荐）：** 终端执行 `./batch-verify.sh`

```
shell 循环
  ├─ claude -p "..."  ← Session 1（全新上下文，领取 kernel）
  │   └─ 验证 → 归档 → 标记 ✅ → 退出
  ├─ claude -p "..."  ← Session 2（全新上下文，领取 iSulad）
  │   └─ 验证 → 归档 → 标记 ✅ → 退出
  ├─ claude -p "..."  ← Session 3 ...
  └─ 队列无 ⏳ → 循环结束 → 🎉
```

**手动模式：** 在 Claude Code 交互窗口中执行 `/ttfhw-batch-verify`，完成后手动开新窗口继续。

## 队列文件

仓库根目录下 `verification-queue.yaml`：

```yaml
queue:
  - repo: kernel
    url: https://gitcode.com/openeuler/kernel.git
    branch: OLK-6.6
    status: pending       # pending | running | done | failed
    note: ""

  - repo: iSulad
    url: https://gitcode.com/openeuler/iSulad.git
    branch: master
    status: done
    note: "验证通过 2026-06-24"
```

**状态：** `pending` 等待 → `running` 进行中 → `done` 完成 / `failed` 失败

## ⚠️ 完成定义（Definition of Done）

以下 **3 个条件全部满足** 才算完成，缺一不可：

```
1. json-org-openeuler/verification_report_*_<repo>_*.json  存在且为合法 JSON
2. json/verification_report_*_<repo>_*.json                 存在且为合法 JSON
3. verification-queue.md 中该仓库状态已改为 ✅ 或 ❌ 并 git push
```

如果只做了第 3 项但前两项不满足 → **你没有完成，必须重做**。
如果前两项满足但第 3 项没做 → shell 脚本的兜底逻辑会补救。

## 工作流程（7 步，全自动无交互）

### 步骤 0：同步队列

```bash
git pull origin main --rebase
```

### 步骤 1：领取任务

读取 `verification-queue.yaml`，找到第一个 `status: pending` 的任务，提取 repo、url、branch。

**没有 pending 时：** 全部 done → 输出 "ALL_DONE"。有 failed → 输出失败列表。

**领取后立即推送锁定：**

```bash
python3 -c "
import yaml
with open('verification-queue.yaml') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['status'] == 'pending':
        r['status'] = 'running'
        break
with open('verification-queue.yaml', 'w') as f:
    yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
"
git add verification-queue.yaml
git commit -m "queue: claim <repo-name> for verification"
git push origin main
```

### 步骤 2：创建隔离 worktree

```bash
# 清理可能残留的旧 worktree
git worktree remove .claude/worktrees/<repo-name> --force 2>/dev/null; true
git branch -D verify/<repo-name> 2>/dev/null; true
# 创建新 worktree
git worktree add .claude/worktrees/<repo-name> -b verify/<repo-name>
```

### 步骤 3：执行验证

在 worktree 中调用 `ttfhw-verify-openeuler` 技能（openEuler 仓库）执行验证：

- 仓库验证 → 原始报告写入 `json-org-openeuler/`
- 报告归一化（调用 `ttfhw-report-normalizer`）→ 归一化报告写入 `json/`
- 清理重建 → `npm run build`

### 步骤 4：自检验证（⚠️ 标记完成前必须执行）

**这是最关键的一步。不做这一步不得标记 ✅。**

```bash
# 必须用 ls 确认两个文件真实存在
ls -l json-org-openeuler/verification_report_*_<repo-name>_*.json
ls -l json/verification_report_*_<repo-name>_*.json
```

如果任一文件不存在 → **你没有完成**，返回步骤 3 重新执行验证。

如果两个文件都存在 → 继续步骤 5。

### 步骤 5：标记完成

修改队列状态：

- 验证成功 → `done`，note 写"验证通过 YYYY-MM-DD"
- 验证失败 → `failed`，note 写失败原因

```bash
python3 -c "
import yaml
with open('verification-queue.yaml') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['repo'] == '<repo-name>':
        r['status'] = 'done'  # or 'failed'
        r['note'] = '验证通过 $(date +%Y-%m-%d)'
        break
with open('verification-queue.yaml', 'w') as f:
    yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
"
git add verification-queue.yaml json-org-openeuler/ json/ docs/
git commit -m "verify: complete <repo-name> verification
...
Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 步骤 6：清理 worktree

```bash
git worktree remove .claude/worktrees/<repo-name> --force
git branch -D verify/<repo-name>
```

### 步骤 7：输出结果

```
[TTFHVV_BATCH] repo=<repo-name> status=<success|failed> remaining=<N>
```

## 异常处理

### 任何步骤失败

- 捕获错误，将仓库标记为 `❌`，备注记录原因
- 清理 worktree 残留
- 推送队列状态
- **不阻塞**：shell 循环会继续下一个 ⏳

### 队列冲突（git push 冲突）

- `git pull --rebase` 重试
- 如果自己的 🔄 被覆盖为 ✅，说明被其他会话抢先，换下一个 ⏳

### worktree 残留

- 步骤 2 先清理再创建，确保干净初始状态

### 验证超时

- 单个仓库验证没有硬性超时（验证技能内部自行控制）
- 如果 claude 进程崩溃，shell 循环 sleep 5s 后继续下一个

## 安全约束

- ⚠️ 步骤 1 领取后**必须立即 push**，防止重复领取
- ⚠️ 步骤 5 推送前确认报告已生成
- ⚠️ 不删除不相关仓库数据
- ⚠️ worktree 用完即清，避免磁盘堆积
- ⚠️ 非 openEuler 的仓库用 `ttfhw-pipeline` 代替 `ttfhw-verify-openeuler`
