# TripSync 快速启动指南

## 一键启动（3步）

### 步骤 1：安装依赖
```bash
npm install
```

### 步骤 2：配置环境变量
复制 `env.example` 为 `.env`，并填入你的 API 密钥：
```bash
# Windows (PowerShell)
Copy-Item env.example .env

# Mac/Linux
cp env.example .env
```

然后编辑 `.env` 文件，填入：
- `OPENAI_API_KEY`：你的 OpenAI API 密钥
- `AMAP_API_KEY`：你的高德地图 API 密钥

### 步骤 3：启动服务器
```bash
npm start
```

访问 http://localhost:3000 即可使用！

## 功能测试流程

1. **注册账号**：在登录页面输入昵称和密码，点击"注册"
2. **收藏链接**：切换到"收藏夹"，输入小红书链接并解析收藏
3. **生成行程**：切换到"生成行程"，选择收藏，设置天数，点击"生成行程"
4. **编辑行程**：切换到"行程编辑"，选择行程进行编辑
5. **分享链接**：切换到"协作分享"，生成分享链接或通过链接访问

## 常见问题

**Q: 小红书链接解析失败？**
A: 小红书有反爬虫机制，解析可能失败。如果失败，可以手动输入标题和地点信息。

**Q: 端口被占用？**
A: 修改 `.env` 文件中的 `PORT` 值。

**Q: API 调用失败？**
A: 检查 `.env` 文件中的 API 密钥是否正确配置。

