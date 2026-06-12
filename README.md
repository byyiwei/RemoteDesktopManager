# RemoteDesktopManager

## 中文介绍

**Windows运维远程桌面管理工具** 是一款专为运维人员打造的 Electron 桌面应用，用于集中、安全、高效地管理多个 Windows RDP 远程桌面连接。

### 核心功能

- **安全密码存储**：基于 Electron `safeStorage` + Windows DPAPI 实现 AES-256-GCM 加密，密码不落地明文
- **一键免密登录**：自动调用 `cmdkey` 注入凭据并启动 `mstsc`，连接结束后自动清理，无需手动输入密码
- **连接集中管理**：支持连接的增删改查、搜索过滤、堡垒机/VPN 标签分类
- **密码查看保护**：查看已保存密码前需验证 Windows 登录密码，30 秒后自动隐藏
- **数据导入导出**：支持加密导出连接列表（基于 passphrase），方便备份与迁移
- **现代化 UI**：基于 React + Ant Design 的卡片式界面，无边框窗口 + 自定义标题栏

### 技术栈

- **Electron 28** + **TypeScript**
- **React 18** + **Ant Design 5**
- **electron-vite**（构建工具）
- **electron-store**（本地数据持久化）

### 适用场景

- 企业 IT 运维人员管理大量 Windows 服务器
- 需要频繁 RDP 登录且对密码安全有要求的团队
- 多客户、多跳板机环境下的连接分类管理

---

## English Introduction

**Windows Remote Desktop Manager** is an Electron-based desktop application designed for IT operations teams to centrally, securely, and efficiently manage multiple Windows RDP connections.

### Key Features

- **Secure Password Storage**: Uses Electron `safeStorage` with Windows DPAPI (AES-256-GCM) to ensure passwords are never stored in plaintext.
- **One-Click Passwordless Login**: Automatically injects credentials via `cmdkey` and launches `mstsc`. Credentials are cleaned up automatically after the session ends.
- **Centralized Connection Management**: Full CRUD support for connections, with search/filter and bastion host / VPN tagging.
- **Password View Protection**: Requires Windows login password verification before revealing saved passwords; auto-hides after 30 seconds.
- **Import & Export**: Export encrypted connection lists (passphrase-based) for backup and migration.
- **Modern UI**: Card-based interface built with React + Ant Design, featuring a frameless window with a custom title bar.

### Tech Stack

- **Electron 28** + **TypeScript**
- **React 18** + **Ant Design 5**
- **electron-vite** (build tool)
- **electron-store** (local data persistence)

### Use Cases

- Enterprise IT admins managing a large fleet of Windows servers
- Teams requiring frequent RDP access with strict password security
- Multi-client, multi-bastion host environments needing organized connection management
