/**
 * 行程路由
 * 处理行程生成、获取、更新
 */

const express = require('express');
const router = express.Router();
const { readJsonFile, appendToJsonArray, findJsonArrayItem, updateJsonArrayItem, deleteJsonArrayItem, writeJsonFile } = require('../utils/fileUtil');
const { generateItinerary, callAIModel } = require('../utils/gptUtil');
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
    const { tripId, tripData } = req.query;
    const userId = getUserId(req); // 获取当前用户ID（关联用户）

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
        msg: '用户身份未识别'
      });
    }

    // 核心修改1：统一tripId格式为字符串，兼容前后端格式差异
    const tripIdStr = String(tripId);

    // 核心修改2：读取所有行程，使用字符串格式匹配tripId
    const trips = await readJsonFile('trips.json');
    let trip = trips.find(t => String(t.tripId) === tripIdStr);

    // 【修复步骤3】核心修复：解析tripData时添加错误处理
    if (!trip && tripData) {
      try {
        // 解析前端传递的tripData（处理格式错误）
        let parsedTripData;
        try {
          parsedTripData = JSON.parse(tripData);
          console.log('[get接口] 解析前端tripData成功:', parsedTripData.tripId || '未知tripId');
        } catch (parseErr) {
          // JSON解析失败：返回明确错误（而非默认"行程不存在"）
          console.error('[get接口] 解析tripData失败:', parseErr.message);
          return res.json({
            code: 1,
            data: null,
            msg: `行程数据格式错误：${parseErr.message}（请检查行程内容）`
          });
        }

        // 校验解析后的tripData完整性
        if (!parsedTripData.itinerary || !Array.isArray(parsedTripData.itinerary)) {
          return res.json({
            code: 1,
            data: null,
            msg: '行程数据缺少有效itinerary字段（需为数组）'
          });
        }

        // 创建新行程（复用sync-local接口的字段逻辑）
        const newTrip = {
          tripId: tripIdStr, // 复用前端tripId
          userId: userId,
          title: parsedTripData.title || `行程-${new Date().toLocaleDateString()}`,
          collectionIds: parsedTripData.collectionIds || [],
          days: parsedTripData.days || parsedTripData.itinerary.length,
          budget: parsedTripData.budget || '不限',
          preference: parsedTripData.preference || '',
          itinerary: parsedTripData.itinerary.map(day => ({
            day: day.day || '',
            date: day.date || new Date().toISOString().split('T')[0],
            items: day.items || []
          })),
          model: 'qwen',
          modelName: '手动同步行程',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 过滤空白天数（避免后端存储无效数据）
        newTrip.itinerary = newTrip.itinerary.filter(day => 
          day.items && Array.isArray(day.items) && day.items.length > 0
        );
        newTrip.days = newTrip.itinerary.length;

        // 保存到后端（复用appendToJsonArray，确保原子性）
        await appendToJsonArray('trips.json', newTrip);
        trip = newTrip; // 更新trip变量，后续正常返回
        console.log('[get接口] 自动创建前端传递的行程:', tripIdStr);
      } catch (createErr) {
        console.error('[get接口] 创建行程失败:', createErr.message);
        return res.json({
          code: 1,
          data: null,
          msg: `创建行程失败：${createErr.message}`
        });
      }
    }

    // 【修复步骤3】核心修改：兼容行程缺少userId的情况
    if (trip) {
      if (!trip.userId || trip.userId !== userId) {
        // 若行程无userId或userId不匹配，自动关联当前请求的用户ID（首次同步）
        trip.userId = userId;
        
        // 同步更新后端的trips.json（确保后续请求归属正确）
        const updatedTrips = trips.map(t => 
          String(t.tripId) === tripIdStr ? trip : t
        );
        await writeJsonFile('trips.json', updatedTrips);
        
        console.log('✅ 后端自动关联行程到当前用户:', userId);
      }
    }

    // 重新校验：行程存在且userId匹配
    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 再次确认userId匹配（双重保障）
    if (trip.userId !== userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在（或无权访问）'
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
 * 同步前端local行程到后端（处理"前端有数据但后端无"场景）
 * POST /api/trip/sync-local
 * Body: { userId, tripId, title, itinerary, days, budget, preference, collectionIds }
 */
router.post('/sync-local', async (req, res) => {
  try {
    const { userId, tripId, title, itinerary, days, budget, preference, collectionIds = [] } = req.body;
    
    // 1. 基础参数校验（返回明确的错误msg）
    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '同步失败：用户ID不能为空'
      });
    }
    if (!title) {
      return res.json({
        code: 1,
        data: null,
        msg: '同步失败：行程标题不能为空'
      });
    }
    if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '同步失败：行程数据（itinerary）不能为空且需为数组'
      });
    }
    
    if (userId.startsWith('guest_')) {
      await getOrCreateGuestUser(userId);
    }
    
    // 生成唯一tripId（如果前端未传递tripId，则生成新ID；否则复用前端传递的tripId）
    const finalTripId = tripId || crypto.randomBytes(8).toString('hex');
    
    // 【修复步骤4】检查行程是否已存在（避免重复创建）
    const trips = await readJsonFile('trips.json');
    const existingTrip = trips.find(t => 
      String(t.tripId) === String(finalTripId) && t.userId === userId
    );
    
    if (existingTrip) {
      // 行程已存在且userId匹配，返回业务提示（code=1，但属于正常提示）
      return res.json({
        code: 1,
        data: null,
        msg: '行程已存在，无需重复同步'
      });
    }
    
    const trip = {
      tripId: finalTripId,
      userId,
      title: title || `行程-${new Date().toLocaleDateString()}`,
      collectionIds: collectionIds,
      days: days || itinerary.length,
      budget: budget || '不限',
      preference: preference || '',
      itinerary: itinerary,
      model: 'qwen', // 兼容手动行程的模型标识
      modelName: '手动同步行程',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 保存到后端trips.json
    await appendToJsonArray('trips.json', trip);
    
    // 3. 成功时返回标准格式
    return res.json({
      code: 0,
      data: { tripId: finalTripId, trip },
      msg: '行程同步成功'
    });
  } catch (error) {
    console.error('同步local行程错误:', error);
    // 4. 失败时返回标准格式（确保包含msg）
    return res.json({
      code: 1,
      data: null,
      msg: `同步失败：${error.message || '后端处理异常'}`
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

    // 过滤空白天数：仅保留包含至少1个项目的天数
    const validItinerary = itinerary.filter(day => {
      return day.items && Array.isArray(day.items) && day.items.length > 0;
    });

    // 如果过滤后没有有效天数，返回错误
    if (validItinerary.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程数据不能为空，至少需要包含一个行程项目'
      });
    }

    // 构建更新数据对象
    const updateData = {
      itinerary: validItinerary,
      updatedAt: new Date().toISOString()
    };

    // 如果提供了title，也更新title
    if (title !== undefined && title !== null) {
      updateData.title = title;
    }

    // 更新days字段为过滤后的有效天数
    updateData.days = validItinerary.length;

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

/**
 * 智能修改行程（使用AI助手）
 * POST /api/trip/modify
 * Body: { tripId, userPrompt }
 */
router.post('/modify', async (req, res) => {
  try {
    const { tripId, userPrompt } = req.body;
    const userId = getUserId(req);

    // 新增：1. 校验用户ID存在性（优先校验，避免空值导致的误判）
    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份未识别，请重新加载页面'
      });
    }

    if (!tripId || !userPrompt) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID和修改指令不能为空'
      });
    }

    // 获取当前行程数据
    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);
    
    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 新增：2. 兼容游客用户ID格式（确保与行程的userId格式一致）
    const isGuest = userId.startsWith('guest_');
    const tripIsGuest = trip.userId && trip.userId.startsWith('guest_');
    
    // 如果用户类型不匹配，给出更明确的错误提示
    if (isGuest !== tripIsGuest) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份与行程创建者类型不匹配（游客/正式用户）'
      });
    }

    // 验证行程所有权（与攻略优化保持一致）
    if (trip.userId !== userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '无权修改该行程'
      });
    }

    // 构造AI提示词
    const agentPrompt = `你是一个专业的旅行规划助手。请基于以下现有行程，按照用户指令修改行程，返回JSON格式的行程数据。

现有行程数据：
${JSON.stringify(trip, null, 2)}

用户修改指令：${userPrompt}

要求：
1. 仅修改用户指定的内容，未提及的内容保持不变
2. 保持行程数据格式与现有格式完全一致
3. itinerary数组中每个项必须包含time（时间）、place（地点）、description（描述）字段
4. 保持tripId、userId、collectionIds等字段不变
5. 如果修改了天数，需要相应调整days字段
6. 直接返回完整的行程JSON对象，不要加其他说明文字

返回格式示例：
{
  "tripId": "原tripId",
  "userId": "原userId",
  "title": "行程标题",
  "days": 3,
  "itinerary": [
    {
      "day": 1,
      "date": "2024-01-01",
      "items": [
        {
          "time": "09:00",
          "place": "地点名称",
          "description": "地点描述"
        }
      ]
    }
  ]
}`;

    // 调用通义千问（优先使用通义千问，因为国内访问更稳定）
    const result = await callAIModel(agentPrompt, 'qwen');
    const content = result.content;
    
    console.log(`[智能修改] 使用 ${result.modelName} 修改成功`);

    // 提取 JSON 部分（去除可能的代码块标记）
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // 解析返回的JSON
    let modifiedTrip;
    try {
      modifiedTrip = JSON.parse(jsonStr);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取JSON对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        modifiedTrip = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI返回的格式不正确，无法解析JSON');
      }
    }

    // 验证并确保关键字段存在
    if (!modifiedTrip.itinerary || !Array.isArray(modifiedTrip.itinerary)) {
      throw new Error('AI返回的行程数据格式错误：缺少itinerary数组');
    }

    // 保持原有字段不变（tripId、userId等）
    modifiedTrip.tripId = trip.tripId;
    modifiedTrip.userId = trip.userId;
    modifiedTrip.collectionIds = trip.collectionIds || [];
    modifiedTrip.budget = modifiedTrip.budget || trip.budget || '不限';
    modifiedTrip.model = trip.model || 'qwen';
    modifiedTrip.modelName = trip.modelName || '通义千问';
    modifiedTrip.createdAt = trip.createdAt;
    modifiedTrip.updatedAt = new Date().toISOString();

    // 验证并格式化itinerary数据
    modifiedTrip.itinerary = modifiedTrip.itinerary.map((day, dayIndex) => ({
      day: day.day || dayIndex + 1,
      date: day.date || '',
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '',
        description: item.description || ''
      }))
    }));

    // 过滤空白天数：仅保留包含至少1个项目的天数
    modifiedTrip.itinerary = modifiedTrip.itinerary.filter(day => {
      return day.items && Array.isArray(day.items) && day.items.length > 0;
    });

    // 如果过滤后没有有效天数，返回错误
    if (modifiedTrip.itinerary.length === 0) {
      throw new Error('修改后的行程不能为空，至少需要包含一个行程项目');
    }

    // 确保days字段正确（从过滤后的itinerary长度计算）
    modifiedTrip.days = modifiedTrip.itinerary.length;

    res.json({
      code: 0,
      data: {
        trip: modifiedTrip,
        model: result.model,
        modelName: result.modelName
      },
      msg: '智能修改成功'
    });
  } catch (error) {
    console.error('智能修改错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '智能修改失败'
    });
  }
});

/**
 * 基于收藏夹攻略优化行程
 * POST /api/trip/optimize-with-favorite
 * Body: { tripId, collectionId, demand }
 */
router.post('/optimize-with-favorite', async (req, res) => {
  try {
    const { tripId, collectionId, demand } = req.body;
    const userId = getUserId(req);

    // 新增：1. 校验用户ID存在性（优先校验，避免空值导致的误判）
    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份未识别，请重新加载页面'
      });
    }

    // 原有校验逻辑（调整顺序，先校验必填参数）
    if (!tripId || !collectionId || !demand) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID、收藏ID和优化需求不能为空'
      });
    }

    // 获取当前行程数据
    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);
    
    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 新增：2. 兼容游客用户ID格式（确保与行程的userId格式一致）
    const isGuest = userId.startsWith('guest_');
    const tripIsGuest = trip.userId && trip.userId.startsWith('guest_');
    
    // 如果用户类型不匹配，给出更明确的错误提示
    if (isGuest !== tripIsGuest) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份与行程创建者类型不匹配（游客/正式用户）'
      });
    }

    // 原有权限校验逻辑
    if (trip.userId !== userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '无权修改该行程'
      });
    }

    // 获取收藏的攻略内容
    const collections = await readJsonFile('collections.json');
    const favoriteCollection = collections.find(c => 
      c.collectionId === collectionId && c.userId === userId
    );

    if (!favoriteCollection) {
      return res.json({
        code: 1,
        data: null,
        msg: '收藏的攻略不存在或无权访问'
      });
    }

    // 核心修改：直接使用用户输入的自定义需求，不再使用预设的demandMap
    const demandDescription = demand;

    // 构造AI提示词
    const agentPrompt = `你是一个专业的旅行规划助手。请基于以下现有行程和收藏的攻略内容，按照用户需求优化行程，返回JSON格式的行程数据。

现有行程数据：
${JSON.stringify(trip, null, 2)}

收藏攻略内容：
标题：${favoriteCollection.title || '未命名攻略'}
内容：${favoriteCollection.content || ''}
地点标签：${(favoriteCollection.tags && favoriteCollection.tags.length > 0) 
  ? favoriteCollection.tags.join('、') 
  : (favoriteCollection.places && favoriteCollection.places.length > 0 
    ? favoriteCollection.places.join('、') 
    : '未提取')}

用户自定义优化需求：${demandDescription}

要求：
1. 仅在现有行程基础上修改/新增，不删除原有非空项目
2. 新增的美食/景点需匹配现有行程的时间逻辑（如中午11:30-13:00安排午餐，晚上18:00-20:00安排晚餐）
3. 保持行程数据格式与现有格式完全一致
4. itinerary数组中每个项必须包含time（时间）、place（地点）、description（描述）字段
5. 保持tripId、userId、collectionIds等字段不变
6. 如果修改了天数，需要相应调整days字段
7. 直接返回完整的行程JSON对象，不要加其他说明文字

返回格式示例：
{
  "tripId": "原tripId",
  "userId": "原userId",
  "title": "行程标题",
  "days": 3,
  "itinerary": [
    {
      "day": 1,
      "date": "2024-01-01",
      "items": [
        {
          "time": "09:00",
          "place": "地点名称",
          "description": "地点描述"
        }
      ]
    }
  ]
}`;

    // 调用通义千问（优先使用通义千问，因为国内访问更稳定）
    const result = await callAIModel(agentPrompt, 'qwen');
    const content = result.content;
    
    console.log(`[攻略优化] 使用 ${result.modelName} 优化成功`);

    // 提取 JSON 部分（去除可能的代码块标记）
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // 解析返回的JSON
    let optimizedTrip;
    try {
      optimizedTrip = JSON.parse(jsonStr);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取JSON对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        optimizedTrip = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI返回的格式不正确，无法解析JSON');
      }
    }

    // 验证并确保关键字段存在
    if (!optimizedTrip.itinerary || !Array.isArray(optimizedTrip.itinerary)) {
      throw new Error('AI返回的行程数据格式错误：缺少itinerary数组');
    }

    // 保持原有字段不变（tripId、userId等）
    optimizedTrip.tripId = trip.tripId;
    optimizedTrip.userId = trip.userId;
    optimizedTrip.collectionIds = trip.collectionIds || [];
    optimizedTrip.budget = optimizedTrip.budget || trip.budget || '不限';
    optimizedTrip.model = trip.model || 'qwen';
    optimizedTrip.modelName = trip.modelName || '通义千问';
    optimizedTrip.createdAt = trip.createdAt;
    optimizedTrip.updatedAt = new Date().toISOString();

    // 验证并格式化itinerary数据
    optimizedTrip.itinerary = optimizedTrip.itinerary.map((day, dayIndex) => ({
      day: day.day || dayIndex + 1,
      date: day.date || '',
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '',
        description: item.description || ''
      }))
    }));

    // 过滤空白天数：仅保留包含至少1个项目的天数
    optimizedTrip.itinerary = optimizedTrip.itinerary.filter(day => {
      return day.items && Array.isArray(day.items) && day.items.length > 0;
    });

    // 如果过滤后没有有效天数，返回错误
    if (optimizedTrip.itinerary.length === 0) {
      throw new Error('优化后的行程不能为空，至少需要包含一个行程项目');
    }

    // 确保days字段正确（从过滤后的itinerary长度计算）
    optimizedTrip.days = optimizedTrip.itinerary.length;

    res.json({
      code: 0,
      data: {
        trip: optimizedTrip,
        model: result.model,
        modelName: result.modelName
      },
      msg: '基于攻略优化成功'
    });
  } catch (error) {
    console.error('攻略优化错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '攻略优化失败'
    });
  }
});

/**
 * 基于多个收藏夹攻略优化行程
 * POST /api/trip/optimize-with-multi-favorite
 * Body: { tripId, collectionIds, demand, userId }
 */
router.post('/optimize-with-multi-favorite', async (req, res) => {
  try {
    const { tripId, collectionIds, demand } = req.body;
    const userId = getUserId(req);

    // 新增：1. 校验用户ID存在性（优先校验，避免空值导致的误判）
    if (!userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份未识别，请重新加载页面'
      });
    }

    // 校验：至少选择一个攻略
    if (!tripId || !collectionIds || !Array.isArray(collectionIds) || collectionIds.length === 0 || !demand) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程ID、至少选择一个攻略、优化需求不能为空'
      });
    }

    // 获取当前行程数据
    const trip = await findJsonArrayItem('trips.json', 'tripId', tripId);
    
    if (!trip) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程不存在'
      });
    }

    // 新增：2. 兼容游客用户ID格式（确保与行程的userId格式一致）
    const isGuest = userId.startsWith('guest_');
    const tripIsGuest = trip.userId && trip.userId.startsWith('guest_');
    
    // 如果用户类型不匹配，给出更明确的错误提示
    if (isGuest !== tripIsGuest) {
      return res.json({
        code: 1,
        data: null,
        msg: '用户身份与行程创建者类型不匹配（游客/正式用户）'
      });
    }

    // 原有权限校验逻辑
    if (trip.userId !== userId) {
      return res.json({
        code: 1,
        data: null,
        msg: '无权修改该行程'
      });
    }

    // 合并多个攻略的内容
    const collections = await readJsonFile('collections.json');
    let mergedFavoriteContent = '';
    const favoriteCollections = [];

    for (const collectionId of collectionIds) {
      const collection = collections.find(c => 
        c.collectionId === collectionId && c.userId === userId
      );
      
      if (collection) {
        favoriteCollections.push(collection);
        // 合并攻略内容，标注攻略标题
        mergedFavoriteContent += `【攻略：${collection.title || '未命名攻略'}】\n`;
        mergedFavoriteContent += `内容：${collection.content || ''}\n`;
        // 添加标签信息
        const tagsToShow = (collection.tags && collection.tags.length > 0) 
          ? collection.tags 
          : (collection.places || []);
        if (tagsToShow.length > 0) {
          mergedFavoriteContent += `地点标签：${tagsToShow.join('、')}\n`;
        }
        mergedFavoriteContent += '\n';
      }
    }

    if (favoriteCollections.length === 0) {
      return res.json({
        code: 1,
        data: null,
        msg: '选中的攻略不存在或无权访问'
      });
    }

    // 构造AI提示词（说明是多攻略）
    const agentPrompt = `你是一个专业的旅行规划助手。请基于以下现有行程、多个收藏的攻略内容，按照用户需求优化行程，返回JSON格式的行程数据。

现有行程数据：
${JSON.stringify(trip, null, 2)}

多个收藏攻略内容：
${mergedFavoriteContent}

用户自定义优化需求：${demand}

要求：
1. 仅在现有行程基础上修改/新增，不删除原有非空项目
2. 结合多个攻略的内容，综合优化行程安排
3. 新增的美食/景点需匹配现有行程的时间逻辑（如中午11:30-13:00安排午餐，晚上18:00-20:00安排晚餐）
4. 保持行程数据格式与现有格式完全一致
5. itinerary数组中每个项必须包含time（时间）、place（地点）、description（描述）字段
6. 保持tripId、userId、collectionIds等字段不变
7. 如果修改了天数，需要相应调整days字段
8. 直接返回完整的行程JSON对象，不要加其他说明文字

返回格式示例：
{
  "tripId": "原tripId",
  "userId": "原userId",
  "title": "行程标题",
  "days": 3,
  "itinerary": [
    {
      "day": 1,
      "date": "2024-01-01",
      "items": [
        {
          "time": "09:00",
          "place": "地点名称",
          "description": "地点描述"
        }
      ]
    }
  ]
}`;

    // 调用通义千问（优先使用通义千问，因为国内访问更稳定）
    const result = await callAIModel(agentPrompt, 'qwen');
    const content = result.content;
    
    console.log(`[多攻略优化] 使用 ${result.modelName} 优化成功`);

    // 提取 JSON 部分（去除可能的代码块标记）
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // 解析返回的JSON
    let optimizedTrip;
    try {
      optimizedTrip = JSON.parse(jsonStr);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取JSON对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        optimizedTrip = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI返回的格式不正确，无法解析JSON');
      }
    }

    // 验证并确保关键字段存在
    if (!optimizedTrip.itinerary || !Array.isArray(optimizedTrip.itinerary)) {
      throw new Error('AI返回的行程数据格式错误：缺少itinerary数组');
    }

    // 保持原有字段不变（tripId、userId等）
    optimizedTrip.tripId = trip.tripId;
    optimizedTrip.userId = trip.userId;
    optimizedTrip.collectionIds = trip.collectionIds || [];
    optimizedTrip.budget = optimizedTrip.budget || trip.budget || '不限';
    optimizedTrip.model = trip.model || 'qwen';
    optimizedTrip.modelName = trip.modelName || '通义千问';
    optimizedTrip.createdAt = trip.createdAt;
    optimizedTrip.updatedAt = new Date().toISOString();

    // 验证并格式化itinerary数据
    optimizedTrip.itinerary = optimizedTrip.itinerary.map((day, dayIndex) => ({
      day: day.day || dayIndex + 1,
      date: day.date || '',
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '',
        description: item.description || ''
      }))
    }));

    // 过滤空白天数：仅保留包含至少1个项目的天数
    optimizedTrip.itinerary = optimizedTrip.itinerary.filter(day => {
      return day.items && Array.isArray(day.items) && day.items.length > 0;
    });

    // 如果过滤后没有有效天数，返回错误
    if (optimizedTrip.itinerary.length === 0) {
      throw new Error('优化后的行程不能为空，至少需要包含一个行程项目');
    }

    // 确保days字段正确（从过滤后的itinerary长度计算）
    optimizedTrip.days = optimizedTrip.itinerary.length;

    res.json({
      code: 0,
      data: {
        trip: optimizedTrip,
        model: result.model,
        modelName: result.modelName
      },
      msg: '基于多个攻略优化成功'
    });
  } catch (error) {
    console.error('多攻略优化错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '多攻略优化失败'
    });
  }
});

/**
 * 智能解析手动输入的行程内容
 * POST /api/trip/parse-manual
 * Body: { content, title }
 */
router.post('/parse-manual', async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content || !content.trim()) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程内容不能为空'
      });
    }

    // 构造通义千问Prompt
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentDate = String(new Date().getDate()).padStart(2, '0');
    const today = `${currentYear}-${currentMonth}-${currentDate}`;

    const parsePrompt = `你是一个专业的行程解析助手。请解析以下任意格式的行程内容，提取结构化行程数据。

**任务要求：**
1. 仔细分析行程内容，识别日期、时间、地点、活动等信息；
2. 将同一日期的行程归为一个day对象；
3. 提取或推断合理的时间、地点和描述；

**输出格式（必须严格按照此JSON格式）：**
{
  "title": "行程标题（若用户未指定标题，需根据内容自动生成一个合适的标题）",
  "days": [
    {
      "date": "日期（格式：YYYY-MM-DD，如：${currentYear}-12-30）。注意：若内容中未指定年份，使用${currentYear}；若未指定具体日期，根据上下文推断；如果是相对时间（如'今天'、'明天'），转换为具体日期（今天是${today}）",
      "itinerary": [
        {
          "time": "时间（格式：HH:MM，如：09:00）。若未指定具体时间，推断合理时间：'早上/上午'→08:00或09:00，'中午'→12:00，'下午'→14:00或15:00，'晚上/傍晚'→18:00或19:00，无法推断则填'00:00'",
          "place": "地点（提取内容中的地点名称，如：乐天百货、水族馆、酒店名称等）",
          "description": "描述（包含该行程的细节、活动、航班号、住宿信息、餐饮等，尽量详细）"
        }
      ]
    }
  ]
}

**重要规则：**
- 同一日期的行程必须归为一个day对象，按时间顺序排列itinerary数组；
- 航班信息（航班号、起降时间、机场）需包含在description中；
- 住宿信息（酒店名称、地址、入住/退房时间）需包含在description中；
- 餐饮信息（餐厅名称、用餐类型）需包含在description中；
- 日期必须转换为具体日期（格式：YYYY-MM-DD），不能使用相对时间；
- 时间尽量推断合理，但若无法确定则使用'00:00'；
- **直接返回JSON对象，不要加任何说明文字、代码块标记（如\`\`\`json）或其他内容。**

**行程内容：**
${content.trim()}

${title ? `**用户指定的标题：** ${title}\n\n请优先使用用户指定的标题，不要修改。` : ''}`;

    // 调用通义千问API
    let result;
    try {
      console.log('[手动行程解析] 开始解析行程内容，长度:', content.length);
      result = await callAIModel(parsePrompt, 'qwen');
      console.log('[手动行程解析] AI解析成功，使用模型:', result.modelName);
    } catch (aiError) {
      console.error('[手动行程解析] AI解析失败:', aiError.message);
      return res.json({
        code: 1,
        data: null,
        msg: `行程解析失败: ${aiError.message}`
      });
    }

    const aiContent = result.content;

    // 提取JSON部分（去除可能的代码块标记）
    let jsonStr = aiContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // 解析JSON
    let parsedTrip;
    try {
      parsedTrip = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[手动行程解析] JSON解析失败:', parseError.message);
      console.error('[手动行程解析] AI返回内容:', aiContent);
      return res.json({
        code: 1,
        data: null,
        msg: 'AI返回格式错误，请简化内容后重试'
      });
    }

    // 校验数据格式
    if (!parsedTrip || !parsedTrip.days || !Array.isArray(parsedTrip.days)) {
      return res.json({
        code: 1,
        data: null,
        msg: '行程解析失败，返回格式不正确'
      });
    }

    // 优先使用用户指定的标题
    if (title && title.trim()) {
      parsedTrip.title = title.trim();
    }

    // 确保有标题
    if (!parsedTrip.title || !parsedTrip.title.trim()) {
      parsedTrip.title = `手动行程-${new Date().toLocaleDateString()}`;
    }

    // 转换为系统标准格式（与AI生成行程格式一致）
    const itinerary = parsedTrip.days.map((day, index) => ({
      day: index + 1,
      date: day.date || new Date().toISOString().split('T')[0],
      items: (day.itinerary || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '未命名地点',
        description: item.description || ''
      }))
    }));

    // 计算总天数
    const days = itinerary.length;

    // 返回标准格式的数据
    res.json({
      code: 0,
      data: {
        itinerary: itinerary,
        title: parsedTrip.title,
        days: days,
        model: 'qwen',
        modelName: result.modelName
      },
      msg: '解析成功'
    });

  } catch (error) {
    console.error('手动行程解析错误:', error);
    res.json({
      code: 1,
      data: null,
      msg: error.message || '行程解析失败'
    });
  }
});

module.exports = router;

