#!/bin/bash
# TTFHW 批量验证调度器（并发版）
# ── 职责：队列管理 + git 操作 + 并发调度 claude session ──
# ── 验证执行由 ttfhw-verify-runner skill 负责 ──
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
STATUS_DIR=".claude/batch-status"   # 后台任务状态文件

REMOTE_IP="192.168.9.114"
REMOTE_USER="root"
MAX_CONCURRENCY=5                    # 最大并发数

mkdir -p "$LOG_DIR" "$STATUS_DIR"

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

# 原子领取：找到 pending → 标记 running → 写入 → 输出 "repo|url|branch|rip|ruser"
# 调用方负责 git add/commit/push
claim_one() {
  python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['status'] == 'pending':
        r['status'] = 'running'
        r['note'] = ''
        with open('$QUEUE_FILE', 'w') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        remote = r.get('remote', {})
        rip = remote.get('ip', '') if remote else ''
        ruser = remote.get('user', '') if remote else ''
        print(f\"{r['repo']}|{r['url']}|{r['branch']}|{rip}|{ruser}\")
        exit(0)
print('NONE')
" 2>/dev/null
}

claim_and_push() {
  # 本地原子领取
  local CLAIMED=$(claim_one)
  if [ "$CLAIMED" = "NONE" ]; then
    return 1
  fi
  # 推送锁定
  git add "$QUEUE_FILE" 2>/dev/null
  git commit -m "queue: claim $(echo $CLAIMED | cut -d'|' -f1)" 2>/dev/null || true
  git push origin main 2>/dev/null || true
  echo "$CLAIMED"
  return 0
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

  [ -z "$RAW_FILE" ]  && { echo "  ❌ 原始报告未生成"; return 1; }
  [ -z "$NORM_FILE" ] && { echo "  ❌ 归一化报告未生成"; return 1; }
  python3 -c "import json; json.load(open('$RAW_FILE'))"  2>/dev/null || { echo "  ❌ 原始 JSON 损坏: $RAW_FILE"; return 1; }
  python3 -c "import json; json.load(open('$NORM_FILE'))" 2>/dev/null || { echo "  ❌ 归一化 JSON 损坏: $NORM_FILE"; return 1; }

  echo "  ✅ 原始: $RAW_FILE"
  echo "  ✅ 归一化: $NORM_FILE"
  return 0
}

# ═══════════════════════════════════════════
# 构建 prompt
# ═══════════════════════════════════════════

build_prompt() {
  local REPO="$1" URL="$2" BRANCH="$3" RIP="$4" RUSER="$5"

  local ENV="WSL 本地 Docker"
  local EXTRA=""
  if [ -n "$RIP" ]; then
    ENV="远程机器 $RIP"
    EXTRA="
     远程机器 IP: $RIP
     远程用户:   ${RUSER:-root}
     认证方式:   免密 SSH"
  fi

  cat <<PROMPT
执行 /ttfhw-verify-runner 技能。

仓库信息:
  仓库名:  $REPO
  URL:    $URL
  分支:    $BRANCH

验证环境: $ENV$EXTRA

⚠️ 关键约束:
1. 在容器内编译，并发 = CPU核数 × 20%
2. 容器名必须为 ${REPO}-ttfhw
3. 产出: json-org-openeuler/verification_report_WSL_${REPO}_*.json
4. 产出: json/verification_report_WSL_${REPO}_*.json
5. 不操作 git，不更新队列文件，只做验证 + 归一化
6. 完成后输出 [TTFHVV_RESULT] 结构化结果
PROMPT
}

# ═══════════════════════════════════════════
# 单个仓库验证（后台任务）
# ═══════════════════════════════════════════

run_single() {
  local REPO="$1" URL="$2" BRANCH="$3" RIP="$4" RUSER="$5"
  local LOG_FILE="$LOG_DIR/${REPO}_$(date +%Y%m%d_%H%M%S).log"
  local STATUS_FILE="$STATUS_DIR/${REPO}.status"

  echo "[$(date +%H:%M:%S)] $REPO 开始..." | tee "$STATUS_FILE"

  local PROMPT=$(build_prompt "$REPO" "$URL" "$BRANCH" "$RIP" "$RUSER")
  local START_TS=$(date +%s)

  timeout ${TIMEOUT_HOURS}h claude -p \
    --dangerously-skip-permissions \
    "$PROMPT" \
    > "$LOG_FILE" 2>&1

  local EXIT_CODE=$?
  local END_TS=$(date +%s)
  local DURATION=$(( (END_TS - START_TS) / 60 ))

  {
    echo ""
    echo "──────────────────────────────────────────"
    echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  耗时:     ${DURATION} 分钟"
    echo "  退出码:   $EXIT_CODE"
  } >> "$LOG_FILE"

  # 写入结构化状态文件供主进程读取
  cat > "$STATUS_FILE" <<EOF
REPO=$REPO
EXIT_CODE=$EXIT_CODE
DURATION=${DURATION}min
LOG=$LOG_FILE
EOF

  echo "[$(date +%H:%M:%S)] $REPO 结束 (exit=$EXIT_CODE, ${DURATION}min)" >> "$LOG_DIR/parallel.log"
}

# ═══════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器（并发版）"
echo "  队列文件:  $QUEUE_FILE"
echo "  远程机器:  ${REMOTE_USER}@${REMOTE_IP}"
echo "  最大并发:  $MAX_CONCURRENCY"
echo "  日期:      $TODAY"
echo "═══════════════════════════════════════════"

TOTAL=0
ROUND=0

while true; do
  ROUND=$((ROUND + 1))

  # 同步队列
  echo ""
  echo "──── 第 $ROUND 轮：同步队列 ────"
  git pull origin main --rebase 2>&1 || {
    echo "  ⚠️ pull 冲突"
    git checkout --theirs "$QUEUE_FILE" 2>/dev/null || true
    git add "$QUEUE_FILE" 2>/dev/null
    git commit -m "resolve queue conflict" 2>/dev/null || true
  }

  # 重置崩溃残留
  STALE=$(reset_stale_running)
  if [ -n "$STALE" ]; then
    echo "  🔄 $STALE"
    git add "$QUEUE_FILE" 2>/dev/null
    git commit -m "queue: reset stale" 2>/dev/null || true
    git push origin main 2>/dev/null || true
  fi

  # 检查是否还有待处理任务
  if [ "$(has_pending)" = "0" ]; then
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
      echo "  🎉 全部完成！共 $TOTAL 个仓库"
      echo "═══════════════════════════════════════════"
    fi
    break
  fi

  # ── 顺序领取任务（最多 MAX_CONCURRENCY 个）──
  echo ""
  echo "──── 领取任务（最多 $MAX_CONCURRENCY 个）────"
  TASKS=()
  for i in $(seq 1 $MAX_CONCURRENCY); do
    CLAIMED=$(claim_and_push)
    if [ $? -ne 0 ] || [ -z "$CLAIMED" ] || [ "$CLAIMED" = "NONE" ]; then
      break
    fi
    TASKS+=("$CLAIMED")
    CLAIMED_NAME=$(echo "$CLAIMED" | cut -d'|' -f1)
    echo "  ✅ 领取: $CLAIMED_NAME"
  done

  if [ ${#TASKS[@]} -eq 0 ]; then
    echo "  无任务可领取，等待下一轮..."
    sleep 10
    continue
  fi

  # ── 并发启动所有任务 ──
  echo ""
  echo "──── 并发启动 ${#TASKS[@]} 个任务 ────"
  PIDS=()
  for TASK in "${TASKS[@]}"; do
    R=$(echo "$TASK" | cut -d'|' -f1)
    U=$(echo "$TASK" | cut -d'|' -f2)
    B=$(echo "$TASK" | cut -d'|' -f3)
    RIP_T=$(echo "$TASK" | cut -d'|' -f4)
    RUSR_T=$(echo "$TASK" | cut -d'|' -f5)
    RIP_FINAL="${RIP_T:-$REMOTE_IP}"
    RUSR_FINAL="${RUSR_T:-$REMOTE_USER}"

    echo "  🚀 $R ($U @ $B)"

    # 后台执行
    run_single "$R" "$U" "$B" "$RIP_FINAL" "$RUSR_FINAL" &
    PIDS+=($!)
  done

  echo "  等待 ${#PIDS[@]} 个任务完成..."

  # ── 等待所有任务完成 ──
  for PID in "${PIDS[@]}"; do
    wait $PID 2>/dev/null || true
  done

  echo ""
  echo "──── 本轮完成，验证产出并更新队列 ────"

  # ── 逐个验证产出、更新状态 ──
  git pull origin main --rebase 2>&1 || true

  for TASK in "${TASKS[@]}"; do
    R=$(echo "$TASK" | cut -d'|' -f1)
    STATUS_FILE="$STATUS_DIR/${R}.status"

    if [ -f "$STATUS_FILE" ]; then
      EXIT_CODE=$(grep 'EXIT_CODE=' "$STATUS_FILE" 2>/dev/null | cut -d'=' -f2)
    else
      EXIT_CODE=-1
    fi

    echo ""
    echo "  ── $R ──"

    if [ "$EXIT_CODE" = "124" ] || [ "$EXIT_CODE" = "124" ]; then
      echo "  ❌ 超时（${TIMEOUT_HOURS}h）"
      update_status "$R" "failed" "超时 ${TIMEOUT_HOURS}h"
    elif [ "$EXIT_CODE" != "0" ]; then
      echo "  ❌ session 异常 (exit=$EXIT_CODE)"
      update_status "$R" "failed" "session 异常退出 (exit=$EXIT_CODE)"
    elif verify_output "$R"; then
      echo "  ✅ 验证通过"
      update_status "$R" "done" "验证通过 $(date +%Y-%m-%d)"
    else
      echo "  ❌ 产出验证失败"
      update_status "$R" "failed" "session 正常退出但未产出有效 JSON"
    fi

    TOTAL=$((TOTAL + 1))
  done

  # 推送队列更新
  git add "$QUEUE_FILE" json-org-openeuler/ json/ docs/ 2>/dev/null || true
  git commit -m "verify: round $ROUND complete ($TOTAL total)" 2>/dev/null || true
  git push origin main 2>/dev/null || true

  echo ""
  echo "  本轮结束，共完成 $TOTAL 个"
  sleep 10
done

# 清理状态目录
rm -rf "$STATUS_DIR"
