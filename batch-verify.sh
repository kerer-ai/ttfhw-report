#!/bin/bash
# TTFHW 批量验证调度器 — 每仓库独立 session，不间断自动接力
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

QUEUE_FILE="verification-queue.md"
TIMEOUT_HOURS=4
TODAY=$(date +%Y%m%d)
LOG_DIR=".claude/batch-logs"
mkdir -p "$LOG_DIR"

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器"
echo "  队列文件: $QUEUE_FILE"
echo "  日期:     $TODAY"
echo "  日志目录: $LOG_DIR"
echo "═══════════════════════════════════════════"

COUNT=0

# ── 产出验证 ──
verify_output() {
  local REPO="$1"
  local RAW_FILE=""
  local NORM_FILE=""

  RAW_FILE=$(ls -t json-org-openeuler/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
  if [ -z "$RAW_FILE" ]; then
    echo "  ❌ 原始报告未生成"
    return 1
  fi

  NORM_FILE=$(ls -t json/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
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

# ── 主循环 ──
while true; do
  echo ""
  echo "[$(date +%H:%M:%S)] pull 同步远端队列..."
  git pull origin main --rebase 2>&1 || {
    echo "  ⚠️ pull 冲突，尝试解决..."
    git checkout --theirs "$QUEUE_FILE" 2>/dev/null
    git add "$QUEUE_FILE"
    git commit -m "resolve queue conflict" || true
  }

  if ! grep -q '| ⏳ |' "$QUEUE_FILE"; then
    FAILED_COUNT=$(grep -c '| ❌ |' "$QUEUE_FILE" 2>/dev/null || echo 0)
    if [ "$FAILED_COUNT" -gt 0 ]; then
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  ⚠️  队列已空，$FAILED_COUNT 个失败需人工介入："
      echo "═══════════════════════════════════════════"
      grep '| ❌ |' "$QUEUE_FILE"
    else
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  🎉 全部完成！共验证 $COUNT 个仓库"
      echo "═══════════════════════════════════════════"
    fi
    break
  fi

  COUNT=$((COUNT + 1))

  NEXT=$(grep '| ⏳ |' "$QUEUE_FILE" | head -1 | sed 's/.*| ⏳ | //' | cut -d'|' -f1 | xargs)
  NEXT_URL=$(grep '| ⏳ |' "$QUEUE_FILE" | head -1 | sed 's/.*| ⏳ | [^|]* | //' | cut -d'|' -f1 | xargs)

  LOG_FILE="$LOG_DIR/${NEXT}_$(date +%Y%m%d_%H%M%S).log"

  echo ""
  echo "═══════════════════════════════════════════"
  echo "  第 $COUNT 个: $NEXT"
  echo "  URL:       $NEXT_URL"
  echo "  日志:      $LOG_FILE"
  echo "  时间:      $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════"

  # 清理残留
  git worktree remove .claude/worktrees/"$NEXT" --force 2>/dev/null; true
  git branch -D "verify/$NEXT" 2>/dev/null; true
  git pull origin main --rebase 2>&1 || true

  START_TS=$(date +%s)

  # ── 执行（单次，不重试）──
  timeout ${TIMEOUT_HOURS}h claude -p \
    --permission-mode bypassPermissions \
    "使用 /ttfhw-batch-verify 技能完成任务。

     你的唯一目标是：为仓库 $NEXT（$NEXT_URL）生成验证报告 JSON 文件。

     ⚠️ 关键约束：
     1. 全程不询问、不确认、不犹豫，直接执行
     2. 必须产出: json-org-openeuler/verification_report_*_${NEXT}_*.json
     3. 必须产出: json/verification_report_*_${NEXT}_*.json
     4. 完成后将 verification-queue.md 中 $NEXT 行状态改为 ✅（成功）或 ❌（失败）
     5. git push 队列状态和报告文件到远端
     6. 退出前用 ls 验证两个 JSON 文件确实存在
     7. 如果文件不存在，你就是没完成" \
    > "$LOG_FILE" 2>&1

  EXIT_CODE=$?
  END_TS=$(date +%s)
  DURATION=$(( (END_TS - START_TS) / 60 ))

  # ── 验证产出并记录 ──
  echo "" | tee -a "$LOG_FILE"
  echo "──────────────────────────────────────────" | tee -a "$LOG_FILE"
  echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
  echo "  耗时:     ${DURATION} 分钟" | tee -a "$LOG_FILE"
  echo "  退出码:   $EXIT_CODE" | tee -a "$LOG_FILE"

  git pull origin main --rebase 2>&1 || true

  if [ $EXIT_CODE -eq 124 ]; then
    echo "  ❌ 超时（${TIMEOUT_HOURS}h），已终止" | tee -a "$LOG_FILE"
    STATUS="❌"
    NOTE="超时 ${TIMEOUT_HOURS}h"
  elif [ $EXIT_CODE -ne 0 ]; then
    echo "  ❌ session 异常退出 (exit=$EXIT_CODE)" | tee -a "$LOG_FILE"
    STATUS="❌"
    NOTE="session 异常退出 (exit=$EXIT_CODE)"
  elif verify_output "$NEXT"; then
    echo "  ✅ 验证通过" | tee -a "$LOG_FILE"
    STATUS="✅"
    NOTE=""
  else
    echo "  ❌ 产出验证失败" | tee -a "$LOG_FILE"
    STATUS="❌"
    NOTE="session 正常退出但未产出有效 JSON"
  fi

  # ── 更新队列 ──
  if grep -q "🔄.*$NEXT" "$QUEUE_FILE" 2>/dev/null; then
    sed -i "s/| 🔄 | $NEXT | .* | .* |/| $STATUS | $NEXT | $NEXT_URL | master | $NOTE |/" "$QUEUE_FILE"
  else
    sed -i "s/| ⏳ | $NEXT | .* | .* |/| $STATUS | $NEXT | $NEXT_URL | master | $NOTE |/" "$QUEUE_FILE"
  fi
  git add "$QUEUE_FILE"
  git commit -m "queue: $NEXT $STATUS ($NOTE)" || true
  git push origin main || true

  echo "  队列已更新: $STATUS" | tee -a "$LOG_FILE"
  sleep 10
done
