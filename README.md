# Eligibility Check & Electrical Risk Snapshot

一个用于资格检查和电气风险快照的单页面应用程序。

## 功能特点

- 多步骤表单流程
- 资格检查（Eligibility Check）
- 电气风险快照（Electrical Risk Snapshot）
- 响应式设计，支持深色/浅色主题
- 离线友好的邮件提交功能

## 使用方法

直接在浏览器中打开 `risk-snapshot.html` 文件即可使用。

## 技术栈

- 纯 HTML/CSS/JavaScript
- 无需构建工具或依赖

## 部署

### Netlify 部署（推荐）

**最快方式：**
1. 访问 https://app.netlify.com
2. 登录后，将整个项目文件夹拖拽到部署区域
3. 几秒钟后网站即可访问

**连接 GitHub（自动部署）：**
1. 在 Netlify 点击 "Add new site" → "Import an existing project"
2. 选择 GitHub 并授权
3. 选择 `xiaomeng7/risk-snapshot-netlify` 仓库
4. 点击 "Deploy site"

详细步骤请查看 [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md)

### GitHub Pages

1. 访问仓库设置：https://github.com/xiaomeng7/risk-snapshot-netlify/settings/pages
2. Source 选择 "Deploy from a branch"
3. 选择 `main` 分支和 `/ (root)` 文件夹
4. 网站地址：https://xiaomeng7.github.io/risk-snapshot-netlify/

### 其他平台

也可以部署到：
- Vercel
- Cloudflare Pages
- 或其他静态托管服务
