/**
 * 行程路由
 * 处理行程生成、获取、更新
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray, findJsonArrayItem, updateJsonArrayItem, deleteJsonArrayItem } = require('../utils/fileUtil');
const { generateItinerary } = require('../utils/gptUtil');
const { getOrCreateGuestUser } = require('./user');
const { getUserId } = require('../utils/requestHelper');
const crypto = require('crypto');

/**
 * AI 生成行程
 * POST /api/trip/generate
 * Body: { userId, collectionIds, days, budget }
 */
router.post('/generate', async (req, res) => {
  try {
    const { collectionIds, days, budget } = req.body;
    const userId = getUserId(req); // 支持userId和guestId

    if (!userId || !collectionIds || !Array.isArray(collectionIds) || collectionIds.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID和收藏ID列表不能为空'
      });
    }

    // 如果是游客ID，创建或获取游客用户
    if (userId.startsWith('guest_')) {
      await getOrCreateGuestUser(userId);
    }

    if (!days || days < 1) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程天数必须大于0'
      });
    }

    // 获取收藏内容
    const collections = await readJsonFile('collections.json');
    const selectedCollections = collections.filter(c => 
      collectionIds.includes(c.collectionId) && c.userId === userId
    );

    if (selectedCollections.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '未找到有效的收藏内容'
      });
    }

    // 获取前端传递的模型类型（gpt/qwen/auto），默认为 auto
    const modelType = req.body.modelType || 'auto';
    
    // 获取前端传递的行程偏好
    const preference = req.body.preference || '';
    
    // 调用 AI 模型生成行程
    let result;
    try {
      console.log('[行程生成] 开始生成行程，收藏数量:', selectedCollections.length, '天数:', days, '模型类型:', modelType, '偏好:', preference || '无');
      result = await generateItinerary(selectedCollections, days, budget, modelType, preference);
      console.log('[行程生成] 行程生成成功，天数:', result.itinerary.length, '使用模型:', result.modelName);
    } catch (gptError) {
      console.error('[行程生成] AI 生成失败:', gptError.message);
      
      // 根据错误类型提供更明确的提示
      let errorMsg = `AI 生成失败: ${gptError.message}`;
      
      // 如果是配置相关错误，提供更详细的提示
      if (gptError.message.includes('服务地址配置错误') || 
          gptError.message.includes('无法解析') ||
          gptError.message.includes('连接失败')) {
        errorMsg = `AI 服务配置错误: ${gptError.message}。请检查 .env 文件中的 OPENAI_API_URL 和 OPENAI_PROXY_URL 配置`;
      } else if (gptError.message.includes('请求超时') || gptError.message.includes('timeout')) {
        errorMsg = `AI 服务请求超时: ${gptError.message}。请检查网络连接或稍后重试`;
      } else if (gptError.message.includes('API Key 未配置')) {
        errorMsg = 'OpenAI API Key 未配置，请在 .env 文件中配置 OPENAI_API_KEY';
      }
      
      return res.json({
        code: 1,
        data: null,
        msg: errorMsg
      });
    }

    // 保存行程
    const tripId = crypto.randomBytes(8).toString('hex');
    const trip = {
      tripId,
      userId,
      title: `行程-${new Date().toLocaleDateString()}`,
      collectionIds,
      days,
      budget: budget || '不限',
      preference: preference || '', // 保存偏好信息
      itinerary: result.itinerary,
      model: result.model,
      modelName: result.modelName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await appendToJsonArray('trips.json', trip);

    res.json({
      code: 0,
      data: {
        tripId,
        itinerary: result.itinerary,
        model: result.model,
        modelName: result.modelName
      },
      msg: `生成成功（使用 ${result.modelName}）`
    });
  } catch (error) {
    console.error('生成错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '生成失败'
    });
  }
});

/**
 * 获取用户行程列表
 * GET /api/trip/list?userId=xxx
 */
router.get('/list', async (req, res) => {
  try {
    const userId = getUserId(req); // 支持userId和guestId

    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID不能为空'
      });
    }

    // 如果是游客ID，创建或获取游客用户
    if (userId.startsWith('guest_')) {
      await getOrCreateGuestUser(userId);
    }

    const trips = await readJsonFile('trips.json');
    const userTrips = trips.filter(t => t.userId === userId);

    res.json({
      code: 0,
      data: {
        trips: userTrips
      },
      msg: '获取成功'
    });
  } catch (error) {
    console.error('获取错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '获取失败'
    });
  }
});

/**
 * 获取行程详情
 * GET /api/trip/get?tripId=xxx
 */
router.get('/get', async (req, res) => {
  try {
    const { tripId } = req.query;

    if (!tripId) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID不能为空'
      });
    }

    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);

    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    res.json({
      code: 0,
      data: {
        trip
      },
      msg: '获取成功'
    });
  } catch (error) {
    console.error('获取错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '获取失败'
    });
  }
});

/**
 * 更新行程
 * POST /api/trip/update
 * Body: { tripId, itinerary, title, days }
 */
router.post('/update', async (req, res) => {
  try {
    const { tripId, itinerary, title, days } = req.body;

    if (!tripId || !itinerary) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID和行程数据不能为空'
      });
    }

    if (!Array.isArray(itinerary)) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程数据格式错误：应为数组'
      });
    }

    // 构建更新数据对象
    const updateData = {
      itinerary,
      updatedAt: new Date().toISOString()
    };

    // 如果提供了title，也更新title
    if (title !== undefined && title !== null) {
      updateData.title = title;
    }

    // 如果提供了days，也更新days
    if (days !== undefined && days !== null) {
      updateData.days = days;
    }

    // 更新行程
    const success = await updateJsonArrayItem('trips.json', 'tripId', tripId, updateData);

    if (!success) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    res.json({
      code: 0,
      data: {},
      msg: '更新成功'
    });
  } catch (error) {
    console.error('更新错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '更新失败'
    });
  }
});

/**
 * 删除行程
 * DELETE /api/trip/delete
 * Body: { tripId, userId }
 */
router.delete('/delete', async (req, res) => {
  try {
    const { tripId, userId } = req.body;

    if (!tripId) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID不能为空'
      });
    }

    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户ID不能为空'
      });
    }

    // 先检查行程是否存在，以及是否属于该用户
    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);
    
    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 验证权限：只有行程的所有者才能删除
    if (trip.userId !== userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '无权删除该行程'
      });
    }

    // 从文件中删除行程
    const success = await deleteJsonArrayItem('trips.json', 'tripId', tripId);

    if (!success) {
      return res.json({
        code: 1,
        data: null,
        msg: '删除失败'
      });
    }

    res.json({
      code: 0,
      data: {},
      msg: '删除成功'
    });
  } catch (error) {
    console.error('删除错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '删除失败'
    });
  }
});

module.exports = router;

