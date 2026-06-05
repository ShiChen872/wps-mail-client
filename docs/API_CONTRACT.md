# WPS 365 邮件 API 契约（MVP）

本客户端通过 **用户授权（delegated）** 调用 `https://openapi.wps.cn`，与 [wps-docs-scraper](../../wps-docs-scraper/output/WPS-365-App/server/email/) 文档一致。

## 已接入端点

| 操作 | 方法 | 路径 | Scope |
|------|------|------|-------|
| 邮箱列表 | GET | `/v7/mailboxes` | `kso.mailbox.read` |
| 文件夹 | GET | `/v7/mailboxes/{id}/folders` | `kso.mailbox.read` |
| 邮件列表 | GET | `/v7/mailboxes/{id}/folders/{folder}/messages` | `kso.mail.read` |

**注意**：`page_size` 实测最大 **10**，超过会返回 `请求参数取值无效`。
| 邮件详情 | GET | `/v7/mailboxes/{id}/folders/{folder}/messages/{msg}` | `kso.mail.read` |
| 搜索 | GET | `/v7/mail_messages/search` | `kso.mail.read` |
| 创建草稿 | POST | `/v7/mailboxes/{id}/messages/create` | `kso.mail.readwrite` |
| 发送 | POST | `/v7/mailboxes/{id}/messages/{msg}/send` | `kso.mail.readwrite` |
| 附件上传 | — | 实测 `attachments/create` 等为 **404** | 客户端对 **图片** 改为 data URI 嵌入正文；其他类型请用 Web 邮箱 |
| 附件 URL | GET | `/v7/mailboxes/{id}/messages/{msg}/attachments/{att}/download_url` | `kso.mail.read` |
| 当前用户 | GET | `/v7/users/current` | `kso.user_base.read` |
| 更新邮件 | POST | `/v7/mailboxes/{id}/folders/{folder}/messages/{msg}/update` | `kso.mail.readwrite` |
| 删除邮件 | POST | `/v7/mailboxes/{id}/folders/{folder}/messages/{msg}/delete` | `kso.mail.readwrite` |
| 移动邮件 | POST | `/v7/mailboxes/{id}/folders/{folder}/messages/{msg}/move` | `kso.mail.readwrite` |
| 邮箱联系人 | GET | `/v7/mail_contacts` | `kso.mail_contact.read`（应用授权） |

系统文件夹 ID：`inbox`、`drafts`、`sent`、`junk`、`trash`。

## OAuth

| 步骤 | URL |
|------|-----|
| 授权 | `GET https://openapi.wps.cn/oauth2/auth` |
| 换 token / 刷新 | `POST https://openapi.wps.cn/oauth2/token` |

## 探查结论（update/delete/move）

V1.1 已按开放平台常见路径接入 `update` / `delete` / `move`（见上表）。若返回 4xx，客户端会**仍更新本地 JSON 缓存**并提示用户以 Web 邮箱为准。建议在 API Explorer 用真实邮件 ID 复核后再收紧错误处理。

## 本地验证

```bash
cd wps-mail-client
cp .env.example .env
# 填写凭证后
npm install
npm run dev
```

也可使用官方 CLI（需配置 `WPS365_CLIENT_ID` 等）：

```bash
wps365-cli api get "/v7/mailboxes"
wps365-cli api get "/v7/mailboxes/{mailbox_id}/folders/inbox/messages?page_size=5"
```
