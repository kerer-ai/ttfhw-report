# TorchAir 仓库问题整理

## 一、编译问题

### 1.1 缺失依赖未在文档中列出

| 依赖项 | 说明 | 来源 |
|--------|------|------|
| python3-devel | CMakeLists.txt find_package(Python3) 需要 Python.h | 编译时报错发现 |
| wheel | CMakeLists.txt setup.py bdist_wheel 需要 | 编译时报错发现 |
| gcc/g++ | build.sh 使用 g++ 编译 | README 构建命令未明确列出 |

**问题描述：**
README.md 构建章节（第64-73行）只列出：
```bash
mkdir build
cd build
cmake ..
make torchair -j8
```
未说明需要预先安装 `python3-devel`、`wheel`、`gcc/g++` 等依赖。

**建议：** 在 README 构建章节增加依赖安装说明。

---

### 1.2 PyTorch 安装问题

**问题描述：**
configure.py 第13行要求 `torch >= 2.1`，但 README 中未说明如何安装 PyTorch。

**实际发现的问题：**

1. **CUDA 版本 vs CPU 版本**
   - 执行 `pip install torch` 默认下载带 CUDA 的完整版本（约 2-4 GB）
   - 在无 GPU 环境下应使用 CPU-only 版本
   - 用户容易下载错误版本，浪费时间

2. **官方源下载失败**
   - `https://download.pytorch.org/whl/cpu` 在国内网络可能访问缓慢或失败
   - 需要使用国内镜像源（如清华源 `https://pypi.tuna.tsinghua.edu.cn/simple/`）

3. **国内源缺少 +cpu 版本**
   - 清华源等国内镜像源同步 PyPI 官方包
   - 但 **PyTorch CPU-only 版本不在 PyPI**，而是在 `download.pytorch.org`
   - 直接使用清华源安装 torch 只会得到 CUDA 版本（因为只有 CUDA 版本在 PyPI）

**解决方案：**
```bash
# 方式一：直接使用 PyTorch 官方 CPU 版本（推荐）
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 方式二：使用国内源 + PyTorch 官方 CPU 版本（网络慢时可能失败）
pip install torch -i https://pypi.tuna.tsinghua.edu.cn/simple/ --extra-index-url https://download.pytorch.org/whl/cpu
```

**建议：** 在 README 中增加 PyTorch 安装说明，明确说明：

---

## 二、测试问题

### 2.1 CANN SDK 下载链接未提供

**问题描述：**
- README 多次提到"昇腾软件栈"（第15、33、54、97、149行）
- 文档中要求安装 CANN 但**未提供下载地址**
- CONTRIBUTING.md 第34、41行要求设置 `ASCEND_CUSTOM_PATH` 但未说明如何获取

**影响：**
- UT 测试需要 CANN SDK（CONTRIBUTING.md 第34行）
- 样例程序需要 NPU 环境（README 第97行）
- 无法在纯 CPU 环境验证完整功能

**建议：** 在 README 安装章节增加 CANN SDK 下载链接。

---

## 三、文档缺失汇总

| 序号 | 缺失项 | 影响 | 优先级 |
|------|--------|------|--------|
| 1 | CANN SDK 下载链接 | 无法运行 UT/样例 | 高 |
| 2 | python3-devel 依赖说明 | 新用户可能编译失败 | 高 |
| 3 | wheel 包依赖说明 | 新用户可能编译失败 | 高 |
| 4 | gcc/g++ 依赖说明 | 新用户可能编译失败 | 中 |
| 5 | PyTorch CPU-only 安装说明 | 默认下载 CUDA 版本（2-4GB），浪费时间 | 高 |
| 6 | PyTorch +cpu 版本不在 PyPI 的说明 | 国内源无法安装 CPU 版本 | 高 |
| 7 | 环境变量 ASCEND_SDK_PATH 说明 | 配置不清晰 | 中 |

---

## 四、建议的 README 修改

### 4.1 增加依赖安装章节

建议在 README.md 第13-17行之间增加：

```markdown
### 依赖安装

#### 系统依赖
```shell
# Ubuntu/Debian
apt-get install -y cmake gcc g++ make git python3-dev

# openEuler
dnf install -y cmake gcc-c++ make git python3-devel python3-pip
```

#### Python 依赖

**重要：PyTorch CPU-only 版本不在 PyPI 官方源！**

- PyTorch 默认包在 PyPI（约 2-4 GB，包含 CUDA）
- PyTorch CPU-only 版本在 `download.pytorch.org`（约 200-500 MB）
- 国内镜像源只同步 PyPI，不会包含 CPU-only 版本

```shell
# 安装 PyTorch (CPU-only，适用于无 GPU 环境) - 推荐方式
pip install torch --index-url https://download.pytorch.org/whl/cpu

# 如需指定版本（如 torch 2.1）
pip install torch==2.1.0+cpu --index-url https://download.pytorch.org/whl/cpu

# 安装带 CUDA 版本 (适用于有 GPU 环境)
pip install torch
```

#### 昇腾软件栈 (可选)
如需运行 UT 测试或样例程序，请参考 [昇腾社区](https://www.hiascend.com/) 下载并安装 CANN。
```

---

## 五、相关文件位置

| 文件 | 位置 | 相关内容 |
|------|------|----------|
| README.md | 第13-17行 | 依赖说明位置 |
| README.md | 第64-73行 | 构建命令位置 |
| README.md | 第149-161行 | 版本配套表 |
| CONTRIBUTING.md | 第34、41行 | UT/ST 测试说明 |
| configure.py | 第13行 | PyTorch 版本要求 |
| CMakeLists.txt | 第1行 | cmake 版本要求 |
