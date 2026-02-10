# ServiceM8 + Snapshot 集成

提交快照/预约后，可通过「Create ServiceM8 Job」在 ServiceM8 中创建客户与工单。

## 1. 环境变量（仅存于 env，勿提交密钥）

在 Netlify：**Site configuration → Environment variables** 中配置：

| 变量 | 说明 | 必填 |
|------|------|------|
| `SERVICEM8_API_KEY` | ServiceM8 Private Application API Key（发请求时放在 `X-API-Key` header） | 创建工单时**是** |
| `SERVICEM8_BASE_URL` | API 根地址，默认 `https://api.servicem8.com/api_1.0` | 否 |
| `SNAPSHOT_SIGNING_SECRET` | 用于对 lead_id + timestamp 做 HMAC 签名的密钥；与生成「Create ServiceM8 Job」链接的 send-booking 共用 | **是**（若要用该链接） |

- 密钥只放在环境变量中，不要写进代码或仓库。
- `SNAPSHOT_SIGNING_SECRET` 需与 `send-booking` 中生成签名时使用的值一致（同一次部署内由 Netlify 注入）。

## 2. 流程简述

1. 用户完成快照并提交（lead 表单或 quickcall）。
2. `send-booking` 发邮件并在响应中返回 `servicem8: { lead_id, timestamp, sig }`（需配置 `SNAPSHOT_SIGNING_SECRET`）。
3. 成功页/弹窗显示「Create ServiceM8 Job」/「创建 ServiceM8 工单」，链接到  
   `/.netlify/functions/createServiceM8Job?lead_id=...&timestamp=...&sig=...`
4. 点击后 `createServiceM8Job`：校验签名 → 按 email/phone 查找或创建 Company → 创建 Job（job_address、job_description 含来源与快照摘要）。

## 3. 本地测试脚本

```bash
# 1. 在项目根目录建 .env（勿提交），例如：
#    SNAPSHOT_SIGNING_SECRET=your-secret
#    NETLIFY_DEV_URL=http://localhost:8888

# 2. 启动本地 Netlify
npx netlify dev

# 3. 另开终端执行
npx ts-node scripts/test-servicem8-create-job.ts
```

脚本会使用 mock 的 lead  payload 调用 `createServiceM8Job`（POST），并打印返回的 `company_uuid` / `job_uuid` 或错误信息。

## 4. 日志（不记录敏感信息）

- 会记录：request id、lead_id 前缀、created/reused company_uuid、created job_uuid。
- 不会记录：`SERVICEM8_API_KEY`、完整 lead_id 或签名。
