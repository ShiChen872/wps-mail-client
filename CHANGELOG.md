# Changelog

## [1.4.2] — 2026-06-10

### 公共邮箱发信身份

- 写信时可选择发件身份（主邮箱 / 公共邮箱），与阅读邮箱独立
- 顶栏邮箱切换标注 `(公共)`

### 快捷键

- `N` 新邮件、`R` / `Shift+R` 回复、`F` 转发、`Delete` 删除、`U` 标未读、`/` 聚焦搜索、`Esc` 关闭
- 工具栏与侧栏「快捷键」帮助表

### 深色模式

- 浅色 / 深色 / 跟随系统三态切换，偏好写入 localStorage

## [1.4.1] — 2026-06-10

### 会话 thread 视图

- 列表按 `thread_id` 分组折叠，同主题多封显示为一条（含数量角标）
- 展开/折叠会话，子邮件缩进列表
- 读信区显示「此会话共 N 封」及上一封/下一封导航
- 搜索模式保持扁平列表

### 保存草稿（V1.4）

- 写信「保存草稿」按钮（仅 createDraft，不发送）
- 草稿箱「继续编辑」，再次保存时替换旧草稿

## [1.3.2] — 2026-06-10

### 写信体验

- **添加文件** 统一入口：小图（≤2MB）自动嵌入正文，其他文件自动上传云文档并插入分享链
- 保留 **从云文档选择** 独立入口（已有文件）
- 富文本 **插入链接** 改为内联对话框（替代 `window.prompt`）
- 写信面板布局优化（字段区可滚动、图片预览尺寸限制）

## [1.3.1] — 2026-06-08

### 云文档链接（V1.3 修正）

- **从已有云文档选择**（最近 / 我的云文档 / 搜索），对齐 [365.kdocs.cn/latest](https://365.kdocs.cn/latest)，不再走本地上传
- 云文档 API：`drive_latest/items`、文件夹浏览、文件搜索
- 写信「云文档链接」打开选择器弹窗

### 读信体验

- 新增 `MailBodyReader`：正文链接可点击，用系统浏览器打开
- 云文档分享链、纯文本 URL 自动识别；正文下方「打开链接」快捷按钮
- 修复点击邮件后仍显示未读（列表样式 + 收件箱角标同步更新）

### 系统邮件 / 隔离审批

- 识别 WPS 隔离审批通知（`data-protact-rule-button`）
- Web 邮箱页面：`https://365.kdocs.cn/email/`；后端 API：`https://email.wps.cn`
- 审批按钮快捷入口 + 打开 365 邮箱引导

### 配置

- `WPS_WEB_MAIL_URL` 默认改为 `https://365.kdocs.cn/email/`
- 新增 `WPS_WEB_MAIL_API_BASE`（默认 `https://email.wps.cn`）
- OAuth scope 配置防呆（修正重复 `WPS_OAUTH_SCOPES=` 前缀）

## [1.3.0] — 2026-06-04

### 新增

- **云文档链接附件**（类 OWA OneDrive）：上传至「我的云文档 / WPS Mail / 附件」→ 开启分享 → 自动插入正文链接
- 写信按钮：**云文档链接** / **嵌入图片** 分工
- 云文档 API 封装（`packages/mail-api/src/yundoc.ts`）

### 配置

- 默认 OAuth scope 增加 `kso.drive.readwrite`、`kso.file.readwrite`、`kso.file_link.readwrite`（**需重新登录**）
- 可选：`WPS_CLOUD_LINK_SCOPE`、`WPS_CLOUD_LINK_ROLE_ID`、`WPS_CLOUD_LINK_EXPIRE_DAYS`

详见 [docs/V1.3.md](docs/V1.3.md)。

## [1.2.0] — 2026-06-04

### 新增（P0）

- **富文本写信**：加粗/斜体/下划线/列表/链接，HTML 正文（`body_version: v2`）
- **附件上传发送**：创建草稿后上传附件再发送（多路径 API 尝试 + multipart 兜底）
- **可选纯文本模式**：写信面板可切换
- **签名**：`.env` 中 `WPS_MAIL_SIGNATURE` 自动追加到正文

### 说明

- 邮件附件上传接口未在 scrape 文档中；若上传失败会提示使用 Web 邮箱或在 API Explorer 确认路径。

## [1.1.0] — 2026-06-01

### 新增

- 回复、全部回复、转发（基于创建草稿 + 引用原文）
- 密送（BCC）与写信联系人联想（缓存往来邮箱；若开通 `kso.mail_contact.read` 则合并企业联系人）
- 自定义文件夹侧栏（`GET /v7/mailboxes/{id}/folders`）
- 列表「加载更多」（`page_token` 分页）
- 文件夹未读数展示（API `unread_message_count` + 本地收件箱缓存）
- 高级搜索 UI（主题 / 发件人 / 正文 / 关键字）
- 读信自动标已读；手动标已读/未读、删除、移动到其他文件夹
- 工具栏「在浏览器中打开」Web 邮箱（`WPS_WEB_MAIL_URL`，默认 https://mail.wps.cn）

### 说明

- 标记已读/删除/移动调用 `.../messages/{id}/update|delete|move`（开放平台常见路径）；若服务端未开放，会**先更新本地缓存**并提示，请以 Web 邮箱为准。
- 企业通讯录 API 需**应用授权** scope，用户 OAuth 下可能仅使用本地联想。

## [0.1.0] — MVP

- OAuth 登录、五系统文件夹、读写信、搜索、附件下载、JSON 缓存、托盘轮询
