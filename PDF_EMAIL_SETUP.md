# 邮件发送配置（Resend）

- **PDF 发送**：结果页「发送到邮箱」通过 `send-pdf` 把《投资房电气风险自查指南》发到用户邮箱。
- **预约提交**：「预约 15 分钟免费解读」/「Book 15-min call」提交后由 `send-booking` 直接发邮件到公司邮箱，不打开客户邮件客户端。

## 1. Resend 账号

1. 注册 [Resend](https://resend.com)，获取 API Key。
2. （可选）验证发件域名，这样发件人可以是 `noreply@你的域名.com`。

## 2. Netlify 环境变量

在 Netlify 站点 **Site settings → Environment variables** 添加：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `RESEND_API_KEY` | Resend API Key（如 `re_xxxx`） | 是 |
| `PDF_FROM_EMAIL` | 发件邮箱（默认 `onboarding@resend.dev`） | 否 |
| `PDF_FROM_NAME` | 发件人名称（默认 Better Home Technology） | 否 |

未设置 `RESEND_API_KEY` 时，用户会看到「发送失败」，仍可使用「直接下载 PDF」链接。

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
