/**
 * 行程列表管理模块
 * 处理行程列表加载、分页、选中、删除等功能
 */

let allTrips = []; // 存储所有行程数据
let currentPage = 1; // 当前页码
const ITEMS_PER_PAGE = 5; // 每页显示的行程数
let selectedTripId = null; // 当前选中的行程ID

/**
 * 加载所有行程数据
 */
async function loadAllTrips() {
  allTrips = [];
  
  // 从localStorage读取已保存的行程
  try {
    const listData = localStorage.getItem('trip_list');
    if (listData) {
      const localTrips = JSON.parse(listData);
      allTrips.push(...localTrips.map(trip => ({ ...trip, source: 'local' })));
    }
  } catch (error) {
    console.error('加载localStorage行程列表失败:', error);
  }
  
  // 从后端API读取行程（如果用户已登录）
  const user = window.userModule?.getCurrentUser();
  if (user) {
    try {
      const data = await window.api.get('/trip/list', { userId: user.userId });
      const trips = data.trips || [];
      
      // 合并服务器行程，避免重复
      trips.forEach(trip => {
        const exists = allTrips.find(t => t.tripId === trip.tripId);
        if (!exists) {
          allTrips.push({ ...trip, source: 'server' });
        } else {
          // 如果已存在，优先使用服务器数据
          const index = allTrips.findIndex(t => t.tripId === trip.tripId);
          allTrips[index] = { ...trip, source: 'server' };
        }
      });
    } catch (error) {
      console.error('加载服务器行程列表失败:', error);
    }
  }
  
  // 重新渲染列表
  renderTripList();
  updatePagination();
}

/**
 * 渲染行程列表（根据当前页）
 */
function renderTripList() {
  const container = document.getElementById('tripList');
  if (!container) return;
  
  // 计算当前页的数据
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentTrips = allTrips.slice(startIndex, endIndex);
  
  if (currentTrips.length === 0 && allTrips.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无行程，请先生成行程</p>';
    return;
  }
  
  if (currentTrips.length === 0) {
    container.innerHTML = '<p class="empty-tip">当前页无数据</p>';
    return;
  }
  
  // 渲染行程项
  container.innerHTML = currentTrips.map(trip => {
    // 确保tripId是字符串类型，用于data属性和比较
    const tripIdStr = String(trip.tripId);
    // 使用字符串比较，确保类型匹配
    const isSelected = selectedTripId && String(selectedTripId) === tripIdStr ? 'selected' : '';
    return `
      <div class="trip-item ${isSelected}" data-trip-id="${tripIdStr}" data-source="${trip.source || 'local'}">
        <span class="trip-name">${trip.title || '未命名行程'}</span>
        <span class="trip-days">${trip.days || 0}天</span>
        <button class="btn-delete-trip" data-trip-id="${tripIdStr}">删除</button>
      </div>
    `;
  }).join('');
  
  // 绑定点击事件（选中行程和删除按钮）
  container.querySelectorAll('.trip-item').forEach(item => {
    const tripId = item.dataset.tripId;
    // 选中行程事件
    item.addEventListener('click', (e) => {
      // 如果点击的是删除按钮，不触发选中
      if (e.target.classList.contains('btn-delete-trip')) {
        return;
      }
      selectTrip(tripId);
    });
    
    // 删除按钮事件（使用事件委托）
    const deleteBtn = item.querySelector('.btn-delete-trip');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        const btnTripId = deleteBtn.dataset.tripId || tripId;
        deleteTripFromList(btnTripId, e);
      });
    }
  });
}

/**
 * 选中行程并加载到编辑区
 * @param {string|number} tripId - 行程唯一标识
 */
async function selectTrip(tripId) {
  // 统一将tripId转换为字符串，确保类型匹配
  const tripIdStr = String(tripId);
  selectedTripId = tripIdStr;
  
  // 使用字符串比较，兼容不同类型的tripId
  const trip = allTrips.find(t => String(t.tripId) === tripIdStr);
  
  if (!trip) {
    window.api.showToast('行程不存在', 'error');
    return;
  }
  
  // 更新选中状态UI（使用字符串比较）
  document.querySelectorAll('.trip-item').forEach(item => {
    if (String(item.dataset.tripId) === tripIdStr) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  // 【游客权限逻辑】检查是否为游客模式
  if (!window.userModule?.isLoggedIn()) {
    window.userModule.showLoginGuideModal();
    return;
  }
  
  // 加载行程详情
  try {
    let tripData = trip;
    
    // 如果有itinerary数据，直接使用；否则从API获取
    if (!trip.itinerary || trip.itinerary.length === 0) {
      const data = await window.api.get('/trip/get', { tripId: tripIdStr });
      tripData = data.trip;
    }
    
    // 设置当前编辑的行程（供tripEdit.js使用）
    if (window.tripEditModule) {
      window.tripEditModule.currentEditTrip = tripData;
    }
    
    // 同时设置全局变量（向后兼容）
    if (typeof currentEditTrip !== 'undefined') {
      window.currentEditTrip = tripData;
    }
    
    // 调用tripEdit.js的displayEditItinerary函数
    if (window.tripEditModule && window.tripEditModule.displayEditItinerary) {
      window.tripEditModule.displayEditItinerary(tripData.itinerary);
    } else {
      // 如果tripEditModule还未初始化，直接调用全局函数
      if (typeof displayEditItinerary === 'function') {
        displayEditItinerary(tripData.itinerary);
      }
    }
    
    // 显示编辑区
    const editContainer = document.getElementById('editTripContainer');
    const editEmpty = document.getElementById('editTripEmpty');
    if (editContainer) editContainer.style.display = 'block';
    if (editEmpty) editEmpty.style.display = 'none';
    
    // 更新行程标题
    const titleEl = document.getElementById('editTripTitle');
    if (titleEl) {
      titleEl.textContent = tripData.title || '未命名行程';
      // 初始化标题编辑功能
      initEditTitle();
    }
    
  } catch (error) {
    console.error('加载行程详情失败:', error);
    window.api.showToast('加载行程失败', 'error');
  }
}

/**
 * 初始化标题编辑功能
 */
function initEditTitle() {
  const titleElement = document.getElementById('editTripTitle');
  if (!titleElement) return;
  
  // 使用事件委托，避免重复绑定
  titleElement.onclick = function() {
    // 如果已经在编辑状态，不重复处理
    if (this.querySelector('input')) return;
    
    const currentText = this.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'trip-title-input';
    
    // 保存原始样式
    const originalStyle = {
      fontSize: window.getComputedStyle(this).fontSize,
      fontWeight: window.getComputedStyle(this).fontWeight,
      color: window.getComputedStyle(this).color
    };
    
    // 设置输入框样式
    input.style.fontSize = originalStyle.fontSize;
    input.style.fontWeight = originalStyle.fontWeight;
    input.style.color = originalStyle.color;
    
    // 替换元素
    this.textContent = '';
    this.appendChild(input);
    input.focus();
    input.select();
    
    // 保存函数
    const saveTitle = () => {
      const newText = input.value.trim() || '未命名行程';
      this.textContent = newText;
      
      // 更新当前行程数据
      if (window.tripEditModule && window.tripEditModule.currentEditTrip) {
        window.tripEditModule.currentEditTrip.title = newText;
      }
      
      // 更新列表中的标题（如果存在，使用字符串比较）
      if (selectedTripId) {
        const currentTrip = allTrips.find(t => String(t.tripId) === String(selectedTripId));
        if (currentTrip) {
          currentTrip.title = newText;
        }
      }
    };
    
    // 失去焦点时保存
    input.addEventListener('blur', saveTitle);
    
    // 回车键保存
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  };
}

/**
 * 删除行程（清单级）
 * @param {string|number} tripId - 行程唯一标识（统一转换为字符串进行比较）
 * @param {Event} event - 事件对象（用于阻止冒泡）
 */
async function deleteTripFromList(tripId, event) {
  // 阻止事件冒泡，避免触发选中
  if (event) {
    event.stopPropagation();
  }
  
  // 确认删除
  if (!confirm('确定要删除这个行程吗？删除后将无法恢复。')) {
    return;
  }
  
  // 统一将tripId转换为字符串，确保类型匹配
  const tripIdStr = String(tripId);
  
  // 查找要删除的行程（使用字符串比较，兼容不同类型）
  const trip = allTrips.find(t => String(t.tripId) === tripIdStr);
  
  if (!trip) {
    console.error('删除失败：未找到行程，tripId:', tripIdStr);
    window.api.showToast('删除失败：未找到该行程', 'error');
    return;
  }
  
  let serverDeleteSuccess = false;
  let localStorageDeleteSuccess = false;
  
  // 1. 尝试从服务器删除（如果是从服务器加载的）
  if (trip.source === 'server') {
    const user = window.userModule?.getCurrentUser();
    if (user) {
      try {
        // 注意：后端可能没有删除接口，如果失败也不影响localStorage删除
        await window.api.delete('/trip/delete', { tripId: tripIdStr, userId: user.userId }, { showError: false });
        serverDeleteSuccess = true;
        console.log('服务器删除成功:', tripIdStr);
      } catch (error) {
        // 后端删除失败不影响继续删除localStorage
        console.warn('服务器删除失败（可能后端接口不存在）:', error.message, '，将继续删除本地数据');
        serverDeleteSuccess = false;
      }
    }
  } else {
    // 本地行程，标记为已处理（不需要服务器删除）
    serverDeleteSuccess = true;
  }
  
  // 2. 从localStorage删除（无论服务器删除是否成功都要执行）
  try {
    const listData = localStorage.getItem('trip_list');
    if (listData) {
      const localTrips = JSON.parse(listData);
      // 使用字符串比较，确保类型匹配
      const beforeCount = localTrips.length;
      const filtered = localTrips.filter(t => String(t.tripId) !== tripIdStr);
      const afterCount = filtered.length;
      
      if (beforeCount > afterCount) {
        localStorage.setItem('trip_list', JSON.stringify(filtered));
        localStorageDeleteSuccess = true;
        console.log('localStorage删除成功:', tripIdStr);
      } else {
        console.warn('localStorage中未找到该行程:', tripIdStr);
      }
    } else {
      // localStorage中没有数据，也视为成功（可能只在服务器）
      localStorageDeleteSuccess = true;
    }
  } catch (error) {
    console.error('从localStorage删除失败:', error);
    localStorageDeleteSuccess = false;
  }
  
  // 3. 从allTrips中删除（用于刷新列表）
  const beforeAllCount = allTrips.length;
  allTrips = allTrips.filter(t => String(t.tripId) !== tripIdStr);
  const afterAllCount = allTrips.length;
  
  if (beforeAllCount === afterAllCount) {
    console.warn('allTrips中未找到该行程:', tripIdStr);
  }
  
  // 4. 如果localStorage删除成功或allTrips删除成功，认为删除操作成功
  if (localStorageDeleteSuccess || beforeAllCount > afterAllCount) {
    // 如果删除的是当前选中的行程，清空编辑区（统一使用字符串比较）
    if (selectedTripId && String(selectedTripId) === tripIdStr) {
      selectedTripId = null;
      const editContainer = document.getElementById('editTripContainer');
      const editEmpty = document.getElementById('editTripEmpty');
      if (editContainer) editContainer.style.display = 'none';
      if (editEmpty) editEmpty.style.display = 'block';
    }
    
    // 重新渲染列表和分页
    const totalPages = Math.ceil(allTrips.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }
    
    renderTripList();
    updatePagination();
    
    // 根据删除情况给出不同的提示
    if (serverDeleteSuccess && localStorageDeleteSuccess) {
      window.api.showToast('删除成功', 'success');
    } else if (localStorageDeleteSuccess) {
      window.api.showToast('本地删除成功（服务器删除可能失败）', 'success');
    } else {
      window.api.showToast('删除失败', 'error');
    }
  } else {
    // 删除失败
    console.error('删除失败：无法从任何数据源删除行程，tripId:', tripIdStr);
    window.api.showToast('删除失败：无法删除该行程', 'error');
  }
}

/**
 * 更新分页控件
 */
function updatePagination() {
  const totalPages = Math.ceil(allTrips.length / ITEMS_PER_PAGE) || 1;
  const prevBtn = document.querySelector('.prev-page');
  const nextBtn = document.querySelector('.next-page');
  const currentPageEl = document.querySelector('.current-page');
  
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
  
  if (currentPageEl) {
    currentPageEl.innerHTML = `第<span class="page-number">${currentPage}</span>页/共${totalPages}页`;
  }
}

/**
 * 上一页
 */
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTripList();
    updatePagination();
  }
}

/**
 * 下一页
 */
function nextPage() {
  const totalPages = Math.ceil(allTrips.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderTripList();
    updatePagination();
  }
}

/**
 * 初始化行程列表管理模块
 */
function initTripListManager() {
  // 绑定分页按钮事件
  const prevBtn = document.querySelector('.prev-page');
  const nextBtn = document.querySelector('.next-page');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', prevPage);
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', nextPage);
  }
  
  // 将删除函数挂载到全局（已改为事件绑定，但保留以备兼容）
  window.deleteTripFromList = deleteTripFromList;
  
  // 加载行程列表
  loadAllTrips();
}

// 导出函数
window.tripListManager = {
  loadAllTrips,
  selectTrip,
  deleteTripFromList,
  initTripListManager
};

