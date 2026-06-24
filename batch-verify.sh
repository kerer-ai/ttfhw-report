#!/bin/bash
# TTFHW 批量验证调度器
# ── 职责：队列管理 + git 操作 + 调度 claude session ──
# ── 验证执行（容器/编译/UT/归一化）由 ttfhw-batch-verify skill 负责 ──
# 中断后可随时重新运行，队列文件是唯一状态

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════

QUEUE_FILE="verification-queue.yaml"
TIMEOUT_HOURS=4
TODAY=$(date +%Y%m%d)
LOG_DIR=".claude/batch-logs"

# 远程验证机器（可选，留空则 WSL 本地执行）
# 所有队列中的仓库默认使用此配置，单个仓库可在 YAML 中覆盖
REMOTE_IP=""            # 例: "10.10.1.100"
REMOTE_USER=""          # 例: "root"，免密 SSH 登录

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
        remote = r.get('remote', {})
        rip = remote.get('ip', '') if remote else ''
        ruser = remote.get('user', '') if remote else ''
        print(f\"{r['repo']}|{r['url']}|{r['branch']}|{rip}|{ruser}\")
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
# 构建 claude -p 的 prompt
# ═══════════════════════════════════════════

build_prompt() {
  local REPO="$1"
  local URL="$2"
  local BRANCH="$3"
  local RIP="$4"
  local RUSER="$5"

  local ENV_DESC="WSL 本地 Docker"
  local REMOTE_FLAG=""
  if [ -n "$RIP" ]; then
    ENV_DESC="远程机器 $RIP"
    REMOTE_FLAG="
     远程机器 IP: $RIP
     远程用户:   ${RUSER:-root}
     认证方式:   免密 SSH"
  fi

  cat <<PROMPT
执行 /ttfhw-batch-verify 技能。

仓库信息:
  仓库名:  $REPO
  URL:    $URL
  分支:    $BRANCH

验证环境: $ENV_DESC$REMOTE_FLAG

⚠️ 关键约束:
1. 在容器内编译，并发 = CPU核数 × 20%
2. 容器名必须为 ${REPO}-ttfhw
3. 产出: json-org-openeuler/verification_report_WSL_${REPO}_*.json
4. 产出: json/verification_report_WSL_${REPO}_*.json
5. 不操作 git，不更新队列文件，只做验证 + 归一化
PROMPT
}

# ═══════════════════════════════════════════
# 主循环
# ═══════════════════════════════════════════

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器"
echo "  队列文件:  $QUEUE_FILE"
echo "  默认环境:  ${REMOTE_IP:-WSL 本地}"
echo "  日期:      $TODAY"
echo "  日志目录:  $LOG_DIR"
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
  NEXT_RIP=$(echo "$TASK" | cut -d'|' -f4)
  NEXT_RUSER=$(echo "$TASK" | cut -d'|' -f5)

  # 仓库级远程配置覆盖全局默认
  RIP="${NEXT_RIP:-$REMOTE_IP}"
  RUSER="${NEXT_RUSER:-$REMOTE_USER}"

  LOG_FILE="$LOG_DIR/${NEXT}_$(date +%Y%m%d_%H%M%S).log"

  echo ""
  echo "═══════════════════════════════════════════"
  echo "  第 $COUNT 个: $NEXT"
  echo "  URL:       $NEXT_URL"
  echo "  分支:      $NEXT_BRANCH"
  if [ -n "$RIP" ]; then
    echo "  远程机器:  ${RUSER:+$RUSER@}$RIP"
  else
    echo "  环境:      WSL 本地"
  fi
  echo "  日志:      $LOG_FILE"
  echo "  时间:      $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════"

  # 同步远端最新队列状态
  git pull origin main --rebase 2>&1 || true
  # 提交本地可能的未提交修改（上次残留）
  git add "$QUEUE_FILE" 2>/dev/null || true
  git commit -m "checkpoint before $NEXT" 2>/dev/null || true

  # 标记为 running 并推送
  update_status "$NEXT" "running" ""
  git add "$QUEUE_FILE" 2>/dev/null
  git commit -m "queue: claim $NEXT" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  START_TS=$(date +%s)

  # ── 执行验证（skill 只管验证+归一化，不管队列/git）──
  PROMPT=$(build_prompt "$NEXT" "$NEXT_URL" "$NEXT_BRANCH" "$RIP" "$RUSER")

  timeout ${TIMEOUT_HOURS}h claude -p \
    --dangerously-skip-permissions \
    "$PROMPT" \
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

  # 推送队列 + 报告文件
  git add "$QUEUE_FILE" json-org-openeuler/ json/ docs/ 2>/dev/null || true
  git commit -m "verify: $NEXT complete" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  echo "  队列已更新" | tee -a "$LOG_FILE"
  echo ""
  echo "  💡 随时重新运行 ./batch-verify.sh 继续下一个仓库"
  sleep 10
done
