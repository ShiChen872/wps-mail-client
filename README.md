# WPS Mail — WPS 365 轻量本地邮件客户端

面向 **WPS 365 公网邮箱** 的 Windows 桌面客户端（Electron），用 OAuth + OpenAPI 替代 Outlook 日常收发，无需 IMAP/SMTP 配置。

## 功能

**当前版本：1.4.2**（V1.4 已完成，详见 [CHANGELOG.md](CHANGELOG.md)）

- WPS 账号 OAuth 登录（主进程保管 token，支持刷新）
- 系统文件夹 + **自定义文件夹**侧栏；**会话 thread 折叠**（同主题分组）
- 读信（HTML 正文）、**打开自动标已读**、附件另存为
- 写邮件、**富文本**、**保存草稿**、**从云文档选择插入链接**（类 OWA OneDrive）、小图嵌入、**回复 / 转发**、**BCC**、联系人联想
- 读信正文**链接可点击**、隔离审批邮件快捷引导
- 可选 **`.env` 签名**（`WPS_MAIL_SIGNATURE`）
- 关键字 + **高级搜索**（主题 / 发件人 / 正文）
- **加载更多**、文件夹未读数、**删除 / 移动 / 标已读**
- **在浏览器中打开** Web 邮箱
- JSON 本地缓存（`userData/wps-mail-data`）+ 启动先展示缓存
- 系统托盘、新邮件轮询通知（约 2 分钟）
- **快捷键**、**深色模式**、**公共邮箱发信身份**选择

## 前置条件

1. WPS 365 企业已开通邮箱席位  
2. [WPS 开放平台](https://open.wps.cn) 创建 **企业自建应用**  
3. 权限勾选：`kso.user_base.read`、`kso.mailbox.read`、`kso.mail.read`、`kso.mail.readwrite`  
4. 用户授权回调：`http://127.0.0.1:38473/callback`

## 快速开始

```bash
cd wps-mail-client
cp .env.example .env
# 编辑 .env 填入 WPS_CLIENT_ID、WPS_CLIENT_SECRET

npm install
npm run dev
```

## GitHub 与多机开发

- 仓库内仅提交 `.env.example`，**切勿**提交 `.env`（已在 `.gitignore` 中忽略）。
- 上传 GitHub、在新 Mac 上克隆与同步的完整步骤见 [docs/GITHUB_AND_MAC.md](docs/GITHUB_AND_MAC.md)。

## 打包（Windows）

```bash
npm run dist
```

产物在 `release/`（NSIS 安装包与 portable）。

## 项目结构

```
wps-mail-client/
  electron/main/     # OAuth、本地缓存、IPC、托盘
  electron/preload/
  packages/mail-api/ # OpenAPI 封装
  src/               # React UI
  docs/API_CONTRACT.md
```

## 与「微软邮箱替换」

- **员工侧**：本客户端对应 Outlook 桌面收发场景。  
- **管理员侧**：Exchange 搬家请使用 WPS 管理后台或 `mail_migration` OpenAPI，不在本客户端内实现。

详见工作区计划文档与 `docs/API_CONTRACT.md`。
