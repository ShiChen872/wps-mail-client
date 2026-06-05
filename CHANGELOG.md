# Changelog

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
