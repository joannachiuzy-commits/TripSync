# TripSync 项目结构说明

## 📁 项目目录结构

```
TripSync/
├── README.md                    # 项目主文档
├── QUICKSTART.md                # 快速启动指南
├── frontend/                    # Vue3前端项目
│   ├── src/
│   │   ├── components/          # 组件目录
│   │   │   └── MapPicker.vue   # 地图选点组件（用于行程编辑）
│   │   ├── views/               # 页面组件
│   │   │   ├── Home.vue        # 首页
│   │   │   ├── GuideList.vue    # 攻略列表页
│   │   │   ├── SiteLibrary.vue # 第三方攻略库管理页
│   │   │   ├── TripEditor.vue  # 小红书链接解析页
│   │   │   ├── TripEdit.vue    # 行程编辑页
│   │   │   └── TripManagement.vue # 行程管理页
│   │   ├── router/
│   │   │   └── index.js        # 路由配置
│   │   ├── App.vue             # 根组件
│   │   ├── main.js             # 入口文件
│   │   └── style.css           # 全局样式
│   ├── index.html              # HTML入口文件
│   ├── package.json            # 前端依赖配置
│   ├── vite.config.js          # Vite构建配置
│   ├── tailwind.config.js      # Tailwind CSS配置
│   ├── postcss.config.js       # PostCSS配置
│   └── .gitignore              # Git忽略文件
├── backend/                    # Express后端项目
│   ├── server.js               # 服务器主文件（所有API接口）
│   ├── config/
│   │   └── supabase.js         # Supabase数据库配置
│   ├── database/               # 数据库SQL脚本
│   │   ├── init.sql            # 数据库初始化脚本
│   │   ├── sites.sql           # 站点表结构
│   │   └── trips.sql           # 行程表结构
│   ├── data/                   # JSON数据文件（Supabase未配置时使用）
│   │   ├── xhs_sites.json      # 小红书站点数据
│   │   ├── trips.json          # 行程数据
│   │   ├── trip_sites.json     # 行程-站点关联数据
│   │   └── trip_items.json     # 行程内容数据
│   ├── package.json            # 后端依赖配置
│   └── .gitignore              # Git忽略文件
└── package.json                # 根目录package.json（可选）
```

---

## 📄 文件说明

### 根目录文件

| 文件 | 说明 |
|------|------|
| `README.md` | 项目主文档，包含项目介绍、功能说明、技术栈等 |
| `QUICKSTART.md` | 快速启动指南，5分钟快速上手指南 |

---

### 前端文件（frontend/）

#### 核心文件

| 文件/目录 | 说明 |
|----------|------|
| `src/main.js` | Vue应用入口文件，初始化Vue应用和路由 |
| `src/App.vue` | 根组件，包含导航栏和路由视图 |
| `src/style.css` | 全局样式文件 |
| `index.html` | HTML入口文件 |
| `package.json` | 前端依赖配置（Vue3、Vite、Tailwind CSS等） |
| `vite.config.js` | Vite构建工具配置 |
| `tailwind.config.js` | Tailwind CSS配置 |
| `postcss.config.js` | PostCSS配置（Tailwind CSS需要） |

#### 组件目录（src/components/）

| 文件 | 说明 |
|------|------|
| `MapPicker.vue` | 地图选点组件，用于行程编辑时选择地点位置 |

#### 页面组件（src/views/）

| 文件 | 说明 |
|------|------|
| `Home.vue` | 首页，展示应用介绍和快速导航 |
| `GuideList.vue` | 攻略列表页，展示所有旅游攻略 |
| `SiteLibrary.vue` | 第三方攻略库管理页，管理保存的小红书站点 |
| `TripEditor.vue` | 小红书链接解析页，解析小红书笔记并保存到攻略库 |
| `TripEdit.vue` | 行程编辑页，编辑行程信息和详细行程内容 |
| `TripManagement.vue` | 行程管理页，管理所有行程（创建、查看、删除） |

#### 路由配置（src/router/）

| 文件 | 说明 |
|------|------|
| `index.js` | Vue Router配置，定义所有路由规则 |

---

### 后端文件（backend/）

#### 核心文件

| 文件 | 说明 |
|------|------|
| `server.js` | Express服务器主文件，包含所有API接口（小红书解析、站点库、行程管理等） |
| `package.json` | 后端依赖配置（Express、Puppeteer、Supabase等） |

#### 配置文件（config/）

| 文件 | 说明 |
|------|------|
| `supabase.js` | Supabase数据库连接配置 |

#### 数据库脚本（database/）

| 文件 | 说明 |
|------|------|
| `init.sql` | 数据库初始化脚本（创建表结构） |
| `sites.sql` | 站点表结构定义 |
| `trips.sql` | 行程表和行程内容表结构定义 |

#### 数据文件（data/）

| 文件 | 说明 |
|------|------|
| `xhs_sites.json` | 小红书站点数据（Supabase未配置时使用） |
| `trips.json` | 行程数据（Supabase未配置时使用） |
| `trip_sites.json` | 行程-站点关联数据（Supabase未配置时使用） |
| `trip_items.json` | 行程内容数据（Supabase未配置时使用） |

---

## 🗑️ 已删除的冗余文件

以下文件已在清理过程中删除：

### 临时报告文件（已删除）

- `ACCEPTANCE_TEST_REPORT.md` - 验收测试报告
- `FIX_REPORT.md` - 修复报告
- `MAP_API_SETUP.md` - 地图API配置说明（功能已集成到README）
- `MAP_FEATURE_TEST.md` - 地图功能测试报告
- `PROJECT_STRUCTURE.md` - 项目结构文档（已重新生成）
- `QUOTE_FIX_REPORT.md` - 引号修复报告
- `REFACTOR_REPORT.md` - 重构报告
- `SITE_LIBRARY_FIX_REPORT.md` - 站点库修复报告
- `SITE_LIBRARY_TEST_REPORT.md` - 站点库测试报告
- `TRIP_EDIT_FEATURE_SUMMARY.md` - 行程编辑功能总结
- `TRIP_ITEMS_FIX_REPORT.md` - 行程内容修复报告
- `XHS_CONTENT_EXTRACT_FIX.md` - 小红书内容提取修复
- `XHS_CONTENT_FILTER_OPTIMIZATION.md` - 小红书内容过滤优化
- `XHS_FIELD_FIX_SUMMARY.md` - 小红书字段修复总结
- `XHS_IMAGE_FETCH_IMPLEMENTATION.md` - 小红书图片抓取实现
- `XHS_PARSE_FILTER_FIX.md` - 小红书解析过滤修复
- `XHS_PARSE_OPTIMIZATION.md` - 小红书解析优化
- `XHS_PARSING_FIX_VERIFICATION.md` - 小红书解析修复验证
- `XHS_ROLLBACK_SUMMARY.md` - 小红书回滚总结

### 未使用的组件（已删除）

- `frontend/src/components/MapViewer.vue` - 独立地图组件（功能已集成到行程编辑弹窗）

---

## ✅ 保留的核心文件

### 文档文件

- ✅ `README.md` - 项目主文档（保留）
- ✅ `QUICKSTART.md` - 快速启动指南（保留）

### 配置文件

- ✅ `.gitignore` - Git忽略文件（前后端各一个）
- ⚠️ `.env` - 环境变量文件（需要手动创建，参考README）

---

## 📋 环境变量配置

### 前端环境变量（frontend/.env）

```env
# 高德地图API Key（地图选点功能需要）
VITE_AMAP_API_KEY=你的高德地图API_Key

# Google Maps API Key（可选）
VITE_GOOGLE_API_KEY=你的Google_Maps_API_Key
```

### 后端环境变量（backend/.env）

```env
# Supabase配置（可选，未配置时使用JSON文件）
SUPABASE_URL=你的Supabase项目URL
SUPABASE_KEY=你的Supabase匿名密钥

# 高德地图API Key（地理编码和路线规划需要）
AMAP_API_KEY=你的高德地图API_Key

# Google Maps API Key（可选）
GOOGLE_API_KEY=你的Google_Maps_API_Key
```

---

## 🚀 项目启动验证

### 1. 检查文件完整性

确保以下核心文件存在：
- ✅ `frontend/src/main.js`
- ✅ `frontend/src/App.vue`
- ✅ `frontend/src/router/index.js`
- ✅ `backend/server.js`
- ✅ `backend/config/supabase.js`

### 2. 检查依赖安装

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

### 3. 启动项目

```bash
# 启动后端（端口3008）
cd backend
npm run dev

# 启动前端（端口5173）
cd ../frontend
npm run dev
```

### 4. 功能验证

- ✅ 首页正常显示
- ✅ 攻略列表页正常加载
- ✅ 第三方攻略库管理页正常显示
- ✅ 小红书链接解析功能正常
- ✅ 行程管理功能正常
- ✅ 行程编辑功能正常（包括地图选点）
- ✅ 地图选点功能正常

---

## 📝 注意事项

1. **环境变量文件**：
   - `.env` 文件需要手动创建（不在Git仓库中）
   - 参考 `README.md` 中的配置说明

2. **数据文件**：
   - `backend/data/` 目录下的JSON文件会在首次使用时自动创建
   - 如果配置了Supabase，数据会优先存储在Supabase中

3. **组件使用**：
   - `MapPicker.vue` 仅在行程编辑页使用
   - 所有页面组件都在 `src/views/` 目录中

4. **API接口**：
   - 所有后端API接口都在 `backend/server.js` 中
   - 接口路径统一以 `/api/` 开头

---

## 🔄 后续维护建议

1. **文档更新**：
   - 保持 `README.md` 和 `QUICKSTART.md` 的更新
   - 重要功能变更时更新文档

2. **代码规范**：
   - 遵循Vue3 Composition API规范
   - 保持代码注释清晰（中文注释）

3. **文件管理**：
   - 避免在根目录创建临时文件
   - 临时测试文件及时清理

4. **依赖管理**：
   - 定期更新依赖包
   - 注意安全漏洞修复

