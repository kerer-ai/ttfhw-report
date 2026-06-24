---
name: ttfhw-pipeline
description: |
  Use when user wants to fully verify a single repository end-to-end: run
  verification, normalize the report, rebuild the dashboard, and push to
  GitHub Pages. Trigger on phrases like "完整验证XXX仓库", "跑一遍XXX的验证流水线",
  "verify and deploy XXX", "完整跑一遍XXX", or user provides a Git URL
  and asks to run the full pipeline.
---

# TTFHW 单仓库完整验证流水线

串联验证 → 归一化 → 构建 → 推送四阶段，一键完成单仓库的端到端验证。

## 参数

用户必须提供仓库 URL，格式如：
- `https://gitcode.com/openeuler/stratovirt.git`
- `https://github.com/Ascend/pytorch.git`

## 工作流程

### 步骤 1：提取仓库名并清理旧数据

从 URL 提取仓库名（URL 末尾路径段去掉 `.git`）：
```
https://gitcode.com/cann/amct.git → amct
https://github.com/Ascend/pytorch → pytorch
```

用仓库名匹配 `json-org-630/` 和 `json/` 中所有同名仓库的旧文件，**全部删除**：

```bash
# 删除旧原始数据
rm -f json-org-630/verification_report_*_<repo-name>_*.json
rm -f json-org-630/verification_report_WSL_<repo-name>_*.json

# 删除旧归一化数据
rm -f json/verification_report_*_<repo-name>_*.json
rm -f json/verification_report_WSL_<repo-name>_*.json
```

### 步骤 2：仓库验证

调用 `ttfhw-verify-pro` 技能执行仓库验证，传入用户提供的仓库 URL。

验证完成后，检查 `json-org-630/` 中是否生成了新的原始 JSON 文件。文件名格式为 `verification_report_WSL_<repo>_<YYYYMMDD>.json`。

如果验证未生成文件，终止流程并报告原因。

### 步骤 3：报告归一化

使用单文件归一化模式处理刚生成的文件：

调用 `ttfhw-report-normalizer` 技能，传入步骤 2 生成的 JSON 文件名。

归一化后验证：
```bash
python3 -c "
import json
with open('json/<filename>', 'r') as f:
    data = json.load(f)
for k in ['metadata','machine_spec','document_reading_summary','execution_log','process_timeline','final_results','documentation_gaps','problems_encountered','session_export_file']:
    assert k in data, f'Missing: {k}'
for sub in ['build','ut','sample']:
    assert sub in data['final_results']
ru = data['metadata'].get('repo_url','')
assert ru == '' or ru.startswith('http'), f'bad repo_url: {ru}'
print('VALIDATED')
"
```

### 步骤 4：清理重建

```bash
rm -rf .next out docs
npm run build
mv out docs
touch docs/.nojekyll
```

### 步骤 5：提交并推送

```bash
git add json-org-630/ json/ docs/
git commit -m "pipeline: verify <repo-name> and rebuild dashboard

- Verify <repo-name> from <repo-url>
- Normalize and rebuild static pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push github v6
```

### 步骤 6：输出摘要

报告各阶段结果：

```
╔══════════════════════════════════════╗
║     TTFHW Pipeline Complete          ║
╠══════════════════════════════════════╣
║ Repo:     <repo-name>               ║
║ URL:      <repo-url>                ║
║ Verify:   <status>                  ║
║ Build:    <build-status>            ║
║ UT:       <ut-status>               ║
║ Sample:   <sample-status>           ║
║ Page:     /ttfhw-report/<route>     ║
╚══════════════════════════════════════╝
```

## 仓库名到页面路由的映射

- 大多数仓库：`WSL_<repo-name>`（如 `WSL_driver`）
- openEuler 前缀的仓库：保持 `openEuler_<repo-name>`（如 `openEuler_MindIE-LLM`）
- 无前缀的特殊仓库：直接用 `repo-name`（如 `hmpi`、`hucx`）

从 `json-org-630/` 生成的文件名确定路由前缀。

## 安全约束

- ⚠️ 步骤 1 删除旧数据前先列出待删文件，等待用户确认
- ⚠️ 步骤 5 推送前确认 commit 内容正确
- ⚠️ 不删除不相关的仓库数据
