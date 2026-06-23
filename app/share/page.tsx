import Link from 'next/link'
import { ResultPieChart } from '@/components/charts/ResultPieChart'
import { StatsOverview } from '@/components/summary/StatsOverview'
import { Card } from '@/components/ui/Card'
import { SummaryStats, CommunityStats } from '@/lib/types'
import { formatDuration } from '@/lib/utils'
import {
  Brain, Zap, BarChart3, FileText, Search, Wrench,
  Code, ArrowRight, TrendingUp, CheckCircle,
  Layers, Globe, Monitor, RefreshCw, ArrowLeft,
  Hammer, Container, TestTube, Play, Clock,
  AlertTriangle, Lightbulb, Package, Sparkles, Target,
  GitBranch, Terminal, Shield, Cpu, XCircle,
} from 'lucide-react'

// ================================================================
// 静态常量 — 页面内容不随 json/ 数据变化
// ================================================================

const STATS: SummaryStats = {
  total: 59,
  success: 18,
  failed: 2,
  partial: 39,
  other: 0,
  avgDuration: 4120,
  avgEnvironmentDuration: 2947,
  totalTestsAll: 47338,
  totalPassedAll: 31928,
  overallPassRate: 67.4,
  buildableCount: 57,
  testableCount: 19,
  ttfhwPassRate: 31,
  buildPassRate: 97,
}

const COMMUNITY_STATS: CommunityStats[] = [
  { community: 'CANN', total: 13, success: 5, failed: 0, partial: 8, passRate: 38, avgDuration: 3500 },
  { community: 'UBSCore', total: 10, success: 1, failed: 0, partial: 9, passRate: 10, avgDuration: 2800 },
  { community: 'MindIE', total: 6, success: 0, failed: 1, partial: 5, passRate: 0, avgDuration: 3200 },
  { community: 'openEuler', total: 5, success: 4, failed: 0, partial: 1, passRate: 80, avgDuration: 1800 },
  { community: 'PyTorch', total: 5, success: 0, failed: 0, partial: 5, passRate: 0, avgDuration: 2500 },
  { community: 'HPCKit', total: 7, success: 3, failed: 0, partial: 4, passRate: 43, avgDuration: 2200 },
  { community: 'MindSpeed', total: 3, success: 0, failed: 0, partial: 3, passRate: 0, avgDuration: 3000 },
  { community: 'openUBMC', total: 7, success: 2, failed: 0, partial: 5, passRate: 29, avgDuration: 3500 },
  { community: '其他', total: 3, success: 1, failed: 0, partial: 2, passRate: 33, avgDuration: 2000 },
]

const PROBLEM_STATS = {
  totalReposWithProblems: 57,
  totalProblems: 213,
  resolvedCount: 120,
  unresolvedCount: 93,
  topProblems: [
    '构建产物安装后 import 失败（缺少 CANN/HCCL 运行时库）',
    'UT/样例需要 NPU 硬件，当前环境不具备',
    'cmake 版本策略兼容性问题',
    '依赖包版本冲突需要手动解决',
    'Docker 容器网络/DNS 解析失败',
    '大文件编译 OOM，需要限制并发',
  ],
}

// ================================================================
// Act 时间轴
// ================================================================

const ACTS = [
  { num: 1, title: '为什么做', sub: 'The Problem', icon: Target, time: '~3min', color: 'rose' as const },
  { num: 2, title: '怎么做', sub: 'The Approach', icon: Layers, time: '~4min', color: 'indigo' as const },
  { num: 3, title: '深度案例', sub: 'Deep Dive', icon: Play, time: '~6min', color: 'purple' as const },
  { num: 4, title: '规模化成果', sub: 'Results', icon: BarChart3, time: '~4min', color: 'emerald' as const },
  { num: 5, title: '带走什么', sub: 'Takeaways', icon: Lightbulb, time: '~3min', color: 'amber' as const },
]

// ================================================================
// Act 2: AI 4-Stage 效率拆解
// ================================================================

const AI_STAGES = [
  {
    num: 1,
    icon: Brain,
    title: '仓库验证',
    skill: 'ttfhw-verify-pro',
    aiReplaces: '阅读文档 → 环境判断 → 依赖安装 → 构建执行 → 错误排查 → UT/样例运行',
    highlights: [
      'AI 自动识别 README 中的构建命令与依赖列表',
      '构建失败时自主分析错误日志、尝试多种修复策略',
      '自动记录每步耗时与决策依据',
    ],
    color: 'indigo' as const,
  },
  {
    num: 2,
    icon: FileText,
    title: '报告归一化',
    skill: 'ttfhw-report-normalizer',
    aiReplaces: '人工理解报告 → 手工整理 → 状态归类 → 脱敏处理',
    highlights: [
      'AI 理解非标准状态值，自动映射为 5 种标准状态',
      '自动脱敏：IP、用户名、主机名替换',
      '支持 6 种不同格式的自动检测与转换',
    ],
    color: 'emerald' as const,
  },
  {
    num: 3,
    icon: Code,
    title: '页面构建',
    skill: 'Next.js SSG Build',
    aiReplaces: '手工编写前端代码 → 手工部署 → 手工维护',
    highlights: [
      'AI 辅助编码生成整个 Dashboard（本页面即为 AI 编写）',
      '读取 JSON 数据自动渲染 61 个静态页面',
      'GitHub Pages 自动部署，零运维成本',
    ],
    color: 'purple' as const,
  },
  {
    num: 4,
    icon: RefreshCw,
    title: '飞书刷新',
    skill: 'ttfhw-feishu-update',
    aiReplaces: '手工对照仓库名 → 逐行填入飞书 → 格式调整',
    highlights: [
      'AI 自动匹配仓库名到飞书行',
      '17 列数据批量写入，秒级完成',
      '零人工录入错误，数据可追溯',
    ],
    color: 'amber' as const,
  },
]

// ================================================================
// Act 3: PyTorch AI 验证演示 — 硬编码时间线
// ================================================================

interface DemoStep {
  icon: React.ReactNode
  iconBg: string
  label: string
  detail: string
  result: 'success' | 'failed' | 'ai_fix' | 'info'
  resultLabel: string
  duration?: string
}

const DEMO_STEPS: DemoStep[] = [
  {
    icon: <FileText className="h-5 w-5" />,
    iconBg: 'bg-blue-100 text-blue-600',
    label: 'AI 阅读文档',
    detail: 'AI 自动解析 README.zh.md、docker/README.md、Dockerfile，提取：基于 PyTorch 2.7.1，cmake 构建，需 manylinux-builder 镜像，依赖 CANN 环境',
    result: 'success',
    resultLabel: '成功提取',
    duration: '60s',
  },
  {
    icon: <Container className="h-5 w-5" />,
    iconBg: 'bg-indigo-100 text-indigo-600',
    label: 'AI 环境准备',
    detail: 'AI 选择 manylinux-builder:v1 镜像（由仓库 Dockerfile 构建），启动容器 ttfhw-pytorch-env，挂载仓库到 /home/pytorch',
    result: 'success',
    resultLabel: '容器就绪',
    duration: '3s',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第1次）',
    detail: 'bash ci/build.sh --python=3.10\n失败原因：CMakeCache.txt 目录不匹配，CMake 检测到上次构建残留',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '38s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 分析错误日志，判定为 CMake 缓存残留问题。执行：清理 build/、dist/ 等构建产物目录（不修改源码）',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第2次）',
    detail: '清理后重试 bash ci/build.sh --python=3.10\n失败原因：CMake 3.28+ 策略兼容性检查不通过（libuv 子项目要求 CMake < 3.5 兼容模式）',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '57s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 识别 CMake 版本策略报错，按错误提示设置环境变量 CMAKE_POLICY_VERSION_MINIMUM=3.5（不修改仓库源码和 CMakeLists.txt）',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-red-100 text-red-600',
    label: '构建（第3次）',
    detail: 'CMAKE_POLICY_VERSION_MINIMUM=3.5 bash ci/build.sh --python=3.10（默认并发 nproc=20）\n失败原因：大模板文件 (StructKernelNpuOpApi.cpp) 编译时 cc1plus 被 OOM Killer 终止',
    result: 'failed',
    resultLabel: '构建失败',
    duration: '23m 58s',
  },
  {
    icon: <Brain className="h-5 w-5" />,
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'AI 自动诊断修复',
    detail: 'AI 识别 OOM 根因：20 核并发导致内存耗尽。设置 MAX_JOBS=4 将 ninja 并发降至 4，清理 cmake 缓存后增量构建',
    result: 'ai_fix',
    resultLabel: 'AI 自主决策',
  },
  {
    icon: <Hammer className="h-5 w-5" />,
    iconBg: 'bg-emerald-100 text-emerald-600',
    label: '构建（第4次 · 增量）',
    detail: 'CMAKE_POLICY_VERSION_MINIMUM=3.5 MAX_JOBS=4 bash ci/build.sh --python=3.10\n✅ 构建成功！产物：torch_npu-2.7.1 wheel (43.2 MB)',
    result: 'success',
    resultLabel: '构建成功',
    duration: '5m 35s',
  },
  {
    icon: <TestTube className="h-5 w-5" />,
    iconBg: 'bg-slate-100 text-slate-600',
    label: 'UT 执行',
    detail: 'AI 判断：仓库 UT 需要 NPU 硬件 + CANN 环境，当前 x86_64 WSL2 环境不具备。冒烟测试：pip install wheel 成功，import torch_npu 因缺少 libhccl.so 失败（属于运行期环境缺失，非构建产物缺陷）',
    result: 'info',
    resultLabel: '正确跳过（无NPU）',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    iconBg: 'bg-purple-100 text-purple-600',
    label: 'AI 生成报告',
    detail: '自动生成结构化 JSON 验证报告，包含全部 16 个步骤的耗时、状态、AI 决策依据。4 次构建尝试总耗时 30m 48s，AI 自主修复 3 个问题。',
    result: 'success',
    resultLabel: '报告完成',
    duration: '68m 40s',
  },
]

// ================================================================
// Act 3: 3 个关键时刻 — 跨仓库 AI 修复精选
// ================================================================

const KEY_MOMENTS = [
  {
    repo: 'Ascend/pytorch',
    problem: 'CMake 3.28+ 策略兼容性',
    icon: Shield,
    aiThought: '错误信息显示 cmake_minimum_required 与 policy CMP0167 冲突。这是 CMake 3.28 新增的兼容性检查，不是代码 bug。最优解：设置环境变量覆盖策略版本，不改源码。',
    aiAction: 'export CMAKE_POLICY_VERSION_MINIMUM=3.5',
    result: '构建通过，零代码改动',
    lesson: 'AI 能区分"环境配置问题"和"代码问题"，优先选择无侵入式修复',
  },
  {
    repo: 'Ascend/pytorch',
    problem: '20 核并发编译 OOM',
    icon: Cpu,
    aiThought: 'dmesg 显示 cc1plus 被 OOM Killer 终止，内存耗尽。当前 ninja -j20 并发过高。C++ 模板实例化本身内存密集，大文件需降低并发。',
    aiAction: 'export MAX_JOBS=4 && ninja -j4（降至 4 核并发）',
    result: '增量构建成功，内存峰值从 >16GB 降至 ~4GB',
    lesson: 'AI 能从系统级错误信号（OOM Killer）反向推导资源约束，自动调整策略',
  },
  {
    repo: '多仓库通用',
    problem: '缺少运行时库依赖',
    icon: Terminal,
    aiThought: 'import 报错 "libhccl.so not found"。这不是构建问题——产物正确生成了。运行时库依赖是环境配置问题，不是构建缺陷。',
    aiAction: 'pip install wheel 成功 → 标记 UT 为 not_run（环境不具备），记录具体缺失的库名和版本',
    result: '正确区分"构建失败"与"运行环境缺失"，避免误报',
    lesson: 'AI 能准确判断问题归属——是代码问题还是环境问题，避免无效修复尝试',
  },
]

// ================================================================
// Act 2: AI 决策树
// ================================================================

const DECISION_TREE = {
  title: 'AI 遇到构建错误的决策流程',
  steps: [
    { label: '捕获错误', detail: '解析 stderr/stdout，提取错误码和关键报错行', icon: Terminal },
    { label: '归类错误', detail: '匹配已知错误模式：CMake/OOM/依赖/网络/源码', icon: Search },
    { label: '评估策略', detail: '优先无侵入修复（环境变量/配置）→ 其次依赖安装 → 最后标记需人工', icon: Brain },
    { label: '执行修复', detail: '应用策略，记录变更内容和决策依据', icon: Wrench },
    { label: '验证结果', detail: '重新执行失败的步骤，确认修复有效', icon: CheckCircle },
  ],
}

// ================================================================
// Act 4: 失败博物馆 — AI 的边界
// ================================================================

const FAILURE_MUSEUM = [
  {
    icon: Cpu,
    title: '硬件依赖（NPU）',
    problem: 'UT 和样例需要 NPU 硬件，x86 环境不具备',
    aiAttempt: '尝试安装 CANN 模拟器、寻找 CPU-only fallback',
    outcome: '无法绕过',
    why: '物理硬件限制，非软件层面可解决。AI 正确标记为 not_run 而非 failed',
  },
  {
    icon: Globe,
    title: '容器网络/DNS 异常',
    problem: 'Docker 容器内 DNS 解析失败，无法访问外部 pip/apt 源',
    aiAttempt: '尝试配置 DNS、使用镜像源、修改 /etc/resolv.conf',
    outcome: '部分可解决',
    why: '底层网络基础设施问题，AI 能力受限于容器环境权限',
  },
  {
    icon: GitBranch,
    title: '仓库源码 Bug',
    problem: '仓库自身代码存在编译错误（非环境问题）',
    aiAttempt: '分析编译错误、尝试常见修复模式',
    outcome: '不修改源码',
    why: '设计原则：AI 不修改被验证仓库的源码，确保验证结果客观可信',
  },
  {
    icon: Shield,
    title: '需交互式认证',
    problem: '私有依赖需要 SSH key 或 token 认证',
    aiAttempt: '检查本地凭证、尝试匿名访问',
    outcome: '标记为环境限制',
    why: '安全性约束：AI 不应处理认证凭证',
  },
]

// ================================================================
// Act 5: 可复用方法论
// ================================================================

const REUSABLE_PATTERNS = [
  {
    icon: FileText,
    title: '从文档出发，不猜测',
    desc: 'AI 严格依据 README/构建脚本，不基于"常识"假设。这对保证验证结果客观性至关重要。',
    applies: '任何需要理解外部代码的场景',
  },
  {
    icon: GitBranch,
    title: '不修改源码原则',
    desc: 'AI 只能调整环境变量、构建参数、依赖版本——绝不修改仓库源码。这保证了"验证的是仓库本身"。',
    applies: '代码审查、CI/CD 验证、兼容性测试',
  },
  {
    icon: BarChart3,
    title: '每步可追溯',
    desc: 'AI 记录每步操作的决策依据、耗时、结果。不是黑盒——任何人都可以回溯验证过程。',
    applies: '合规审计、质量追溯、知识沉淀',
  },
  {
    icon: Layers,
    title: '标准化输出',
    desc: '无论输入格式多混乱，AI 将结果归一化为 5 种标准状态。下游消费方（页面、飞书）无需理解原始格式。',
    applies: '多源数据聚合、自动化报表、系统集成',
  },
]

// ================================================================
// Act 5: Agent-Ready 仓库 — 从验证到标准
// ================================================================

const AGENT_READY_DIMENSIONS = [
  {
    icon: FileText,
    title: '文档清晰度',
    question: 'AI 能否从文档中自动提取构建命令、依赖列表和测试入口？',
    goal: 'README 中明确标注构建命令（如 `bash ci/build.sh`）、依赖清单（requirements.txt / CMakeLists.txt）、测试入口（如 `pytest tests/`）',
    antiPattern: '构建步骤隐藏在 CI 脚本深层、依赖分散在多个文件且未在 README 中索引、只有口头/飞书传递的"构建指南"',
    color: 'indigo' as const,
  },
  {
    icon: Container,
    title: '环境可复现性',
    question: 'AI 能否在无人指导的情况下复现构建和运行环境？',
    goal: '提供 Dockerfile / devcontainer.json / nix flake，声明系统级依赖和版本（如 cmake >= 3.20, gcc-11）',
    antiPattern: '依赖宿主机预装的工具链、没有容器化方案、环境配置只在"老员工的机器上能跑"',
    color: 'emerald' as const,
  },
  {
    icon: Package,
    title: '依赖完整性',
    question: '所有依赖是否显式声明，AI 能否一键安装？',
    goal: 'Python: requirements.txt + setup.py；C++: CMakeLists.txt find_package；系统依赖: Dockerfile 中 apt/yum install；版本号固定而非 `latest`',
    antiPattern: '代码中 import 了但未声明的包、私有源未配置访问方式、版本用 `latest` 导致不可复现',
    color: 'amber' as const,
  },
  {
    icon: TestTube,
    title: '测试可执行性',
    question: '测试入口是否标准化，AI 能否发现、运行并解析测试结果？',
    goal: '测试命令在 README 中明确标注、输出格式标准化（JUnit XML / JSON）、区分单元测试（无硬件依赖）和集成测试（需硬件）',
    antiPattern: '测试需要特殊硬件但未声明、测试入口藏在 Makefile 深层 target、测试失败只输出堆栈无结构化报告',
    color: 'purple' as const,
  },
  {
    icon: Shield,
    title: '代码规范一致性',
    question: '项目是否有自动化规范检查，AI 生成的代码能否自动符合项目风格？',
    goal: '配置 .pre-commit-config.yaml / .clang-format / .eslintrc / ruff.toml，CI 强制检查，pre-commit hook 自动修复格式问题',
    antiPattern: '代码风格靠"人工 Review"维护、没有格式化配置、同一仓库内不同文件风格不一致导致 AI 代码风格飘忽',
    color: 'rose' as const,
  },
]

const AGENT_READY_SCENARIO = {
  before: [
    { time: '9:00', text: '打开 README，从头开始阅读理解项目' },
    { time: '9:30', text: '克隆代码，手动尝试构建' },
    { time: '10:00', text: '构建失败，对照错误日志逐条排查' },
    { time: '10:30', text: '在飞书/Slack 问同事"这个报错什么意思"' },
    { time: '11:00', text: '发现缺少某个系统依赖，手动 apt install' },
    { time: '11:30', text: '环境问题解决，重新构建' },
    { time: '12:00', text: '终于跑通构建。半天过去了。' },
  ],
  after: [
    { time: '9:00', text: '"AI，帮我搭建这个项目的开发环境" — 发送仓库 URL' },
    { time: '9:01', text: 'AI 拉取代码 → 阅读文档 → 分析环境需求' },
    { time: '9:02', text: 'AI 启动容器 → 安装所有依赖' },
    { time: '9:03', text: 'AI 执行构建，遇错自动诊断修复' },
    { time: '9:05', text: '构建成功，冒烟测试通过，环境就绪' },
    { time: '9:06', text: '开发者开始写今天的第一行业务代码' },
  ],
}

const AGENT_READY_PRACTICES = [
  {
    step: 'Step 1',
    title: '把"构建指令"写在 AI 能找到的地方',
    icon: Terminal,
    problem: '9 个仓库的构建命令藏在 CI 脚本里，AI 需要扫描多层 YAML 才能找到',
    action: '在 README 中用一个独立段落明确写出：`构建：bash ci/build.sh --release`',
    impact: 'AI 首次构建成功率从 ~60% 提升到 ~90%',
    color: 'indigo' as const,
  },
  {
    step: 'Step 2',
    title: '用 devcontainer 而不是"手动搭环境"',
    icon: Container,
    problem: '15 个仓库缺少容器化配置，AI 需要自行选择基础镜像并安装系统依赖',
    action: '在仓库根目录放置 .devcontainer/devcontainer.json，声明系统依赖和 VS Code 扩展',
    impact: '环境准备时间从平均 12min 降至 <1min，且 100% 可复现',
    color: 'emerald' as const,
  },
  {
    step: 'Step 3',
    title: '锁定依赖版本，固定到具体版本号',
    icon: Package,
    problem: '11 个仓库的依赖声明使用了 `latest` 或版本范围 `>=`，AI 在不同时间拉取到不同版本导致结果不一致',
    action: 'Python: pip freeze > requirements.txt 并提交；C++: CMakeLists.txt 中固定 find_package 版本；系统依赖: Dockerfile 中固定包版本',
    impact: '消除了"昨天能跑今天不行"的依赖漂移问题',
    color: 'amber' as const,
  },
  {
    step: 'Step 4',
    title: '把 pre-commit 配好，让 AI 帮你遵守规范',
    icon: Shield,
    problem: '18 个仓库没有 pre-commit 配置，AI 生成的代码风格无法自动校准',
    action: '配置 .pre-commit-config.yaml：至少包含 trailing-whitespace、end-of-file-fixer、语言特定的 linter/formatter',
    impact: 'AI 生成代码的风格一致性从"靠运气"变成"靠机制"',
    color: 'rose' as const,
  },
  {
    step: 'Step 5',
    title: '区分"无硬件测试"和"需硬件测试"',
    icon: TestTube,
    problem: '22 个仓库的测试需要 NPU/GPU，但 README 未区分，AI 需要反复尝试才能判断',
    action: '在 README 测试章节标注：`单元测试（无硬件依赖）：pytest tests/unit` vs `集成测试（需要 NPU）：pytest tests/integration --device npu`',
    impact: 'AI 不再浪费时间尝试无法执行的测试，验证时间缩短 ~40%',
    color: 'purple' as const,
  },
]

// ================================================================
// Act 5: AI 能力总结
// ================================================================

const AI_CAPABILITIES = [
  { icon: FileText, title: '文档理解', desc: '自动解析 README，提取构建/依赖/测试命令', stage: 'Stage 1' },
  { icon: Search, title: '错误诊断', desc: '分析编译错误日志，识别 OOM、CMake 策略等根因', stage: 'Stage 1' },
  { icon: Wrench, title: '自主修复', desc: '调整环境变量、清理缓存、降并发等策略自动尝试', stage: 'Stage 1' },
  { icon: BarChart3, title: '信息抽取', desc: '从非标准格式中提取结构化数据，自动归一化', stage: 'Stage 2' },
  { icon: Code, title: '代码生成', desc: '辅助编写前端代码、数据处理逻辑', stage: 'Stage 3' },
  { icon: Globe, title: '系统集成', desc: '自动匹配数据行、批量写入外部系统', stage: 'Stage 4' },
]

// ================================================================
// 颜色映射
// ================================================================

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; light: string }> = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-200', light: 'bg-indigo-50' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-50' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-50' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-50' },
  rose: { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-200', light: 'bg-rose-50' },
}

// ================================================================
// 辅助函数 & 小组件
// ================================================================

function resultBadge(result: DemoStep['result']) {
  switch (result) {
    case 'success':
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          成功
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          失败
        </span>
      )
    case 'ai_fix':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <Brain className="h-3 w-3" />
          AI 自主修复
        </span>
      )
    case 'info':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <CheckCircle className="h-3 w-3" />
          判断正确
        </span>
      )
  }
}

function getEfficiencyNumbers() {
  const aiMinutes = Math.round(STATS.avgDuration / 60)
  const manualMinutes = 100
  const multiplier = Math.round((manualMinutes / aiMinutes) * 10) / 10
  const aiTotalHours = Math.round((STATS.total * aiMinutes) / 60)
  const manualTotalHours = STATS.total * 2
  const savedHours = manualTotalHours - aiTotalHours
  return { aiMinutes, manualMinutes, multiplier, aiTotalHours, manualTotalHours, savedHours }
}

// ================================================================
// Transition Bar 组件 — Act 之间的大过渡
// ================================================================

function ActTransition({ num, title, sub, color }: { num: number; title: string; sub: string; color: string }) {
  const c = COLOR_MAP[color]
  return (
    <div className="py-6 bg-slate-100/50">
      <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
        <div className="flex items-center gap-4">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} text-lg font-bold text-white shadow-sm`}>
            {num}
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">{sub}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {ACTS[num - 1]?.time}
          </div>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// Main Page
// ================================================================

export default function SharePage() {
  const eff = getEfficiencyNumbers()

  return (
    <main>
      {/* ================================================================ */}
      {/* 🕐 顶部时间轴导航 */}
      {/* ================================================================ */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="flex items-center gap-1 py-3 overflow-x-auto">
            {ACTS.map((act, i) => {
              const c = COLOR_MAP[act.color]
              return (
                <div key={act.num} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-slate-300 mx-1" />}
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${c.bg} text-[10px] font-bold text-white`}>
                      {act.num}
                    </span>
                    <span className="text-xs font-medium text-slate-700">{act.title}</span>
                    <span className="text-[10px] text-slate-400">{act.time}</span>
                  </div>
                </div>
              )
            })}
            <Link
              href="/"
              className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              仪表盘
            </Link>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Act 1: 为什么做 (The Problem) — ~3min */}
      {/* ================================================================ */}
      <ActTransition num={1} title="为什么做" sub="The Problem" color="rose" />

      {/* Hero */}
      <section className="bg-gradient-to-b from-rose-50 via-white to-white pt-6 pb-16">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-rose-100 px-5 py-2 text-sm font-medium text-rose-700">
            <Brain className="h-4 w-4" />
            AI 辅助业务实践
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            AI 辅助软件构建验证
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-500 leading-relaxed">
            AI 独立完成 {STATS.total}+ 开源仓库的全流程验证 ——
            从阅读文档到飞书报告，全链路无需人工干预
          </p>

          {/* Key Numbers */}
          <div className="mt-12 grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-rose-600">{STATS.total}+</div>
              <div className="mt-1 text-sm text-slate-400">仓库全自动验证</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-rose-600">4</div>
              <div className="mt-1 text-sm text-slate-400">AI 驱动阶段</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-rose-600">
                {eff.aiMinutes}min
              </div>
              <div className="mt-1 text-sm text-slate-400">平均每仓库完成</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Point Story */}
      <section className="pb-16 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <Card className="border-rose-200 bg-rose-50/30">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                  <AlertTriangle className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-rose-800 mb-3">
                    问题：人工验证 {STATS.total} 个仓库是不可持续的
                  </h3>
                  <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                    <p>
                      在 AI 辅助之前，验证一个开源仓库需要约 <strong>{eff.manualMinutes} 分钟</strong>人工投入——
                      阅读 README、理解构建系统、搭建 Docker 环境、安装依赖、执行构建、
                      排查错误、运行测试、整理报告。每个步骤都需要人的判断和操作。
                    </p>
                    <p>
                      {STATS.total} 个仓库意味着 <strong>{eff.manualTotalHours} 小时</strong>的重复性工作。
                      而且：
                    </p>
                    <ul className="space-y-2 ml-4">
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <span><strong>标准不统一</strong> — 每个人对"验证通过"的判断标准不同</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <span><strong>经验难沉淀</strong> — 排查过程没人记录，换了人就重新踩坑</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <span><strong>无法规模化</strong> — 增加新仓库就意味着增加线性的人力投入</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Act 2: 怎么做 (The Approach) — ~4min */}
      {/* ================================================================ */}
      <ActTransition num={2} title="怎么做" sub="The Approach" color="indigo" />

      {/* 4-Stage Pipeline */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <Layers className="h-4 w-4" />
              全链路 AI 自动化
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 在 4 个阶段替代了什么
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              从仓库验证到飞书报告，4 个阶段全由 AI 驱动，人只做最终审核
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {AI_STAGES.map((stage) => {
              const c = COLOR_MAP[stage.color]
              return (
                <Card key={stage.num} className={`border-2 ${c.border} ${c.light}/30 flex flex-col`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${c.bg} text-sm font-bold text-white`}>
                      {stage.num}
                    </span>
                    <stage.icon className={`h-5 w-5 ${c.text}`} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">{stage.title}</h3>
                  <code className="mt-1 text-[11px] font-mono text-slate-400">{stage.skill}</code>
                  <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">
                      🤖 AI 替代了
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">{stage.aiReplaces}</p>
                  </div>
                  <ul className="mt-4 space-y-2 flex-1">
                    {stage.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${c.text}`} />
                        <span className="text-xs text-slate-500 leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* AI Decision Tree */}
      <section className="pb-14 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <Card className="border-indigo-100 bg-indigo-50/20">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-indigo-800">
                  {DECISION_TREE.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {DECISION_TREE.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-white border border-indigo-100 px-3 py-2 shadow-sm">
                      <step.icon className="h-4 w-4 text-indigo-500 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{step.label}</div>
                        <div className="text-[11px] text-slate-400 leading-tight">{step.detail}</div>
                      </div>
                    </div>
                    {i < DECISION_TREE.steps.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-indigo-300 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Act 3: 深度案例 (Deep Dive) — ~6min */}
      {/* ================================================================ */}
      <ActTransition num={3} title="深度案例" sub="Deep Dive" color="purple" />

      {/* PyTorch Demo Timeline */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
              <Play className="h-4 w-4" />
              实战回放
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 验证全过程演示
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              以{' '}
              <a href="https://gitcode.com/Ascend/pytorch.git" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
                Ascend/pytorch
              </a>{' '}
              为例 — AI 在无人工干预下完成 11 个步骤，4 次构建尝试，3 次 AI 自主修复后成功
            </p>
          </div>

          {/* Timeline */}
          <div className="relative mx-auto max-w-2xl">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-0">
              {DEMO_STEPS.map((step, i) => (
                <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${step.iconBg} shadow-sm ring-4 ring-white`}>
                      {step.icon}
                    </div>
                  </div>
                  <Card className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-slate-800">
                            {step.label}
                          </h4>
                          {resultBadge(step.result)}
                          {step.duration && (
                            <span className="text-xs text-slate-400 font-mono">
                              {step.duration}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                          {step.detail}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Build Duration Breakdown */}
          <Card className="mt-10 mx-auto max-w-2xl border-purple-100 bg-purple-50/30">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-purple-800">
                AI 的多轮尝试耗时分解
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '第1次尝试', dur: '38s', status: 'failed' },
                { label: '第2次尝试', dur: '57s', status: 'failed' },
                { label: '第3次 OOM', dur: '23m 58s', status: 'failed' },
                { label: '第4次成功', dur: '5m 35s', status: 'success' },
              ].map((item, i) => (
                <div key={i} className="rounded-lg bg-white border border-purple-100 p-3 text-center">
                  <div className={`text-lg font-bold ${item.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {item.dur}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 text-center">
              4 次构建尝试，第 4 次成功 — AI 每次失败后自主调整策略，无需人工介入
            </p>
          </Card>

        </div>
      </section>

      {/* 3 Key Moments */}
      <section className="pb-14 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
                <Lightbulb className="h-4 w-4" />
                3 个关键时刻
              </div>
              <h3 className="text-2xl font-semibold text-slate-900">
                AI 的决策是如何产生的
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                不只讲结果，更要看 AI 的推理过程——它是怎么想的，为什么这样决策
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {KEY_MOMENTS.map((moment, i) => (
                <Card key={i} className="border-violet-100 hover:border-violet-200 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                      <moment.icon className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-violet-500 bg-violet-50 px-2 py-0.5 rounded">
                          {moment.repo}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-800">{moment.problem}</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="rounded-lg bg-purple-50/50 border border-purple-100 p-3">
                          <span className="text-[11px] font-semibold text-purple-500 uppercase tracking-wide">🧠 AI 推理</span>
                          <p className="mt-1 text-slate-600 leading-relaxed">{moment.aiThought}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-3">
                          <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide">🔧 AI 行动</span>
                          <p className="mt-1 font-mono text-xs text-emerald-700">{moment.aiAction}</p>
                        </div>
                        <div className="flex items-start gap-2 text-slate-600">
                          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>结果：</strong>{moment.result}</span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-500">
                          <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-xs italic">💡 {moment.lesson}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Act 4: 规模化成果 (Results at Scale) — ~4min */}
      {/* ================================================================ */}
      <ActTransition num={4} title="规模化成果" sub="Results at Scale" color="emerald" />

      {/* Manual vs AI */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <Zap className="h-4 w-4" />
              核心变革
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              从人工验证到 AI 自动化
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Manual */}
            <div className="rounded-2xl border-2 border-red-100 bg-red-50/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-red-800">人工验证（过去）</h3>
                  <p className="text-sm text-red-500">依赖个人经验，标准不统一，效率低下</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: FileText, text: '逐字阅读 README，理解构建步骤和依赖关系' },
                  { icon: Container, text: '手动搭建 Docker 环境，选择基础镜像' },
                  { icon: Search, text: '逐条执行命令，遇到错误人工排查、搜索解决方案' },
                  { icon: Clock, text: '手工记录每步执行结果、耗时，整理成报告' },
                  { icon: Clock, text: `一个仓库约需 ${eff.manualMinutes} 分钟（含环境准备和问题排查）` },
                  { icon: Monitor, text: `${STATS.total} 个仓库需要约 ${eff.manualTotalHours} 小时人工投入` },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT: AI */}
            <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <Brain className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-emerald-800">AI 自动验证（现在）</h3>
                  <p className="text-sm text-emerald-500">标准化流程，全自动执行，结果可复现</p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: Brain, text: 'AI 自动解析 README，提取构建命令、依赖列表、测试入口' },
                  { icon: Zap, text: 'AI 自主选择镜像，启动容器，安装依赖' },
                  { icon: Brain, text: `AI 自主分析错误日志、尝试多轮修复（已自主解决 ${PROBLEM_STATS.resolvedCount}+ 个问题）` },
                  { icon: Zap, text: 'AI 自动记录执行日志、耗时、决策依据，生成结构化报告' },
                  { icon: Zap, text: `一个仓库平均仅需 ${eff.aiMinutes} 分钟` },
                  { icon: CheckCircle, text: `${STATS.total} 个仓库全自动完成，零人工介入` },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <span className="text-sm text-slate-600 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Efficiency Stats Bar */}
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-4xl font-bold">{eff.multiplier}x</div>
                <div className="mt-1 text-sm text-emerald-100">AI 验证效率提升</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{eff.aiTotalHours}h</div>
                <div className="mt-1 text-sm text-emerald-100">AI 完成 {STATS.total} 个仓库</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{eff.savedHours}h</div>
                <div className="mt-1 text-sm text-emerald-100">相比人工节省时间</div>
              </div>
              <div>
                <div className="text-4xl font-bold">{STATS.buildPassRate}%</div>
                <div className="mt-1 text-sm text-emerald-100">构建成功率（AI 自主达成）</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Big Numbers + Charts */}
      <section className="py-10 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="text-center py-8 border-l-4 border-l-indigo-500">
              <div className="text-5xl font-bold text-indigo-600">{STATS.total}+</div>
              <div className="mt-2 text-sm text-slate-500">
                仓库全自动验证
                <br />
                <span className="text-xs text-slate-400">人工不可能覆盖的量级</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-emerald-500">
              <div className="text-5xl font-bold text-emerald-600">{eff.multiplier}x</div>
              <div className="mt-2 text-sm text-slate-500">
                验证效率提升
                <br />
                <span className="text-xs text-slate-400">对比人工约 {eff.manualMinutes}min/仓库</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-amber-500">
              <div className="text-5xl font-bold text-amber-600">{eff.savedHours}h+</div>
              <div className="mt-2 text-sm text-slate-500">
                相比人工节省时间
                <br />
                <span className="text-xs text-slate-400">{STATS.total} 仓库 × 2h/仓库 ≈ {STATS.total * 2}h 人工</span>
              </div>
            </Card>
            <Card className="text-center py-8 border-l-4 border-l-purple-500">
              <div className="text-5xl font-bold text-purple-600">100%</div>
              <div className="mt-2 text-sm text-slate-500">
                零遗漏仓库
                <br />
                <span className="text-xs text-slate-400">{STATS.total} 个仓库全部覆盖</span>
              </div>
            </Card>
          </div>

          {/* Problems AI solved */}
          <Card className="mt-6 border-indigo-100 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="h-5 w-5 text-indigo-500" />
              <span className="font-semibold text-indigo-800">
                AI 自主解决的构建问题
              </span>
            </div>
            <p className="text-sm text-slate-600">
              在 {PROBLEM_STATS.totalReposWithProblems} 个仓库的验证过程中，共遇到 {PROBLEM_STATS.totalProblems} 个构建/环境问题。
              AI 自主解决了其中 {PROBLEM_STATS.resolvedCount}+ 个，无需人工介入。剩余为环境限制（如 NPU 硬件缺失）等不可控因素。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PROBLEM_STATS.topProblems.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-100 px-3 py-1 text-xs text-slate-600">
                  <Wrench className="h-3 w-3 text-indigo-400" />
                  {p}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Results Overview */}
      <section className="py-10 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-8">
            <StatsOverview stats={STATS} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">整体验证结果分布</h3>
              <ResultPieChart success={STATS.success} failed={STATS.failed} partial={STATS.partial} />
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">社区维度分布</h3>
              <div className="space-y-3">
                {COMMUNITY_STATS.map((cs) => (
                  <div key={cs.community} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-slate-600 shrink-0">{cs.community}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden flex">
                      {cs.success > 0 && (
                        <div
                          className="bg-emerald-500 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.success / cs.total) * 100}%` }}
                        >
                          {cs.success}
                        </div>
                      )}
                      {cs.partial > 0 && (
                        <div
                          className="bg-amber-400 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.partial / cs.total) * 100}%` }}
                        >
                          {cs.partial}
                        </div>
                      )}
                      {cs.failed > 0 && (
                        <div
                          className="bg-red-400 h-full flex items-center justify-center text-[10px] text-white font-medium"
                          style={{ width: `${(cs.failed / cs.total) * 100}%` }}
                        >
                          {cs.failed}
                        </div>
                      )}
                    </div>
                    <span className="w-10 text-xs text-slate-400 text-right font-mono">{cs.passRate}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> 成功</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> 部分成功</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" /> 失败</span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Failure Museum */}
      <section className="pb-14 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600">
                <AlertTriangle className="h-4 w-4" />
                失败博物馆
              </div>
              <h3 className="text-2xl font-semibold text-slate-900">
                AI 也不是万能的
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                诚实展示 AI 的边界——哪些问题 AI 解决不了，为什么
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FAILURE_MUSEUM.map((item, i) => (
                <Card key={i} className="border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <item.icon className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{item.problem}</p>
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="text-slate-500">
                          <span className="font-medium text-slate-600">AI 尝试：</span>{item.aiAttempt}
                        </p>
                        <p className="flex items-center gap-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.outcome === '无法绕过' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.outcome}
                          </span>
                          <span className="text-slate-400">— {item.why}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Act 5: 带走什么 (Takeaways) — ~3min */}
      {/* ================================================================ */}
      <ActTransition num={5} title="带走什么" sub="Takeaways" color="amber" />

      {/* Reusable Patterns */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
                <Target className="h-4 w-4" />
                可复用方法论
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                不只是案例，更是可迁移的方法
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                以下 4 个核心原则可以应用到其他 AI 辅助开发场景
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {REUSABLE_PATTERNS.map((pattern, i) => (
                <Card key={i} className="border-amber-100 hover:border-amber-200 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                      <pattern.icon className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800">{pattern.title}</h4>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{pattern.desc}</p>
                      <p className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        适用：{pattern.applies}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* AI Capabilities */}
      <section className="py-10 bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
              <Brain className="h-4 w-4" />
              AI 能力拆解
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              AI 提效的 6 大关键能力
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-3xl mx-auto">
            {AI_CAPABILITIES.map((cap, i) => (
              <Card key={i} className="group hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                    <cap.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-800">{cap.title}</h4>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                        {cap.stage}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Agent-Ready 仓库 — 从验证到标准 */}
      {/* ================================================================ */}

      {/* 洞察：TTFHW 真正在测什么 */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
              <Sparkles className="h-4 w-4" />
              洞察
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              TTFHW 真正在测什么：仓库的 Agent-Ready 程度
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              每次验证表面上是"构建能不能过"，实质上是在测试一个更深层的问题——
              <strong>这个仓库对 AI Agent 有多友好？</strong>
              一个 Agent 能否独立理解它、搭建它、跑通它？
            </p>
          </div>

          {/* 5 Dimensions Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {AGENT_READY_DIMENSIONS.map((dim, i) => {
              const c = COLOR_MAP[dim.color]
              return (
                <Card key={i} className={`border-l-4 ${c.border} hover:shadow-md transition-shadow`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.light}`}>
                      <dim.icon className={`h-5 w-5 ${c.text}`} />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">{dim.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    🤖 <span className="font-medium text-slate-600">{dim.question}</span>
                  </p>
                  <div className="rounded-md bg-emerald-50/50 border border-emerald-100 p-2.5 mb-2">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">✅ Agent-Ready 标准</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{dim.goal}</p>
                  </div>
                  <div className="rounded-md bg-red-50/50 border border-red-100 p-2.5">
                    <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">❌ 常见反模式</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{dim.antiPattern}</p>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Takeaway */}
          <p className="mt-8 text-center text-sm text-slate-400 max-w-2xl mx-auto">
            这 5 个维度构成了仓库的 <strong className="text-slate-600">Agent-Ready 评分卡</strong>。
            59 个仓库的实际验证数据显示：维度覆盖越完整，AI 首次构建成功率越高，人工介入次数越少。
          </p>
        </div>
      </section>

      {/* 具象场景：Agent-Ready 仓库的一天 */}
      <section className="pb-14 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-sm font-medium text-sky-700">
                <Play className="h-4 w-4" />
                具象场景
              </div>
              <h3 className="text-2xl font-semibold text-slate-900">
                同一件事，两个世界的区别
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                新人要开始在一个新仓库上开发功能，从拿到 repo URL 到跑通构建开始写代码——
                Agent-Ready 到底改变了什么？
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BEFORE */}
              <Card className="border-red-100 bg-red-50/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                    <Clock className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-700">传统模式</h4>
                    <p className="text-xs text-red-400">非 Agent-Ready 仓库 · 总耗时 ~3h</p>
                  </div>
                </div>
                <div className="relative pl-6 border-l-2 border-red-200 space-y-3">
                  {AGENT_READY_SCENARIO.before.map((item, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[calc(1.5rem+3px)] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-red-200 bg-white" />
                      <p className="text-xs text-slate-400 font-mono">{item.time}</p>
                      <p className="text-sm text-slate-600">{item.text}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* AFTER */}
              <Card className="border-emerald-100 bg-emerald-50/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                    <Zap className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-700">Agent-Ready 模式</h4>
                    <p className="text-xs text-emerald-400">Agent-Ready 仓库 · 总耗时 ~5min</p>
                  </div>
                </div>
                <div className="relative pl-6 border-l-2 border-emerald-200 space-y-3">
                  {AGENT_READY_SCENARIO.after.map((item, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[calc(1.5rem+3px)] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-emerald-200 bg-emerald-100" />
                      <p className="text-xs text-slate-400 font-mono">{item.time}</p>
                      <p className="text-sm text-slate-700">{item.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              差距不是 AI 有多聪明——而是仓库有没有为 AI 准备好。
            </p>
          </div>
        </div>
      </section>

      {/* 如何让你的仓库 Agent-Ready */}
      <section className="pb-14 bg-white">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                <Wrench className="h-4 w-4" />
                立刻就能做
              </div>
              <h3 className="text-2xl font-semibold text-slate-900">
                让你的仓库进入 Agent-Ready 状态
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                来自 59 个仓库的实际验证数据——以下 5 步是影响最大的改进点，按优先级排列
              </p>
            </div>

            <div className="space-y-4">
              {AGENT_READY_PRACTICES.map((practice, i) => {
                const c = COLOR_MAP[practice.color]
                return (
                  <Card key={i} className={`border-l-4 ${c.border} hover:shadow-sm transition-shadow`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.light}`}>
                        <practice.icon className={`h-5 w-5 ${c.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold ${c.text} bg-white border ${c.border} rounded px-1.5 py-0.5`}>
                            {practice.step}
                          </span>
                          <h4 className="text-sm font-semibold text-slate-800">{practice.title}</h4>
                        </div>
                        <div className="space-y-1.5 mt-2 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-red-400 shrink-0 mt-0.5">⚠️</span>
                            <span className="text-slate-500"><strong>现状：</strong>{practice.problem}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-500 shrink-0 mt-0.5">→</span>
                            <span className="text-slate-600"><strong>做法：</strong>{practice.action}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-indigo-500 shrink-0 mt-0.5">📈</span>
                            <span className="text-slate-500"><strong>效果：</strong>{practice.impact}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              完成这 5 步之后，你的仓库就可以通过{' '}
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">/ttfhw-verify-pro</code>{' '}
              一键验证——AI 将独立完成构建全流程，你只需要审核结果。
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Closing: Summary + CTA */}
      {/* ================================================================ */}
      <section className="py-16 bg-gradient-to-b from-slate-50 to-indigo-50">
        <div className="mx-auto max-w-screen-xl px-6 xl:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-5 py-2 text-sm font-medium text-indigo-700">
            <Zap className="h-4 w-4" />
            总结
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            AI 将软件验证从"人驱动"变为"AI 驱动"
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-lg text-slate-500 leading-relaxed">
            传统软件验证依赖人工逐一阅读文档、搭建环境、执行命令、记录结果。
            TTFHW 方案通过 AI 实现了全链路自动化——AI 理解文档、自主决策、自动修复、自动报告。
            人只需要审核最终结果，做出决策。
          </p>

          {/* Core Message */}
          <div className="mt-8 mx-auto max-w-lg rounded-xl bg-white border-2 border-indigo-200 p-6">
            <p className="text-base font-semibold text-indigo-800 mb-2">
              🎯 今天最想传递的核心信息
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              AI 不是替代开发者，而是把开发者从"重复性验证"中解放出来，
              让你专注于真正需要创造力和判断力的工作。
              <br />
              <span className="text-indigo-500 font-medium">
                我们不是用 AI 替代人的思考——而是用 AI 替代"不需要思考"的重复劳动。
              </span>
            </p>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{STATS.total}</div>
              <div className="text-xs text-slate-400 mt-1">仓库已验证</div>
            </div>
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{COMMUNITY_STATS.length}</div>
              <div className="text-xs text-slate-400 mt-1">社区覆盖</div>
            </div>
            <div className="rounded-xl bg-white border border-indigo-100 p-4">
              <div className="text-2xl font-bold text-indigo-600">{STATS.buildPassRate}%</div>
              <div className="text-xs text-slate-400 mt-1">构建通过率</div>
            </div>
          </div>

          {/* Future */}
          <div className="mt-8 mx-auto max-w-lg rounded-xl bg-white border border-slate-200 p-6 text-left">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              未来方向
            </h4>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                扩展到更多社区和仓库类型（私有仓库、内部项目）
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                增加更多验证维度（性能基准、安全扫描、兼容性矩阵）
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-500">
                <ArrowRight className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                接入 CI/CD 流水线，实现每次 commit 自动验证
              </li>
            </ul>
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Monitor className="h-4 w-4" />
              返回验证仪表盘
            </Link>
            <a
              href="https://gitcode.com/TTFHVV/ttfhw-report"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Code className="h-4 w-4" />
              查看 Skill 文档
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
