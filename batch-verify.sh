#!/bin/bash
# TTFHW 批量验证调度器 — 每仓库独立 session，不间断自动接力
# 中断后可随时重新运行，队列文件是唯一状态

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

QUEUE_FILE="verification-queue.yaml"
TIMEOUT_HOURS=4
TODAY=$(date +%Y%m%d)
LOG_DIR=".claude/batch-logs"
mkdir -p "$LOG_DIR"

# ═══════════════════════════════════════════
# YAML 辅助函数
# ═══════════════════════════════════════════

has_pending() {
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
pending = [r for r in data['queue'] if r['status'] == 'pending']
print(len(pending))
" 2>/dev/null
}

next_task() {
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['status'] == 'pending':
        print(f\"{r['repo']}|{r['url']}|{r['branch']}\")
        break
" 2>/dev/null
}

update_status() {
  local REPO="$1"
  local NEW_STATUS="$2"
  local NOTE="$3"
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['repo'] == '$REPO':
        r['status'] = '$NEW_STATUS'
        r['note'] = '$NOTE'
        break
with open('$QUEUE_FILE', 'w') as f:
    yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
" 2>/dev/null
}

list_failed() {
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
failed = [r for r in data['queue'] if r['status'] == 'failed']
for r in failed:
    print(f\"  ❌ {r['repo']:20s} {r.get('note', '')}\")
" 2>/dev/null
}

# 将 stale running 任务重置为 pending（上次会话崩溃残留）
reset_stale_running() {
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
reset = []
for r in data['queue']:
    if r['status'] == 'running':
        r['status'] = 'pending'
        r['note'] = 'previous session crashed, retry'
        reset.append(r['repo'])
with open('$QUEUE_FILE', 'w') as f:
    yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
if reset:
    print(f\"Reset stale tasks: {', '.join(reset)}\")
" 2>/dev/null
}

# ═══════════════════════════════════════════
# 产出验证
# ═══════════════════════════════════════════

verify_output() {
  local REPO="$1"
  local RAW_FILE=$(ls -t json-org-openeuler/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
  local NORM_FILE=$(ls -t json/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)

  if [ -z "$RAW_FILE" ]; then
    echo "  ❌ 原始报告未生成"
    return 1
  fi
  if [ -z "$NORM_FILE" ]; then
    echo "  ❌ 归一化报告未生成"
    return 1
  fi
  if ! python3 -c "import json; json.load(open('$RAW_FILE'))" 2>/dev/null; then
    echo "  ❌ 原始报告 JSON 损坏: $RAW_FILE"
    return 1
  fi
  if ! python3 -c "import json; json.load(open('$NORM_FILE'))" 2>/dev/null; then
    echo "  ❌ 归一化报告 JSON 损坏: $NORM_FILE"
    return 1
  fi

  echo "  ✅ 原始报告: $RAW_FILE"
  echo "  ✅ 归一化报告: $NORM_FILE"
  return 0
}

# ═══════════════════════════════════════════
# 主循环
# ═══════════════════════════════════════════

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器"
echo "  队列文件: $QUEUE_FILE"
echo "  日期:     $TODAY"
echo "  日志目录: $LOG_DIR"
echo "═══════════════════════════════════════════"

COUNT=0

while true; do
  echo ""
  echo "[$(date +%H:%M:%S)] pull 同步远端队列..."
  git pull origin main --rebase 2>&1 || {
    echo "  ⚠️ pull 冲突，尝试解决..."
    git checkout --theirs "$QUEUE_FILE" 2>/dev/null || true
    git add "$QUEUE_FILE" 2>/dev/null || true
    git commit -m "resolve queue conflict" 2>/dev/null || true
  }

  # 重置上次崩溃残留的 running 任务
  STALE=$(reset_stale_running)
  if [ -n "$STALE" ]; then
    echo "  🔄 $STALE"
    git add "$QUEUE_FILE" 2>/dev/null
    git commit -m "queue: reset stale running tasks" 2>/dev/null || true
    git push origin main 2>/dev/null || true
  fi

  PENDING=$(has_pending)
  if [ "$PENDING" = "0" ] || [ -z "$PENDING" ]; then
    FAILED=$(python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
print(len([r for r in data['queue'] if r['status'] == 'failed']))
" 2>/dev/null || echo 0)

    if [ "$FAILED" -gt 0 ]; then
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  ⚠️  队列已空，$FAILED 个失败需人工介入："
      echo "═══════════════════════════════════════════"
      list_failed
    else
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  🎉 全部完成！共验证 $COUNT 个仓库"
      echo "═══════════════════════════════════════════"
    fi
    break
  fi

  COUNT=$((COUNT + 1))

  TASK=$(next_task)
  NEXT=$(echo "$TASK" | cut -d'|' -f1)
  NEXT_URL=$(echo "$TASK" | cut -d'|' -f2)
  NEXT_BRANCH=$(echo "$TASK" | cut -d'|' -f3)

  LOG_FILE="$LOG_DIR/${NEXT}_$(date +%Y%m%d_%H%M%S).log"

  echo ""
  echo "═══════════════════════════════════════════"
  echo "  第 $COUNT 个: $NEXT"
  echo "  URL:       $NEXT_URL"
  echo "  分支:      $NEXT_BRANCH"
  echo "  日志:      $LOG_FILE"
  echo "  时间:      $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════"

  # 清理残留 worktree
  git worktree remove .claude/worktrees/"$NEXT" --force 2>/dev/null || true
  git branch -D "verify/$NEXT" 2>/dev/null || true
  git pull origin main --rebase 2>&1 || true

  # 标记为 running 并推送
  update_status "$NEXT" "running" ""
  git add "$QUEUE_FILE" 2>/dev/null
  git commit -m "queue: claim $NEXT" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  START_TS=$(date +%s)

  # ── 执行验证（单次，不重试）──
  # 不加 set -e，超时/失败由 EXIT_CODE 捕获
  timeout ${TIMEOUT_HOURS}h claude -p \
    --dangerously-skip-permissions \
    "使用 /ttfhw-batch-verify 技能完成任务。

     你的唯一目标是：为仓库 $NEXT（$NEXT_URL）在分支 $NEXT_BRANCH 上生成验证报告 JSON 文件。

     ⚠️ 关键约束：
     1. 全程不询问、不确认、不犹豫，直接执行
     2. 必须产出: json-org-openeuler/verification_report_*_${NEXT}_*.json
     3. 必须产出: json/verification_report_*_${NEXT}_*.json
     4. 完成后将 verification-queue.yaml 中 $NEXT 的状态改为 done（成功）或 failed（失败）
     5. 通过 python3 + yaml 更新队列文件，不要手动编辑
     6. git push 队列状态和报告文件到远端
     7. 退出前用 ls 验证两个 JSON 文件确实存在
     8. 如果文件不存在，你就是没完成" \
    > "$LOG_FILE" 2>&1

  EXIT_CODE=$?
  END_TS=$(date +%s)
  DURATION=$(( (END_TS - START_TS) / 60 ))

  # ── 验证产出并更新队列 ──
  {
    echo ""
    echo "──────────────────────────────────────────"
    echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  耗时:     ${DURATION} 分钟"
    echo "  退出码:   $EXIT_CODE"
  } | tee -a "$LOG_FILE"

  git pull origin main --rebase 2>&1 || true

  if [ $EXIT_CODE -eq 124 ]; then
    echo "  ❌ 超时（${TIMEOUT_HOURS}h），已终止" | tee -a "$LOG_FILE"
    update_status "$NEXT" "failed" "超时 ${TIMEOUT_HOURS}h"
  elif [ $EXIT_CODE -ne 0 ]; then
    echo "  ❌ session 异常退出 (exit=$EXIT_CODE)" | tee -a "$LOG_FILE"
    update_status "$NEXT" "failed" "session 异常退出 (exit=$EXIT_CODE)"
  elif verify_output "$NEXT"; then
    echo "  ✅ 验证通过" | tee -a "$LOG_FILE"
    update_status "$NEXT" "done" "验证通过 $(date +%Y-%m-%d)"
  else
    echo "  ❌ 产出验证失败" | tee -a "$LOG_FILE"
    update_status "$NEXT" "failed" "session 正常退出但未产出有效 JSON"
  fi

  # 推送队列更新
  git add "$QUEUE_FILE" 2>/dev/null
  git commit -m "queue: $NEXT done" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  echo "  队列已更新" | tee -a "$LOG_FILE"
  echo ""
  echo "  💡 随时重新运行 ./batch-verify.sh 继续下一个仓库"
  sleep 10
done
