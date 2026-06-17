<div align="center">

# Lumin

**A lightweight, high-performance SSH client with modern aesthetics**

Built with Go (Wails) + React 18. Focused on blazing speed, glassmorphism design, and seamless cloud sync.

[![Release](https://img.shields.io/github/v/release/wmwlwmwl/Lumin-SSH?style=flat-square&color=0078D6&label=RELEASE)](https://github.com/wmwlwmwl/Lumin-SSH/releases)
[![Platform](https://img.shields.io/badge/PLATFORM-WINDOWS-0078D6.svg?style=flat-square)](https://github.com/wmwlwmwl/Lumin-SSH/releases)
[![License](https://img.shields.io/badge/LICENSE-MIT-8CBA00.svg?style=flat-square)](LICENSE)

[English](./README_EN.md) · [简体中文](./README.md)

</div>

---

Lumin is more than an SSH client — it's a geek toolchain built for DevOps engineers. We blend system-level performance probes with Glassmorphism design to make every connection both efficient and beautiful.

---

## ✨ Features

- ⚡ **Async PTY Engine**
  - Go-native concurrent I/O on the backend, WebSocket + xterm.js for ultra-low latency.
  - Predictive Local Echo for buttery-smooth typing even on high-latency connections.
- 🎨 **Glassmorphism Design**
  - Dark / Light themes with system-follow auto-switching.
  - Custom accent colors, plus 4 terminal color themes: Lumin Default, Tokyo Night, Catppuccin, Dracula.
  - Custom terminal background wallpaper with adjustable opacity.
  - Frosted glass overlays and micro-animation transitions on all modals.
- 📊 **System Resource Probe**
  - No agent deployment required — auto-mounts monitoring panel on connection.
  - Millisecond-level CPU charts, memory pie, network throughput, disk I/O, and more.
- 📁 **Remote File Manager**
  - Browse, upload, download, delete, rename, and create directories.
  - Built-in code editor for editing remote files directly.
  - Compress / extract (tar.gz / zip) support.
  - Three layout modes: tab, left split, bottom split.
- 📜 **Command History & Quick Commands**
  - Auto-captures remote shell command history with search and replay.
  - Quick command snippets library — send frequently used commands in one click.
- ☁️ **Cloud Sync (WebDAV / R2 / FTP / SFTP)**
  - Supports WebDAV, Cloudflare R2, FTP, and SFTP backends.
  - Every config change is auto-encrypted with AES-256-GCM and snapshotted. One-click restore on any machine.
- 🔒 **Local Encryption**
  - Generates a unique 32-byte key on first run. All passwords, private keys, and credentials are AES-GCM encrypted before hitting disk.
- 🌐 **Smart Ping / Latency**
  - Choose between SSH Banner RTT and TCP Dial protocols.
  - SSH Banner mode penetrates TUN proxies (Clash / V2Ray) to measure real latency.
- 🚀 **Auto Update**
  - Checks GitHub Releases on startup. One-click download and install.
- 📌 **System Tray**
  - Close to tray instead of quitting. Single-instance enforcement.
- ⌨️ **Customizable Shortcuts**
  - Copy, paste, clear, new tab, SIGINT, EOF, and more — all freely rebindable.
- 🌍 **Internationalization**
  - 简体中文 / English.

---

## 🛠️ Build

Requirements: **Go 1.20+** and **Node.js 18+**

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Clone
git clone https://github.com/wmwlwmwl/Lumin-SSH.git
cd Lumin-SSH

# Dev mode (hot reload)
wails dev

# Production build
wails build

# NSIS installer (requires NSIS)
wails build -nsis
```

---

## 📜 License

[MIT License](LICENSE) — Open source is all about having fun. Use it, modify it, enjoy it!