# 部署到 GitHub 指南

## 步骤 1: 在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 仓库名称：`risk-snapshot-netlify`
3. 选择 Public 或 Private
4. **不要**勾选任何初始化选项（README、.gitignore、license）
5. 点击 "Create repository"

## 步骤 2: 推送代码到 GitHub

创建仓库后，GitHub 会显示推送命令。运行以下命令：

```bash
cd /Users/mengzhang/Downloads/risk-snapshot-netlify

# 添加远程仓库（将 YOUR_USERNAME 替换为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/risk-snapshot-netlify.git

# 推送代码
git branch -M main
git push -u origin main
```

## 步骤 3: 启用 GitHub Pages（可选）

如果你想将网站托管在 GitHub Pages：

1. 进入仓库的 Settings
2. 点击左侧的 "Pages"
3. 在 Source 下选择 "Deploy from a branch"
4. 选择 "main" 分支和 "/ (root)" 文件夹
5. 点击 Save

网站将在以下地址可用：
`https://YOUR_USERNAME.github.io/risk-snapshot-netlify/risk-snapshot.html`

## 或者使用 Netlify 部署

1. 访问 https://app.netlify.com
2. 拖拽 `risk-snapshot-netlify` 文件夹到 Netlify
3. 网站会自动部署并获得一个 URL
