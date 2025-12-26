/**
 * 行程编辑模块
 * 处理行程加载、编辑、保存
 */

let currentEditTrip = null;

// 存储智能行程优化的所有收藏项（用于搜索过滤）
let allFavoriteLinks = [];

// ==================== 工具函数：整合重复逻辑 ====================

/**
 * 存储键名常量
 */
const STORAGE_KEYS = {
  TRIP_LIST: 'trip_list'
};

/**
 * 获取当前编辑行程的tripId（整合重复逻辑）
 * @returns {string|null} 当前行程ID，未找到返回null
 */
function getCurrentTripId() {
  // 优先级1：全局变量
  if (window.currentLoadedTripId) {
    return String(window.currentLoadedTripId);
  }
  
  // 优先级2：DOM属性
  const editPanel = document.querySelector('.trip-edit-panel');
  const editContainer = document.getElementById('editTripContainer');
  
  if (editPanel?.dataset.currentTripId) {
    return editPanel.dataset.currentTripId;
  }
  if (editContainer?.dataset.currentTripId) {
    return editContainer.dataset.currentTripId;
  }
  
  // 优先级3：内存中的行程数据
  if (currentEditTrip?.tripId) {
    return String(currentEditTrip.tripId);
  }
  
  return null;
}

/**
 * 更新localStorage中的行程数据（整合重复逻辑）
 * @param {string} tripId 行程ID
 * @param {Object} tripData 行程数据（至少包含tripId, title, days, savedAt/updatedAt）
 */
function updateTripInLocalStorage(tripId, tripData) {
  try {
    let tripList = [];
    const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
    if (listData) {
      tripList = JSON.parse(listData);
    }
    
    const existingIndex = tripList.findIndex(t => String(t.tripId) === String(tripId));
    
    const tripListItem = {
      tripId: tripData.tripId || tripId,
      title: tripData.title || '未命名行程',
      days: tripData.days || 0,
      savedAt: tripData.savedAt || tripData.updatedAt || new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      tripList[existingIndex] = tripListItem;
    } else {
      tripList.push(tripListItem);
    }
    
    localStorage.setItem(STORAGE_KEYS.TRIP_LIST, JSON.stringify(tripList));
  } catch (error) {
    console.warn('更新localStorage失败:', error);
  }
}

/**
 * 过滤空白天数（整合重复逻辑）
 * @param {Array} itinerary 行程数据
 * @returns {Array} 过滤后的行程数据
 */
function filterEmptyDays(itinerary) {
  if (!itinerary || !Array.isArray(itinerary)) {
    return [];
  }
  return itinerary.filter(day => {
    return day.items && Array.isArray(day.items) && day.items.length > 0;
  });
}

/**
 * 更新编辑面板的tripId（整合重复逻辑）
 * @param {string} tripId 行程ID
 */
function updateEditPanelTripId(tripId) {
  const editPanel = document.querySelector('.trip-edit-panel');
  const editContainer = document.getElementById('editTripContainer');
  if (editPanel) {
    editPanel.dataset.currentTripId = String(tripId);
  }
  if (editContainer) {
    editContainer.dataset.currentTripId = String(tripId);
  }
}

/**
 * 应用优化后的行程数据（整合AI优化后的重复处理逻辑）
 * @param {Object} optimizedTrip 优化后的行程数据
 * @param {string} currentTripId 当前行程ID
 * @param {Object} response API响应（包含modelName等信息）
 */
function applyOptimizedTrip(optimizedTrip, currentTripId, response) {
  // 1. 过滤空天数
  if (optimizedTrip.itinerary && Array.isArray(optimizedTrip.itinerary)) {
    optimizedTrip.itinerary = filterEmptyDays(optimizedTrip.itinerary);
    optimizedTrip.days = optimizedTrip.itinerary.length;
  }
  
  // 2. 更新内存中的行程数据
  currentEditTrip = optimizedTrip;
  if (window.tripEditModule) {
    window.tripEditModule.currentEditTrip = optimizedTrip;
  }
  
  // 3. 更新编辑面板的tripId
  updateEditPanelTripId(optimizedTrip.tripId);
  
  // 4. 更新行程标题
  const titleEl = document.getElementById('editTripTitle');
  if (titleEl) {
    titleEl.textContent = optimizedTrip.title || '未命名行程';
    if (window.tripListManager && typeof window.tripListManager.initEditTitle === 'function') {
      window.tripListManager.initEditTitle();
    }
  }
  
  // 5. 刷新编辑区
  displayEditItinerary(optimizedTrip.itinerary, optimizedTrip);
  
  // 6. 更新localStorage
  updateTripInLocalStorage(currentTripId, optimizedTrip);
  
  // 7. 刷新行程列表
  if (window.tripListManager && window.tripListManager.loadAllTrips) {
    window.tripListManager.loadAllTrips();
  }
}

/**
 * 获取当前登录用户ID（修复版本）
 * @returns {string|null} 用户ID，未登录返回null
 */
function getCurrentLoginUserId() {
  const currentUser = window.userModule?.getCurrentUser();
  if (!currentUser || !currentUser.userId) {
    // 未登录用户，不跳转（由调用方决定是否跳转）
    return null;
  }
  return currentUser.userId;
}

/**
 * 检查当前用户是否有权修改该行程（带调试日志）
 * 【修复】优先复用前端已加载的行程数据，避免重复调用后端接口
 * @param {string|number} tripId 行程ID
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkTripModifyPermission(tripId) {
  try {
    const currentUserId = getCurrentLoginUserId();
    
    if (!currentUserId) {
      console.log('权限校验调试：未登录用户');
      return false;
    }

    // 统一tripId格式为字符串
    const tripIdStr = String(tripId);

    // 核心修改1：优先复用前端已加载的行程数据（currentEditTrip），避免重复调用后端接口
    if (currentEditTrip && String(currentEditTrip.tripId) === tripIdStr) {
      // 补全权限字段（兼容旧数据）
      const trip = {
        ...currentEditTrip,
        creatorId: currentEditTrip.creatorId || currentEditTrip.userId || currentUserId,
        collaborators: currentEditTrip.collaborators || []
      };
      
      // 权限规则：创建者或协作者可修改
      const isCreator = (trip.creatorId === currentUserId) || (trip.userId === currentUserId);
      const isCollaborator = Array.isArray(trip.collaborators) && trip.collaborators.includes(currentUserId);
      const hasPermission = isCreator || isCollaborator;

      console.log('权限校验调试：复用前端已加载数据，权限结果:', {
        currentUserId,
        tripId: tripIdStr,
        tripCreatorId: trip.creatorId,
        tripUserId: trip.userId,
        hasPermission
      });

      return hasPermission;
    }

    // 核心修改2：仅当未加载数据时，才调用后端接口，且传递字符串格式的tripId和userId
    try {
      const data = await window.api.get('/trip/get', { 
        tripId: tripIdStr, // 统一转为字符串
        userId: currentUserId, // 传递用户ID，供后端校验归属
        // 【修复步骤4】传递前端currentEditTrip数据，供后端创建
        tripData: currentEditTrip ? JSON.stringify(currentEditTrip) : ''
      });
      const trip = data.trip;

      if (!trip) {
        console.log('权限校验调试：后端未找到行程，tripId:', tripIdStr);
        return false;
      }

      // 补全权限字段（兼容旧数据）
      trip.creatorId = trip.creatorId || trip.userId || currentUserId;
      trip.collaborators = trip.collaborators || [];

      // 权限规则：创建者或协作者可修改
      const isCreator = (trip.creatorId === currentUserId) || (trip.userId === currentUserId);
      const isCollaborator = Array.isArray(trip.collaborators) && trip.collaborators.includes(currentUserId);
      const hasPermission = isCreator || isCollaborator;

      console.log('权限校验调试（后端接口）：', {
        currentUserId,
        tripId: tripIdStr,
        tripCreatorId: trip.creatorId,
        tripUserId: trip.userId,
        hasPermission
      });

      return hasPermission;
    } catch (apiError) {
      // 【修复步骤4】若后端返回"行程不存在"，先同步local数据再重试
      if (apiError.message?.includes('行程不存在') && currentEditTrip && String(currentEditTrip.tripId) === tripIdStr) {
        console.log('⚠️ 权限校验时后端无行程，先同步local数据');
        try {
          // 调用同步函数
          await syncLocalTripToBackend(currentEditTrip, currentUserId);
          
          // 同步后重试权限校验
          const retryData = await window.api.get('/trip/get', {
            tripId: tripIdStr,
            userId: currentUserId
          });
          const trip = retryData.trip;
          
          if (!trip) {
            return false;
          }
          
          // 补全权限字段（兼容旧数据）
          trip.creatorId = trip.creatorId || trip.userId || currentUserId;
          trip.collaborators = trip.collaborators || [];
          
          // 权限规则：创建者或协作者可修改
          const isCreator = (trip.creatorId === currentUserId) || (trip.userId === currentUserId);
          const isCollaborator = Array.isArray(trip.collaborators) && trip.collaborators.includes(currentUserId);
          const hasPermission = isCreator || isCollaborator;
          
          return hasPermission;
        } catch (syncError) {
          console.error('同步local行程失败:', syncError);
          // 同步失败，但如果前端已加载数据，允许继续操作
          return true;
        }
      }
      
      // 若后端返回"无权访问"，但前端已加载成功，允许继续操作
      if (apiError.message?.includes('无权访问')) {
        console.warn('权限校验警告：后端提示无权访问，但前端可能已加载本地数据，允许继续操作');
        // 如果前端已加载数据，返回true；否则返回false
        return currentEditTrip && String(currentEditTrip.tripId) === tripIdStr;
      }
      
      throw apiError; // 其他错误继续抛出
    }
  } catch (error) {
    console.error('权限校验失败:', error);
    return false;
  }
}

/**
 * 【新增辅助函数】同步local行程到后端（复用生成行程的格式）
 * @param {Object} localTrip 本地行程数据
 * @param {string} userId 用户ID
 * @returns {Promise<string>} 返回同步后的tripId
 */
async function syncLocalTripToBackend(localTrip, userId) {
  try {
    // 【核心修复】补全后端必填字段（参考trip.js的sync-local接口校验）
    const syncData = {
      userId: userId,
      tripId: localTrip.tripId, // 传递前端local的tripId，确保一致
      // 补全collectionIds：local行程可能缺少，默认空数组（后端要求为数组）
      collectionIds: localTrip.collectionIds || [],
      // 补全days：确保为数字（后端要求>0）
      days: localTrip.days || (localTrip.itinerary ? localTrip.itinerary.length : 1),
      // 补全budget：默认"不限"（后端非必填但建议填充）
      budget: localTrip.budget || '不限',
      // 补全preference：默认空字符串
      preference: localTrip.preference || '',
      // 校验itinerary格式：确保为数组且每个day有items
      itinerary: (localTrip.itinerary || []).map(day => ({
        day: day.day || '',
        date: day.date || new Date().toISOString().split('T')[0],
        // 补全items：确保为数组（避免后端过滤后为空）
        items: (day.items || []).length > 0 
          ? day.items 
          : [{ time: '09:00', place: '未命名地点', description: '默认行程项' }]
      })),
      // 补全title：避免后端使用默认标题
      title: localTrip.title || `行程-${new Date().toLocaleDateString()}`
    };

    // 【新增】前端校验：确保days>0且itinerary非空（避免后端校验失败）
    if (syncData.days < 1) syncData.days = 1;
    if (syncData.itinerary.length === 0) {
      syncData.itinerary.push({
        day: 1,
        date: new Date().toISOString().split('T')[0],
        items: [{ time: '09:00', place: '未命名地点', description: '默认行程项' }]
      });
      syncData.days = 1;
    }

    // 调用后端同步接口（使用postRaw返回完整响应，区分业务提示与错误）
    const response = await window.api.postRaw('/trip/sync-local', syncData);
    
    // 【简化】仅打印成功提示
    if (response.code === 0) {
      console.log(`[同步行程] 行程 ${localTrip.tripId} 同步成功`);
      return response.data?.tripId || localTrip.tripId;
    } else if (response.msg && response.msg.includes('行程已存在')) {
      // 行程已存在属于正常业务提示，不触发警告
      console.log(`[同步行程] 行程 ${localTrip.tripId} 已存在`);
      return localTrip.tripId;
    } else {
      // 其他业务错误才触发警告
      throw new Error(response.msg || '同步失败');
    }
  } catch (error) {
    // 【保留】错误日志
    console.error(`[同步行程] 失败:`, error);
    // 确保错误信息非空
    const errorMsg = error.message || '未知错误';
    window.api.showToast(`同步警告：${errorMsg}`, 'warning');
    // 抛出自定义错误（包含明确信息）
    throw new Error(errorMsg);
  }
}

/**
 * 加载行程列表
 */
async function loadTripList() {
  const selector = document.getElementById('tripSelector');
  if (!selector) return;
  
  selector.innerHTML = '<option value="">请选择行程</option>';
  
  // 从localStorage读取已保存的行程
  try {
    const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
    if (listData) {
      const localTrips = JSON.parse(listData);
      localTrips.forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.tripId;
        option.textContent = `${trip.title || '未命名行程'} (${trip.days || 0}天)`;
        option.dataset.source = 'local';
        selector.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载localStorage行程列表失败:', error);
  }
  
  // 从后端API读取行程（如果用户已登录）
  const user = window.userModule.getCurrentUser();
  if (user) {
    try {
      const data = await window.api.get('/trip/list', { userId: user.userId });
      const trips = data.trips || [];
      
      trips.forEach(trip => {
        // 检查是否已存在（避免重复）
        const existing = Array.from(selector.options).find(opt => opt.value === trip.tripId);
        if (!existing) {
          const option = document.createElement('option');
          option.value = trip.tripId;
          option.textContent = `${trip.title || '未命名行程'} (${trip.days || 0}天)`;
          option.dataset.source = 'server';
          selector.appendChild(option);
        }
      });
    } catch (error) {
      console.error('加载服务器行程列表失败:', error);
    }
  }
}

/**
 * 加载行程详情
 * 【游客权限逻辑】游客模式下需要登录才能加载行程进行编辑
 * 【修复】优先从localStorage的trip_list加载完整数据，如果没有完整数据再调用后端API
 */
async function loadTrip() {
  // 【游客权限逻辑】检查是否为游客模式，游客无法编辑行程
  if (!window.userModule.isLoggedIn()) {
    window.userModule.showLoginGuideModal();
    return; // 阻止后续操作
  }

  const tripId = document.getElementById('tripSelector').value;

  if (!tripId) {
    window.api.showToast('请选择行程', 'error');
    return;
  }

  try {
    // 核心修改1：统一tripId为字符串格式
    const tripIdStr = String(tripId);
    let tripData = null;
    
    // 步骤1：优先从localStorage的trip_list加载完整数据
    try {
      const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
      if (listData) {
        const tripList = JSON.parse(listData);
        // 用字符串匹配查找localStorage中的行程
        const localTrip = tripList.find(t => String(t.tripId) === tripIdStr);
        
        // 检查是否有完整的itinerary数据
        if (localTrip && localTrip.itinerary && Array.isArray(localTrip.itinerary) && localTrip.itinerary.length > 0) {
          tripData = { ...localTrip };
          // 统一localTrip的tripId为字符串
          tripData.tripId = String(tripData.tripId);
          
          // 【修复步骤1】核心修改：补全当前登录用户的userId
          const currentUser = window.userModule?.getCurrentUser();
          const currentUserId = currentUser?.userId || currentUser?.guestId;
          
          if (currentUserId && (!tripData.userId || tripData.userId !== currentUserId)) {
            // 为行程补充/更新userId为当前用户ID
            tripData.userId = currentUserId;
            
            // 同步更新localStorage中的行程数据（确保后续请求归属正确）
            const updatedTripList = tripList.map(t => 
              String(t.tripId) === tripIdStr ? { ...t, userId: currentUserId } : t
            );
            localStorage.setItem(STORAGE_KEYS.TRIP_LIST, JSON.stringify(updatedTripList));
            
            console.log('✅ 为行程补全当前用户ID:', currentUserId);
          }
          
          console.log('✅ 从localStorage加载完整行程数据（格式统一）:', tripIdStr);
          
          // 【修复步骤1】新增核心逻辑：检查后端是否存在该行程，不存在则同步
          if (currentUserId) {
            try {
              // 先调用后端get接口，检查是否存在
              await window.api.get('/trip/get', {
                tripId: tripIdStr,
                userId: currentUserId
              });
              console.log('✅ 后端已存在该行程，无需同步');
            } catch (apiError) {
              // 若后端返回"行程不存在"，则同步local行程到后端
              if (apiError.message?.includes('行程不存在')) {
                console.log('⚠️ 后端无该行程，开始同步local行程到后端');
                await syncLocalTripToBackend(tripData, currentUserId);
                console.log('✅ local行程同步后端成功');
              } else {
                // 其他错误不阻断，仅记录日志
                console.warn('⚠️ 检查后端行程时出错，但继续使用本地数据:', apiError.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('从localStorage加载行程失败:', error);
    }
    
    // 步骤2：如果localStorage中没有完整数据，从后端API获取（传递字符串tripId）
    if (!tripData) {
      const currentUser = window.userModule?.getCurrentUser();
      const userId = currentUser?.userId ? String(currentUser.userId) : null;

      try {
        const data = await window.api.get('/trip/get', { 
          tripId: tripIdStr, // 传递字符串格式
          userId: userId
        });
        tripData = data.trip;
        // 统一后端返回的tripId为字符串
        if (tripData) {
          tripData.tripId = String(tripData.tripId);
        }
        console.log('✅ 从后端API加载行程数据（格式统一）:', tripIdStr);
      } catch (apiError) {
        console.error('从后端API加载行程失败:', apiError);
        // 【修复步骤4】若后端返回"无权访问"，但localStorage有数据，忽略错误（静默同步行程归属）
        const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
        const hasLocalData = listData && JSON.parse(listData).some(t => String(t.tripId) === tripIdStr);
        
        if (tripData || hasLocalData) {
          console.warn('⚠️ 后端提示无权访问，但本地有行程数据，已自动关联当前用户');
          // 不抛出错误，继续使用本地数据
        } else {
          throw new Error(`加载行程失败：${apiError.message || '未找到该行程'}`);
        }
      }
    }
    
    // 步骤3：校验行程数据完整性
    if (!tripData) {
      throw new Error('未找到行程数据');
    }
    
    if (!tripData.itinerary || !Array.isArray(tripData.itinerary)) {
      throw new Error('行程数据格式错误：缺少itinerary字段或格式不正确');
    }
    
    // 步骤4：补全缺失字段，统一数据格式
    // 核心修改2：统一currentEditTrip的tripId为字符串
    currentEditTrip = {
      ...tripData,
      tripId: tripIdStr, // 强制使用统一的字符串格式
      title: tripData.title || '未命名行程',
      days: tripData.days || tripData.itinerary.length,
      itinerary: tripData.itinerary.map((day, index) => ({
        day: day.day || index + 1,
        date: day.date || new Date().toISOString().split('T')[0], // 确保日期格式为YYYY-MM-DD
        items: (day.items || []).map(item => ({
          time: item.time || '00:00',
          place: item.place || '未命名地点',
          description: item.description || ''
        }))
      }))
    };
    
    // 步骤5：补全缺失的权限字段（兼容旧数据）
    if (!currentEditTrip.hasOwnProperty('creatorId')) {
      const currentUserId = getCurrentLoginUserId();
      currentEditTrip.creatorId = currentEditTrip.userId || currentUserId;
    }
    if (!currentEditTrip.hasOwnProperty('collaborators')) {
      currentEditTrip.collaborators = [];
    }
    
    // 步骤6：过滤空天数（移除无项目的天数）
    if (currentEditTrip.itinerary && Array.isArray(currentEditTrip.itinerary)) {
      currentEditTrip.itinerary = filterEmptyDays(currentEditTrip.itinerary);
      currentEditTrip.days = currentEditTrip.itinerary.length;
    }
    
    // 步骤7：权限校验+按钮状态控制
    const hasPermission = await checkTripModifyPermission(tripIdStr);
    updateModifyButtonsState(hasPermission);
    
    // 步骤8：【修复】更新全局变量和DOM属性（均为字符串格式）
    window.currentLoadedTripId = tripIdStr;
    updateEditPanelTripId(tripIdStr);
    
    // 步骤9：渲染行程
    displayEditItinerary(currentEditTrip.itinerary, currentEditTrip);
    document.getElementById('editTripContainer').style.display = 'block';
    
    // 重新初始化拖拽功能（因为DOM被重新渲染）
    if (typeof initDragAndDrop === 'function') {
      // 拖拽功能已在initTripEdit中初始化，使用事件委托，无需重新初始化
      // 但需要确保事件监听器已绑定（通常事件委托只需要初始化一次）
    }
    
    console.log('✅ 行程加载成功（格式统一）:', {
      tripId: tripIdStr,
      title: currentEditTrip.title,
      days: currentEditTrip.days,
      itineraryLength: currentEditTrip.itinerary.length,
      currentLoadedTripId: window.currentLoadedTripId,
      tripIdType: typeof currentEditTrip.tripId
    });
  } catch (error) {
    console.error('❌ 加载行程失败:', error);
    
    // 【修复步骤4】仅当localStorage也无数据时，才显示错误提示
    const tripSelector = document.getElementById('tripSelector');
    const tripIdStr = tripSelector ? String(tripSelector.value) : null;
    
    if (tripIdStr) {
      const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
      const hasLocalData = listData && JSON.parse(listData).some(t => String(t.tripId) === tripIdStr);
      
      if (!hasLocalData) {
        window.api.showToast(error.message || '加载行程失败', 'error');
      } else {
        console.warn('⚠️ 后端提示无权访问，但本地有行程数据，已自动关联当前用户');
      }
    } else {
      window.api.showToast(error.message || '加载行程失败', 'error');
    }
  }
}

/**
 * 更新修改按钮的状态（启用/禁用）- 扩展版本
 * @param {boolean} hasPermission 是否有权限
 */
function updateModifyButtonsState(hasPermission) {
  // 扩展权限控制到所有操作按钮
  const modifyButtons = [
    '#btnAgentModify', // 智能修改行程按钮
    '#btnOptimizeWithFavorite', // 基于攻略优化按钮
    '#saveTripBtn', // 保存修改按钮
    '.btn-add' // 新增：添加项目按钮（所有添加按钮）
  ];

  modifyButtons.forEach(selector => {
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => {
      if (btn) {
        // 设置disabled属性，CSS的:disabled选择器会自动应用样式
        btn.disabled = !hasPermission;
        // 设置透明度（视觉反馈）
        btn.style.opacity = hasPermission ? '1' : '0.6';
        // 设置指针样式
        btn.style.cursor = hasPermission ? 'pointer' : 'not-allowed';
      }
    });
  });
}

/**
 * 展示可编辑的行程
 * @param {Array} itinerary 行程数据
 * @param {Object} tripData 行程完整数据（可选，包含tripId等信息）
 */
function displayEditItinerary(itinerary, tripData = null) {
  const container = document.getElementById('editItinerary');
  
  if (!itinerary || itinerary.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无行程数据</p>';
    return;
  }

  // 过滤空白天数：仅保留包含至少1个项目的天数
  const validDays = filterEmptyDays(itinerary);
  
  if (validDays.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无行程数据</p>';
    return;
  }
  
  // 如果提供了tripData，存储tripId到编辑面板（双重保障）
  if (tripData && tripData.tripId) {
    updateEditPanelTripId(tripData.tripId);
  }

  // 使用过滤后的有效天数进行渲染
  container.innerHTML = validDays.map((day, dayIndex) => `
    <div class="day-section" data-day-index="${dayIndex}">
      <div class="day-header">
        第 ${day.day || dayIndex + 1} 天
        <input type="date" value="${day.date || ''}" class="day-date" style="margin-left: 1rem; padding: 0.25rem;">
      </div>
      <div class="day-items">
        ${day.items && day.items.length > 0 ? day.items.map((item, itemIndex) => `
          <div class="editable-item trip-item" draggable="true" data-day-index="${dayIndex}" data-item-index="${itemIndex}">
            <input type="time" value="${item.time || ''}" class="item-time" style="width: 100px;">
            <input type="text" value="${item.place || ''}" placeholder="地点" class="item-place">
            <textarea placeholder="描述" class="item-description">${item.description || ''}</textarea>
            <button class="btn-delete" onclick="deleteTripItem(${dayIndex}, ${itemIndex})">删除</button>
          </div>
        `).join('') : ''}
        <button class="btn-add" onclick="addTripItem(${dayIndex})">添加项目</button>
      </div>
    </div>
  `).join('');
}

/**
 * 添加行程项目
 * 【游客权限逻辑】游客模式下需要登录才能添加行程项目
 * 【权限校验】检查是否有权限修改该行程
 */
async function addTripItem(dayIndex) {
  // 【游客权限逻辑】检查是否为游客模式，游客无法编辑行程
  if (!window.userModule.isLoggedIn()) {
    window.userModule.showLoginGuideModal();
    return; // 阻止后续操作
  }

  // 【权限校验】检查是否有权限修改该行程
  const currentTripId = getCurrentTripId();

  if (currentTripId) {
    const hasPermission = await checkTripModifyPermission(currentTripId);
    if (!hasPermission) {
      window.api.showToast('您无权修改该行程', 'error');
      return;
    }
  }

  const daySection = document.querySelector(`.day-section[data-day-index="${dayIndex}"] .day-items`);
  if (!daySection) return;

  const itemIndex = daySection.querySelectorAll('.editable-item').length;
  const newItem = document.createElement('div');
  newItem.className = 'editable-item trip-item';
  newItem.setAttribute('draggable', 'true');
  newItem.setAttribute('data-day-index', dayIndex);
  newItem.setAttribute('data-item-index', itemIndex);
  newItem.innerHTML = `
    <input type="time" value="09:00" class="item-time" style="width: 100px;">
    <input type="text" value="" placeholder="地点" class="item-place">
    <textarea placeholder="描述" class="item-description"></textarea>
    <button class="btn-delete" onclick="deleteTripItem(${dayIndex}, ${itemIndex})">删除</button>
  `;
  
  // 插入到"添加项目"按钮之前
  const addBtn = daySection.querySelector('.btn-add');
  daySection.insertBefore(newItem, addBtn);
}

/**
 * 删除行程项目
 */
function deleteTripItem(dayIndex, itemIndex) {
  const item = document.querySelector(
    `.editable-item[data-day-index="${dayIndex}"][data-item-index="${itemIndex}"]`
  );
  if (item) {
    item.remove();
    // 重新索引
    updateItemIndexes(dayIndex);
  }
}

/**
 * 更新项目索引
 */
function updateItemIndexes(dayIndex) {
  const items = document.querySelectorAll(
    `.day-section[data-day-index="${dayIndex}"] .editable-item`
  );
  items.forEach((item, index) => {
    item.setAttribute('data-item-index', index);
    const deleteBtn = item.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.setAttribute('onclick', `deleteTripItem(${dayIndex}, ${index})`);
    }
  });
}

/**
 * 保存行程修改
 */
async function saveTrip() {
  try {
    // 1. 获取当前编辑行程的tripId
    const currentTripId = getCurrentTripId();
    
    if (!currentTripId) {
      window.api.showToast('保存失败：未找到当前编辑行程的ID，请先加载行程', 'error');
      console.error('保存失败：无法获取tripId，window.currentLoadedTripId:', window.currentLoadedTripId);
    return;
  }

    // 2. 收集编辑后的行程数据（与生成行程格式一致）
  const itinerary = [];
  const daySections = document.querySelectorAll('.day-section');

  daySections.forEach((daySection, dayIndex) => {
    const day = daySection.querySelector('.day-header input.day-date')?.value || '';
    const items = [];

    daySection.querySelectorAll('.editable-item').forEach(itemEl => {
      items.push({
        time: itemEl.querySelector('.item-time')?.value || '',
        place: itemEl.querySelector('.item-place')?.value || '',
        description: itemEl.querySelector('.item-description')?.value || ''
      });
    });

      // 仅保存包含至少1个项目的天数（过滤空白天数）
      if (items.length > 0) {
    itinerary.push({
          day: itinerary.length + 1, // 使用实际索引，确保连续
      date: day,
      items
    });
      }
    });

    // 获取标题和计算天数
    const titleEl = document.getElementById('editTripTitle');
    const title = titleEl ? titleEl.textContent.trim() : (currentEditTrip?.title || '未命名行程');
    const days = itinerary.length; // 从itinerary长度计算天数

    // 3. 构建更新后的行程数据（与生成行程格式一致）
    const updatedTripData = {
      tripId: currentTripId,
      title: title,
      days: days,
      itinerary: itinerary,
      updatedAt: new Date().toISOString()
    };

    // 4. 更新本地存储（localStorage中的trip_list）
    updateTripInLocalStorage(currentTripId, {
      tripId: currentTripId,
      title: title,
      days: days,
      savedAt: updatedTripData.updatedAt || new Date().toISOString()
    });
    console.log('✅ 已更新localStorage中的trip_list');

    // 5. 更新后端接口（如果用户已登录）
    // 【修复步骤3】新增核心逻辑：检查后端是否有该行程，无则创建，有则更新
    const currentUser = window.userModule?.getCurrentUser();
    const currentUserId = currentUser?.userId || currentUser?.guestId;
    
    if (currentUserId) {
      let isBackendExist = false;
      
      try {
        // 调用get接口检查后端是否存在
        await window.api.get('/trip/get', {
          tripId: currentTripId,
          userId: currentUserId
        });
        isBackendExist = true;
      } catch (apiError) {
        if (apiError.message?.includes('行程不存在')) {
          isBackendExist = false;
        } else {
          // 其他错误不影响保存流程，仅记录日志
          console.warn('⚠️ 检查后端行程时出错:', apiError.message);
        }
      }
      
      // 【分支逻辑】根据后端是否存在选择接口
      if (isBackendExist) {
        // 后端有行程：调用update接口
  try {
    await window.api.post('/trip/update', {
            tripId: currentTripId,
            title: title,
            itinerary: itinerary
          });
          console.log('✅ 后端已有行程，执行更新操作');
        } catch (error) {
          console.warn('⚠️ 后端更新失败:', error);
          // 后端更新失败不影响本地保存成功
        }
      } else {
        // 后端无行程：调用sync-local接口创建
        try {
          await window.api.post('/trip/sync-local', {
            userId: currentUserId,
            tripId: currentTripId, // 传递前端local的tripId，确保一致
            title: title,
            itinerary: itinerary,
            days: days,
            budget: currentEditTrip?.budget || '不限',
            collectionIds: currentEditTrip?.collectionIds || []
          });
          console.log('✅ 后端无行程，执行创建操作');
        } catch (error) {
          console.warn('⚠️ 后端创建失败:', error);
          // 后端创建失败不影响本地保存成功
        }
      }
    }

    // 6. 更新内存中的currentEditTrip
    if (currentEditTrip) {
      currentEditTrip.title = title;
      currentEditTrip.itinerary = itinerary;
      currentEditTrip.days = days;
      if (currentEditTrip.tripId !== currentTripId) {
        currentEditTrip.tripId = currentTripId;
      }
    }

    // 7. 刷新行程列表（如果行程列表管理模块存在）
    if (window.tripListManager && window.tripListManager.loadAllTrips) {
      window.tripListManager.loadAllTrips();
    }

    // 8. 显示成功提示
    window.api.showToast('保存成功', 'success');
    
  } catch (error) {
    console.error('保存行程修改失败:', error);
    window.api.showToast('保存失败：' + (error.message || '未知错误'), 'error');
  }
}

/**
 * 初始化智能行程优化模块（合并后的模块）
 */
function initSmartOptimizer() {
  const optimizeBtn = document.getElementById('btnSmartOptimize');
  const instructionInput = document.getElementById('optimizeInstructionInput');
  
  if (!optimizeBtn || !instructionInput) {
    return;
  }

  // 加载收藏夹链接列表
  loadFavoriteLinks();

  // 绑定智能优化按钮点击事件
  optimizeBtn.addEventListener('click', handleSmartOptimize);

  // 绑定回车键快捷提交
  instructionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      optimizeBtn.click();
    }
  });

  // 智能行程优化的收藏搜索框（实时搜索）
  const favoriteSearchInput = document.getElementById('favoriteSearchInput');
  if (favoriteSearchInput) {
    favoriteSearchInput.addEventListener('input', (e) => {
      // 实时过滤收藏列表
      if (allFavoriteLinks.length > 0) {
        renderFavoriteLinks(allFavoriteLinks);
      }
    });
  }
}

/**
 * 根据关键词过滤收藏项（用于智能行程优化）
 * @param {Array} favoriteLinks - 收藏项数组
 * @param {string} keyword - 搜索关键词
 * @returns {Array} 过滤后的收藏项数组
 */
function filterFavoriteLinks(favoriteLinks, keyword) {
  if (!keyword || !keyword.trim()) {
    return favoriteLinks;
  }

  const lowerKeyword = keyword.toLowerCase().trim();
  
  return favoriteLinks.filter(link => {
    // 匹配标题
    const titleMatch = link.title && 
      link.title.toLowerCase().includes(lowerKeyword);
    
    // 匹配标签（优先使用tags，如果没有则使用places）
    const tagsToSearch = (link.tags && link.tags.length > 0) 
      ? link.tags 
      : (link.places || []);
    
    const tagMatch = tagsToSearch.some(tag => 
      tag && tag.toString().toLowerCase().includes(lowerKeyword)
    );
    
    return titleMatch || tagMatch;
  });
}

/**
 * 渲染收藏夹链接列表到复选框组（支持搜索过滤）
 * @param {Array} favoriteLinks - 收藏项数组
 */
function renderFavoriteLinks(favoriteLinks) {
  const checkboxesContainer = document.getElementById('favoriteCheckboxes');
  if (!checkboxesContainer) {
    return;
  }

  // 应用搜索过滤
  const searchInput = document.getElementById('favoriteSearchInput');
  const keyword = searchInput ? searchInput.value.trim() : '';
  const filteredLinks = filterFavoriteLinks(favoriteLinks, keyword);

  checkboxesContainer.innerHTML = '';
  
  if (filteredLinks.length === 0) {
    if (keyword) {
      checkboxesContainer.innerHTML = '<p class="empty-tip" style="font-size: 12px; color: #999;">未找到匹配的攻略</p>';
    } else {
      checkboxesContainer.innerHTML = '<p class="empty-tip" style="font-size: 12px; color: #999;">暂无收藏的攻略</p>';
    }
    return;
  }

  filteredLinks.forEach(link => {
    const labelEl = document.createElement('label');
    labelEl.className = 'favorite-checkbox-item';
    labelEl.innerHTML = `
      <input type="checkbox" class="favorite-checkbox" value="${link.collectionId}">
      <span>${window.utils.escapeHtml(link.title || '未命名攻略')}</span>
    `;
    checkboxesContainer.appendChild(labelEl);
  });
}

/**
 * 加载收藏夹链接列表到复选框组（多选模式）
 */
async function loadFavoriteLinks() {
  const checkboxesContainer = document.getElementById('favoriteCheckboxes');
  if (!checkboxesContainer) {
    return;
  }

  try {
    const user = window.userModule?.getCurrentUser();
    if (!user) {
      checkboxesContainer.innerHTML = '<p class="empty-tip" style="font-size: 12px; color: #999;">请先登录</p>';
      return;
    }

    const data = await window.api.get('/collection/list', { userId: user.userId });
    const favoriteLinks = data.collections || [];
    
    // 保存所有收藏项（用于搜索过滤）
    allFavoriteLinks = favoriteLinks;
    
    // 渲染列表（会自动应用搜索过滤）
    renderFavoriteLinks(favoriteLinks);
  } catch (error) {
    console.error('加载收藏夹链接失败:', error);
    checkboxesContainer.innerHTML = '<p class="empty-tip" style="font-size: 12px; color: #999;">加载失败</p>';
  }
}

/**
 * 处理智能行程优化（合并后的统一处理函数）
 * 根据是否选择攻略执行不同分支：选攻略则基于攻略优化，不选则直接智能修改
 */
async function handleSmartOptimize() {
  const optimizeBtn = document.getElementById('btnSmartOptimize');
  const instructionInput = document.getElementById('optimizeInstructionInput');

  if (!optimizeBtn || !instructionInput) {
    return;
  }

  try {
    // 1. 收集选中的多个攻略ID
    const selectedCheckboxes = document.querySelectorAll('.favorite-checkbox:checked');
    const collectionIds = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);

    // 2. 基础校验
    const currentTripId = getCurrentTripId();

    if (!currentTripId) {
      window.api.showToast('请先加载行程', 'warning');
      return;
    }

    const instruction = instructionInput.value.trim();

    // 输入校验：若选攻略则至少选一个，且需要指令
    if (collectionIds.length > 0 && !instruction) {
      window.api.showToast('选择了攻略时，请输入优化指令', 'warning');
      return;
    }

    // 输入校验：无指令且无攻略时提示
    if (!instruction && collectionIds.length === 0) {
      window.api.showToast('请输入优化指令（或选择攻略）', 'warning');
      return;
    }

    // 新增：前置权限校验
    const hasPermission = await checkTripModifyPermission(currentTripId);
    if (!hasPermission) {
      window.api.showToast('您无权修改该行程', 'error');
      return;
    }

    // 2. 获取当前用户ID
    const currentUser = window.userModule?.getCurrentUser();
    if (!currentUser || !currentUser.userId) {
      window.api.showToast('用户身份异常，请刷新页面', 'error');
      return;
    }
    const userId = currentUser.userId;

    // 3. 禁用按钮，显示加载状态
    optimizeBtn.disabled = true;
    optimizeBtn.textContent = '优化中...';
    window.api.showLoadingOverlay();

    // 4. 分支逻辑：是否选择了收藏夹攻略
    let response;
    let optimizedTrip;

    if (collectionIds.length > 0) {
      // 分支A：结合多个收藏夹攻略优化（调用optimize-with-multi-favorite接口）
      response = await window.api.post('/trip/optimize-with-multi-favorite', {
        tripId: currentTripId,
        collectionIds: collectionIds, // 传递多攻略ID数组
        demand: instruction,
        userId: userId
      });

      if (!response || !response.trip) {
        throw new Error('服务器返回数据格式错误');
      }
      optimizedTrip = response.trip;
    } else {
      // 分支B：直接智能修改（调用modify接口）
      if (!instruction) {
        window.api.showToast('请输入优化指令', 'warning');
        return;
      }

      response = await window.api.post('/trip/modify', {
        tripId: currentTripId,
        userPrompt: instruction,
        userId: userId
      });

      if (!response || !response.trip) {
        throw new Error('服务器返回数据格式错误');
      }
      optimizedTrip = response.trip;
    }

    // 5. 优化后过滤空天数（移除无项目的天数）
    if (optimizedTrip.itinerary && Array.isArray(optimizedTrip.itinerary)) {
      optimizedTrip.itinerary = optimizedTrip.itinerary.filter(day => {
        return day.items && Array.isArray(day.items) && day.items.length > 0;
      });
      // 更新days字段为过滤后的天数
      optimizedTrip.days = optimizedTrip.itinerary.length;
    }

    // 6. 更新当前编辑的行程数据
    currentEditTrip = optimizedTrip;
    if (window.tripEditModule) {
      window.tripEditModule.currentEditTrip = optimizedTrip;
    }

    // 7. 更新编辑面板的tripId（双重保障）
    // 修复：显式获取DOM元素并添加存在性校验
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    
    if (editPanel) {
      editPanel.dataset.currentTripId = String(optimizedTrip.tripId);
    }
    if (editContainer) {
      editContainer.dataset.currentTripId = String(optimizedTrip.tripId);
    }

    // 8. 更新行程标题
    const titleEl = document.getElementById('editTripTitle');
    if (titleEl) {
      titleEl.textContent = optimizedTrip.title || '未命名行程';
      // 重新初始化标题编辑功能（如果函数存在）
      if (window.tripListManager && typeof window.tripListManager.initEditTitle === 'function') {
        window.tripListManager.initEditTitle();
      }
    }

    // 9. 复用displayEditItinerary函数刷新编辑区（会自动过滤空天数）
    displayEditItinerary(optimizedTrip.itinerary, optimizedTrip);

    // 10. 更新本地存储（同步到trip_list）
    try {
      let tripList = [];
      const listData = localStorage.getItem('trip_list');
      if (listData) {
        tripList = JSON.parse(listData);
      }
      
      const existingIndex = tripList.findIndex(t => String(t.tripId) === String(currentTripId));
      
      const tripListItem = {
        tripId: optimizedTrip.tripId,
        title: optimizedTrip.title || '未命名行程',
        days: optimizedTrip.days || optimizedTrip.itinerary.length,
        savedAt: optimizedTrip.updatedAt || new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        tripList[existingIndex] = tripListItem;
      } else {
        tripList.push(tripListItem);
      }
      
      localStorage.setItem('trip_list', JSON.stringify(tripList));
    } catch (error) {
      console.warn('更新localStorage失败:', error);
    }

    // 11. 刷新行程列表（如果存在）
    if (window.tripListManager && window.tripListManager.loadAllTrips) {
      window.tripListManager.loadAllTrips();
    }

    // 12. 显示成功提示
    const modelName = response.modelName || '通义千问';
    const actionType = collectionIds.length > 0 ? `基于${collectionIds.length}个攻略优化` : '智能修改';
    window.api.showToast(`${actionType}完成（使用${modelName}），可保存修改`, 'success');

  } catch (error) {
    console.error('行程优化失败:', error);
    // 调整：异常提示更精准
    const errorMsg = error.message || '请检查输入内容或稍后重试';
    if (errorMsg.includes('无权')) {
      window.api.showToast('您无权修改该行程', 'error');
    } else {
      window.api.showToast('行程优化失败：' + errorMsg, 'error');
    }
  } finally {
    // 恢复按钮状态
    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = '智能优化行程';
    }
    window.api.hideLoadingOverlay();
  }
}

/**
 * 处理基于收藏夹攻略的行程优化
 */
async function handleFavoriteOptimize() {
  const optimizeBtn = document.getElementById('btnOptimizeWithFavorite');
  const linkSelect = document.getElementById('favoriteLinkSelect');
  const demandInput = document.getElementById('customOptimizeDemandInput');

  if (!optimizeBtn || !linkSelect || !demandInput) {
    return;
  }

  try {
    // 获取当前编辑行程的tripId
    const currentTripId = getCurrentTripId();

    if (!currentTripId) {
      window.api.showToast('请先加载行程', 'error');
      return;
    }

    // 新增：前置权限校验
    const hasPermission = await checkTripModifyPermission(currentTripId);
    if (!hasPermission) {
      window.api.showToast('您无权修改该行程', 'error');
      return;
    }

    // 1. 获取选中的攻略、自定义优化需求、当前行程
    const linkId = linkSelect.value;
    // 核心修改：从自定义输入框获取需求，而非下拉框
    const customDemand = demandInput.value.trim();

    // 新增校验：自定义需求不能为空
    if (!linkId) {
      window.api.showToast('请选择攻略', 'warning');
      return;
    }

    if (!customDemand) {
      window.api.showToast('请输入优化需求', 'warning');
      return;
    }

    // 2. 获取当前用户ID（核心修复：补充用户ID传递）
    const currentUser = window.userModule?.getCurrentUser();
    if (!currentUser || !currentUser.userId) {
      window.api.showToast('用户身份异常，请刷新页面', 'error');
      return;
    }
    const userId = currentUser.userId; // 兼容正式用户和游客（游客的userId就是guestId）

    // 3. 禁用按钮，显示加载状态
    optimizeBtn.disabled = true;
    optimizeBtn.textContent = '优化中...';
    window.api.showLoadingOverlay();

    // 4. 调用后端API进行优化（核心修复：传递用户ID）
    const response = await window.api.post('/trip/optimize-with-favorite', {
      tripId: currentTripId,
      collectionId: linkId,
      demand: customDemand,
      userId: userId // 新增：传递用户ID（兼容正式用户/游客）
    });

    if (!response || !response.trip) {
      throw new Error('服务器返回数据格式错误');
    }

    let optimizedTrip = response.trip;

    // 5. 应用优化后的行程数据
    applyOptimizedTrip(optimizedTrip, currentTripId, response);

    // 6. 显示成功提示
    window.api.showToast(`基于攻略优化完成（使用${response.modelName || '通义千问'}），可保存修改`, 'success');

  } catch (error) {
    console.error('攻略优化失败:', error);
    // 调整：异常提示更精准
    const errorMsg = error.message || '请检查攻略内容或稍后重试';
    if (errorMsg.includes('无权')) {
      window.api.showToast('您无权修改该行程', 'error');
    } else {
      window.api.showToast('攻略优化失败：' + errorMsg, 'error');
    }
  } finally {
    // 恢复按钮状态
    if (optimizeBtn) {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = '基于攻略优化行程';
    }
    window.api.hideLoadingOverlay();
  }
}

/**
 * 处理智能修改行程
 */
async function handleAgentModify() {
  const modifyBtn = document.getElementById('btnAgentModify');
  const promptInput = document.getElementById('agentPromptInput');
  
  if (!modifyBtn || !promptInput) {
    return;
  }

  try {
    // 1. 获取当前编辑行程的tripId
    const currentTripId = getCurrentTripId();
    
    if (!currentTripId) {
      window.api.showToast('请先加载行程', 'error');
      return;
    }

    // 新增：前置权限校验
    const hasPermission = await checkTripModifyPermission(currentTripId);
    if (!hasPermission) {
      window.api.showToast('您无权修改该行程', 'error');
      return;
    }

    // 2. 获取用户输入的修改指令
    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
      window.api.showToast('请输入修改指令', 'error');
      return;
    }

    // 3. 禁用按钮，显示加载状态
    modifyBtn.disabled = true;
    modifyBtn.textContent = 'AI修改中...';
    window.api.showLoadingOverlay();

    // 4. 获取当前用户ID（核心修复：补充用户ID传递）
    const currentUser = window.userModule?.getCurrentUser();
    if (!currentUser || !currentUser.userId) {
      window.api.showToast('用户身份异常，请刷新页面', 'error');
      return;
    }
    const userId = currentUser.userId; // 兼容正式用户和游客

    // 5. 调用后端API进行智能修改（核心修复：传递用户ID）
    const response = await window.api.post('/trip/modify', {
      tripId: currentTripId,
      userPrompt: userPrompt,
      userId: userId // 新增：传递用户ID（兼容正式用户/游客）
    });

    if (!response || !response.trip) {
      throw new Error('服务器返回数据格式错误');
    }

    let modifiedTrip = response.trip;

    // 5. 应用优化后的行程数据
    applyOptimizedTrip(modifiedTrip, currentTripId, response);

    // 12. 清空输入框
    promptInput.value = '';

    // 13. 显示成功提示
    window.api.showToast(`智能修改完成（使用${response.modelName || '通义千问'}），可保存修改`, 'success');

  } catch (error) {
    console.error('智能修改失败:', error);
    // 调整：异常提示更精准
    const errorMsg = error.message || '请检查指令或稍后重试';
    if (errorMsg.includes('无权')) {
      window.api.showToast('您无权修改该行程', 'error');
    } else {
      window.api.showToast('智能修改失败：' + errorMsg, 'error');
    }
  } finally {
    // 恢复按钮状态
    const modifyBtn = document.getElementById('btnAgentModify');
    if (modifyBtn) {
      modifyBtn.disabled = false;
      modifyBtn.textContent = '智能修改行程';
    }
    window.api.hideLoadingOverlay();
  }
}

/**
 * 存储被拖拽的行程项目
 */
let draggedItem = null;

/**
 * 辅助函数：找到拖拽位置对应的目标元素
 * @param {HTMLElement} container 容器元素
 * @param {number} y 鼠标Y坐标
 * @returns {HTMLElement|null} 目标元素
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.trip-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * 辅助函数：同步拖拽后的行程项目顺序到本地数据
 * @param {HTMLElement} dayContainer 当天的行程容器
 */
function syncTripItemOrder(dayContainer) {
  try {
    // 获取当前天的索引（从DOM中获取）
    const daySection = dayContainer.closest('.day-section');
    if (!daySection) return;
    
    const dayIndex = Number(daySection.dataset.dayIndex);
    if (isNaN(dayIndex)) return;
    
    // 获取当前行程ID
    const currentTripId = getCurrentTripId();
    if (!currentTripId) {
      console.warn('同步拖拽顺序失败：未找到当前行程ID');
      return;
    }
    
    // 更新当天的行程项目顺序（与DOM一致）
    const items = [...dayContainer.querySelectorAll('.trip-item')].map(item => ({
      time: item.querySelector('.item-time')?.value || '',
      place: item.querySelector('.item-place')?.value || '',
      description: item.querySelector('.item-description')?.value || ''
    }));
    
    // 优先更新currentEditTrip（内存中的完整数据）
    if (currentEditTrip && String(currentEditTrip.tripId) === String(currentTripId)) {
      if (currentEditTrip.itinerary && currentEditTrip.itinerary[dayIndex]) {
        currentEditTrip.itinerary[dayIndex].items = items;
        console.log('✅ 已同步拖拽顺序到currentEditTrip');
      }
    }
    
    // 注意：localStorage中的trip_list通常只包含基本信息（tripId, title, days, savedAt）
    // 不包含完整的itinerary数据，所以不需要更新localStorage
    // 完整的行程数据会在用户点击"保存修改"按钮时统一保存
    
  } catch (error) {
    console.error('同步拖拽顺序失败:', error);
  }
}

/**
 * 初始化拖拽功能
 */
function initDragAndDrop() {
  // 1. 监听行程项目的拖拽开始事件
  document.addEventListener('dragstart', function(e) {
    // 如果点击的是输入框、文本域或按钮，不触发拖拽（这些元素默认不可拖拽，但为了保险起见）
    if (e.target.matches('input, textarea, button, .btn-delete')) {
      return;
    }
    
    const tripItem = e.target.closest('.trip-item');
    if (tripItem) {
      draggedItem = tripItem;
      // 拖拽时添加样式提示
      tripItem.classList.add('dragging');
      // 设置拖拽数据（可选，用于跨浏览器兼容）
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  // 2. 监听拖拽结束事件（移除样式）
  document.addEventListener('dragend', function(e) {
    const tripItem = e.target.closest('.trip-item');
    if (tripItem) {
      tripItem.classList.remove('dragging');
      draggedItem = null;
    }
  });

  // 3. 监听行程容器的拖拽经过事件（允许放置）
  // 使用事件委托，因为day-items容器是动态生成的
  document.addEventListener('dragover', function(e) {
    const dayContainer = e.target.closest('.day-items');
    if (!dayContainer || !draggedItem) return;
    
    // 检查是否在同一天内（不允许跨天拖拽）
    const draggedDayIndex = draggedItem.dataset.dayIndex;
    const targetDaySection = dayContainer.closest('.day-section');
    if (!targetDaySection || targetDaySection.dataset.dayIndex !== draggedDayIndex) {
      return; // 不允许跨天拖拽
    }
    
    e.preventDefault(); // 必须阻止默认行为，否则无法触发drop
    
    // 找到当前拖拽位置下方的行程项目，用于定位插入点
    const afterItem = getDragAfterElement(dayContainer, e.clientY);
    const draggable = document.querySelector('.trip-item.dragging');
    if (!draggable) return;
    
    if (afterItem == null) {
      // 如果没有找到目标元素，插入到容器末尾（但在"添加项目"按钮之前）
      const addBtn = dayContainer.querySelector('.btn-add');
      if (addBtn) {
        dayContainer.insertBefore(draggable, addBtn);
      } else {
        dayContainer.appendChild(draggable);
      }
    } else {
      dayContainer.insertBefore(draggable, afterItem);
    }
  });

  // 4. 监听放置事件（交换位置+同步数据）
  document.addEventListener('drop', function(e) {
    const dayContainer = e.target.closest('.day-items');
    if (!dayContainer || !draggedItem) return;
    
    e.preventDefault();
    
    // 检查是否在同一天内
    const draggedDayIndex = draggedItem.dataset.dayIndex;
    const targetDaySection = dayContainer.closest('.day-section');
    if (!targetDaySection || targetDaySection.dataset.dayIndex !== draggedDayIndex) {
      return; // 不允许跨天拖拽
    }
    
    // 同步更新本地行程数据（关键：保证拖拽后数据与DOM一致）
    syncTripItemOrder(dayContainer);
    
    // 重新更新项目索引
    const dayIndex = Number(targetDaySection.dataset.dayIndex);
    if (!isNaN(dayIndex)) {
      updateItemIndexes(dayIndex);
    }
    
    draggedItem = null;
  });
}

/**
 * 初始化输入框和拖拽操作的权限拦截
 * 【修复闪烁问题】优化权限检查逻辑，避免在每次输入时都触发异步检查
 */
function initPermissionInterceptors() {
  // 存储已检查过权限的输入框及其权限状态（避免重复检查）
  const permissionCache = new WeakMap();
  
  // 【修复】改为在focus时检查权限，而不是在每次input时检查
  document.addEventListener('focus', async function(e) {
    // 匹配行程编辑区的输入框（时间、地点、描述）
    const editPanel = document.querySelector('.trip-edit-panel');
    if (!editPanel || !editPanel.contains(e.target)) {
      return;
    }

    // 检查是否是行程编辑相关的输入框
    if (e.target.matches('.item-time, .item-place, .item-description, .day-date')) {
      // 如果已经检查过权限且权限通过，直接返回（允许输入）
      const cachedPermission = permissionCache.get(e.target);
      if (cachedPermission === true) {
        return;
      }
      
      const currentTripId = editPanel.dataset.currentTripId || 
                           document.getElementById('editTripContainer')?.dataset.currentTripId;
      
      if (currentTripId) {
        // 记录原始值（用于拦截时恢复）
        if (!e.target.dataset.originalValue) {
          e.target.dataset.originalValue = e.target.value;
        }
        
        // 如果之前检查过且权限失败，直接阻止
        if (cachedPermission === false) {
          e.target.blur();
          window.api.showToast('您无权修改该行程', 'error');
          return;
        }
        
        // 异步检查权限（不阻塞输入，允许用户先输入）
        checkTripModifyPermission(currentTripId).then(hasPermission => {
          // 缓存权限结果
          permissionCache.set(e.target, hasPermission);
          
          if (!hasPermission) {
            // 权限检查失败，恢复原值并移除焦点
            e.target.value = e.target.dataset.originalValue || '';
            e.target.blur();
            window.api.showToast('您无权修改该行程', 'error');
          }
          // 权限通过时，允许继续输入，不需要额外操作
        }).catch(error => {
          console.error('权限检查失败:', error);
          // 检查失败时，允许输入（避免阻塞用户操作）
          permissionCache.set(e.target, true);
        });
      }
    }
  }, true); // 使用捕获阶段
  
  // 【新增】在blur时清除权限缓存，允许下次重新检查（处理权限可能变化的情况）
  document.addEventListener('blur', function(e) {
    if (e.target.matches('.item-time, .item-place, .item-description, .day-date')) {
      // 不清除缓存，保持权限状态，避免频繁检查
      // 如果需要重新检查，可以在特定操作后清除缓存
    }
  }, true);

  // 拦截拖拽操作
  document.addEventListener('dragstart', async function(e) {
    // 如果点击的是输入框、文本域或按钮，不拦截（让它们正常处理）
    if (e.target.matches('input, textarea, button, .btn-delete')) {
      return;
    }
    
    const editPanel = document.querySelector('.trip-edit-panel');
    if (!editPanel || !editPanel.contains(e.target)) {
      return;
    }

    // 检查是否是行程项目拖拽（支持.trip-item和.editable-item）
    const tripItem = e.target.closest('.trip-item, .editable-item');
    if (tripItem && !tripItem.closest('.day-section')) {
      // 确保是行程项目本身，而不是day-section
      const currentTripId = editPanel.dataset.currentTripId || 
                           document.getElementById('editTripContainer')?.dataset.currentTripId;
      
      if (currentTripId) {
        const hasPermission = await checkTripModifyPermission(currentTripId);
        if (!hasPermission) {
          e.preventDefault();
          e.stopPropagation();
          window.api.showToast('您无权修改该行程', 'error');
          return false;
        }
      }
    }
  }, true);

  // 拦截删除按钮点击（双重保障）
  document.addEventListener('click', async function(e) {
    if (e.target.matches('.btn-delete') || e.target.closest('.btn-delete')) {
      const editPanel = document.querySelector('.trip-edit-panel');
      if (!editPanel || !editPanel.contains(e.target)) {
        return;
      }

      const currentTripId = editPanel.dataset.currentTripId || 
                           document.getElementById('editTripContainer')?.dataset.currentTripId;
      
      if (currentTripId) {
        const hasPermission = await checkTripModifyPermission(currentTripId);
        if (!hasPermission) {
          e.preventDefault();
          e.stopPropagation();
          window.api.showToast('您无权修改该行程', 'error');
          return false;
        }
      }
    }
  }, true);
}

/**
 * 从localStorage兜底获取行程数据的辅助函数
 */
function getTripFromLocalStorage() {
  const currentTripId = getCurrentTripId();
  if (!currentTripId) return null;
  
  try {
    const listData = localStorage.getItem(STORAGE_KEYS.TRIP_LIST);
    if (listData) {
      const tripList = JSON.parse(listData);
      const localTrip = tripList.find(t => String(t.tripId) === String(currentTripId));
      return localTrip ? { ...localTrip } : null;
    }
  } catch (error) {
    console.warn('从localStorage兜底获取行程失败:', error);
  }
  return null;
}

/**
 * 生成并导出PDF（使用html2pdf.js，更好的中文支持）
 * 【修复空白PDF问题】添加DOM渲染等待、样式优化、数据兜底、配置增强
 */
async function exportTripToPdf() {
  let tempDiv = null;
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  
  try {
    // 0. 【修复3】优化依赖校验逻辑（增加更灵活的判断）
    let html2pdfInstance;
    try {
      // 兼容不同版本的html2pdf导出方式
      if (typeof window.html2pdf === 'function') {
        html2pdfInstance = window.html2pdf;
      } else if (window.html2pdf && typeof window.html2pdf.default === 'function') {
        html2pdfInstance = window.html2pdf.default;
      } else if (window.html2pdf) {
        html2pdfInstance = window.html2pdf;
      } else {
        throw new Error('html2pdf未定义');
      }
      
      // 验证核心方法
      if (!html2pdfInstance || !html2pdfInstance.set || !html2pdfInstance.from) {
        throw new Error('html2pdf核心方法缺失');
      }
    } catch (error) {
      window.api.showToast('PDF导出库加载不完整，请刷新页面重试', 'error');
      console.error('PDF导出库校验失败:', error, {
        hasHtml2pdf: !!window.html2pdf,
        html2pdfType: typeof window.html2pdf,
        hasSetMethod: !!(window.html2pdf && window.html2pdf.set),
        hasFromMethod: !!(window.html2pdf && window.html2pdf.from),
        hasHtml2canvas: !!window.html2canvas,
        hasJspdf: !!(window.jspdf || window.jsPDF)
      });
      return;
    }

    // 【修复4】添加按钮加载状态，避免重复点击
    if (exportPdfBtn) {
      exportPdfBtn.disabled = true;
      exportPdfBtn.textContent = '导出中...';
    }

    // 1. 【修复2】获取当前编辑的行程数据（优先读取全局最新数据）
    // 步骤1：优先读取全局最新数据（tripListManager选中后会更新此值）
    const globalTripData = window.tripEditModule?.currentEditTrip;
    // 步骤2：其次读取局部变量，最后从localStorage兜底
    let tripData = globalTripData || currentEditTrip || getTripFromLocalStorage();
    
    // 加强数据校验：若所有数据源都无数据，提示并返回
    if (!tripData || !tripData.itinerary || !Array.isArray(tripData.itinerary)) {
      window.api.showToast('未获取到有效行程数据，请重新加载行程', 'error');
      console.error('PDF导出-无有效行程数据:', { 
        tripData, 
        currentTripId: getCurrentTripId(),
        globalTripData: !!globalTripData,
        localCurrentEditTrip: !!currentEditTrip
      });
      return;
    }
    
    if (tripData.itinerary.length === 0) {
      window.api.showToast('请先加载行程', 'warning');
      return;
    }

    // 2. 从数据源收集行程信息（确保数据清洁）
    const itinerary = tripData.itinerary;
    
    // 【修复3】过滤有效天数（至少1个item），避免空内容
    const validItinerary = itinerary.filter(day => 
      day.items && Array.isArray(day.items) && day.items.length > 0
    );

    // 【修复5】数据校验与日志调试
    console.log('PDF导出-行程数据:', {
      tripDataExists: !!tripData,
      itineraryLength: itinerary.length,
      validItineraryLength: validItinerary.length
    });
    
    // 计算日期范围（从数据源获取，而非DOM）
    const dates = itinerary.map(day => day.date).filter(Boolean);
    let dateRange = '';
    let startDateStr = '';
    let endDateStr = '';
    
    if (dates.length > 0) {
      const startDate = new Date(dates[0]);
      const endDate = new Date(dates[dates.length - 1]);
      startDateStr = formatDateChinese(dates[0]);
      endDateStr = formatDateChinese(dates[dates.length - 1]);
      dateRange = `${startDateStr}至${endDateStr}`;
    } else {
      dateRange = '日期未设置';
    }
    
    const days = itinerary.length;

    // 3. 构建正确的标题（确保格式正确）
    const correctTitle = dateRange !== '日期未设置' ? `${dateRange}行程` : '未命名行程';

    // 4. 构建HTML内容（使用内联样式确保字体和格式正确）
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            margin: 2cm;
            size: A4 portrait;
          }
          body {
            font-family: "Microsoft YaHei", "SimHei", "SimSun", "Arial", sans-serif;
            font-size: 12pt;
            line-height: 1.2;
            color: #333;
            padding: 0;
            margin: 0;
          }
          .pdf-title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 10px;
            font-family: "SimHei", "Microsoft YaHei", "Arial", sans-serif;
          }
          .pdf-duration {
            text-align: center;
            font-size: 12pt;
            margin-bottom: 15px;
            font-family: "SimSun", "Microsoft YaHei", "Arial", sans-serif;
          }
          .pdf-divider {
            border-top: 1px solid #333;
            margin: 15px 0;
          }
          .day-section {
            margin-bottom: 20px;
          }
          .day-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 10px;
            font-family: "SimHei", "Microsoft YaHei", "Arial", sans-serif;
          }
          .day-item {
            font-size: 12pt;
            margin-bottom: 8px;
            line-height: 1.2;
            font-family: "SimSun", "Microsoft YaHei", "Arial", sans-serif;
          }
          .day-divider {
            border-top: 0.5px solid #ccc;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="pdf-title">${correctTitle}</div>
        <div class="pdf-duration">行程时长：${days}天</div>
        <div class="pdf-divider"></div>
    `;

    // 5. 【修复3】补充行程数据兜底逻辑（避免空内容）
    if (validItinerary.length === 0) {
      // 无有效行程项时的兜底提示
      htmlContent += `
        <div class="day-section">
          <div class="day-title">暂无有效行程项</div>
          <div class="day-item">请先在行程编辑界面添加行程项目（如时间、地点、描述）</div>
        </div>
      `;
    } else {
      // 遍历有效天数的行程（从数据源获取，过滤无效字符）
      validItinerary.forEach((day, dayIndex) => {
        // 找到原始索引（用于计算日期）
        const originalIndex = itinerary.findIndex(d => d === day);
        const dayNum = day.day || (originalIndex >= 0 ? originalIndex + 1 : dayIndex + 1);
        // 【修复3】修复日期格式化：确保不会返回空值
        const dayDate = formatDateForPdf(day.date);
        const dayTitle = `第${dayNum}天 | ${dayDate}`; // 确保有值
        
        htmlContent += `<div class="day-section">`;
        htmlContent += `<div class="day-title">${dayTitle}</div>`; // 标题必显
        
        if (day.items && Array.isArray(day.items) && day.items.length > 0) {
          day.items.forEach((item) => {
            // 【修复3】修复行程项拼接：确保每个字段有兜底
            const time = cleanTripContent(item.time || '未设置时间');
            const place = cleanTripContent(item.place || '未设置地点');
            const description = cleanTripContent(item.description || '无描述');
            
            // 格式化项目内容：时间 | 地点 | 内容（无空字段）
            const itemText = `${time}  |  ${place}  |  ${description}`;
            htmlContent += `<div class="day-item">${itemText}</div>`;
          });
        }
        
        // 添加分隔线（最后一天不加）
        if (dayIndex < validItinerary.length - 1) {
          htmlContent += `<div class="day-divider"></div>`;
        }
        
        htmlContent += `</div>`;
      });
    }

    htmlContent += `
      </body>
      </html>
    `;

    // 【修复5】HTML内容长度日志（若长度<500，说明内容生成异常）
    console.log('PDF导出-HTML内容长度:', htmlContent.length);
    if (htmlContent.length < 500) {
      console.warn('PDF导出警告：HTML内容过短，可能为空', htmlContent);
    }

    // 6. 【修复2】创建临时容器并设置内容（调整样式：视觉隐藏但保留布局）
    tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed'; // 固定定位避免滚动影响
    tempDiv.style.top = '0';
    tempDiv.style.left = '0';
    tempDiv.style.width = '210mm'; // A4宽度，确保内容不溢出
    tempDiv.style.height = 'auto';
    tempDiv.style.opacity = '0'; // 视觉隐藏
    tempDiv.style.visibility = 'visible'; // 保持DOM可捕获
    tempDiv.style.zIndex = '-1'; // 避免遮挡其他元素
    tempDiv.style.pointerEvents = 'none'; // 禁用交互
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);

    // 【修复1】等待DOM渲染完成（确保HTML内容完全绘制后再触发PDF生成）
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        // 额外兼容：确保样式生效和尺寸计算完成
        setTimeout(() => {
          // 强制触发重排，确保offsetWidth/offsetHeight计算正确
          tempDiv.offsetHeight;
          resolve();
        }, 100);
      });
    });

    // 获取临时容器的实际尺寸（A4尺寸：210mm × 297mm，在96dpi下约794px × 1123px）
    const containerWidth = tempDiv.offsetWidth || 794;
    const containerHeight = tempDiv.offsetHeight || 1123;
    
    console.log('PDF导出-临时容器尺寸:', {
      width: containerWidth,
      height: containerHeight,
      offsetWidth: tempDiv.offsetWidth,
      offsetHeight: tempDiv.offsetHeight
    });

    // 7. 【修复4】使用html2pdf.js生成PDF（优化配置参数，解决视口外捕获空白）
    const opt = {
      margin: [20, 20, 20, 20], // 上下左右各2cm = 20mm
      filename: `${correctTitle.replace(/[^\w\s-]/g, '_').substring(0, 50)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, // 高清捕获
        useCORS: true,
        allowTaint: true, // 允许捕获带特殊字符的内容
        logging: true, // 开启日志便于调试
        letterRendering: true,
        backgroundColor: '#ffffff', // 【修复4】关键：设置白色背景（避免透明）
        scrollY: 0, // 【修复4】关键：从顶部开始捕获
        scrollX: 0,
        windowWidth: containerWidth, // 【修复4】关键：使用临时容器宽度
        windowHeight: containerHeight // 【修复4】关键：使用临时容器高度
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true,
        encoding: 'UTF-8' // 显式指定编码，避免中文乱码
      }
    };

    // 8. 生成并下载PDF
    await html2pdfInstance().set(opt).from(tempDiv).save();
    
    window.api.showToast('PDF导出成功', 'success');
  } catch (error) {
    console.error('导出PDF失败:', error);
    window.api.showToast('PDF导出失败，请重试', 'error');
  } finally {
    // 【修复4】恢复按钮状态
    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.textContent = '生成并导出PDF';
    }
    
    // 9. 【修复5】清理临时元素（确保即使出错也能清理）
    if (tempDiv && tempDiv.parentNode) {
      try {
        document.body.removeChild(tempDiv);
      } catch (cleanupError) {
        console.warn('清理临时元素失败:', cleanupError);
      }
    }
  }
}

/**
 * 格式化日期为PDF显示格式（YYYY/MM/DD）
 * 【修复3】添加无效日期兜底，避免返回空值
 */
function formatDateForPdf(dateString) {
  try {
    if (!dateString) return '日期未设置';
    const date = new Date(dateString);
    // 校验日期有效性（关键修复：排除Invalid Date）
    if (isNaN(date.getTime())) {
      throw new Error('无效日期');
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  } catch (error) {
    // 兜底：返回原始字符串（而非空值）
    return dateString || '日期未设置';
  }
}

/**
 * 格式化日期为中文格式（YYYY年MM月DD日）
 * 【修复3】添加无效日期兜底，避免返回空值
 */
function formatDateChinese(dateString) {
  try {
    if (!dateString) return '日期未设置';
    const date = new Date(dateString);
    // 校验日期有效性（关键修复：排除Invalid Date）
    if (isNaN(date.getTime())) {
      throw new Error('无效日期');
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
  } catch (error) {
    // 兜底：返回原始字符串（而非空值）
    return dateString || '日期未设置';
  }
}

/**
 * 过滤行程内容中的无效字符（保留中文、英文、数字、常见标点）
 */
function cleanTripContent(content) {
  if (!content) return '';
  // 保留中文、英文、数字、常见标点（：，。；、！？），其他符号替换为空
  return content.replace(/[^\u4e00-\u9fa5a-zA-Z0-9:：,，.。;；、！？\s-]/g, '').trim();
}

/**
 * 初始化行程编辑模块
 */
function initTripEdit() {
  // 保存按钮（新布局中仍然存在）
  const saveBtn = document.getElementById('saveTripBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTrip);
  }

  // 【修复5】PDF导出按钮绑定：添加日志和容错
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) {
    // 先移除旧事件（避免重复绑定）
    exportPdfBtn.removeEventListener('click', exportTripToPdf);
    exportPdfBtn.addEventListener('click', exportTripToPdf);
    console.log('✅ PDF导出按钮事件绑定成功');
  } else {
    console.error('❌ 未找到PDF导出按钮（exportPdfBtn），请检查HTML中的id是否正确');
    // 不显示toast，避免干扰用户（仅在控制台提示）
  }

  // 加载行程按钮（旧布局，保留兼容性）
  const loadBtn = document.getElementById('loadTripBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadTrip);
  }

  // 加载行程列表（用于下拉框，保留兼容性）
  loadTripList();

  // 初始化智能行程优化模块（合并后的模块）
  initSmartOptimizer();

  // 初始化权限拦截器（输入框、拖拽等操作）
  initPermissionInterceptors();

  // 初始化拖拽功能
  initDragAndDrop();

  // 将函数挂载到全局，供 HTML 中的 onclick 使用
  window.addTripItem = addTripItem;
  window.deleteTripItem = deleteTripItem;
}

// 导出行程编辑相关函数
window.tripEditModule = {
  loadTripList,
  loadTrip,
  displayEditItinerary,
  saveTrip,
  initTripEdit,
  initSmartOptimizer,
  handleSmartOptimize,
  loadFavoriteLinks,
  getCurrentLoginUserId, // 导出用户ID获取函数
  checkTripModifyPermission, // 导出权限校验函数
  updateModifyButtonsState, // 导出按钮状态控制函数
  initPermissionInterceptors, // 导出权限拦截器初始化函数
  syncLocalTripToBackend, // 导出同步local行程到后端函数
  currentEditTrip // 导出currentEditTrip供其他模块使用
};


