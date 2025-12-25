/**
 * 行程编辑模块
 * 处理行程加载、编辑、保存
 */

let currentEditTrip = null;

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

    // 从后端获取行程详情（包含userId字段）
    const data = await window.api.get('/trip/get', { tripId });
    const trip = data.trip;

    if (!trip) {
      console.log('权限校验调试：行程不存在，tripId:', tripId);
      return false;
    }

    // 补全缺失的权限字段（兼容旧数据）
    // 如果旧行程没有creatorId，使用userId作为creatorId
    if (!trip.hasOwnProperty('creatorId')) {
      trip.creatorId = trip.userId || currentUserId;
    }
    if (!trip.hasOwnProperty('collaborators')) {
      trip.collaborators = [];
    }

    // 权限规则：行程创建者（creatorId或userId匹配）或协作者可修改
    const isCreator = (trip.creatorId === currentUserId) || (trip.userId === currentUserId);
    const isCollaborator = Array.isArray(trip.collaborators) && trip.collaborators.includes(currentUserId);
    const hasPermission = isCreator || isCollaborator;

    // 调试日志
    console.log('权限校验调试：', {
      currentUserId,
      tripId,
      tripCreatorId: trip.creatorId || trip.userId,
      tripUserId: trip.userId,
      tripCollaborators: trip.collaborators,
      isCreator,
      isCollaborator,
      hasPermission
    });

    return hasPermission;
  } catch (error) {
    console.error('权限校验失败:', error);
    return false;
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
    const listData = localStorage.getItem('trip_list');
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
    // 修复：获取当前用户ID，确保与后端一致
    const currentUser = window.userModule?.getCurrentUser();
    let userId = null;
    if (currentUser && currentUser.userId) {
      userId = currentUser.userId;
    }

    // 调用后端接口获取行程（携带用户ID，确保权限校验通过）
    const data = await window.api.get('/trip/get', { 
      tripId,
      userId: userId // 新增：传递用户ID
    });
    currentEditTrip = data.trip;
    
    // 修复：补全缺失的权限字段（兼容旧数据）
    if (!currentEditTrip.hasOwnProperty('creatorId')) {
      const currentUserId = getCurrentLoginUserId();
      currentEditTrip.creatorId = currentEditTrip.userId || currentUserId;
    }
    if (!currentEditTrip.hasOwnProperty('collaborators')) {
      currentEditTrip.collaborators = [];
    }
    
    // 加载后先过滤空天数
    if (currentEditTrip.itinerary && Array.isArray(currentEditTrip.itinerary)) {
      currentEditTrip.itinerary = currentEditTrip.itinerary.filter(day => {
        return day.items && Array.isArray(day.items) && day.items.length > 0;
      });
      // 更新days字段为过滤后的天数
      currentEditTrip.days = currentEditTrip.itinerary.length;
    }
    
    // 新增：权限校验+按钮状态控制
    const hasPermission = await checkTripModifyPermission(tripId);
    updateModifyButtonsState(hasPermission);
    
    displayEditItinerary(currentEditTrip.itinerary, currentEditTrip);
    document.getElementById('editTripContainer').style.display = 'block';
  } catch (error) {
    // 错误已在 api.js 中处理
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
  const validDays = itinerary.filter(day => {
    // 检查是否有items数组且至少包含1个项目
    return day.items && Array.isArray(day.items) && day.items.length > 0;
  });
  
  if (validDays.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无行程数据</p>';
    return;
  }
  
  // 如果提供了tripData，存储tripId到编辑面板（双重保障）
  if (tripData && tripData.tripId) {
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    if (editPanel) {
      editPanel.dataset.currentTripId = String(tripData.tripId);
    }
    if (editContainer) {
      editContainer.dataset.currentTripId = String(tripData.tripId);
    }
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
          <div class="editable-item" data-day-index="${dayIndex}" data-item-index="${itemIndex}">
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
  const editPanel = document.querySelector('.trip-edit-panel');
  const editContainer = document.getElementById('editTripContainer');
  let currentTripId = null;
  
  if (editPanel && editPanel.dataset.currentTripId) {
    currentTripId = editPanel.dataset.currentTripId;
  } else if (editContainer && editContainer.dataset.currentTripId) {
    currentTripId = editContainer.dataset.currentTripId;
  } else if (currentEditTrip && currentEditTrip.tripId) {
    currentTripId = String(currentEditTrip.tripId);
  }

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
  newItem.className = 'editable-item';
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
    // 1. 获取当前编辑行程的tripId（优先从DOM属性获取，其次从currentEditTrip）
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    let currentTripId = null;
    
    if (editPanel && editPanel.dataset.currentTripId) {
      currentTripId = editPanel.dataset.currentTripId;
    } else if (editContainer && editContainer.dataset.currentTripId) {
      currentTripId = editContainer.dataset.currentTripId;
    } else if (currentEditTrip && currentEditTrip.tripId) {
      currentTripId = String(currentEditTrip.tripId);
    }
    
    if (!currentTripId) {
      window.api.showToast('保存失败：未找到当前编辑行程的ID', 'error');
      console.error('保存失败：无法获取tripId');
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
    try {
      let tripList = [];
      const listData = localStorage.getItem('trip_list');
      if (listData) {
        tripList = JSON.parse(listData);
      }
      
      // 查找是否已存在（根据tripId，使用字符串比较）
      const existingIndex = tripList.findIndex(t => String(t.tripId) === String(currentTripId));
      
      const tripListItem = {
        tripId: currentTripId,
        title: title,
        days: days,
        savedAt: updatedTripData.updatedAt || new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        // 更新现有项
        tripList[existingIndex] = tripListItem;
        console.log('✅ 已更新localStorage中的行程列表项');
      } else {
        // 如果不存在，添加新项（理论上不应该发生，但为了安全）
        tripList.push(tripListItem);
        console.warn('⚠️ 行程列表中未找到该行程，已添加为新项');
      }
      
      // 保存回localStorage
      localStorage.setItem('trip_list', JSON.stringify(tripList));
      console.log('✅ 已更新localStorage中的trip_list');
    } catch (error) {
      console.error('更新localStorage失败:', error);
      // 不阻断后续操作，继续尝试更新后端
    }

    // 5. 更新后端接口（如果用户已登录）
  try {
    await window.api.post('/trip/update', {
        tripId: currentTripId,
        title: title,
        itinerary: itinerary
      });
      console.log('✅ 已更新后端行程数据');
    } catch (error) {
      console.warn('⚠️ 后端更新失败（可能用户未登录或接口不存在）:', error);
      // 后端更新失败不影响本地保存成功
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

    checkboxesContainer.innerHTML = '';
    
    if (favoriteLinks.length === 0) {
      checkboxesContainer.innerHTML = '<p class="empty-tip" style="font-size: 12px; color: #999;">暂无收藏的攻略</p>';
      return;
    }

    favoriteLinks.forEach(link => {
      const labelEl = document.createElement('label');
      labelEl.className = 'favorite-checkbox-item';
      labelEl.innerHTML = `
        <input type="checkbox" class="favorite-checkbox" value="${link.collectionId}">
        <span>${window.utils.escapeHtml(link.title || '未命名攻略')}</span>
      `;
      checkboxesContainer.appendChild(labelEl);
    });
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
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    let currentTripId = null;
    
    if (editPanel && editPanel.dataset.currentTripId) {
      currentTripId = editPanel.dataset.currentTripId;
    } else if (editContainer && editContainer.dataset.currentTripId) {
      currentTripId = editContainer.dataset.currentTripId;
    } else if (currentEditTrip && currentEditTrip.tripId) {
      currentTripId = String(currentEditTrip.tripId);
    }

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
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    let currentTripId = null;
    
    if (editPanel && editPanel.dataset.currentTripId) {
      currentTripId = editPanel.dataset.currentTripId;
    } else if (editContainer && editContainer.dataset.currentTripId) {
      currentTripId = editContainer.dataset.currentTripId;
    } else if (currentEditTrip && currentEditTrip.tripId) {
      currentTripId = String(currentEditTrip.tripId);
    }

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
    const editPanel = document.querySelector('.trip-edit-panel');
    const editContainer = document.getElementById('editTripContainer');
    let currentTripId = null;
    
    if (editPanel && editPanel.dataset.currentTripId) {
      currentTripId = editPanel.dataset.currentTripId;
    } else if (editContainer && editContainer.dataset.currentTripId) {
      currentTripId = editContainer.dataset.currentTripId;
    } else if (currentEditTrip && currentEditTrip.tripId) {
      currentTripId = String(currentEditTrip.tripId);
    }
    
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

    // 5. 智能修改后过滤空天数（移除无项目的天数）
    if (modifiedTrip.itinerary && Array.isArray(modifiedTrip.itinerary)) {
      modifiedTrip.itinerary = modifiedTrip.itinerary.filter(day => {
        return day.items && Array.isArray(day.items) && day.items.length > 0;
      });
      // 更新days字段为过滤后的天数
      modifiedTrip.days = modifiedTrip.itinerary.length;
    }

    // 6. 更新当前编辑的行程数据
    currentEditTrip = modifiedTrip;
    if (window.tripEditModule) {
      window.tripEditModule.currentEditTrip = modifiedTrip;
    }

    // 7. 更新编辑面板的tripId（双重保障）
    if (editPanel) {
      editPanel.dataset.currentTripId = String(modifiedTrip.tripId);
    }
    if (editContainer) {
      editContainer.dataset.currentTripId = String(modifiedTrip.tripId);
    }

    // 8. 更新行程标题
    const titleEl = document.getElementById('editTripTitle');
    if (titleEl) {
      titleEl.textContent = modifiedTrip.title || '未命名行程';
      // 重新初始化标题编辑功能（如果函数存在）
      if (window.tripListManager && typeof window.tripListManager.initEditTitle === 'function') {
        window.tripListManager.initEditTitle();
      }
    }

    // 9. 复用displayEditItinerary函数刷新编辑区（会自动过滤空天数）
    displayEditItinerary(modifiedTrip.itinerary, modifiedTrip);

    // 10. 更新本地存储（同步到trip_list）
    try {
      let tripList = [];
      const listData = localStorage.getItem('trip_list');
      if (listData) {
        tripList = JSON.parse(listData);
      }
      
      const existingIndex = tripList.findIndex(t => String(t.tripId) === String(currentTripId));
      
      const tripListItem = {
        tripId: modifiedTrip.tripId,
        title: modifiedTrip.title || '未命名行程',
        days: modifiedTrip.days || modifiedTrip.itinerary.length,
        savedAt: modifiedTrip.updatedAt || new Date().toISOString()
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
 * 初始化输入框和拖拽操作的权限拦截
 */
function initPermissionInterceptors() {
  // 拦截输入框修改操作
  document.addEventListener('input', async function(e) {
    // 匹配行程编辑区的输入框（时间、地点、描述）
    const editPanel = document.querySelector('.trip-edit-panel');
    if (!editPanel || !editPanel.contains(e.target)) {
      return;
    }

    // 检查是否是行程编辑相关的输入框
    if (e.target.matches('.item-time, .item-place, .item-description, .day-date')) {
      const currentTripId = editPanel.dataset.currentTripId || 
                           document.getElementById('editTripContainer')?.dataset.currentTripId;
      
      if (currentTripId) {
        const hasPermission = await checkTripModifyPermission(currentTripId);
        if (!hasPermission) {
          e.preventDefault();
          e.stopPropagation();
          window.api.showToast('您无权修改该行程', 'error');
          
          // 恢复输入框原有值
          const originalValue = e.target.dataset.originalValue || e.target.defaultValue || '';
          e.target.value = originalValue;
          return false;
        } else {
          // 记录原始值（用于拦截时恢复）
          if (!e.target.dataset.originalValue) {
            e.target.dataset.originalValue = e.target.value;
          }
        }
      }
    }
  }, true); // 使用捕获阶段，确保在输入前拦截

  // 拦截拖拽操作
  document.addEventListener('dragstart', async function(e) {
    const editPanel = document.querySelector('.trip-edit-panel');
    if (!editPanel || !editPanel.contains(e.target)) {
      return;
    }

    // 检查是否是行程项目拖拽
    if (e.target.closest('.editable-item, .day-section')) {
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
 * 初始化行程编辑模块
 */
function initTripEdit() {
  // 保存按钮（新布局中仍然存在）
  const saveBtn = document.getElementById('saveTripBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTrip);
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
  currentEditTrip // 导出currentEditTrip供其他模块使用
};

