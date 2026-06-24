#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

QUEUE_FILE="verification-queue.md"

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器"
echo "  队列文件: $QUEUE_FILE"
echo "  模式:     每仓库独立 session"
echo "═══════════════════════════════════════════"
echo ""

COUNT=0

while true; do
  # 拉取最新队列
  echo "[pull] 同步远端队列..."
  git pull origin main --rebase 2>&1 || true

  # 检查是否还有待验证仓库
  if ! grep -q '⏳' "$QUEUE_FILE"; then
    FAILED_COUNT=$(grep -c '❌' "$QUEUE_FILE" 2>/dev/null || echo 0)
    if [ "$FAILED_COUNT" -gt 0 ]; then
      echo ""
      echo "⚠️  队列中无待验证仓库，但有 $FAILED_COUNT 个失败任务："
      grep '❌' "$QUEUE_FILE"
      echo ""
      echo "请手动处理失败仓库后重新运行。"
    else
      echo ""
      echo "🎉 所有仓库验证完成！共 $COUNT 个仓库。"
    fi
    break
  fi

  COUNT=$((COUNT + 1))

  NEXT=$(grep '⏳' "$QUEUE_FILE" | head -1 | sed 's/.*| ⏳ | //' | cut -d'|' -f1 | xargs)
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  第 $COUNT 个仓库: $NEXT"
  echo "  启动独立 session..."
  echo "═══════════════════════════════════════════"
  echo ""

  # 全新独立 session，执行一个仓库的验证
  claude -p "执行 /ttfhw-batch-verify 技能。自动领取 verification-queue.md 中第一个 ⏳ 任务，执行完整的验证流水线（verify → normalize → build → push），完成后标记队列并退出。全程无需交互确认，遇到错误标记为 ❌ 后退出。" 2>&1

  EXIT_CODE=$?

  echo ""
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[$COUNT] $NEXT — session 正常结束"
  else
    echo "[$COUNT] $NEXT — session 异常 (exit code: $EXIT_CODE)，继续下一个"
    # 如果任务未标记完成，标记为失败
    if grep -q "🔄.*$NEXT" "$QUEUE_FILE"; then
      git pull origin main --rebase 2>&1 || true
      sed -i "s/| 🔄 | $NEXT |/| ❌ | $NEXT |/" "$QUEUE_FILE"
      git add "$QUEUE_FILE"
      git commit -m "queue: mark $NEXT as failed (session crashed)" || true
      git push origin main || true
    fi
  fi

  # 短暂间隔，避免 API 限流
  sleep 10
done
