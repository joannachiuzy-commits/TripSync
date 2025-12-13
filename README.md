# TripSync 网页版 MVP

智能行程规划助手 - 小红书链接收藏、AI生成行程、高德路线规划、协作分享

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JavaScript（无框架）
- **存储**: JSON 文件存储
- **API**: OpenAI GPT（行程生成）、高德地图 API（路线规划）

## 项目结构

```
tripsync-web/
├── backend/                 # 后端代码
│   ├── app.js              # Express 入口文件
│   ├── routes/             # 路由文件
│   │   ├── user.js         # 用户路由（注册/登录）
│   │   ├── collection.js   # 收藏路由（解析/保存/列表）
│   │   ├── trip.js         # 行程路由（生成/获取/更新）
│   │   ├── amap.js         # 高德地图路由（路线规划）
│   │   └── share.js        # 分享路由（创建/验证链接）
│   ├── utils/              # 工具函数
│   │   ├── fileUtil.js     # JSON 文件读写（并发安全）
│   │   ├── gptUtil.js      # OpenAI GPT API 封装
│   │   ├── amapUtil.js     # 高德地图 API 封装
│   │   └── shareUtil.js    # 分享链接生成/验证
│   └── data/               # JSON 数据存储目录
│       ├── users.json      # 用户数据
│       ├── collections.json # 收藏数据
│       ├── trips.json      # 行程数据
│       └── shares.json     # 分享链接数据
├── frontend/               # 前端代码
│   ├── index.html          # 入口页面（单页应用）
│   ├── css/
│   │   └── style.css       # 样式文件（响应式设计）
│   └── js/
│       ├── main.js         # 主入口
│       ├── api.js          # API 请求封装
│       ├── user.js         # 用户模块
│       ├── collection.js   # 收藏模块
│       ├── tripGenerate.js # 行程生成模块
│       ├── tripEdit.js     # 行程编辑模块
│       └── share.js        # 分享模块
├── package.json            # 项目依赖配置
├── .env                    # 环境变量配置（需自行创建）
└── README.md               # 项目说明文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

依赖包（仅4个）：
- `express` - Web 框架
- `axios` - HTTP 请求
- `dotenv` - 环境变量管理
- `cors` - 跨域支持

### 2. 配置环境变量

创建 `.env` 文件（参考 `env.example`）：

```env
# 服务器配置
PORT=3000

# OpenAI API 配置（必填）
OPENAI_API_KEY=your_openai_api_key_here

# 高德地图 API 配置（必填）
AMAP_API_KEY=your_amap_api_key_here
```

**获取 API 密钥：**
- OpenAI API Key: https://platform.openai.com/api-keys
- 高德地图 API Key: https://console.amap.com/dev/key/app

### 3. 启动后端服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 4. 访问前端页面

在浏览器中打开 `http://localhost:3000`

## 核心功能使用流程

### 1. 用户注册/登录

- 首次使用需要注册（输入昵称和密码）
- 注册成功后使用相同账号登录
- 登录状态保存在浏览器 localStorage 中

### 2. 收藏小红书链接

1. 切换到「收藏夹」标签
2. 输入小红书链接（如：`https://www.xiaohongshu.com/...`）
3. 点击「解析」按钮（可能会因反爬虫失败，可手动输入）
4. 查看解析结果（标题、内容、提取的地点）
5. 点击「收藏」保存

**注意**：小红书链接解析可能受反爬虫限制，如果解析失败，可手动输入标题和地点信息。

### 3. AI 生成行程

1. 切换到「生成行程」标签
2. 勾选已收藏的小红书内容
3. 设置行程天数（1-30天）
4. 输入预算（可选，如：5000元）
5. 点击「生成行程」按钮
6. 等待 AI 生成结构化行程（使用 GPT-3.5-turbo）

### 4. 编辑行程

1. 切换到「行程编辑」标签
2. 选择要编辑的行程
3. 点击「加载行程」
4. 修改行程节点（时间、地点、描述）
5. 可添加/删除行程项目
6. 点击「保存修改」

### 5. 协作分享

**创建分享链接：**
1. 切换到「协作分享」标签
2. 选择要分享的行程
3. 选择权限（只读/可编辑）
4. 点击「生成分享链接」
5. 复制链接分享给他人

**通过链接访问：**
1. 在「协作分享」标签中输入分享链接
2. 点击「验证并打开」
3. 查看或编辑共享行程（根据权限）

## API 文档

访问 `http://localhost:3000/api/docs` 查看完整 API 文档

### 主要接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/user/register` | POST | 用户注册 |
| `/api/user/login` | POST | 用户登录 |
| `/api/collection/parse` | POST | 解析小红书链接 |
| `/api/collection/save` | POST | 保存收藏 |
| `/api/collection/list` | GET | 获取收藏列表 |
| `/api/trip/generate` | POST | AI 生成行程 |
| `/api/trip/get` | GET | 获取行程详情 |
| `/api/trip/update` | POST | 更新行程 |
| `/api/amap/route` | POST | 高德路线规划 |
| `/api/share/create` | POST | 创建分享链接 |
| `/api/share/verify` | POST | 验证分享链接 |

所有接口统一返回格式：
```json
{
  "code": 0,  // 0-成功，1-失败
  "data": {}, // 返回数据
  "msg": ""   // 提示信息
}
```

## 高德配置项说明

### 配置项列表

在 `.env` 文件中需要配置以下高德相关项：

| 配置项 | 说明 | 是否必填 | 获取地址 |
|--------|------|----------|----------|
| `AMAP_KEY` | 高德 Web 服务 Key（用于后端 API 调用和前端地图显示） | **必填** | https://console.amap.com/dev/key/app |
| `AMAP_SECURITY_JSCODE` | 高德后端安全密钥（用于 Web 服务 API 签名） | 可选 | 高德开放平台控制台 → 应用管理 → 安全密钥 |
| `AMAP_FRONT_SECURITY_JSCODE` | 高德前端安全密钥（用于 JS API 安全密钥配置） | 可选 | 高德开放平台控制台 → 应用管理 → 安全密钥 |
| `AMAP_API_DOMAIN` | 高德 API 域名 | 可选（默认：https://restapi.amap.com） | - |

### 配置获取步骤

1. **获取 AMAP_KEY**：
   - 访问 https://console.amap.com/dev/key/app
   - 登录高德开放平台
   - 创建应用，选择「Web 服务」类型
   - 创建 Key，获取 `AMAP_KEY`

2. **获取安全密钥**（可选，但推荐配置）：
   - 在高德开放平台控制台 → 应用管理
   - 找到对应应用，进入「安全密钥」设置
   - 配置安全密钥（后端和前端可配置不同的密钥）
   - 获取 `AMAP_SECURITY_JSCODE`（后端用）和 `AMAP_FRONT_SECURITY_JSCODE`（前端用）

### 配置示例

```env
# 高德地图配置
AMAP_KEY=your_amap_key_here
AMAP_SECURITY_JSCODE=your_backend_security_jscode
AMAP_FRONT_SECURITY_JSCODE=your_frontend_security_jscode
AMAP_API_DOMAIN=https://restapi.amap.com
```

### 安全说明

⚠️ **重要**：禁止在前端代码中硬编码密钥，所有密钥通过 `.env` 文件管理，前端仅通过后端接口 `/api/config/amap` 获取必要的非敏感配置。

## 注意事项

1. **小红书链接解析**：由于反爬虫机制，解析功能可能不稳定。如果解析失败，可手动输入标题和地点。

2. **JSON 文件存储**：数据存储在 `backend/data/` 目录下的 JSON 文件中。已实现并发安全机制，但多人协作时仍需注意。

3. **API 密钥**：确保在 `.env` 文件中正确配置 OpenAI 和高德地图的 API 密钥。启动服务时会检查配置，缺失时会显示警告。

4. **高德地图配置**：如果未配置 `AMAP_KEY`，高德相关功能（路线规划、地图显示）将不可用。前端会显示友好提示。

5. **端口配置**：默认端口为 3000，可在 `.env` 中修改。

6. **浏览器兼容性**：推荐使用现代浏览器（Chrome、Firefox、Safari、Edge）。

## 后续扩展

- [ ] 微信小程序迁移
- [ ] 数据库集成（替换 JSON 存储）
- [ ] 用户认证增强（JWT Token）
- [ ] 微信登录集成
- [ ] 更完善的小红书链接解析（使用 Puppeteer）
- [ ] 行程导出功能（PDF、图片）
- [ ] 地图可视化展示

## 许可证

MIT

## 作者

单人开发项目

