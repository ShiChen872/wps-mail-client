# 上传到 GitHub 并在 Mac 上继续开发

## 一、原则：什么进仓库、什么不进

| 进 GitHub | 不进 GitHub |
|-----------|-------------|
| 源代码、`package.json`、`package-lock.json` | `.env`（真实 Client ID / Secret） |
| `.env.example`（占位符） | `node_modules/`、`out/`、`release/` |
| 文档 | OAuth 登录后的 `tokens.json`、本地 `mail-store.json` |

项目根目录 `.gitignore` 已忽略 `.env` 与上述路径。推送前可用下面命令自查：

```bash
cd wps-mail-client
git status
# 确认列表里没有 .env
git check-ignore -v .env   # 应显示被 .gitignore 匹配
```

若曾误提交过 `.env`，需从 Git 历史中移除后再推送（见文末「补救」）。

---

## 二、在 Windows 上首次推到 GitHub

### 1. 在 GitHub 创建仓库

1. 打开 https://github.com/new  
2. 仓库名例如：`wps-mail-client`  
3. 建议选 **Private**（企业应用凭证虽不在仓库里，代码仍宜私有）  
4. **不要**勾选 “Add a README”（本地已有）  
5. 创建后记下仓库 URL，例如：  
   `https://github.com/你的用户名/wps-mail-client.git`

### 2. 本地初始化并推送

在 PowerShell 或 Git Bash 中（路径按你的实际目录修改）：

```bash
cd d:\Andy\cursor_local_project\wps-mail-client

git init
git add .
git status
# 再次确认：没有 .env、没有 node_modules

git commit -m "Initial commit: WPS Mail client v1.1.0"

git branch -M main
git remote add origin https://github.com/你的用户名/wps-mail-client.git
git push -u origin main
```

首次 `git push` 会提示登录 GitHub，推荐使用 **HTTPS + Personal Access Token**，或 **SSH 密钥**（见 GitHub → Settings → SSH keys）。

### 3. 真实配置放在仓库外保存

把当前机器上的 `.env` 内容存到安全位置（例如 1Password、企业密码库、加密 U 盘），**不要**写进 Issue / README / 聊天截图。

在新 Mac 上只需：

```bash
cp .env.example .env
# 用编辑器填入与 Windows 相同的 WPS_CLIENT_ID、WPS_CLIENT_SECRET 等
```

---

## 三、在新 Mac 上克隆并运行

### 环境准备

```bash
# 安装 Homebrew（若未安装）后：
brew install node@20 git
# 或使用 nvm：https://github.com/nvm-sh/nvm
```

建议 Node **18+** 或 **20 LTS**。

### 克隆与安装

```bash
git clone https://github.com/你的用户名/wps-mail-client.git
cd wps-mail-client

cp .env.example .env
# 编辑 .env，填入与 Windows 相同的凭证

npm install
npm run dev
```

### Mac 上 OAuth 注意点

- 回调地址仍为 `http://127.0.0.1:38473/callback`（与 `.env.example` 一致即可）。  
- WPS 开放平台「授权回调地址」只需配置一次，**同一应用**在 Windows / Mac 上共用。  
- 首次在 Mac 登录会重新走浏览器授权，token 保存在本机 `~/Library/Application Support/wps-mail-client/`（不进 Git）。

### 打包（可选）

```bash
npm run build
npm run dist   # 生成 macOS 安装包（需在 Mac 上执行）
```

---

## 四、两台机器日常协作

```bash
# 下班前（任一台机器）
git add .
git commit -m "描述你的改动"
git push

# 另一台机器开始工作前
git pull
npm install    # 若 package-lock.json 有变化
npm run dev
```

`.env` **不要**用 Git 同步；每台机器各自维护一份，内容保持一致即可。

---

## 五、可选增强

| 做法 | 说明 |
|------|------|
| **Private 仓库** | 默认推荐 |
| **GitHub Codespaces** | 云端开发；密钥用 Codespaces Secrets，仍不要提交 `.env` |
| **.env.local + gitignore** | 已用 `.env` + `.env.example` 模式，无需改 |
| **git-crypt** | 团队加密部分文件；个人项目通常不必 |

---

## 六、误提交 `.env` 时的补救

若 `.env` 曾被 `git add` 并 push：

```bash
# 从跟踪中移除（保留本地文件）
git rm --cached .env
git commit -m "Stop tracking .env"
git push

# 若已推送含密钥的提交：在 WPS 开放平台轮换 Client Secret，并考虑 BFG / git filter-repo 清历史
```

轮换密钥后，更新各机器上的 `.env` 与开放平台配置。

---

*文档版本：2026-06-01*
