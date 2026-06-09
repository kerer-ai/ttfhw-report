# openEuler 项目验证报告汇总

> 生成时间：2026-06-09
> 数据来源：json-org-openeuler/ 目录下 62 个 JSON 验证报告

---

## 一、汇总统计

| 指标 | 数值 |
|------|------|
| 总项目数 | 62 |
| 构建成功 | 49 |
| 构建部分成功 (partial_success / success_with_workarounds / success_with_modifications) | 6 |
| 构建失败 | 2 |
| 构建状态未知/空 | 5 |
| UT 全部通过 | 20 |
| UT 部分通过 | 8 |
| UT 跳过/不可运行 | 28 |
| 样例成功 | 5 |
| 样例部分成功 | 3 |

### 构建状态分布

| 构建状态 | 项目数 | 占比 |
|---------|--------|------|
| success | 49 | 79.0% |
| partial_success | 4 | 6.5% |
| success_with_workarounds | 1 | 1.6% |
| success_with_modifications | 1 | 1.6% |
| failed | 2 | 3.2% |
| 未知/空 | 5 | 8.1% |

### UT 状态分布

| UT 状态 | 项目数 | 占比 |
|---------|--------|------|
| success | 20 | 32.3% |
| partial_success / partial / partial_pass | 8 | 12.9% |
| skipped / not_runnable / compile_success | 28 | 45.2% |
| 未知/空 | 6 | 9.7% |

### 常见问题 Top 10

| 排名 | 问题描述 | 涉及项目数 |
|------|---------|-----------|
| 1 | openEuler 官方镜像源网络超时 / SSL 连接失败 | ~20 |
| 2 | 缺少 CANN Toolkit / NPU 硬件无法运行测试和样例 | ~15 |
| 3 | HPCKit 不可获取（需华为鲲鹏开发者账号） | 5 |
| 4 | Windows 换行符 (CRLF) 导致 shell 脚本执行失败 | 5 |
| 5 | Docker 卷挂载在 Windows 环境下路径解析失败 | 4 |
| 6 | pip/PyPI 官方源下载超时 | 4 |
| 7 | 缺少系统头文件或开发库 | 4 |
| 8 | GCC 版本不支持特定 ARM 架构指令集 (-march=armv9.x) | 3 |
| 9 | 缺少 pip 命令（openEuler 基础镜像未预装） | 3 |
| 10 | googletest / mockcpp 等测试框架安装问题 | 3 |

### 最常见特殊依赖

| 特殊依赖 | 涉及项目数 |
|---------|-----------|
| CANN Toolkit | ~30+ |
| HPCKit | 5 (HMPI, KUPL, KuDNN, KuQCD, KuTACC) |
| torch_npu | ~8 |
| googletest | ~5 |
| BiSheng 编译器 | 2 (KuQCD, KUPL) |

---

## 二、详细表格

| # | 项目名称 | 架构 | 验证环境 | 镜像 | 构建状态 | 构建耗时(s) | 构建产物 | 失败组件 | UT状态 | UT总数/通过/失败/跳过 | 样例状态 | 总耗时(s) | 特殊依赖 | 问题数 | 文档缺失数 |
|---|---------|------|---------|------|---------|------------|---------|---------|--------|----------------------|---------|---------|---------|--------|-----------|
| 1 | ubs-comm | aarch64 (Kunpeng) | Remote ECS aarch64 (openEuler 22.03 LTS) | openEuler 22.03 LTS (ECS native) | success | 408 | libhcom.so.0.0.1, libhcom_static.a, hcom_ut | - | success | 940/940/0/- | skipped | 2700 | googletest 1.12.1, mockcpp v2.7 | 7 | 5 |
| 2 | A-Tune | x86_64 | WSL2 Docker (openEuler 24.03 LTS container) | hub.oepkgs.net/openeuler/openeuler:24.03-lts | partial_success | 180 | atune-adm, atuned, daemon_profile_server.so | db | skipped | 22/0/0/22 | skipped | 548 | - | 5 | 8 |
| 3 | Ascend-pytorch | x86_64 / aarch64 | - | - | success | 1928 | torch_npu wheel, libtorch_npu.so, libtensorpipe.so, libop_plugin_atb.so, libnpu_profiler.so | - | skipped | 0/0/0/- | skipped | 10320 | CANN, op-plugin, hccl | 6 | 6 |
| 4 | HMPI | AArch64 (鲲鹏920) | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 5400 | libmpi.so.40.30.6, mpirun, mpiexec, orted, ompi_info, libucg.so, libucs.so, MCA components | - | partial | 2/2/0/- | partial | 8760 | HPCKit | 8 | 9 |
| 5 | KUPL | AArch64 (鲲鹏920) | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts (arm64) | success_with_workarounds | 46 | libkupl.so.1.26.1.RC1, kupl.h, kupl_mma.h, 72 internal headers | - | partial_success | -/-/-/- | not_applicable | 4500 | HPCKit | 6 | 8 |
| 6 | KuDNN | ARM aarch64 (鲲鹏920) | openEuler 24.03 LTS aarch64 (QEMU) | hub.oepkgs.net/openeuler/openeuler:24.03-lts | failed | 0 | - | - | skipped | 0/0/0/- | skipped | 660 | HPCKit, KUPL, KML BLAS, googletest | 5 | 7 |
| 7 | KuQCD | ARM aarch64 (鲲鹏920) | openEuler 24.03 LTS aarch64 (QEMU) | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success_with_modifications | 74 | libkuqcd.so | - | success | 1/1/0/- | not_applicable | 3420 | HPCKit, KUPL, HMPI, BiSheng | 7 | 7 |
| 8 | KuTACC | 鲲鹏920 AArch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 74 | libkutacc.so.1.26.1.RC1, kutacc.h | - | success | 56/56/0/- | not_available | 6900 | HPCKit_26.0.RC1 | 7 | 10 |
| 9 | MindIE-LLM | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | libfoundation.so, libsystem_log.so, libmindie_grpc.a, libmindie_protobuf.a, libpd_grpc_proto_file.a | - | skipped | 0/0/0/- | skipped | 33780 | CANN, torch_npu, MindIE-LLM whl | 10 | 6 |
| 10 | MindIE-Motor | x86_64, aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | partial_success | 2400 | http_client_ctl, http_client_ctl.json, third_party_libs | - | skipped | 0/0/0/- | skipped | 6600 | CANN Toolkit, torch, grpc | 8 | 5 |
| 11 | MindIE-PyMotor | 未明确(Python项目) | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 5.5 | motor-0.1.0-py3-none-any.whl | - | success | 1315/1315/0/0 | skipped | 4800 | - | 7 | 4 |
| 12 | MindIE-SD (0602) | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | failed | 1 | - | - | partial_success | 38/34/0/0 | skipped | 5760 | CANN Toolkit 8.5.1, torch/torch_npu, mindiesd | 8 | 10 |
| 13 | MindIE-SD (0604) | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | partial_success | 300 | mindiesd-1.0.0-py3-none-any.whl | - | partial_success | 38/34/0/0 | skipped | 8640 | CANN Toolkit, torch, torch_npu | 6 | 7 |
| 14 | MindSpeed-LLM | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | mindspeed_llm-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 10800 | CANN, torch_npu, MindIE | 7 | 4 |
| 15 | MindSpeed-MM | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | mindspeed_mm-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 10800 | CANN, torch_npu, MindIE | 5 | 5 |
| 16 | MindSpeed | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | mindspeed-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 7200 | CANN, torch_npu | 5 | 4 |
| 17 | OmniStateStore | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 8 | omnistatestore-1.0.0-py3-none-any.whl | - | success | 6/6/0/0 | skipped | 5400 | - | 5 | 4 |
| 18 | XUCG | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | libucs.so, libucg.so, libxucg.so, xucg.h | - | success | 2/2/0/- | not_applicable | 3600 | HPCKit | 6 | 5 |
| 19 | amct | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | amct_cann-0.1.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 5400 | CANN | 5 | 4 |
| 20 | asc-devkit | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | ascend_devkit-0.1.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 21 | asc-tools | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | ascend_tools-0.1.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 22 | atvoss | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | libatvoss.so, atvoss.h | - | success | 100/100/0/- | not_applicable | 5400 | - | 5 | 5 |
| 23 | bishengjdk-8 | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | bishengjdk-8 RPM | - | success | 4/4/0/- | success | 3600 | - | 5 | 4 |
| 24 | component_drivers | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | driver RPM包 | - | skipped | 0/0/0/- | skipped | 5400 | CANN, NPU驱动 | 5 | 4 |
| 25 | devmon | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | devmon-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 26 | driver | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | driver RPM包 | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 27 | ge | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | libge_runner.so, libge_common.so | - | success | 100/100/0/- | skipped | 5400 | CANN | 5 | 4 |
| 28 | graph-autofusion | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | libgraph_autofusion.so | - | success | 50/50/0/- | not_applicable | 3600 | CANN | 4 | 3 |
| 29 | ham | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | ham-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 30 | hccl | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 720 | cann-hccl_9.1.0_linux-x86_64.run, libhccl.so, libhccl_compat.so, AIV kernel objects | - | success | 1/1/0/- | partial | 4200 | CANN Toolkit 9.1.0, makeself, googletest, cann-cmake | 7 | 6 |
| 31 | hcomm | aarch64 (Kunpeng) | Remote ECS aarch64 (openEuler 22.03 LTS) | openEuler 22.03 LTS (ECS native) | success | 408 | libhcom.so.0.0.1, libhcom_static.a, hcom_ut | - | success | 940/940/0/- | skipped | 2700 | googletest, mockcpp | 7 | 5 |
| 32 | hixl | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | libhixl.so, hixl.h | - | success | 50/50/0/- | not_applicable | 3600 | CANN | 4 | 3 |
| 33 | hucx | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | libhucx.so, hucx.h | - | success | 50/50/0/- | not_applicable | 3600 | CANN | 4 | 3 |
| 34 | iSulad | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | iSulad RPM包 | - | success | 100/100/0/- | success | 3600 | - | 5 | 4 |
| 35 | kernel | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | kernel RPM包 | - | skipped | 0/0/0/- | skipped | 3600 | - | 4 | 3 |
| 36 | kunpeng-extension-for-pytorch | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | kunpeng_extension_for_pytorch-0.1.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN, torch_npu | 4 | 3 |
| 37 | libipmi | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | libipmi.so, libipmi.h | - | success | 50/50/0/- | not_applicable | 3600 | - | 4 | 3 |
| 38 | libmcpp | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | libmcpp.so, mcpp.h | - | success | 50/50/0/- | not_applicable | 3600 | - | 4 | 3 |
| 39 | manifest | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | manifest-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 40 | memcache | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | libmemcache.so, memcache.h | - | success | 50/50/0/- | not_applicable | 3600 | - | 4 | 3 |
| 41 | memfabric-hybrid | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 120 | libmemfabric.so, memfabric.h | - | success | 50/50/0/- | not_applicable | 3600 | - | 4 | 3 |
| 42 | metadef | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | partial_success | 600 | libmetadef.so, metadef.h | metadef_ops | partial_success | 100/80/20/- | skipped | 5400 | CANN, googletest | 6 | 5 |
| 43 | oam-tools | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 60 | oam-tools-1.0.0-py3-none-any.whl | - | skipped | 0/0/0/- | skipped | 3600 | CANN | 4 | 3 |
| 44 | op-plugin | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | libop_plugin.so, op_plugin.h | - | success | 50/50/0/- | skipped | 5400 | CANN | 5 | 4 |
| 45 | opbase | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 300 | libopbase.so, opbase.h | - | success | 50/50/0/- | not_applicable | 3600 | CANN | 4 | 3 |
| 46 | ops-cv | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | cann-ops-cv-custom_linux-x86_64.run, libcust_opapi.so | - | compile_success | 0/0/0/- | skipped | 2400 | CANN toolkit | 4 | 3 |
| 47 | ops-math | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | cann-ops-math-custom_linux-x86_64.run, libcust_opapi.so | - | compile_success | 0/0/0/- | skipped | 2400 | CANN toolkit | 4 | 3 |
| 48 | ops-nn | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | cann-ops-nn-custom_linux-x86_64.run, libcust_opapi.so | - | compile_success | 0/0/0/- | skipped | 2400 | CANN toolkit | 4 | 3 |
| 49 | ops-transformer | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 600 | cann-ops-transformer-custom_linux-x86_64.run, libcust_opapi.so | - | compile_success | 0/0/0/- | skipped | 2400 | CANN toolkit | 4 | 3 |
| 50 | pto-isa | x86_64 / AArch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 45 | CPU ST test binaries | - | success | 138/138/0/- | success | 900 | - | 2 | 0 |
| 51 | pyasc | aarch64/x86_64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 297 | libpyasc.cpython-311-x86_64-linux-gnu.so, libMLIRAsc.a, ascir-tblgen | - | partial_pass | 306/19/286/1 | skipped | 6193 | LLVM 19.1.7, CANN, PyTorch 2.7.1, torch_npu | 6 | 3 |
| 52 | pypto | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 242 | libtile_fwk_*.so, pypto_impl.cpython-311-x86_64-linux-gnu.so, pypto-0.2.1.whl | - | partial | 290/68/13/- | success | 2520 | CANN toolkit, CANN ops, pto-isa, NPU驱动 | 6 | 6 |
| 53 | runtime | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 675 | cann-npu-runtime_9.0.0_linux-x86_64.run | - | success | 1042/1042/0/- | skipped | 1800 | CANN toolkit, CANN ops包 | 1 | 3 |
| 54 | shmem | x86_64, aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 839 | libshmem.so, libshmem_utils.so, SHMEM_1.0.0_linux-x86_64.run | - | partial | 595/3/0/1 | partial | 9000 | - | 6 | 4 |
| 55 | stratovirt | - | - | - | - | - | - | - | - | -/-/-/- | - | - | - | 0 | 0 |
| 56 | torchair | x86_64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 1.3 | torchair-0.1-py3-none-any.whl, _torchair.so, _npu_graph_executor.so | - | not_runnable | 0/0/0/- | not_runnable | 86400 | CANN, torch_npu | 7 | 8 |
| 57 | ubs-engine | aarch64/x86_64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 365 | ubse, ubsectl, libmempooling.so, libprocess_mem.so, libstrategy.so, libubs-virt-agent.so, libubse-client.so, libucache_plugin.so | - | success | 5516/5422/0/94 | success | 5100 | ubs-comm-devel | 3 | 3 |
| 58 | ubs-io | x86_64, aarch64 | - | - | success | 480 | libbio_sdk.so, libbio_server.so, bio_daemon, libock_interceptor.so, libock_iofwd_proxy.so | - | success | 326/326/0/- | skipped | 1680 | libboundscheck, ubs-comm, spdlog, googletest, mockcpp | 6 | 5 |
| 59 | ubs-mem | x86_64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | partial_success | 94 | libubsmd.so, libubsm_sdk.so | - | partial_success | 752/716/13/23 | not_available | 3600 | hcom (ubs-comm-lib) | 6 | 4 |
| 60 | ubs-virt | aarch64 / x86_64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | - | vas_daemon, vasctl, ubs-virt-ovs, ubs-opt, ubs-opt-guard, ubs-opt-tuner, ubs-optimizer RPM | - | partial_success | -/-/-/- | skipped | 1560 | CANN | 4 | 3 |
| 61 | ubturbo | x86_64 / aarch64 | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 7 | ub_turbo_exec, libubturbo_client.so, librmrs_ubturbo_plugin.so | - | partial_success | 444/444/0/- | expected_failure | 1320 | libboundscheck, libvirt-devel, SMAP | 5 | 7 |
| 62 | webui | 未指定(前端项目) | - | hub.oepkgs.net/openeuler/openeuler:24.03-lts | success | 22 | dist/, server_model.bin, vendor.8895674d.js.gz | - | partial_success | 211/210/1/- | not_applicable | 5400 | @computing/opendesign-icons, @computing/opendesign2 | 6 | 5 |
