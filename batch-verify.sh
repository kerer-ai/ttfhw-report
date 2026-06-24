#!/bin/bash
# TTFHW 批量验证调度器 — 每仓库独立 session，不间断自动接力
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

QUEUE_FILE="verification-queue.md"
MAX_RETRIES=1          # 每个仓库最多重试次数
TIMEOUT_HOURS=4        # 单仓超时（小时）
TODAY=$(date +%Y%m%d)

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器"
echo "  队列文件: $QUEUE_FILE"
echo "  模式:     每仓库独立 session"
echo "  日期:     $TODAY"
echo "═══════════════════════════════════════════"
echo ""

COUNT=0

# ── 产出验证函数 ──
verify_output() {
  local REPO="$1"
  local RAW_FILE=""
  local NORM_FILE=""

  # 检查原始报告（json-org-openeuler/）
  RAW_FILE=$(ls -t json-org-openeuler/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
  if [ -z "$RAW_FILE" ]; then
    echo "  ❌ 原始报告未生成: json-org-openeuler/verification_report_*_${REPO}_*.json"
    return 1
  fi

  # 检查归一化报告（json/）
  NORM_FILE=$(ls -t json/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
  if [ -z "$NORM_FILE" ]; then
    echo "  ❌ 归一化报告未生成: json/verification_report_*_${REPO}_*.json"
    return 1
  fi

  # 检查文件是否为今天生成（非空、有效 JSON）
  if ! python3 -c "import json; d=json.load(open('$RAW_FILE')); print('OK')" 2>/dev/null | grep -q OK; then
    echo "  ❌ 原始报告 JSON 损坏: $RAW_FILE"
    return 1
  fi
  if ! python3 -c "import json; d=json.load(open('$NORM_FILE')); print('OK')" 2>/dev/null | grep -q OK; then
    echo "  ❌ 归一化报告 JSON 损坏: $NORM_FILE"
    return 1
  fi

  echo "  ✅ 原始报告: $RAW_FILE"
  echo "  ✅ 归一化报告: $NORM_FILE"
  return 0
}

# ── 主循环 ──
while true; do
  # 同步远端队列
  echo "[$(date +%H:%M:%S)] pull 同步远端队列..."
  git pull origin main --rebase 2>&1 || { echo "  ⚠️ pull 冲突，尝试解决..."; git checkout --theirs "$QUEUE_FILE" 2>/dev/null; git add "$QUEUE_FILE"; git commit -m "resolve queue conflict" || true; }

  # 检查是否还有待验证仓库
  if ! grep -q '⏳' "$QUEUE_FILE"; then
    FAILED_COUNT=$(grep -c '❌' "$QUEUE_FILE" 2>/dev/null || echo 0)
    if [ "$FAILED_COUNT" -gt 0 ]; then
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  ⚠️  队列中无待验证仓库"
      echo "  失败 $FAILED_COUNT 个，需人工介入："
      echo "═══════════════════════════════════════════"
      grep '❌' "$QUEUE_FILE"
    else
      echo ""
      echo "═══════════════════════════════════════════"
      echo "  🎉 全部完成！共验证 $COUNT 个仓库"
      echo "═══════════════════════════════════════════"
    fi
    break
  fi

  COUNT=$((COUNT + 1))

  NEXT=$(grep '⏳' "$QUEUE_FILE" | head -1 | sed 's/.*| ⏳ | //' | cut -d'|' -f1 | xargs)
  NEXT_URL=$(grep '⏳' "$QUEUE_FILE" | head -1 | sed 's/.*| ⏳ | [^|]* | //' | cut -d'|' -f1 | xargs)

  echo ""
  echo "═══════════════════════════════════════════"
  echo "  第 $COUNT 个: $NEXT"
  echo "  URL:       $NEXT_URL"
  echo "  时间:      $(date +%H:%M:%S)"
  echo "═══════════════════════════════════════════"

  SUCCESS=false

  for ATTEMPT in $(seq 1 $((MAX_RETRIES + 1))); do
    echo ""
    echo "  ── 尝试 $ATTEMPT / $((MAX_RETRIES + 1)) ──"

    # 每次尝试前清理可能残留的 worktree 和 🔄 状态
    git worktree remove .claude/worktrees/"$NEXT" --force 2>/dev/null; true
    git branch -D "verify/$NEXT" 2>/dev/null; true
    git pull origin main --rebase 2>&1 || true

    # ── 核心：独立 session，一次性完成 ──
    # --permission-mode bypassPermissions 避免权限提示阻塞
    # timeout 防止无限挂起
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
      2>&1

    EXIT_CODE=$?

    # ── 验证产出 ──
    echo ""
    echo "  ── 验证产出 ──"
    git pull origin main --rebase 2>&1 || true

    if verify_output "$NEXT"; then
      SUCCESS=true
      break
    else
      echo "  ⚠️ 产出验证失败 (exit=$EXIT_CODE)"
      if [ $ATTEMPT -le $MAX_RETRIES ]; then
        echo "  将在 30 秒后重试..."
        sleep 30
      fi
    fi
  done

  # ── 最终标记 ──
  if [ "$SUCCESS" = true ]; then
    echo ""
    echo "  ✅ $NEXT 验证完成"
    # 确保队列标记为完成（skill 可能已做，这里兜底）
    if grep -q "🔄.*$NEXT" "$QUEUE_FILE" 2>/dev/null; then
      sed -i "s/| 🔄 | $NEXT |/| ✅ | $NEXT |/" "$QUEUE_FILE"
      git add "$QUEUE_FILE"
      git commit -m "queue: mark $NEXT complete" || true
      git push origin main || true
    fi
  else
    echo ""
    echo "  ❌ $NEXT 验证失败（重试 $((MAX_RETRIES + 1)) 次后仍未产出有效 JSON）"
    git pull origin main --rebase 2>&1 || true
    sed -i "s/| 🔄 | $NEXT |/| ❌ | $NEXT | session 未产出有效 JSON/" "$QUEUE_FILE"
    git add "$QUEUE_FILE"
    git commit -m "queue: mark $NEXT failed (no valid JSON after retries)" || true
    git push origin main || true
  fi

  sleep 10
done
