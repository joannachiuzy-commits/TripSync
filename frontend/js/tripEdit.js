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
 */
function displayEditItinerary(itinerary) {
  const container = document.getElementById('editItinerary');
  
  if (!itinerary || itinerary.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无行程数据</p>';
    return;
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
  if (!currentEditTrip) {
    window.api.showToast('请先加载行程', 'error');
    return;
  }

  // 收集编辑后的行程数据
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

  try {
    await window.api.post('/trip/update', {
      tripId: currentEditTrip.tripId,
      itinerary
    });

    window.api.showToast('保存成功', 'success');
    
    // 更新当前行程数据
    currentEditTrip.itinerary = itinerary;
  } catch (error) {
    // 错误已在 api.js 中处理
  }
}

/**
 * 初始化行程编辑模块
 */
function initTripEdit() {
  // 加载行程按钮
  document.getElementById('loadTripBtn').addEventListener('click', loadTrip);

  // 保存按钮
  document.getElementById('saveTripBtn').addEventListener('click', saveTrip);

  // 加载行程列表
  loadTripList();

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
  initTripEdit
};

