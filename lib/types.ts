// 汇总数据接口
export type ResultStatus = 'success' | 'failed' | 'partial_success' | 'unknown' | 'skipped' | 'not_run' | 'no_tests';
export type ConfigStatus = 'configured' | 'not_configured' | 'unknown';

export interface RepoSummary {
  name: string;
  displayName: string;
  result: ResultStatus;
  buildStatus: ResultStatus;
  utStatus: ResultStatus;
  sampleStatus: ResultStatus;
  totalDuration: number;
  environmentDuration?: number;
  buildDuration?: number;
  utDuration?: number;
  sampleDuration?: number;
  testPassed?: number;
  testFailed?: number;
  testTotal?: number;
  testSkipped?: number;
  generatedAt: string;
  environment: 'local' | 'remote' | 'unknown';
  url?: string;
  category?: string;
  // v630: 代码质量配置状态
  preCommitStatus: ConfigStatus;
  lintRunnerStatus: ConfigStatus;
  devcontainerStatus: ConfigStatus;
}

// 详情数据接口 - 扩展覆盖所有JSON字段
export interface RepoDetail extends RepoSummary {
  url: string;
  branch?: string;

  // 标准格式字段
  timeline: TimelinePhase[];
  attempts: Attempt[];
  buildResult: BuildResult;
  utStats: UtStats;
  documentation: DocumentationChecklist;
  dependencies?: DependencyInfo;
  hardwareConfig?: HardwareConfig;
  imageSelection?: ImageSelection;
  issues?: (string | Record<string, any>)[];
  recommendations?: (string | Record<string, any>)[];
  rawData?: Record<string, any>;

  // report-511 特有字段 (保留原始数据)
  metadata?: ReportMetadata;
  machineSpec?: MachineSpec;
  documentReadingSummary?: DocumentReadingSummary;
  executionLog?: ExecutionLogEntry[];
  processTimeline?: ProcessTimelineEntry[];
  finalResults?: FinalResults;
  utStAnalysis?: UtStAnalysis;
  documentationGaps?: DocumentationGapItem[];
  problemsEncountered?: ProblemEncountered[];
  conclusion?: Conclusion;
  sessionExportFile?: string;

  // v630 新增字段
  staticAnalysis?: StaticAnalysisResult;
  devcontainer?: DevcontainerResult;
}

// report-511 特有类型定义

export interface ReportMetadata {
  repo_path?: string;
  repo_url?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  total_steps?: number;
  // v630 新增
  branch?: string;
  commit?: string;
  commit_subject?: string;
  commit_date?: string;
  git_describe?: string;
}

export interface MachineSpec {
  host_machine?: Record<string, any>;
  container?: Record<string, any>;
  image_source?: {
    type?: string;
    image_name?: string;
    selection_reason?: string;
    source?: string;
    [key: string]: any;
  };
  npu_hardware_present?: boolean;
  cann_environment?: Record<string, any>;
  [key: string]: any;
}

export interface HostMachine {
  os?: string;
  architecture?: string;
  cpu_model?: string;
  cpu_cores?: number;
  memory?: string;
  disk?: string;
  docker_version?: string;
  kernel?: string;
}

export interface ContainerSpec {
  os?: string;
  architecture?: string;
  image?: string;
  container_name?: string;
  python_version?: string;
  cmake_version?: string;
  gcc_version?: string;
  torch_version?: string;
}

export interface DocumentReadingSummary {
  architecture?: { value?: string; source?: string };
  os_selection?: { value?: string; source?: string };
  os_support?: { value?: string; source?: string };
  dependencies?: { value?: string[]; source?: string };
  explicit_dependencies?: { value?: string[]; source?: string };
  build_commands?: { value?: string; source?: string };
  ut_commands?: { value?: string; source?: string };
  st_commands?: { value?: string; source?: string };
  sample_commands?: { value?: string; source?: string };
  cann_prerequisite?: { value?: string; source?: string };
}

export interface ExecutionLogEntry {
  timestamp?: string;
  step?: string;
  command?: string;
  success?: boolean;
  output?: string;
  error?: string;
  returncode?: number;
  note?: string;
  detail?: string;
}

export interface ProcessTimelineEntry {
  timestamp?: string;
  step?: string;
  action?: string;
  result?: string;
  details?: Record<string, any>;
}

export interface FinalResults {
  build?: BuildFinalResult;
  ut?: UtFinalResult;
  st?: StFinalResult;
  sample?: SampleFinalResult;
  runtime?: RuntimeFinalResult;
}

export interface BuildFinalResult {
  status?: string;
  reason?: string;
  stage?: string;
  artifacts?: Artifact[];
  installed_cann_stats?: InstalledCannStats;
}

export interface InstalledCannStats {
  shared_libraries?: number;
  header_files?: number;
  directories?: number;
  cann_version?: string;
  missing_components?: string[];
}

export interface UtFinalResult {
  status?: string;
  reason?: string;
  torchair_ut?: UtTestDetail;
  inductor_npu_ext_ut?: UtTestDetail;
  total?: number;
  passed?: number;
  failed?: number;
  tests?: TestItem[];
}

export interface UtTestDetail {
  status?: string;
  reason?: string;
  total?: number;
  passed?: number;
  failed?: number;
  tests?: TestItem[];
  link_errors?: string[];
  build_script_error?: string;
  note?: string;
}

export interface TestItem {
  name?: string;
  status?: string;
}

export interface StFinalResult {
  status?: string;
  reason?: string;
  required_libraries?: string[];
  import_error?: string;
  note?: string;
}

export interface SampleFinalResult {
  status?: string;
  reason?: string;
  note?: string;
}

export interface RuntimeFinalResult {
  status?: string;
  reason?: string;
  note?: string;
}

export interface UtStAnalysis {
  torchair_ut?: UtStAnalysisItem;
  torchair_st?: UtStAnalysisItem;
  inductor_npu_ext_ut?: UtStAnalysisItem;
}

export interface UtStAnalysisItem {
  location?: string;
  type?: string;
  dependencies?: string[];
  can_run_without_ascend?: boolean;
  reason?: string;
  method?: string;
  test_results?: string;
}

export interface DocumentationGap {
  gap?: string;
  item?: string;
  severity?: string;
  detail?: string;
}

// 支持字符串格式（runtime等）和对象格式（torchair等）
export type DocumentationGapItem = string | DocumentationGap;

export interface ProblemEncountered {
  timestamp?: string;
  problem?: string;
  root_cause?: string;
  solution?: string;
  source?: string;
  resolved?: boolean;
  resolution_detail?: string;
  attempted_fixes?: string[];
}

export interface Conclusion {
  build_success?: boolean;
  ut_executable?: boolean;
  st_executable?: boolean;
  runtime_available?: boolean;
  inductor_ut_executable?: boolean;
  summary?: string;
}

// 标准格式类型

export interface TimelinePhase {
  phase: string;
  durationSeconds: number;
  status: string;
  breakdown?: Record<string, number>;
}

export interface Attempt {
  sequence: number;
  phase: string;
  action: string;
  command?: string;
  result: ResultStatus | 'timeout';
  durationSeconds: number;
  output?: string;
  errorMessage?: string;
}

export interface BuildResult {
  status: ResultStatus;
  buildCommand?: string;
  durationSeconds?: number;
  artifacts?: Artifact[];
  error?: string | BuildError;
  warnings?: string[];
  targetsCount?: number;
  progress?: string;
  /** 构建命令 (v630) */
  command?: string;
  /** 构建并发数 (v630) */
  concurrency?: number;
  /** 多次构建尝试的耗时分解 (v630) */
  durationBreakdown?: Record<string, number>;
}

export interface BuildError {
  type?: string;
  location?: string;
  message?: string;
  details?: string;
}

export interface Artifact {
  name: string;
  path?: string;
  type?: string;
  sizeBytes?: number;
  sizeHuman?: string;
  size?: string;
}

export interface UtStats {
  framework?: string;
  status: ResultStatus;
  totalTests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  disabled?: number;
  durationSeconds?: number;
  testSuites?: string[];
  errorSummary?: string;
  errorDetail?: string;
  coveragePercent?: number;
  /** UT跳过原因 (v630) */
  skipReason?: string;
}

// ======================== v630 新增类型 ========================

export interface StaticAnalysisResult {
  enabled: boolean;
  summary?: string;
  pre_commit: PreCommitDetail;
  lint_runner: LintRunnerDetail;
}

export interface PreCommitDetail {
  configured: boolean;
  config_file?: string | null;
  status?: string;
  duration_seconds?: number;
  total_hooks?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  failures?: PreCommitFailure[];
}

export interface PreCommitFailure {
  hook_id?: string;
  hook_name?: string;
  reason?: string;
  test_name?: string;
}

export interface LintRunnerDetail {
  configured: boolean;
  config_file?: string | null;
  status?: string;
  duration_seconds?: number;
  active_linters?: string[];
  result?: string;
}

export interface DevcontainerResult {
  enabled: boolean;
  config_dir?: string | null;
  config_files?: string[];
  summary?: string;
}

export interface SmokeTestResult {
  command?: string;
  status?: string;
  interpretation?: string;
}

export interface SampleResultItem {
  sample_name: string;
  execution_status: string;
  output_summary: string;
  execution_time: string;
}

export interface DocumentationChecklist {
  readmeExists?: boolean;
  readmeHasInstallSection?: boolean;
  readmeHasQuickStart?: boolean;
  readmeHasApiSection?: boolean;
  buildGuideExists?: boolean;
  contributingGuideExists?: boolean;
  devcontainerExists?: boolean;
  dockerfileExists?: boolean;
  docsDirectoryExists?: boolean;
  exampleDirectoryExists?: boolean;
}

export interface DependencyInfo {
  totalDependencies?: number;
  resolvedDependencies?: Dependency[];
  missingDependencies?: (string | MissingDependency)[];
}

export interface MissingDependency {
  name?: string;
  reason?: string;
}

export interface Dependency {
  name: string;
  version?: string;
  type?: string;
  source?: string;
}

export interface HardwareConfig {
  server?: string;
  npuAvailable?: boolean;
  npuCount?: number;
  npuDevice?: string;
  npuStatus?: string;
}

export interface ImageSelection {
  method?: string;
  selectedImage?: string;
  toolVersions?: Record<string, string>;
}

export interface SummaryStats {
  total: number;
  success: number;
  failed: number;
  partial: number;
  other: number;
  avgDuration: number;
  avgEnvironmentDuration: number;
  totalTestsAll: number;
  totalPassedAll: number;
  overallPassRate: number;
  buildableCount: number;
  testableCount: number;
  ttfhwPassRate: number;
  buildPassRate: number;
}

// 分享汇报页面 — 社区维度统计 (硬编码数据使用)
export interface CommunityStats {
  community: string;
  total: number;
  success: number;
  failed: number;
  partial: number;
  passRate: number;
  avgDuration: number;
}
