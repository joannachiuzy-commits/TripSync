/**
 * 行程编辑模块
 * 处理行程加载、编辑、保存
 */

let currentEditTrip = null;

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
    const data = await window.api.get('/trip/get', { tripId });
    currentEditTrip = data.trip;
    displayEditItinerary(data.trip.itinerary);
    document.getElementById('editTripContainer').style.display = 'block';
  } catch (error) {
    // 错误已在 api.js 中处理
  }
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

  container.innerHTML = itinerary.map((day, dayIndex) => `
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
 */
function addTripItem(dayIndex) {
  // 【游客权限逻辑】检查是否为游客模式，游客无法编辑行程
  if (!window.userModule.isLoggedIn()) {
    window.userModule.showLoginGuideModal();
    return; // 阻止后续操作
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

      itinerary.push({
        day: dayIndex + 1,
        date: day,
        items
      });
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
 * 初始化智能行程助手
 */
function initTripAgentHelper() {
  const modifyBtn = document.getElementById('btnAgentModify');
  const promptInput = document.getElementById('agentPromptInput');
  
  if (!modifyBtn || !promptInput) {
    return;
  }

  // 绑定智能修改按钮点击事件
  modifyBtn.addEventListener('click', handleAgentModify);

  // 绑定回车键快捷提交
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      modifyBtn.click();
    }
  });
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

    // 4. 调用后端API进行智能修改
    const response = await window.api.post('/trip/modify', {
      tripId: currentTripId,
      userPrompt: userPrompt
    });

    if (!response || !response.trip) {
      throw new Error('服务器返回数据格式错误');
    }

    const modifiedTrip = response.trip;

    // 5. 更新当前编辑的行程数据
    currentEditTrip = modifiedTrip;
    if (window.tripEditModule) {
      window.tripEditModule.currentEditTrip = modifiedTrip;
    }

    // 6. 更新编辑面板的tripId（双重保障）
    if (editPanel) {
      editPanel.dataset.currentTripId = String(modifiedTrip.tripId);
    }
    if (editContainer) {
      editContainer.dataset.currentTripId = String(modifiedTrip.tripId);
    }

    // 7. 更新行程标题
    const titleEl = document.getElementById('editTripTitle');
    if (titleEl) {
      titleEl.textContent = modifiedTrip.title || '未命名行程';
      // 重新初始化标题编辑功能（如果函数存在）
      if (window.tripListManager && typeof window.tripListManager.initEditTitle === 'function') {
        window.tripListManager.initEditTitle();
      }
    }

    // 8. 复用displayEditItinerary函数刷新编辑区
    displayEditItinerary(modifiedTrip.itinerary, modifiedTrip);

    // 9. 更新本地存储（同步到trip_list）
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

    // 10. 刷新行程列表（如果存在）
    if (window.tripListManager && window.tripListManager.loadAllTrips) {
      window.tripListManager.loadAllTrips();
    }

    // 11. 清空输入框
    promptInput.value = '';

    // 12. 显示成功提示
    window.api.showToast(`智能修改完成（使用${response.modelName || '通义千问'}），可保存修改`, 'success');

  } catch (error) {
    console.error('智能修改失败:', error);
    window.api.showToast('智能修改失败：' + (error.message || '请检查指令或稍后重试'), 'error');
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

  // 初始化智能行程助手
  initTripAgentHelper();

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
  initTripAgentHelper,
  handleAgentModify,
  currentEditTrip // 导出currentEditTrip供其他模块使用
};

