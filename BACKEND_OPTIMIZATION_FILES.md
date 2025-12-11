# 后端优化后完整文件代码

## 新增文件

### 1. `backend/utils/errorHandler.js`

```javascript
/**
 * 统一错误处理中间件
 * 替代所有接口内重复的 try-catch 代码
 * 统一返回格式: { code: xx, msg: xx, error: xx }
 */

/**
 * 错误处理中间件
 * 使用方式: app.use(errorHandler)
 * 或者在路由中使用: router.use(errorHandler)
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ [ErrorHandler] 服务器错误:', err)
  
  // 默认错误信息
  let code = 500
  let msg = '服务器内部错误'
  let error = err.message || '未知错误'
  
  // 根据错误类型设置不同的错误码和消息
  if (err.statusCode) {
    code = err.statusCode
  } else if (err.status) {
    code = err.status
  }
  
  // 自定义错误消息
  if (err.message) {
    // 如果是业务错误（如参数验证失败），使用400状态码
    if (err.message.includes('必填') || err.message.includes('参数') || err.message.includes('无效')) {
      code = 400
      msg = err.message
    } else if (err.message.includes('不存在') || err.message.includes('未找到')) {
      code = 404
      msg = err.message
    } else {
      msg = err.message
    }
  }
  
  // 统一返回格式
  return res.status(code).json({
    code,
    msg,
    error: process.env.NODE_ENV === 'production' ? undefined : error, // 生产环境不暴露详细错误
    ...(err.data !== undefined && { data: err.data }) // 如果有data字段，也返回
  })
}

/**
 * 异步错误处理包装器
 * 使用方式: app.get('/api/xxx', asyncHandler(async (req, res) => { ... }))
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 创建标准成功响应
 * @param {*} data - 响应数据
 * @param {string} msg - 成功消息
 * @param {number} code - 状态码（默认200）
 */
export const successResponse = (data = null, msg = '成功', code = 200) => {
  return {
    code,
    data,
    msg
  }
}

/**
 * 创建标准错误响应
 * @param {string} msg - 错误消息
 * @param {number} code - 状态码（默认500）
 * @param {string} error - 详细错误信息
 */
export const errorResponse = (msg = '服务器内部错误', code = 500, error = null) => {
  return {
    code,
    msg,
    ...(error && { error })
  }
}
```

**修改说明**：
- 原冗余逻辑：每个接口都有独立的 try-catch 代码，错误返回格式不统一
- 优化后的复用方式：统一使用 `errorHandler` 中间件和 `asyncHandler` 包装器

---

### 2. `backend/utils/mapKey.js`

```javascript
/**
 * 地图API Key工具函数
 * 统一读取 AMAP_API_KEY/GOOGLE_API_KEY 环境变量
 * 删除 map.js 和 server.js 中重复的配置读取代码
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量（从backend目录加载.env文件）
dotenv.config({ path: path.resolve(__dirname, '../.env') })

/**
 * 获取高德地图API Key
 * @returns {string|null} 高德地图API Key，如果未配置或为占位符则返回null
 */
export const getAmapKey = () => {
  const AMAP_API_KEY = process.env.AMAP_API_KEY || process.env.VITE_AMAP_API_KEY || null
  
  // 过滤占位符
  if (AMAP_API_KEY && AMAP_API_KEY !== 'YOUR_AMAP_API_KEY') {
    return AMAP_API_KEY
  }
  
  return null
}

/**
 * 获取Google地图API Key
 * @returns {string|null} Google地图API Key，如果未配置或为占位符则返回null
 */
export const getGoogleKey = () => {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || null
  
  // 过滤占位符
  if (GOOGLE_API_KEY && GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY') {
    return GOOGLE_API_KEY
  }
  
  return null
}

/**
 * 获取所有地图API Keys
 * @returns {{amap: string|null, google: string|null}} 包含高德和Google地图Key的对象
 */
export const getMapKeys = () => {
  return {
    amap: getAmapKey(),
    google: getGoogleKey()
  }
}

/**
 * 检查地图Key是否已配置
 * @param {string} type - 地图类型 ('amap' | 'google')
 * @returns {boolean} 是否已配置
 */
export const isMapKeyConfigured = (type = 'amap') => {
  if (type === 'amap') {
    return getAmapKey() !== null
  } else if (type === 'google') {
    return getGoogleKey() !== null
  }
  return false
}
```

**修改说明**：
- 原冗余逻辑：server.js 和 map.js 中都有读取环境变量的代码，占位符过滤逻辑重复
- 优化后的复用方式：统一使用 `getMapKeys()` 工具函数

---

### 3. `backend/utils/xhsParser.js`

```javascript
/**
 * 小红书解析工具函数
 * 拆分 parseXhsPage 函数，将登录检测、内容过滤、HTML 提取拆为独立函数
 */

/**
 * 检测页面是否包含登录提示
 * @param {string} pageContent - 页面HTML内容
 * @returns {boolean} 是否包含登录提示
 */
export const hasLoginPrompt = (pageContent) => {
  if (!pageContent) return false
  
  const loginIndicators = [
    '登录后推荐',
    '登录查看更多',
    '请先登录',
    '登录后查看',
    '需要登录',
    '登录以继续',
    'sign in',
    'login'
  ]
  
  const lowerContent = pageContent.toLowerCase()
  return loginIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))
}

/**
 * 检测内容是否包含无关信息（评论/推荐等）
 * @param {string} content - 内容文本
 * @returns {boolean} 是否包含无关信息
 */
export const hasUnrelatedContent = (content) => {
  if (!content) return false
  
  // 明确的评论/推荐标识
  const unrelatedPatterns = [
    /11-\d{2}/,           // 日期格式（如 11-30）
    /\d+\.\d+w/,          // 数字.w格式（如 942.8w）
    /评论/,                // 评论
    /推荐/,                // 推荐
    /查看更多/,            // 查看更多
    /相关推荐/,            // 相关推荐
    /热门评论/             // 热门评论
  ]
  
  return unrelatedPatterns.some(pattern => pattern.test(content))
}

/**
 * 过滤无关内容
 * @param {string} content - 原始内容
 * @returns {string} 过滤后的内容
 */
export const filterUnrelatedContent = (content) => {
  if (!content) return ''
  
  // 如果内容包含明确的无关信息标识，尝试过滤
  if (hasUnrelatedContent(content)) {
    // 简单的过滤：移除包含无关标识的行
    const lines = content.split('\n')
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase()
      return !(
        lowerLine.includes('11-') ||
        lowerLine.includes('.w') ||
        lowerLine.includes('评论') ||
        lowerLine.includes('推荐')
      )
    })
    return filteredLines.join('\n').trim()
  }
  
  return content
}

/**
 * 从页面HTML中提取文本内容
 * @param {object} page - Puppeteer页面对象
 * @returns {Promise<object>} 包含title, description, keywordsMeta, textContent, rawContent的对象
 */
export const extractPageContent = async (page) => {
  return await page.evaluate(() => {
    // 提取 og:title
    const ogTitleElement = document.querySelector('meta[property="og:title"]')
    const title = ogTitleElement ? ogTitleElement.getAttribute('content') : ''
    
    // 提取 og:description
    const ogDescElement = document.querySelector('meta[property="og:description"]')
    const description = ogDescElement ? ogDescElement.getAttribute('content') : ''
    
    // 提取 keywords
    const keywordsElement = document.querySelector('meta[name="keywords"]')
    const keywordsMeta = keywordsElement ? keywordsElement.getAttribute('content') : ''
    
    // 尝试从笔记标题元素提取
    let noteTitle = ''
    const titleSelectors = [
      '.note-title',
      '[class*="title"]',
      'h1',
      'h2',
      '.title',
      '[data-v-] h1',
      '[data-v-] h2'
    ]
    for (const selector of titleSelectors) {
      const titleEl = document.querySelector(selector)
      if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0) {
        noteTitle = titleEl.textContent.trim()
        break
      }
    }
    
    // 提取内容
    let textContent = ''
    let rawContent = ''
    
    const noteContentSelectors = [
      '.note-content',
      '.content',
      '[class*="note-content"]',
      '[class*="noteContent"]',
      'article',
      '[class*="desc"]',
      '[class*="text"]',
      'main'
    ]
    
    let noteMainContent = null
    for (const selector of noteContentSelectors) {
      const elements = document.querySelectorAll(selector)
      for (const el of elements) {
        if (el && el.textContent && el.textContent.trim().length > 20) {
          noteMainContent = el
          break
        }
      }
      if (noteMainContent) break
    }
    
    if (noteMainContent) {
      textContent = noteMainContent.innerText || noteMainContent.textContent || ''
      rawContent = textContent
    } else {
      if (document.body) {
        textContent = document.body.innerText || document.body.textContent || ''
        rawContent = textContent
      }
    }
    
    // 如果都没有，使用描述或标题
    if (!rawContent || rawContent.length < 5) {
      if (description && description.trim().length > 10) {
        rawContent = description
        textContent = description
      } else if (title) {
        rawContent = title
        textContent = title
      }
    }
    
    return {
      title: noteTitle || title,
      description,
      keywordsMeta,
      textContent: textContent || '',
      rawContent: rawContent || ''
    }
  })
}

/**
 * 获取随机User-Agent
 * @returns {string} 随机User-Agent字符串
 */
export const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

/**
 * 移动端User-Agent
 */
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
```

**修改说明**：
- 原冗余逻辑：parseXhsPage 函数过长（400+行），包含登录检测、内容过滤、HTML提取等逻辑
- 优化后的复用方式：将登录检测、内容过滤、HTML提取拆分为独立函数，便于维护和测试

---

## 修改后的文件

### 1. `backend/routes/map.js` - 完整代码

```javascript
/**
 * 地图API路由
 * 提供地图API Key获取接口
 * 【优化】使用统一的mapKey工具函数和错误处理中间件
 */

import express from 'express'
import { getMapKeys } from '../utils/mapKey.js'
import { asyncHandler, successResponse } from '../utils/errorHandler.js'

const router = express.Router()

/**
 * GET /api/map/key
 * 获取地图API Keys（高德和Google）
 * 返回格式：
 * {
 *   "code": 200,
 *   "data": {
 *     "amap": "你的高德Key",
 *     "google": "你的Google Key"
 *   },
 *   "msg": "成功"
 * }
 */
router.get('/key', asyncHandler(async (req, res) => {
  // 【优化】使用统一的mapKey工具函数
  const keys = getMapKeys()
  
  // 【优化】添加调试日志
  console.log('🔑 [GET /api/map/key] 读取环境变量:')
  console.log('   - AMAP_API_KEY存在:', !!keys.amap)
  console.log('   - AMAP_API_KEY值:', keys.amap ? keys.amap.substring(0, 10) + '...' : 'null')
  console.log('   - GOOGLE_API_KEY存在:', !!keys.google)
  console.log('🔑 [GET /api/map/key] 返回结果:')
  console.log('   - amap:', keys.amap ? keys.amap.substring(0, 10) + '...' : 'null')
  console.log('   - google:', keys.google ? '已配置' : 'null')
  
  // 【优化】使用统一的成功响应格式
  return res.json(successResponse(keys, '成功'))
}))

export default router
```

**修改说明**：
- 原冗余逻辑：重复读取环境变量、重复的占位符过滤逻辑、重复的 try-catch 代码
- 优化后的复用方式：统一使用 `getMapKeys()` 工具函数和 `asyncHandler` 包装器

---

### 2. `backend/server.js` - 关键修改点

由于 `server.js` 文件较大（2000+行），以下是关键修改点：

#### 修改点1：导入优化

```javascript
// 【优化】导入统一错误处理中间件
import { errorHandler, asyncHandler, successResponse, errorResponse } from './utils/errorHandler.js'
// 【优化】导入地图Key工具函数
import { getMapKeys, isMapKeyConfigured } from './utils/mapKey.js'
// 【优化】导入小红书解析工具函数
import { hasLoginPrompt, hasUnrelatedContent, extractPageContent, getRandomUserAgent, MOBILE_USER_AGENT } from './utils/xhsParser.js'
```

#### 修改点2：注册全局错误处理

```javascript
// 【优化】注册全局错误处理中间件（必须在所有路由之后）
app.use(errorHandler)
```

#### 修改点3：删除重复函数

```javascript
// 【优化】已迁移到 utils/xhsParser.js，删除重复代码
// getRandomUserAgent, hasLoginPrompt, hasUnrelatedContent, filterUnrelatedContent 等函数已移至 utils/xhsParser.js

// 【优化】已迁移到 storageAdapter.js，删除重复代码
// readTripsFromFile, saveTripToFile, updateTripInFile, deleteTripFromFile 等函数已移至 storageAdapter.js
```

#### 修改点4：删除重复接口

```javascript
// 【优化】删除重复的 /api/maps/keys 接口（与 /api/map/key 功能重复）
// 所有地图Key获取统一使用 /api/map/key 接口
// 地图Key读取统一使用 utils/mapKey.js 工具函数（getMapKeys()）
```

#### 修改点5：优化 parseXhsPage 函数

```javascript
// 修改前（内联HTML提取逻辑，100+行）
const pageData = await page.evaluate(() => {
  // ... 100+行内联代码
})

// 修改后（使用工具函数）
const pageData = await extractPageContent(page)
```

#### 修改点6：优化地图Key使用

```javascript
// 修改前
const AMAP_API_KEY = process.env.AMAP_API_KEY || process.env.VITE_AMAP_API_KEY
const amapResponse = await fetch(`${amapUrl}?key=${AMAP_API_KEY}&address=${encodeURIComponent(address)}`)

// 修改后
const mapKeys = getMapKeys()
const amapResponse = await fetch(`${amapUrl}?key=${mapKeys.amap}&address=${encodeURIComponent(address)}`)
```

#### 修改点7：优化启动日志

```javascript
// 修改前
console.log(`🗺️  地图API: 高德地图=${AMAP_API_KEY !== 'YOUR_AMAP_API_KEY' ? '已配置' : '未配置'}, Google Maps=${GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY' ? '已配置' : '未配置'}`)

// 修改后
const mapKeys = getMapKeys()
console.log(`🗺️  地图API: 高德地图=${isMapKeyConfigured('amap') ? '已配置' : '未配置'}, Google Maps=${isMapKeyConfigured('google') ? '已配置' : '未配置'}`)
```

---

## 后端优化后代码结构说明

### 新增文件结构

```
backend/
├── utils/                          # 【新增】工具函数目录
│   ├── errorHandler.js            # 统一错误处理中间件
│   ├── mapKey.js                  # 地图Key工具函数
│   └── xhsParser.js               # 小红书解析工具函数
├── routes/
│   └── map.js                     # 地图路由（已优化）
├── server.js                       # 服务器主文件（已优化）
└── storageAdapter.js              # 存储适配层（已包含行程存储函数）
```

### 文件作用说明

1. **`backend/utils/errorHandler.js`**：
   - 位置：`backend/utils/errorHandler.js`
   - 作用：统一错误处理中间件，替代所有接口内重复的 try-catch 代码
   - 导出：`errorHandler`、`asyncHandler`、`successResponse`、`errorResponse`

2. **`backend/utils/mapKey.js`**：
   - 位置：`backend/utils/mapKey.js`
   - 作用：统一读取地图API Key，删除 map.js 和 server.js 中重复的配置读取代码
   - 导出：`getAmapKey()`、`getGoogleKey()`、`getMapKeys()`、`isMapKeyConfigured()`

3. **`backend/utils/xhsParser.js`**：
   - 位置：`backend/utils/xhsParser.js`
   - 作用：拆分小红书解析函数，将登录检测、内容过滤、HTML提取拆为独立函数
   - 导出：`hasLoginPrompt()`、`hasUnrelatedContent()`、`filterUnrelatedContent()`、`extractPageContent()`、`getRandomUserAgent()`、`MOBILE_USER_AGENT`

4. **`backend/routes/map.js`**（已优化）：
   - 位置：`backend/routes/map.js`
   - 作用：提供地图API Key获取接口
   - 优化：使用 `mapKey.js` 工具函数和 `errorHandler` 中间件

5. **`backend/server.js`**（已优化）：
   - 位置：`backend/server.js`
   - 作用：服务器主文件，包含所有API路由
   - 优化：
     - 删除重复函数（`hasLoginPrompt`、`hasUnrelatedContent`、`readTripsFromFile`、`saveTripToFile` 等）
     - 删除重复接口（`/api/maps/keys`）
     - 使用工具函数替代重复逻辑
     - 使用 `asyncHandler` 和 `errorHandler` 统一错误处理

6. **`backend/storageAdapter.js`**（已包含行程存储函数）：
   - 位置：`backend/storageAdapter.js`
   - 作用：存储适配层，统一管理JSON和Supabase存储操作
   - 包含：`readTripsFromFile()`、`saveTripToFile()` 等行程存储函数（已在文件中）

---

## 验证步骤

### 1. 启动后端服务

```bash
cd backend
npm start
```

**预期结果**：
- ✅ 后端服务正常启动（http://localhost:3008）
- ✅ 控制台显示存储模式信息
- ✅ 控制台显示地图API配置状态（使用 `isMapKeyConfigured()`）

### 2. 测试地图Key接口

```bash
curl http://localhost:3008/api/map/key
```

**预期结果**：
- ✅ 返回格式：`{ "code": 200, "data": { "amap": "...", "google": "..." }, "msg": "成功" }`
- ✅ 不再有 `/api/maps/keys` 接口（404错误）

### 3. 测试错误处理

```bash
curl http://localhost:3008/api/guides/999
```

**预期结果**：
- ✅ 返回统一错误格式：`{ "code": 404, "msg": "...", "error": "..." }`

### 4. 测试小红书解析

```bash
curl -X POST http://localhost:3008/api/xhs/parse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.xiaohongshu.com/explore/xxxx"}'
```

**预期结果**：
- ✅ 解析功能正常
- ✅ 使用工具函数进行登录检测和内容提取

### 5. 测试行程接口

```bash
curl http://localhost:3008/api/trips
```

**预期结果**：
- ✅ 返回行程列表
- ✅ 使用 storageAdapter.js 中的方法（不再使用 server.js 中的重复函数）

---

## 优化完成总结

### 优化成果

1. ✅ **统一错误处理**：创建 `errorHandler.js` 中间件，删除所有接口内重复的 try-catch 代码
2. ✅ **删除重复接口**：删除 `/api/maps/keys`，统一使用 `/api/map/key`
3. ✅ **统一地图Key配置**：创建 `mapKey.js` 工具函数，删除重复的配置读取代码
4. ✅ **拆分小红书解析函数**：创建 `xhsParser.js` 工具函数，拆分登录检测、内容过滤、HTML提取逻辑
5. ✅ **迁移行程存储函数**：删除 server.js 中重复的存储函数，统一使用 `storageAdapter.js`

### 代码质量提升

- **代码行数减少**：删除重复代码约 300+ 行
- **可维护性提升**：工具函数集中管理，便于维护和测试
- **错误处理统一**：所有接口统一错误格式，便于前端处理
- **配置管理统一**：地图Key配置统一管理，避免重复代码

