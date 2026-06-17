<div align="center">

# Lumin

**一个轻量级、高性能的现代化 SSH 客户端**

基于 Go (Wails) + React 18 构建，追求极致的响应速度、玻璃拟态美学与多端数据漫游。

[![Release](https://img.shields.io/github/v/release/wmwlwmwl/Lumin-SSH?style=flat-square&color=0078D6&label=RELEASE)](https://github.com/wmwlwmwl/Lumin-SSH/releases)
[![Platform](https://img.shields.io/badge/PLATFORM-WINDOWS-0078D6.svg?style=flat-square)](https://github.com/wmwlwmwl/Lumin-SSH/releases)
[![License](https://img.shields.io/badge/LICENSE-MIT-8CBA00.svg?style=flat-square)](LICENSE)

[English](./README_EN.md) · [简体中文](./README.md)

</div>

<div align="center">
  <br/>
  <img src="assets/pc_empty_main.png" alt="Lumin 主面板" width="800" />
</div>

---

Lumin 不只是一个 SSH 客户端，它是一套为运维工程师打造的极客工具链。我们将系统级高性能探针与 Glassmorphism（玻璃拟态）设计语言融合，让每一次连接都兼具效率与美感。

<div align="center">
  <br/>
  <img src="assets/pc_connected_session.png" alt="Lumin 终端与资源监控" width="800" />
</div>

## ✨ 核心特性

- ⚡ **原生级全异步 PTY 引擎**
  - 后端基于 Go 原生并发处理 I/O，前端采用 `WebSocket` 与 `xterm.js` 构建极低延迟通道。
  - 支持 **预测本地回显 (Predictive Local Echo)** 机制，即便在高延迟网络下也能提供丝滑输入体验。
- 🎨 **Glassmorphism 玻璃拟态美学**
  - 深色/浅色双主题，支持跟随系统自动切换。
  - 自定义强调色，可选 Lumin Default、Tokyo Night、Catppuccin、Dracula 四套终端配色。
  - 支持自定义终端底栏壁纸，可调节透明度。
  - 所有弹窗均附带毛玻璃遮罩与微动效过渡。
- 📊 **系统级资源探针**
  - 无需额外部署 Agent，直连后自动挂载监控面板。
  - 毫秒级刷新 CPU 曲线、内存饼图、网络吞吐、磁盘 I/O 等指标。
- 📁 **远程文件管理器**
  - 支持文件浏览、上传、下载、删除、重命名、新建目录。
  - 内置代码编辑器，可直接编辑远程文件。
  - 支持压缩/解压（tar.gz / zip）。
  - 支持标签页、左侧分屏、底部分屏三种布局模式。
- 📜 **命令历史与快捷指令**
  - 自动捕获远程 Shell 命令历史，支持搜索与回放。
  - 快捷指令片段库，一键发送常用命令。
- ☁️ **全时无缝云端漫游 (WebDAV / R2 / FTP / SFTP)**
  - 支持 WebDAV、Cloudflare R2、FTP、SFTP 四种云存储后端。
  - 每次配置变更自动 AES-256-GCM 加密快照，多端一键恢复。
- 🔒 **本地高强度加密**
  - 首次运行自动生成 32 字节随机密钥，所有密码、私钥、WebDAV 凭据均经 AES-GCM 加密后落盘。
- 🌐 **智能延迟检测**
  - 支持 SSH Banner RTT 和 TCP Dial 两种协议。
  - SSH Banner 模式可穿透 TUN 代理（Clash / V2Ray）测出真实延迟。
- 🚀 **自动更新**
  - 启动时检测 GitHub Release 最新版本，支持一键下载安装。
- 📌 **系统托盘驻留**
  - 关闭窗口最小化至托盘，防止误关。
  - 单实例保护，重复启动自动唤起已有窗口。
- ⌨️ **可自定义快捷键**
  - 复制、粘贴、清屏、新建标签页、SIGINT、EOF 等均支持自由绑定。
- 🌍 **国际化**
  - 支持简体中文 / English 切换。

---

## 🛠️ 构建指南

环境要求：**Go 1.20+** 与 **Node.js 18+**

```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 克隆仓库
git clone https://github.com/wmwlwmwl/Lumin-SSH.git
cd Lumin-SSH

# 开发模式（热重载）
wails dev

# 生产构建
wails build

# 构建 NSIS 安装包（需安装 NSIS）
wails build -nsis
```

---

## 📜 许可证

本项目遵循 [MIT License](LICENSE) 协议开源。