# TripSync - 旅游攻略应用

一个基于 Vue3 + Express 的全栈旅游攻略应用，帮助用户发现和分享旅行经验。

## 📁 项目结构

```
TripSync/
├── frontend/          # Vue3前端项目
│   ├── src/
│   │   ├── views/     # 页面组件
│   │   ├── router/    # 路由配置
│   │   ├── App.vue    # 根组件
│   │   └── main.js    # 入口文件
│   ├── package.json
│   └── vite.config.js
├── backend/           # Express后端项目
│   ├── server.js      # 服务器主文件
│   ├── config/        # 配置文件
│   └── package.json
└── README.md          # 项目说明文档
```

## 🚀 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn
- Supabase 账号（用于数据库）

### 1. 安装依赖

#### 前端依赖
```bash
cd frontend
npm install
```

#### 后端依赖
```bash
cd backend
npm install
```

### 2. 配置 Supabase

1. 访问 [Supabase](https://supabase.com) 创建新项目
2. 在项目设置中获取 `URL` 和 `anon key`
3. 在 `backend` 目录下创建 `.env` 文件：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here
PORT=3001
```

4. 在 Supabase SQL 编辑器中执行以下 SQL 创建表：

```sql
-- 创建攻略表
CREATE TABLE guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用Row Level Security
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取
CREATE POLICY "允许所有人读取攻略" ON guides
  FOR SELECT USING (true);

-- 创建策略：允许所有人创建
CREATE POLICY "允许所有人创建攻略" ON guides
  FOR INSERT WITH CHECK (true);

-- 创建策略：允许所有人更新
CREATE POLICY "允许所有人更新攻略" ON guides
  FOR UPDATE USING (true);

-- 创建策略：允许所有人删除
CREATE POLICY "允许所有人删除攻略" ON guides
  FOR DELETE USING (true);
```

### 3. 运行项目

#### 启动后端服务（终端1）
```bash
cd backend
npm run dev
```

后端服务将在 `http://localhost:3001` 运行

#### 启动前端服务（终端2）
```bash
cd frontend
npm run dev
```

前端应用将在 `http://localhost:3000` 运行

### 4. 访问应用

打开浏览器访问：`http://localhost:3000`

## 📚 功能说明

### 前端功能

- **首页** (`/`): 展示应用介绍和快速导航
- **攻略列表** (`/guides`): 显示所有旅游攻略，支持查看详情

### 后端API接口

- `GET /api/health` - 健康检查
- `GET /api/guides` - 获取所有攻略
- `GET /api/guides/:id` - 获取单个攻略
- `POST /api/guides` - 创建新攻略
- `PUT /api/guides/:id` - 更新攻略
- `DELETE /api/guides/:id` - 删除攻略

### API请求示例

#### 创建攻略
```bash
curl -X POST http://localhost:3001/api/guides \
  -H "Content-Type: application/json" \
  -d '{
    "title": "日本东京旅游攻略",
    "description": "探索东京的必游景点和美食",
    "location": "东京, 日本",
    "content": "详细攻略内容..."
  }'
```

#### 获取所有攻略
```bash
curl http://localhost:3001/api/guides
```

## 🛠️ 技术栈

### 前端
- **Vue 3** - 渐进式JavaScript框架
- **Vite** - 快速的前端构建工具
- **Vue Router** - 官方路由管理器
- **Tailwind CSS** - 实用优先的CSS框架
- **Axios** - HTTP客户端

### 后端
- **Express** - Node.js Web框架
- **Supabase** - 开源Firebase替代品（PostgreSQL数据库）
- **CORS** - 跨域资源共享中间件
- **dotenv** - 环境变量管理

## 📝 开发说明

### 代码结构

- 所有代码都包含中文注释，方便新手理解
- 前端使用 Vue 3 Composition API
- 后端使用 ES6 模块语法
- API遵循RESTful设计规范

### 环境变量

后端需要配置以下环境变量（在 `backend/.env` 文件中）：
- `SUPABASE_URL`: Supabase项目URL
- `SUPABASE_KEY`: Supabase匿名密钥
- `PORT`: 服务器端口（可选，默认3001）

## 🔧 常见问题

### 1. 前端无法连接后端
- 确保后端服务已启动（`http://localhost:3001`）
- 检查 `frontend/vite.config.js` 中的代理配置

### 2. Supabase连接失败
- 检查 `.env` 文件中的配置是否正确
- 确认Supabase项目的URL和密钥是否正确
- 检查网络连接和Supabase服务状态

### 3. 数据库表不存在
- 在Supabase SQL编辑器中执行创建表的SQL语句
- 确认表名和字段名与代码中的一致

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！


