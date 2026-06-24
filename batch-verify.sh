#!/bin/bash
# TTFHW 批量验证调度器（并发版）
# ── 职责：队列管理 + 并发调度 claude session ──
# ── 验证执行由 ttfhw-verify-runner skill 负责 ──
# 中断后可随时重新运行，队列文件是唯一状态

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════
# 默认配置
# ═══════════════════════════════════════════

QUEUE_FILE="verification-queue.yaml"
TIMEOUT_HOURS=4
TODAY=$(date +%Y%m%d)
LOG_DIR=".claude/batch-logs"
STATUS_DIR=".claude/batch-status"

MODE="local"              # local | remote
REMOTE_IP=""              # --mode remote 时必须指定
REMOTE_USER="root"
MAX_CONCURRENCY=5
BUILD_RATIO=20

# ═══════════════════════════════════════════
# CLI 参数解析
# ═══════════════════════════════════════════

usage() {
  cat <<EOF
用法: ./batch-verify.sh [选项]

TTFHW 批量验证调度器 — 从队列文件领取仓库，并发启动独立 session 验证。

选项:
  -m, --mode MODE          验证环境: local（默认）| remote
  -j, --concurrency N     最大并发数（默认: 5）
  -b, --build-ratio N     容器内编译线程比例，CPU核数 × N%（默认: 20）
  --remote-ip IP          远程机器 IP（--mode remote 时必填）
  --remote-user USER      远程 SSH 用户（默认: root，需免密）
  -h, --help              显示此帮助信息

示例:
  ./batch-verify.sh                                            # 本地，5 并发
  ./batch-verify.sh -j 10 -b 30                               # 本地，10 并发
  ./batch-verify.sh --mode remote --remote-ip 192.168.9.114   # 远程，5 并发

队列文件: $QUEUE_FILE（YAML 格式，每仓库可单独指定 remote 覆盖全局配置）
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mode)
      MODE="$2"; shift 2 ;;
    --mode=*)
      MODE="${1#*=}"; shift ;;
    -j|--concurrency)
      MAX_CONCURRENCY="$2"; shift 2 ;;
    --concurrency=*)
      MAX_CONCURRENCY="${1#*=}"; shift ;;
    -b|--build-ratio)
      BUILD_RATIO="$2"; shift 2 ;;
    --build-ratio=*)
      BUILD_RATIO="${1#*=}"; shift ;;
    --remote-ip)
      REMOTE_IP="$2"; shift 2 ;;
    --remote-ip=*)
      REMOTE_IP="${1#*=}"; shift ;;
    --remote-user)
      REMOTE_USER="$2"; shift 2 ;;
    --remote-user=*)
      REMOTE_USER="${1#*=}"; shift ;;
    -h|--help)
      usage ;;
    *)
      echo "未知选项: $1（-h 查看帮助）"; exit 1 ;;
  esac
done

# 参数校验
if [[ "$MODE" != "local" && "$MODE" != "remote" ]]; then
  echo "错误: --mode 必须为 local 或 remote（当前: $MODE）"
  exit 1
fi
if [[ "$MODE" == "remote" && -z "$REMOTE_IP" ]]; then
  echo "错误: --mode remote 时必须指定 --remote-ip"
  exit 1
fi
if ! [[ "$MAX_CONCURRENCY" =~ ^[0-9]+$ ]] || [ "$MAX_CONCURRENCY" -lt 1 ]; then
  echo "错误: 并发数必须为正整数（当前: $MAX_CONCURRENCY）"
  exit 1
fi
if ! [[ "$BUILD_RATIO" =~ ^[0-9]+$ ]] || [ "$BUILD_RATIO" -lt 1 ] || [ "$BUILD_RATIO" -gt 100 ]; then
  echo "错误: 编译线程比例必须在 1-100 之间（当前: $BUILD_RATIO）"
  exit 1
fi

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

update_status() {
  local REPO="$1" NEW_STATUS="$2" NOTE="$3"
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
  local RAW_FILE NORM_FILE
  RAW_FILE=$(ls -t json-org-openeuler/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)
  NORM_FILE=$(ls -t json/verification_report_*_${REPO}_*.json 2>/dev/null | head -1)

  [ -z "$RAW_FILE" ]  && { echo "  ❌ 原始报告未生成"; return 1; }
  [ -z "$NORM_FILE" ] && { echo "  ❌ 归一化报告未生成"; return 1; }
  python3 -c "import json; json.load(open('$RAW_FILE'))"  2>/dev/null || { echo "  ❌ 原始 JSON 损坏: $RAW_FILE"; return 1; }
  python3 -c "import json; json.load(open('$NORM_FILE'))" 2>/dev/null || { echo "  ❌ 归一化 JSON 损坏: $NORM_FILE"; return 1; }

  echo "  ✅ 原始: $RAW_FILE"
  echo "  ✅ 归一化: $NORM_FILE"
  return 0
}

# ═══════════════════════════════════════════
# 构建 prompt（build_ratio 传入 skill）
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

编译并发: CPU核数 × ${BUILD_RATIO}%（至少为1），容器名 ${REPO}-ttfhw

══════════════════════════════════════
⚠️ 运行模式：无人值守自动化流水线
══════════════════════════════════════

1. 全程禁止询问、确认、停顿。遇到选择直接用最合理的默认方案。
2. 无论仓库验证成功或失败，都必须生成完整的 JSON 报告。
   构建失败、UT 不通过、Docker 不可用——这些都是有效结果，如实记录即可。
3. 不要因为某个步骤失败就提前退出。完成所有能做的步骤，把失败原因写入
   problems_encountered，然后继续后面的步骤。
4. 如果 Docker 不可用，尝试在宿主机直接编译（安装对应依赖后执行构建命令）；
   如果宿主机环境也不满足，记录原因到报告中，状态标记为 not_run。
5. 在容器/宿主机内每一步安装依赖、编译、测试都必须记录 execution_log
   （timestamp + command + success + output + duration_seconds）。

══════════════════════════════════════
⚠️ 完成标准（必须全部满足才能退出）
══════════════════════════════════════

必须产出两个文件：
  json-org-openeuler/verification_report_WSL_${REPO}_*.json
  json/verification_report_WSL_${REPO}_*.json

退出前执行 ls 确认两个文件确实存在。文件不存在 = 你没完成。

══════════════════════════════════════
⚠️ 独立刷新队列状态
══════════════════════════════════════

验证和归一化都完成后，你必须自行更新 verification-queue.yaml 中 ${REPO} 的状态：

  python3 -c "
  import yaml
  with open('verification-queue.yaml') as f:
      data = yaml.safe_load(f)
  for r in data['queue']:
      if r['repo'] == '${REPO}':
          r['status'] = '<done 或 failed>'
          r['note'] = '<状态说明>'
          break
  with open('verification-queue.yaml', 'w') as f:
      yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
  "

退出前输出以下结构化结果（必须包含实际状态值）:
[TTFHVV_RESULT]
repo=${REPO}
build=<success|failed|not_run>
ut=<success|failed|partial_success|not_run>
sample=<success|failed|partial_success|not_run>
PROMPT
}

# ═══════════════════════════════════════════
# Worker：独立循环领取 + 验证，不等待其他 worker
# ═══════════════════════════════════════════

LOCK_FILE="$QUEUE_FILE.lock"

# 带锁领取任务（多 worker 安全）
claim_locked() {
  flock -x "$LOCK_FILE" -c "
    python3 -c \"
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
for r in data['queue']:
    if r['status'] == 'pending':
        r['status'] = 'running'
        with open('$QUEUE_FILE', 'w') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        remote = r.get('remote', {})
        rip = remote.get('ip', '') if remote else ''
        ruser = remote.get('user', '') if remote else ''
        print(f\\\"{r['repo']}|{r['url']}|{r['branch']}|{rip}|{ruser}\\\")
        exit(0)
print('NONE')
    \"
  " 2>/dev/null
}

worker_loop() {
  local WORKER_ID="$1"
  local TASK_COUNT=0

  while true; do
    # 带锁领取
    local CLAIMED
    CLAIMED=$(claim_locked)
    if [ -z "$CLAIMED" ] || [ "$CLAIMED" = "NONE" ]; then
      echo "[worker-$WORKER_ID] 无待验证任务，退出（完成 $TASK_COUNT 个）"
      break
    fi

    local REPO URL BRANCH RIP_T RUSR_T RIP_FINAL RUSR_FINAL
    REPO=$(echo "$CLAIMED" | cut -d'|' -f1)
    URL=$(echo "$CLAIMED" | cut -d'|' -f2)
    BRANCH=$(echo "$CLAIMED" | cut -d'|' -f3)
    RIP_T=$(echo "$CLAIMED" | cut -d'|' -f4)
    RUSR_T=$(echo "$CLAIMED" | cut -d'|' -f5)
    RIP_FINAL="${RIP_T:-$REMOTE_IP}"
    RUSR_FINAL="${RUSR_T:-$REMOTE_USER}"

    TASK_COUNT=$((TASK_COUNT + 1))
    local LOG_FILE="$LOG_DIR/${REPO}_$(date +%Y%m%d_%H%M%S).log"

    echo "[$(date +%H:%M:%S)] worker-$WORKER_ID: $REPO (#$TASK_COUNT) 开始..."

    local PROMPT
    PROMPT=$(build_prompt "$REPO" "$URL" "$BRANCH" "$RIP_FINAL" "$RUSR_FINAL")
    local START_TS
    START_TS=$(date +%s)

    timeout ${TIMEOUT_HOURS}h claude -p \
      --dangerously-skip-permissions \
      "$PROMPT" \
      > "$LOG_FILE" 2>&1

    local EXIT_CODE=$?
    local END_TS DURATION
    END_TS=$(date +%s)
    DURATION=$(( (END_TS - START_TS) / 60 ))

    {
      echo ""
      echo "──────────────────────────────────────────"
      echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
      echo "  耗时:     ${DURATION} 分钟"
      echo "  退出码:   $EXIT_CODE"
    } >> "$LOG_FILE"

    # 独立更新队列状态（带锁）
    local NOTE
    if [ "$EXIT_CODE" = "124" ]; then
      NOTE="超时 ${TIMEOUT_HOURS}h"
    elif [ "$EXIT_CODE" != "0" ]; then
      NOTE="session 异常退出 (exit=$EXIT_CODE)"
    elif verify_output "$REPO"; then
      NOTE="验证通过 $(date +%Y-%m-%d)"
    else
      NOTE="session 正常退出但未产出有效 JSON"
    fi

    local NEW_STATUS
    if [ "$EXIT_CODE" = "0" ] && verify_output "$REPO" 2>/dev/null; then
      NEW_STATUS="done"
    else
      NEW_STATUS="failed"
    fi

    flock -x "$LOCK_FILE" -c "python3 -c \"
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
\"" 2>/dev/null

    echo "[$(date +%H:%M:%S)] worker-$WORKER_ID: $REPO → $NEW_STATUS (${DURATION}min)"
  done
}

# ═══════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════

# Ctrl+C 时杀掉所有后台 claude 进程
cleanup() {
  echo ""
  echo "正在停止所有后台验证任务..."
  jobs -p 2>/dev/null | while read pid; do
    kill -TERM "$pid" 2>/dev/null || true
    pkill -P "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "已停止。running 任务下次启动会自动重置为 pending。"
  rm -rf "$STATUS_DIR"
  exit 130
}
trap cleanup SIGINT SIGTERM

echo "═══════════════════════════════════════════"
echo "  TTFHW 批量验证调度器（Worker Pool）"
echo "  队列文件:  $QUEUE_FILE"
echo "  验证环境:  $MODE$([[ "$MODE" == "remote" ]] && echo " (${REMOTE_USER}@${REMOTE_IP})")"
echo "  并发 worker: $MAX_CONCURRENCY"
echo "  编译比例:   ${BUILD_RATIO}%"
echo "═══════════════════════════════════════════"

# 重置崩溃残留
STALE=$(reset_stale_running)
if [ -n "$STALE" ]; then
  echo "🔄 $STALE"
fi

PENDING=$(has_pending)
if [ "$PENDING" = "0" ]; then
  FAILED=$(python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
print(len([r for r in data['queue'] if r['status'] == 'failed']))
" 2>/dev/null || echo 0)
  if [ "$FAILED" -gt 0 ]; then
    echo "⚠️  无待验证任务，$FAILED 个失败需人工介入"
    list_failed
  else
    echo "🎉 全部已完成"
  fi
  exit 0
fi

echo ""
echo "启动 $MAX_CONCURRENCY 个 worker，各 worker 独立循环领取任务..."
echo ""

# 启动 worker pool
for i in $(seq 1 "$MAX_CONCURRENCY"); do
  worker_loop "$i" &
done

# 等待所有 worker 完成
wait

# 汇总
echo ""
echo "═══════════════════════════════════════════"
FAILED=$(python3 -c "
import yaml
with open('$QUEUE_FILE') as f:
    data = yaml.safe_load(f)
done_count = len([r for r in data['queue'] if r['status'] == 'done'])
failed_count = len([r for r in data['queue'] if r['status'] == 'failed'])
pending_count = len([r for r in data['queue'] if r['status'] in ('pending', 'running')])
print(f'{done_count}|{failed_count}|{pending_count}')
" 2>/dev/null)
DONE_C=$(echo "$FAILED" | cut -d'|' -f1)
FAIL_C=$(echo "$FAILED" | cut -d'|' -f2)
PEND_C=$(echo "$FAILED" | cut -d'|' -f3)
echo "  完成: $DONE_C  |  失败: $FAIL_C  |  剩余: $PEND_C"
echo "═══════════════════════════════════════════"
if [ "$FAIL_C" -gt 0 ]; then
  list_failed
fi

rm -rf "$STATUS_DIR"
