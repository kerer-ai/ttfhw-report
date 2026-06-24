#!/usr/bin/env python3
"""TTFHW 批量验证调度器（Python Worker Pool）

每个 worker 独立循环：加锁领取任务 → 调用 claude -p 验证 → 加锁更新状态 → 重复。
所有产物本地生成，不操作 git。

用法:
  ./batch-verify.py                                      # 本地，5 并发
  ./batch-verify.py -j 10 -b 30                          # 10 并发，30% 编译
  ./batch-verify.py --mode remote --remote-ip 192.168.9.114  # 远程
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import yaml

# ── 配置 ──────────────────────────────────────────────

QUEUE_FILE = "verification-queue.yaml"
TIMEOUT_HOURS = 4
LOG_DIR = Path(".claude/batch-logs")

# 默认值（CLI 可覆盖）
DEFAULT_MODE = "local"
DEFAULT_CONCURRENCY = 5
DEFAULT_BUILD_RATIO = 20
DEFAULT_REMOTE_IP = ""
DEFAULT_REMOTE_USER = "root"

# 全局锁 — 保护 YAML 文件读写
yaml_lock = threading.Lock()

# worker 计数器（用于统计）
worker_done = 0
worker_failed = 0
stats_lock = threading.Lock()

# 优雅退出标志
shutdown_flag = threading.Event()


# ── YAML 队列操作 ─────────────────────────────────────

def read_queue() -> list:
    with open(QUEUE_FILE) as f:
        return yaml.safe_load(f)["queue"]


def write_queue(tasks: list):
    with open(QUEUE_FILE, "w") as f:
        yaml.dump({"queue": tasks}, f, allow_unicode=True,
                  default_flow_style=False, sort_keys=False)


def claim_task() -> dict | None:
    """加锁领取一个 pending 任务，标记 running。无任务返回 None。"""
    with yaml_lock:
        tasks = read_queue()
        for r in tasks:
            if r["status"] == "pending":
                r["status"] = "running"
                r["note"] = ""
                write_queue(tasks)
                return {
                    "repo": r["repo"],
                    "url": r["url"],
                    "branch": r["branch"],
                    "remote_ip": (r.get("remote", {}) or {}).get("ip", ""),
                    "remote_user": (r.get("remote", {}) or {}).get("user", ""),
                }
    return None


def update_task(repo: str, status: str, note: str):
    """加锁更新任务状态。"""
    with yaml_lock:
        tasks = read_queue()
        for r in tasks:
            if r["repo"] == repo:
                r["status"] = status
                r["note"] = note
                break
        write_queue(tasks)


def reset_stale_running():
    """将 running 但无产出的任务重置为 pending。"""
    with yaml_lock:
        tasks = read_queue()
        reset = []
        for r in tasks:
            if r["status"] == "running":
                r["status"] = "pending"
                r["note"] = "previous session crashed, retry"
                reset.append(r["repo"])
        write_queue(tasks)
        if reset:
            print(f"🔄 Reset stale: {', '.join(reset)}")


def queue_summary() -> tuple[int, int, int]:
    """返回 (done_count, failed_count, pending_or_running_count)。"""
    tasks = read_queue()
    done = sum(1 for r in tasks if r["status"] == "done")
    failed = sum(1 for r in tasks if r["status"] == "failed")
    pending = sum(1 for r in tasks if r["status"] in ("pending", "running"))
    return done, failed, pending


def list_failed():
    tasks = read_queue()
    for r in tasks:
        if r["status"] == "failed":
            print(f"  ❌ {r['repo']:20s} {r.get('note', '')}")


# ── 产出验证 ──────────────────────────────────────────

def verify_output(repo: str) -> bool:
    """检查原始 + 归一化 JSON 报告是否存在且合法。"""
    raw_dir = Path("json-org-openeuler")
    norm_dir = Path("json")

    raw_files = sorted(raw_dir.glob(f"verification_report_*_{repo}_*.json"))
    norm_files = sorted(norm_dir.glob(f"verification_report_*_{repo}_*.json"))

    if not raw_files:
        print(f"    ❌ 原始报告未生成")
        return False
    if not norm_files:
        print(f"    ❌ 归一化报告未生成")
        return False

    for f in [raw_files[-1], norm_files[-1]]:
        try:
            json.loads(f.read_text())
        except json.JSONDecodeError:
            print(f"    ❌ JSON 损坏: {f}")
            return False

    print(f"    ✅ 原始: {raw_files[-1]}")
    print(f"    ✅ 归一化: {norm_files[-1]}")
    return True


# ── Prompt 构建 ────────────────────────────────────────

def build_prompt(task: dict, remote_ip: str, remote_user: str,
                 build_ratio: int) -> str:
    repo = task["repo"]
    url = task["url"]
    branch = task["branch"]
    rip = task["remote_ip"] or remote_ip
    ruser = task["remote_user"] or remote_user

    if rip:
        env_desc = f"远程机器 {rip}"
        env_extra = f"\n 远程机器 IP: {rip}\n 远程用户:   {ruser}\n 认证方式:   免密 SSH"
    else:
        env_desc = "WSL 本地 Docker"
        env_extra = ""

    return f"""执行 /ttfhw-verify-runner 技能。

仓库信息:
  仓库名:  {repo}
  URL:    {url}
  分支:    {branch}

验证环境: {env_desc}{env_extra}

编译并发: CPU核数 × {build_ratio}%（至少为1），容器名 {repo}-ttfhw

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
  json-org-openeuler/verification_report_WSL_{repo}_*.json
  json/verification_report_WSL_{repo}_*.json

退出前执行 ls 确认两个文件确实存在。文件不存在 = 你没完成。

══════════════════════════════════════
⚠️ 独立刷新队列状态
══════════════════════════════════════

验证和归一化都完成后，你必须自行更新 verification-queue.yaml 中 {repo} 的状态：

  python3 -c "
  import yaml
  with open('verification-queue.yaml') as f:
      data = yaml.safe_load(f)
  for r in data['queue']:
      if r['repo'] == '{repo}':
          r['status'] = '<done 或 failed>'
          r['note'] = '<状态说明>'
          break
  with open('verification-queue.yaml', 'w') as f:
      yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
  "

退出前输出以下结构化结果（必须包含实际状态值）:
[TTFHVV_RESULT]
repo={repo}
build=<success|failed|not_run>
ut=<success|failed|partial_success|not_run>
sample=<success|failed|partial_success|not_run>
"""


# ── 单任务执行 ─────────────────────────────────────────

def run_task(task: dict, remote_ip: str, remote_user: str,
             build_ratio: int) -> tuple[int, str]:
    """执行单个仓库验证，返回 (exit_code, note)。"""
    repo = task["repo"]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOG_DIR / f"{repo}_{ts}.log"

    prompt = build_prompt(task, remote_ip, remote_user, build_ratio)
    start = time.time()

    try:
        result = subprocess.run(
            ["claude", "-p", "--dangerously-skip-permissions", prompt],
            capture_output=True, text=True,
            timeout=TIMEOUT_HOURS * 3600,
        )
        exit_code = result.returncode
        log_path.write_text(result.stdout + "\n" + result.stderr, errors="replace")
    except subprocess.TimeoutExpired:
        exit_code = 124
        log_path.write_text(f"TIMEOUT after {TIMEOUT_HOURS}h")
    except FileNotFoundError:
        return (-1, "claude CLI 未找到")
    except Exception as e:
        return (-1, f"执行异常: {e}")

    duration = int((time.time() - start) / 60)

    # 追加摘要到日志
    with open(log_path, "a") as f:
        f.write(f"\n──────────────────────────────────────────\n")
        f.write(f"  完成时间: {datetime.now().isoformat()}\n")
        f.write(f"  耗时:     {duration} 分钟\n")
        f.write(f"  退出码:   {exit_code}\n")

    # 判定结果
    if exit_code == 124:
        note = f"超时 {TIMEOUT_HOURS}h"
    elif exit_code != 0:
        note = f"session 异常退出 (exit={exit_code})"
    elif verify_output(repo):
        note = f"验证通过 {datetime.now().strftime('%Y-%m-%d')}"
    else:
        note = "session 正常退出但未产出有效 JSON"

    return exit_code, note


# ── Worker 循环 ────────────────────────────────────────

def worker_loop(worker_id: int, remote_ip: str, remote_user: str,
                build_ratio: int):
    """Worker 主循环：领取 → 执行 → 更新状态 → 重复。"""
    global worker_done, worker_failed
    count = 0

    while not shutdown_flag.is_set():
        task = claim_task()
        if task is None:
            print(f"[worker-{worker_id}] 无待验证任务，退出（完成 {count} 个）")
            break

        repo = task["repo"]
        count += 1
        print(f"[{datetime.now().strftime('%H:%M:%S')}] worker-{worker_id}: {repo} (#{count}) 开始...")

        exit_code, note = run_task(task, remote_ip, remote_user, build_ratio)

        # 判定最终状态
        new_status = "done" if (exit_code == 0 and "验证通过" in note) else "failed"
        update_task(repo, new_status, note)

        with stats_lock:
            if new_status == "done":
                worker_done += 1
            else:
                worker_failed += 1

        print(f"[{datetime.now().strftime('%H:%M:%S')}] worker-{worker_id}: {repo} → {new_status}")


# ── 主流程 ─────────────────────────────────────────────

def main():
    global worker_done, worker_failed

    parser = argparse.ArgumentParser(
        description="TTFHW 批量验证调度器（Worker Pool）")
    parser.add_argument("-m", "--mode", choices=["local", "remote"],
                        default=DEFAULT_MODE, help="验证环境（默认: local）")
    parser.add_argument("-j", "--concurrency", type=int,
                        default=DEFAULT_CONCURRENCY, help="最大并发 worker 数（默认: 5）")
    parser.add_argument("-b", "--build-ratio", type=int,
                        default=DEFAULT_BUILD_RATIO,
                        help="编译线程比例 %%（默认: 20，范围 1-100）")
    parser.add_argument("--remote-ip", default=DEFAULT_REMOTE_IP,
                        help="远程机器 IP（--mode remote 时必填）")
    parser.add_argument("--remote-user", default=DEFAULT_REMOTE_USER,
                        help="远程 SSH 用户（默认: root）")
    args = parser.parse_args()

    # 参数校验
    if args.mode == "remote" and not args.remote_ip:
        print("错误: --mode remote 时必须指定 --remote-ip")
        sys.exit(1)
    if not (1 <= args.build_ratio <= 100):
        print(f"错误: 编译比例必须在 1-100 之间（当前: {args.build_ratio}）")
        sys.exit(1)
    if args.concurrency < 1:
        print(f"错误: 并发数必须 >= 1（当前: {args.concurrency}）")
        sys.exit(1)

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # 信号处理
    def shutdown(sig, frame):
        print("\n正在停止所有 worker...")
        shutdown_flag.set()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Banner
    env_str = f"{args.mode}"
    if args.mode == "remote":
        env_str += f" ({args.remote_user}@{args.remote_ip})"
    print("═══════════════════════════════════════════")
    print("  TTFHW 批量验证调度器（Python Worker Pool）")
    print(f"  队列文件:   {QUEUE_FILE}")
    print(f"  验证环境:   {env_str}")
    print(f"  并发 worker: {args.concurrency}")
    print(f"  编译比例:    {args.build_ratio}%")
    print(f"  日志目录:    {LOG_DIR}")
    print("═══════════════════════════════════════════")

    # 重置崩溃残留
    reset_stale_running()

    done, failed, pending = queue_summary()
    if pending == 0:
        if failed > 0:
            print(f"\n⚠️  无待验证任务，{failed} 个失败需人工介入")
            list_failed()
        else:
            print(f"\n🎉 全部已完成（{done} 个）")
        return

    print(f"\n启动 {args.concurrency} 个 worker，各 worker 独立循环领取任务...\n")

    # 启动 worker pool
    threads = []
    for i in range(1, args.concurrency + 1):
        t = threading.Thread(
            target=worker_loop,
            args=(i, args.remote_ip, args.remote_user, args.build_ratio),
            daemon=True,
        )
        t.start()
        threads.append(t)

    # 等待所有 worker 完成
    for t in threads:
        t.join()

    # 汇总
    print("\n═══════════════════════════════════════════")
    done, failed, pending = queue_summary()
    print(f"  完成: {done}  |  失败: {failed}  |  剩余: {pending}")
    print("═══════════════════════════════════════════")
    if failed > 0:
        list_failed()


if __name__ == "__main__":
    main()
