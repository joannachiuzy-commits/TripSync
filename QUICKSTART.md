# TripSync 快速启动指南

## 🎯 5分钟快速上手

### 步骤1: 安装依赖（约2分钟）

打开两个终端窗口：

**终端1 - 安装前端依赖：**
```bash
cd frontend
npm install
```

**终端2 - 安装后端依赖：**
```bash
cd backend
npm install
```

### 步骤2: 配置Supabase（约2分钟）

1. **创建Supabase项目**
   - 访问 https://supabase.com
   - 注册/登录账号
   - 创建新项目（选择免费计划即可）

2. **获取配置信息**
   - 进入项目设置（Settings）
   - 找到 API 设置（API Settings）
   - 复制 `Project URL` 和 `anon public` key

3. **配置环境变量**
   - 在 `backend` 目录下创建 `.env` 文件
   - 复制 `env.example` 的内容到 `.env`
   - 填入你的Supabase配置：
   ```env
   SUPABASE_URL=https://你的项目.supabase.co
   SUPABASE_KEY=你的anon-key
   PORT=3001
   ```

4. **创建数据库表**
   - 在Supabase项目中，进入 SQL Editor
   - 打开 `backend/database/init.sql` 文件
   - 复制全部内容到SQL编辑器
   - 点击运行（Run）

### 步骤3: 启动项目（约1分钟）

**终端1 - 启动后端：**
```bash
cd backend
npm run dev
```
看到 `🚀 TripSync后端服务运行在 http://localhost:3001` 表示成功

**终端2 - 启动前端：**
```bash
cd frontend
npm run dev
```
看到 `Local: http://localhost:3000` 表示成功

### 步骤4: 访问应用

打开浏览器访问：**http://localhost:3000**

## ✅ 验证安装

1. **检查后端健康状态**
   - 访问：http://localhost:3001/api/health
   - 应该看到：`{"status":"ok","message":"TripSync后端服务运行正常"}`

2. **检查前端页面**
   - 访问：http://localhost:3000
   - 应该看到TripSync首页

3. **测试攻略列表**
   - 点击导航栏的"攻略列表"
   - 应该能看到示例数据（如果执行了init.sql中的示例数据）

## 🐛 常见问题排查

### 问题1: 后端启动失败
- **检查**: `.env` 文件是否存在且配置正确
- **检查**: Supabase URL和Key是否正确
- **解决**: 重新检查Supabase项目设置

### 问题2: 前端无法获取数据
- **检查**: 后端服务是否正常运行（访问 http://localhost:3001/api/health）
- **检查**: 浏览器控制台是否有错误信息
- **解决**: 确保后端先启动，再启动前端

### 问题3: 数据库连接失败
- **检查**: Supabase项目是否正常运行
- **检查**: 数据库表是否已创建（在Supabase Table Editor中查看）
- **解决**: 重新执行 `backend/database/init.sql` 中的SQL

### 问题4: 端口被占用
- **前端端口3000被占用**: 修改 `frontend/vite.config.js` 中的 `port`
- **后端端口3001被占用**: 修改 `backend/.env` 中的 `PORT`

## 📚 下一步

- 阅读 `README.md` 了解完整功能说明
- 查看 `backend/server.js` 了解API接口
- 查看 `frontend/src/views/` 了解前端页面结构
- 开始开发你的功能！

## 💡 提示

- 使用 `npm run dev` 启动开发模式（支持热重载）
- 使用 `npm run build` 构建生产版本
- 所有代码都包含中文注释，方便理解


