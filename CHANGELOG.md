# Changelog

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
