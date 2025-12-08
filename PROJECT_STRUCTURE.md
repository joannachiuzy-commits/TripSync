# TripSync 项目结构说明

## 📂 完整目录结构

```
TripSync/
├── frontend/                          # Vue3前端项目
│   ├── src/                           # 源代码目录
│   │   ├── views/                     # 页面组件
│   │   │   ├── Home.vue              # 首页组件
│   │   │   └── GuideList.vue         # 攻略列表页组件
│   │   ├── router/                    # 路由配置
│   │   │   └── index.js              # 路由定义文件
│   │   ├── App.vue                    # 根组件（包含导航栏）
│   │   ├── main.js                    # 应用入口文件
│   │   └── style.css                  # 全局样式（包含Tailwind导入）
│   ├── index.html                     # HTML模板
│   ├── package.json                   # 前端依赖配置
│   ├── vite.config.js                 # Vite构建配置
│   ├── tailwind.config.js             # Tailwind CSS配置
│   ├── postcss.config.js              # PostCSS配置
│   └── .gitignore                     # Git忽略文件
│
├── backend/                           # Express后端项目
│   ├── config/                        # 配置文件目录
│   │   └── supabase.example.js       # Supabase配置示例
│   ├── database/                      # 数据库相关文件
│   │   └── init.sql                   # 数据库初始化SQL脚本
│   ├── server.js                      # Express服务器主文件
│   ├── package.json                   # 后端依赖配置
│   ├── env.example                    # 环境变量配置示例
│   └── .gitignore                     # Git忽略文件
│
├── README.md                          # 项目主文档
├── QUICKSTART.md                      # 快速启动指南
├── PROJECT_STRUCTURE.md              # 项目结构说明（本文件）
└── package.json                       # 根目录依赖（Supabase客户端）

```

## 📄 文件说明

### 前端文件

| 文件 | 说明 |
|------|------|
| `frontend/src/main.js` | Vue应用入口，初始化应用和路由 |
| `frontend/src/App.vue` | 根组件，包含导航栏和路由视图 |
| `frontend/src/router/index.js` | 路由配置，定义页面路由规则 |
| `frontend/src/views/Home.vue` | 首页组件，展示应用介绍 |
| `frontend/src/views/GuideList.vue` | 攻略列表页，展示所有攻略 |
| `frontend/vite.config.js` | Vite配置，包含代理设置 |
| `frontend/tailwind.config.js` | Tailwind主题和样式配置 |

### 后端文件

| 文件 | 说明 |
|------|------|
| `backend/server.js` | Express服务器主文件，包含所有API路由 |
| `backend/database/init.sql` | 数据库表创建和初始化脚本 |
| `backend/config/supabase.example.js` | Supabase连接配置示例 |
| `backend/env.example` | 环境变量配置模板 |

## 🔄 数据流

```
用户浏览器
    ↓
前端 (Vue3 + Vite) - http://localhost:3000
    ↓ HTTP请求 (通过代理)
后端 (Express) - http://localhost:3001
    ↓ API调用
Supabase (PostgreSQL数据库)
```

## 🛣️ 路由结构

### 前端路由
- `/` - 首页（Home.vue）
- `/guides` - 攻略列表页（GuideList.vue）

### 后端API路由
- `GET /api/health` - 健康检查
- `GET /api/guides` - 获取所有攻略
- `GET /api/guides/:id` - 获取单个攻略
- `POST /api/guides` - 创建攻略
- `PUT /api/guides/:id` - 更新攻略
- `DELETE /api/guides/:id` - 删除攻略

## 🗄️ 数据库结构

### guides 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，自动生成 |
| title | VARCHAR(255) | 攻略标题 |
| description | TEXT | 攻略描述 |
| location | VARCHAR(255) | 地点 |
| content | TEXT | 详细内容 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 🔧 配置文件说明

### 前端配置
- **vite.config.js**: 配置开发服务器端口(3000)和API代理
- **tailwind.config.js**: 自定义Tailwind主题颜色

### 后端配置
- **.env**: 包含Supabase连接信息（需要手动创建）
- **server.js**: 配置Express中间件和路由

## 📦 依赖说明

### 前端核心依赖
- `vue`: Vue3框架
- `vue-router`: 路由管理
- `axios`: HTTP请求库
- `tailwindcss`: CSS框架

### 后端核心依赖
- `express`: Web框架
- `@supabase/supabase-js`: Supabase客户端
- `cors`: 跨域支持
- `dotenv`: 环境变量管理

## 🚀 开发工作流

1. **修改前端代码** → Vite自动热重载
2. **修改后端代码** → Node.js watch模式自动重启
3. **修改数据库** → 在Supabase Dashboard中操作
4. **测试API** → 使用curl或Postman测试接口

## 📝 代码风格

- 所有代码使用中文注释
- Vue组件使用Composition API
- 后端使用ES6模块语法
- API遵循RESTful规范


