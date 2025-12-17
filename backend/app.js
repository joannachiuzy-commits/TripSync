/**
 * TripSync 后端入口文件
 * 配置 Express 服务器、中间件、路由
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
// 加载根目录的.env文件（而非backend/.env）
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3006;

// 中间件配置
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析 URL 编码请求体

// 静态文件服务（前端文件）
app.use(express.static(path.join(__dirname, '../frontend')));

// 路由注册
const userRoutes = require('./routes/user');
const collectionRoutes = require('./routes/collection');
const tripRoutes = require('./routes/trip');
const amapRoutes = require('./routes/amap');
const shareRoutes = require('./routes/share');
const configRoutes = require('./routes/config');
const testRoutes = require('./routes/test'); // 新增：测试路由
// 注意：testRoutes 下的接口会自动拼接 /api/test 前缀，完整路径为 /api/test/xxx

app.use('/api/user', userRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/trip', tripRoutes);
app.use('/api/amap', amapRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/config', configRoutes);
app.use('/api/test', testRoutes); // 新增：挂载测试路由（完整路径：/api/test/xxx）

// 简易接口文档（仅开发环境可用）
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'TripSync API 文档',
    baseUrl: `http://localhost:${PORT}/api`,
    apis: [
      {
        path: '/api/user/register',
        method: 'POST',
        description: '用户注册',
        params: { nickname: 'string', password: 'string' },
        example: { code: 0, data: { userId: 'xxx', nickname: 'xxx' }, msg: '注册成功' }
      },
      {
        path: '/api/user/login',
        method: 'POST',
        description: '用户登录',
        params: { nickname: 'string', password: 'string' },
        example: { code: 0, data: { userId: 'xxx', nickname: 'xxx', token: 'xxx' }, msg: '登录成功' }
      },
      {
        path: '/api/collection/parse',
        method: 'POST',
        description: '解析小红书链接',
        params: { url: 'string' },
        example: { code: 0, data: { title: 'xxx', content: 'xxx', places: [] }, msg: '解析成功' }
      },
      {
        path: '/api/collection/save',
        method: 'POST',
        description: '保存收藏',
        params: { userId: 'string', url: 'string', title: 'string', content: 'string', places: 'array' },
        example: { code: 0, data: { collectionId: 'xxx' }, msg: '保存成功' }
      },
      {
        path: '/api/collection/list',
        method: 'GET',
        description: '获取收藏列表',
        params: { userId: 'string' },
        example: { code: 0, data: { collections: [] }, msg: '获取成功' }
      },
      {
        path: '/api/trip/generate',
        method: 'POST',
        description: 'AI 生成行程',
        params: { userId: 'string', collectionIds: 'array', days: 'number', budget: 'string' },
        example: { code: 0, data: { tripId: 'xxx', itinerary: [] }, msg: '生成成功' }
      },
      {
        path: '/api/trip/list',
        method: 'GET',
        description: '获取用户行程列表',
        params: { userId: 'string' },
        example: { code: 0, data: { trips: [] }, msg: '获取成功' }
      },
      {
        path: '/api/trip/get',
        method: 'GET',
        description: '获取行程详情',
        params: { tripId: 'string' },
        example: { code: 0, data: { trip: {} }, msg: '获取成功' }
      },
      {
        path: '/api/trip/update',
        method: 'POST',
        description: '更新行程',
        params: { tripId: 'string', itinerary: 'array' },
        example: { code: 0, data: {}, msg: '更新成功' }
      },
      {
        path: '/api/amap/route',
        method: 'POST',
        description: '高德路线规划',
        params: { origin: 'string', destination: 'string', waypoints: 'array' },
        example: { code: 0, data: { route: {} }, msg: '规划成功' }
      },
      {
        path: '/api/share/create',
        method: 'POST',
        description: '创建分享链接',
        params: { tripId: 'string', permission: 'edit|read' },
        example: { code: 0, data: { shareLink: 'xxx' }, msg: '创建成功' }
      },
      {
        path: '/api/share/verify',
        method: 'POST',
        description: '验证分享链接',
        params: { shareLink: 'string' },
        example: { code: 0, data: { tripId: 'xxx', permission: 'edit|read' }, msg: '验证成功' }
      },
      {
        path: '/api/config/amap',
        method: 'GET',
        description: '获取高德地图配置（前端使用）',
        params: {},
        example: { code: 0, data: { key: 'xxx', securityJsCode: 'xxx', apiDomain: 'https://restapi.amap.com' }, msg: '获取成功' }
      },
      {
        path: '/api/config/test',
        method: 'GET',
        description: '测试接口：返回高德配置（脱敏展示，仅用于调试）',
        params: {},
        example: { code: 0, data: { key: 'xxxx****xxxx', hasSecurityJsCode: '已配置', hasFrontSecurityJsCode: true, apiDomain: 'https://restapi.amap.com' }, msg: '配置信息（已脱敏）' }
      },
      {
        path: '/api/test/test-gpt-proxy',
        method: 'GET',
        description: '测试GPT代理接口：验证代理能否正常调用chat/completions（仅用于调试）',
        params: {},
        example: { code: 0, data: { success: true, result: '测试成功', duration: '1234ms', proxyConfigured: true }, msg: 'GPT代理测试成功' }
      }
    ]
  };
  res.json(docs);
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 1,
    data: null,
    msg: '接口不存在'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 1,
    data: null,
    msg: err.message || '服务器内部错误'
  });
});

// 启动前配置检查
const { validateConfig } = require('./utils/amapUtil');
try {
  // 检查高德配置（启动时仅警告，不阻止启动）
  validateConfig();
  console.log('✅ 高德地图配置检查通过');
  // 验证AMAP_KEY是否正确加载（仅显示前8位和后4位，用于调试）
  if (process.env.AMAP_KEY) {
    const key = process.env.AMAP_KEY;
    const maskedKey = key.length > 12 ? `${key.substring(0, 8)}****${key.substring(key.length - 4)}` : '****';
    console.log(`   AMAP_KEY: ${maskedKey} (已加载)`);
  }
} catch (error) {
  console.warn('⚠️  高德地图配置警告:', error.message);
  console.warn('   高德相关功能将不可用，请检查 .env 文件中的配置');
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 TripSync 服务器已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api/docs`);
});

