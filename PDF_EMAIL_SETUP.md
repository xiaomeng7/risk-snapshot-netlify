# 邮件发送配置（Resend）

- **PDF 发送**：结果页「发送到邮箱」通过 `send-pdf` 把《投资房电气风险自查指南》发到用户邮箱。
- **预约提交**：「预约 15 分钟免费解读」/「Book 15-min call」提交后由 `send-booking` 直接发邮件到公司邮箱，不打开客户邮件客户端。

## 1. 获取 Resend API Key

1. 打开 [https://resend.com](https://resend.com)，用邮箱或 Google 注册并登录。
2. 进入 **API Keys**：
   - 左侧菜单点 **API Keys**，或直接打开 [https://resend.com/api-keys](https://resend.com/api-keys)。
3. 创建 Key：
   - 点 **Create API Key**。
   - 填一个名称（如 `Netlify Risk Snapshot`）。
   - 权限选 **Sending access**（只发信即可）。
   - 点 **Add**，**复制显示的 Key**（形如 `re_123abc...`，只显示一次，务必保存）。

（可选）在 Resend 里添加并验证你的域名，之后发件人可用 `noreply@你的域名.com`；不验证则用 Resend 默认发件地址。

## 2. 在 Netlify 里设置 RESEND_API_KEY

1. 登录 [Netlify](https://app.netlify.com)，进入你的站点（如 risk-snapshot）。
2. 打开 **Site configuration**（或 **Site settings**）→ **Environment variables**。
3. 点 **Add a variable** / **Add environment variable**：
   - **Key**：`RESEND_API_KEY`（必须一字不差）。
   - **Value**：粘贴刚才复制的 Resend API Key（如 `re_xxxx...`）。
   - **Scopes**：勾选 **All scopes** 或至少 **Production**（以及需要测试时的 **Deploy previews**）。
4. 保存后，**重新部署一次站点**（Deploys → Trigger deploy → Deploy site），环境变量才会在 Function 里生效。

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `RESEND_API_KEY` | Resend API Key（如 `re_xxxx`） | **是** |
| `PDF_FROM_EMAIL` | 发件邮箱（默认 `onboarding@resend.dev`） | 否 |
| `PDF_FROM_NAME` | 发件人名称（默认 Better Home Technology） | 否 |
| `BOOKING_TO_EMAIL` | 预约邮件收件地址（默认 info@bhtechnology.com.au） | 否 |

未设置 `RESEND_API_KEY` 时，PDF「发送到邮箱」和「提交预约」会报错，用户仍可使用「直接下载 PDF」和表单重试。

## 3. 邮件内容

- **英文**：感谢完成快照、附上 checklist、欢迎回复或联系 info@bhtechnology.com.au。
- **中文**：感谢完成快照、附上《投资房电气风险自查指南》、欢迎回复或联系 info@bhtechnology.com.au。

邮件正文在 `netlify/functions/send-pdf.js` 中的 `BODY_EN` / `BODY_ZH`，可按需修改。

## 4. PDF 文件

- 英文：`investment property check guide.pdf`（根目录）
- 中文：`investment property check guide CN.pdf`（根目录）

部署后可通过  
`https://你的站点.netlify.app/investment%20property%20check%20guide.pdf`  
等链接直接访问，Function 会从站点自身拉取 PDF 并作为附件发送。
