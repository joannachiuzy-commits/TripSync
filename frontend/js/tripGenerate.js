/**
 * 行程生成模块
 * 处理 AI 生成行程、展示生成结果
 */

let currentTripId = null;
let currentItineraryData = null; // 保存当前生成的行程原始数据

/**
 * 生成行程
 * 【游客权限逻辑】游客模式下需要登录才能生成行程
 */
async function generateTrip() {
  try {
    // 检查关键模块是否存在
    if (!window.userModule) {
      throw new Error('userModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.collectionModule) {
      throw new Error('collectionModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.api) {
      throw new Error('api 模块未加载，请检查脚本加载顺序');
    }

    // 【游客权限逻辑】检查是否为游客模式，游客无法生成行程
    if (!window.userModule.isLoggedIn()) {
      window.userModule.showLoginGuideModal();
      return; // 阻止后续操作
    }

    const selectedCollections = window.collectionModule.getSelectedCollections();
    
    if (selectedCollections.length === 0) {
      window.api.showToast('请至少选择一个收藏', 'error');
      return;
    }

    const daysInput = document.getElementById('tripDays');
    const budgetInput = document.getElementById('tripBudget');
    
    if (!daysInput) {
      throw new Error('未找到行程天数输入框，请检查HTML');
    }

    const days = parseInt(daysInput.value);
    const budget = budgetInput ? budgetInput.value.trim() : '';

    if (!days || days < 1) {
      window.api.showToast('请输入有效的行程天数', 'error');
      return;
    }

    const user = window.userModule.getCurrentUser();
    if (!user) {
      window.api.showToast('请先登录', 'error');
      return;
    }

    // 获取用户选择的模型类型
    const modelTypeSelect = document.getElementById('modelTypeSelect');
    const modelType = modelTypeSelect ? modelTypeSelect.value : 'auto';

    // 获取行程偏好
    const preferenceInput = document.getElementById('preferenceInput');
    const preference = preferenceInput ? preferenceInput.value.trim() : '';

    const data = await window.api.post('/trip/generate', {
      userId: user.userId,
      collectionIds: selectedCollections.map(c => c.collectionId),
      days,
      budget,
      modelType, // 传递模型类型参数
      preference // 传递偏好参数
    });

    // 生成新行程时创建唯一tripId（不复用旧ID）
    currentTripId = 'local_' + Date.now();
    
    // 清除localStorage中的旧行程数据，确保不继承历史标题
    localStorage.removeItem('validated_trip');
    
    // 保存行程原始数据
    currentItineraryData = data.itinerary;
    
    // 强制重置标题为默认值"未命名行程"（不读取缓存）
    const tripTitle = document.getElementById('tripTitle');
    if (tripTitle) {
      tripTitle.textContent = '未命名行程';
    }
    
    // 显示生成结果
    displayItinerary(data.itinerary);
    
    const generateResult = document.getElementById('generateResult');
    if (generateResult) {
      generateResult.style.display = 'block';
      // 如果有行程内容，显示保存按钮
      if (data.itinerary && data.itinerary.length > 0) {
        showSaveTripButton();
      }
    }
    // 显示生成成功提示，包含使用的模型信息
    const modelName = data.modelName || 'AI';
    window.api.showToast(`行程生成成功（使用 ${modelName}）`, 'success');

    // 刷新行程列表（编辑页面和分享页面）
    setTimeout(() => {
      if (window.tripEditModule && window.tripEditModule.loadTripList) {
        window.tripEditModule.loadTripList();
      }
      if (window.shareModule && window.shareModule.loadTripList) {
        window.shareModule.loadTripList();
      }
    }, 500);
  } catch (error) {
    // 捕获前置逻辑错误（如模块未定义、参数错误）
    if (window.api && window.api.hideLoadingOverlay) {
      window.api.hideLoadingOverlay(); // 隐藏可能残留的加载遮罩
    }
    if (window.api && window.api.showToast) {
      window.api.showToast(error.message || '生成行程失败', 'error');
    }
    console.error('生成行程错误：', error);
  }
}

/**
 * 展示行程
 * @param {Array} itinerary 行程数据
 */
function displayItinerary(itinerary) {
  const container = document.getElementById('generatedItinerary');
  
  if (!itinerary || itinerary.length === 0) {
    container.innerHTML = '<p class="empty-tip">未生成行程数据</p>';
    // 隐藏保存按钮
    hideSaveTripButton();
    return;
  }

  container.innerHTML = itinerary.map((day, dayIndex) => `
    <div class="day-section" data-day-index="${dayIndex}">
      <div class="day-header">第 ${day.day} 天 ${day.date ? `(${day.date})` : ''}</div>
      <div class="day-items">
        ${day.items && day.items.length > 0 ? day.items.map((item, itemIndex) => `
          <div class="editable-item" data-day-index="${dayIndex}" data-item-index="${itemIndex}">
            <div class="trip-item-content">
              <span class="item-time trip-editable" data-type="time" data-day="${dayIndex}" data-item="${itemIndex}">${item.time || ''}</span>
              <span class="item-place trip-editable" data-type="place" data-day="${dayIndex}" data-item="${itemIndex}">${item.place || '未设置地点'}</span>
              <span class="item-description trip-editable" data-type="description" data-day="${dayIndex}" data-item="${itemIndex}">${item.description || ''}</span>
            </div>
            <button class="item-delete-btn" onclick="handleDeleteTripItem(${dayIndex}, ${itemIndex})" title="删除该行程项目">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 5.5C5.77614 5.5 6 5.72386 6 6V11C6 11.2761 5.77614 11.5 5.5 11.5C5.22386 11.5 5 11.2761 5 11V6C5 5.72386 5.22386 5.5 5.5 5.5Z" fill="currentColor"/>
                <path d="M8 6C8 5.72386 7.77614 5.5 7.5 5.5C7.22386 5.5 7 5.72386 7 6V11C7 11.2761 7.22386 11.5 7.5 11.5C7.77614 11.5 8 11.2761 8 11V6Z" fill="currentColor"/>
                <path d="M10.5 5.5C10.7761 5.5 11 5.72386 11 6V11C11 11.2761 10.7761 11.5 10.5 11.5C10.2239 11.5 10 11.2761 10 11V6C10 5.72386 10.2239 5.5 10.5 5.5Z" fill="currentColor"/>
                <path d="M4 2.5C4 2.22386 4.22386 2 4.5 2H5.5H10.5H11.5C11.7761 2 12 2.22386 12 2.5C12 2.77614 11.7761 3 11.5 3H11V12.5C11 13.3284 10.3284 14 9.5 14H6.5C5.67157 14 5 13.3284 5 12.5V3H4.5C4.22386 3 4 2.77614 4 2.5ZM6 3V12.5C6 12.7761 6.22386 13 6.5 13H9.5C9.77614 13 10 12.7761 10 12.5V3H6Z" fill="currentColor"/>
                <path d="M6.5 1.5C6.22386 1.5 6 1.72386 6 2V2.5C6 2.77614 6.22386 3 6.5 3H9.5C9.77614 3 10 2.77614 10 2.5V2C10 1.72386 9.77614 1.5 9.5 1.5H6.5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        `).join('') : '<p class="empty-tip">暂无安排</p>'}
      </div>
    </div>
  `).join('');
  
  // 初始化编辑功能
  initTripEditFeatures();
}

/**
 * 处理删除行程项目（包装函数，复用tripEdit.js中的deleteTripItem）
 * @param {number} dayIndex 天数索引
 * @param {number} itemIndex 项目索引
 */
function handleDeleteTripItem(dayIndex, itemIndex) {
  // 先调用tripEdit.js中的deleteTripItem删除DOM元素并更新索引
  if (window.deleteTripItem) {
    window.deleteTripItem(dayIndex, itemIndex);
  }
  
  // 同步更新currentItineraryData
  if (currentItineraryData && currentItineraryData[dayIndex] && currentItineraryData[dayIndex].items) {
    const items = currentItineraryData[dayIndex].items;
    if (itemIndex >= 0 && itemIndex < items.length) {
      items.splice(itemIndex, 1);
      
      // 更新localStorage
      updateLocalStorageTripData({ itinerary: currentItineraryData });
      
      window.api.showToast('行程项目已删除', 'success');
    }
  }
}

/**
 * 处理删除行程项目（包装函数，复用tripEdit.js中的deleteTripItem）
 * @param {number} dayIndex 天数索引
 * @param {number} itemIndex 项目索引
 */
function handleDeleteTripItem(dayIndex, itemIndex) {
  // 先调用tripEdit.js中的deleteTripItem删除DOM元素
  if (window.deleteTripItem) {
    window.deleteTripItem(dayIndex, itemIndex);
  }
  
  // 同步更新currentItineraryData
  if (currentItineraryData && currentItineraryData[dayIndex] && currentItineraryData[dayIndex].items) {
    const items = currentItineraryData[dayIndex].items;
    if (itemIndex >= 0 && itemIndex < items.length) {
      items.splice(itemIndex, 1);
      
      // 更新localStorage
      updateLocalStorageTripData({ itinerary: currentItineraryData });
      
      window.api.showToast('行程项目已删除', 'success');
    }
  }
}

/**
 * 初始化行程编辑功能
 */
function initTripEditFeatures() {
  // 初始化标题编辑
  initTitleEdit();
  
  // 初始化内容编辑
  initContentEdit();
  
  // 初始化单个项目删除功能
  initDeleteTripItem();
}

/**
 * 初始化标题编辑功能
 */
function initTitleEdit() {
  const titleElement = document.getElementById('tripTitle');
  if (!titleElement) return;
  
  // 尝试从localStorage恢复标题
  try {
    const savedData = localStorage.getItem('validated_trip');
    if (savedData) {
      const tripData = JSON.parse(savedData);
      if (tripData.title) {
        titleElement.textContent = tripData.title;
      }
    }
  } catch (error) {
    console.error('恢复标题失败：', error);
  }
  
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
    const titleText = this.textContent;
    this.textContent = '';
    this.appendChild(input);
    input.focus();
    input.select();
    
    // 保存函数
    const saveTitle = () => {
      const newText = input.value.trim() || '生成的行程';
      this.textContent = newText;
      updateLocalStorageTripData({ title: newText });
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
 * 初始化内容编辑功能
 */
function initContentEdit() {
  // 使用事件委托处理所有可编辑元素
  const container = document.getElementById('generatedItinerary');
  if (!container) return;
  
  container.addEventListener('click', function(e) {
    // 优先检查是否是删除按钮，如果是则直接返回（由删除功能处理）
    if (e.target.closest('.trip-item-delete-btn')) {
      return;
    }
    
    const editable = e.target.closest('.trip-editable');
    if (!editable || editable.querySelector('input, textarea')) return;
    
    const type = editable.dataset.type;
    const dayIndex = parseInt(editable.dataset.day);
    const itemIndex = parseInt(editable.dataset.item);
    
    if (isNaN(dayIndex) || isNaN(itemIndex)) return;
    
    const currentText = editable.textContent.trim();
    const isDescription = type === 'description';
    
    let inputElement;
    if (isDescription) {
      inputElement = document.createElement('textarea');
      inputElement.style.minHeight = '40px';
    } else {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
    }
    
    inputElement.value = currentText;
    
    // 复制原始样式
    const computedStyle = window.getComputedStyle(editable);
    inputElement.style.fontSize = computedStyle.fontSize;
    inputElement.style.fontWeight = computedStyle.fontWeight;
    inputElement.style.color = computedStyle.color;
    inputElement.style.width = editable.offsetWidth + 'px';
    
    // 替换内容
    editable.textContent = '';
    editable.appendChild(inputElement);
    inputElement.focus();
    inputElement.select();
    
    // 保存函数
    const saveContent = () => {
      const newValue = inputElement.value.trim();
      editable.textContent = newValue || (type === 'place' ? '未设置地点' : '');
      
      // 更新数据
      if (currentItineraryData && currentItineraryData[dayIndex] && currentItineraryData[dayIndex].items) {
        const item = currentItineraryData[dayIndex].items[itemIndex];
        if (item) {
          if (type === 'time') item.time = newValue;
          else if (type === 'place') item.place = newValue;
          else if (type === 'description') item.description = newValue;
          
          // 更新localStorage
          updateLocalStorageTripData({ itinerary: currentItineraryData });
        }
      }
    };
    
    // 失去焦点时保存
    inputElement.addEventListener('blur', saveContent);
    
    // 回车键保存（非textarea）
    if (!isDescription) {
      inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputElement.blur();
        }
      });
    }
  });
}

/**
 * 初始化单个行程项目删除功能
 * 注意：删除按钮通过onclick直接调用handleDeleteTripItem，这里不再需要事件委托
 */
function initDeleteTripItem() {
  // 此函数保留用于未来扩展，当前删除功能通过onclick="handleDeleteTripItem()"实现
}

/**
 * 验证删除结果
 */
function verifyDeleteResult(dayIndex, itemIndex) {
  try {
    // 从localStorage重新读取数据验证
    const savedData = localStorage.getItem('validated_trip');
    if (savedData) {
      const tripData = JSON.parse(savedData);
      if (tripData.itinerary && tripData.itinerary[dayIndex]) {
        const items = tripData.itinerary[dayIndex].items;
        console.log(`✅ 验证删除结果：第${dayIndex + 1}天原有${items.length + 1}个项目，删除后剩余${items.length}个`);
        
        // 验证其他天的数据完整性
        const totalItems = tripData.itinerary.reduce((sum, day) => sum + (day.items ? day.items.length : 0), 0);
        console.log(`✅ 整个行程共有${totalItems}个项目`);
      }
    }
  } catch (error) {
    console.error('验证删除结果失败：', error);
  }
}

/**
 * 更新localStorage中的行程数据
 */
function updateLocalStorageTripData(updates) {
  try {
    const savedData = localStorage.getItem('validated_trip');
    if (!savedData) return;
    
    const tripData = JSON.parse(savedData);
    
    // 合并更新
    if (updates.title !== undefined) {
      tripData.title = updates.title;
    }
    
    if (updates.itinerary !== undefined) {
      tripData.itinerary = updates.itinerary;
      tripData.itineraryHtml = document.getElementById('generatedItinerary').innerHTML;
    }
    
    // 更新保存时间
    tripData.savedAt = new Date().toISOString();
    
    // 确保有tripId（如果不存在则使用currentTripId或生成新ID）
    if (!tripData.tripId) {
      tripData.tripId = currentTripId || 'local_' + Date.now();
    }
    
    // 保存回localStorage
    localStorage.setItem('validated_trip', JSON.stringify(tripData));
    
    // 同步更新到行程列表
    saveTripToList(tripData);
  } catch (error) {
    console.error('更新localStorage失败：', error);
  }
}

/**
 * 保存行程到行程列表（保存完整数据，包含itinerary）
 */
function saveTripToList(tripData) {
  try {
    // 获取现有行程列表
    let tripList = [];
    const listData = localStorage.getItem('trip_list');
    if (listData) {
      tripList = JSON.parse(listData);
    }
    
    // 查找是否已存在（根据tripId，使用字符串比较确保类型兼容）
    const tripIdStr = String(tripData.tripId);
    const existingIndex = tripList.findIndex(t => String(t.tripId) === tripIdStr);
    
    // 统一日期格式为YYYY-MM-DD，确保与编辑页面兼容
    let normalizedItinerary = [];
    if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
      normalizedItinerary = tripData.itinerary.map((day, index) => ({
        day: day.day || index + 1,
        date: day.date || new Date().toISOString().split('T')[0], // 确保日期格式为YYYY-MM-DD
        items: (day.items || []).map(item => ({
          time: item.time || '00:00',
          place: item.place || '未命名地点',
          description: item.description || ''
        }))
      }));
    }
    
    // 获取当前用户ID（如果存在）
    const currentUser = window.userModule?.getCurrentUser();
    const userId = currentUser?.userId || currentUser?.guestId || null;
    
    // 构建完整的行程列表项（包含itinerary数据，供编辑页面使用）
    const tripListItem = {
      tripId: tripData.tripId,
      title: tripData.title || '未命名行程',
      days: tripData.days || normalizedItinerary.length || 0,
      itinerary: normalizedItinerary, // 保存完整的itinerary数据
      savedAt: tripData.savedAt || new Date().toISOString(),
      userId: userId // 保存用户ID，供权限校验使用
    };
    
    if (existingIndex >= 0) {
      // 更新现有项（合并数据，保留原有字段）
      tripList[existingIndex] = {
        ...tripList[existingIndex],
        ...tripListItem
      };
    } else {
      // 添加新项
      tripList.push(tripListItem);
    }
    
    // 保存回localStorage
    localStorage.setItem('trip_list', JSON.stringify(tripList));
    console.log('✅ 已保存完整行程数据到trip_list，包含itinerary');
  } catch (error) {
    console.error('保存行程列表失败：', error);
  }
}

// 标记是否已初始化，避免重复绑定
let isTripGenerateInitialized = false;

/**
 * 初始化行程偏好模块交互逻辑
 */
function initPreferenceModule() {
  const preferenceTags = document.querySelectorAll('.preference-tag');
  const preferenceInput = document.getElementById('preferenceInput');
  const clearBtn = document.getElementById('clearPreferenceBtn');
  const agentTip = document.getElementById('agentTip');

  if (!preferenceInput || !clearBtn || !agentTip) {
    console.warn('⚠️  行程偏好模块元素未找到，跳过初始化');
    return;
  }

  // 1. 快捷标签点击逻辑
  preferenceTags.forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      
      // 获取所有激活的标签文本
      const activeTags = Array.from(preferenceTags)
        .filter(t => t.classList.contains('active'))
        .map(t => t.dataset.text);
      
      // 获取当前输入框内容（去除已存在的标签文本）
      let currentValue = preferenceInput.value.trim();
      
      // 如果输入框为空，直接填充激活的标签
      if (!currentValue) {
        preferenceInput.value = activeTags.join('，');
      } else {
        // 如果输入框有内容，检查是否需要添加新标签
        const currentTags = currentValue.split('，').map(t => t.trim());
        activeTags.forEach(tagText => {
          if (!currentTags.includes(tagText)) {
            currentValue += '，' + tagText;
          }
        });
        preferenceInput.value = currentValue;
      }
      
      // 显示Agent反馈提示
      agentTip.style.display = 'block';
      setTimeout(() => {
        agentTip.style.display = 'none';
      }, 3000);
    });
  });

  // 2. 清空按钮逻辑
  clearBtn.addEventListener('click', () => {
    preferenceInput.value = '';
    preferenceTags.forEach(tag => tag.classList.remove('active'));
  });

  // 3. 输入框输入时，如果内容变化，自动取消相关标签的激活状态
  preferenceInput.addEventListener('input', () => {
    const inputValue = preferenceInput.value.trim();
    preferenceTags.forEach(tag => {
      const tagText = tag.dataset.text;
      if (!inputValue.includes(tagText)) {
        tag.classList.remove('active');
      }
    });
  });

  console.log('✅ 行程偏好模块交互逻辑初始化成功');
}

/**
 * 显示保存行程按钮
 */
function showSaveTripButton() {
  const saveContainer = document.querySelector('.save-trip-container');
  if (saveContainer) {
    saveContainer.style.display = 'flex';
    // 重置按钮状态
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    const saveTip = document.querySelector('.save-trip-container .save-trip-tip');
    if (saveBtn) {
      saveBtn.textContent = '保存行程';
      saveBtn.disabled = false;
    }
    if (saveTip) {
      saveTip.style.display = 'none';
    }
  }
}

/**
 * 隐藏保存行程按钮
 */
function hideSaveTripButton() {
  const saveContainer = document.querySelector('.save-trip-container');
  if (saveContainer) {
    saveContainer.style.display = 'none';
  }
}

/**
 * 处理保存行程
 */
function handleSaveTrip() {
  try {
    // 获取所有需要保存的数据
    const daysInput = document.getElementById('tripDays');
    const budgetInput = document.getElementById('tripBudget');
    const modelTypeSelect = document.getElementById('modelTypeSelect');
    const preferenceInput = document.getElementById('preferenceInput');
    const generatedItinerary = document.getElementById('generatedItinerary');
    
    if (!daysInput || !generatedItinerary || !currentItineraryData) {
      window.api.showToast('保存失败：缺少必要数据', 'error');
      return;
    }
    
    // 获取标题
    const tripTitle = document.getElementById('tripTitle');
    const title = tripTitle ? tripTitle.textContent.trim() : '未命名行程';
    
    // 使用当前tripId（新生成的行程已有唯一ID）
    let tripId = currentTripId || 'local_' + Date.now();
    
    // 计算实际天数（基于itinerary长度，确保数据准确）
    const actualDays = currentItineraryData ? currentItineraryData.length : parseInt(daysInput.value) || 0;
    
    // 统一日期格式为YYYY-MM-DD，确保与编辑页面兼容
    const normalizedItinerary = currentItineraryData ? currentItineraryData.map((day, index) => ({
      day: day.day || index + 1,
      date: day.date || new Date().toISOString().split('T')[0], // 确保日期格式为YYYY-MM-DD
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '未命名地点',
        description: item.description || ''
      }))
    })) : [];
    
    const tripData = {
      tripId: tripId, // 行程ID
      title: title, // 保存标题
      days: actualDays, // 使用实际天数
      budget: budgetInput ? budgetInput.value.trim() : '',
      modelType: modelTypeSelect ? modelTypeSelect.value : 'auto',
      preference: preferenceInput ? preferenceInput.value.trim() : '',
      itinerary: normalizedItinerary, // 保存标准化后的行程数据
      itineraryHtml: generatedItinerary.innerHTML, // 保存HTML内容
      savedAt: new Date().toISOString() // 保存时间
    };
    
    // 存储到localStorage（当前行程）
    localStorage.setItem('validated_trip', JSON.stringify(tripData));
    
    // 保存到行程列表（包含完整itinerary数据）
    saveTripToList(tripData);
    
    // 更新按钮状态
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    const saveTip = document.querySelector('.save-trip-container .save-trip-tip');
    
    if (saveBtn) {
      saveBtn.textContent = '已生效';
      saveBtn.disabled = true;
    }
    
    if (saveTip) {
      saveTip.style.display = 'inline';
    }
    
    window.api.showToast('行程已保存', 'success');
    console.log('✅ 行程已保存到localStorage');
    
    // 刷新下拉列表
    if (window.tripEditModule && window.tripEditModule.loadTripList) {
      window.tripEditModule.loadTripList();
    }
    if (window.shareModule && window.shareModule.loadTripList) {
      window.shareModule.loadTripList();
    }
  } catch (error) {
    console.error('保存行程错误：', error);
    window.api.showToast('保存失败：' + (error.message || '未知错误'), 'error');
  }
}

/**
 * 手动生成行程（使用通义千问智能解析）
 * 解析用户输入的任意格式行程内容，转换为系统标准格式并渲染
 */
async function generateManualTrip() {
  try {
    // 步骤1：获取用户输入
    const tripContent = document.getElementById('manualTripInput').value.trim();
    const tripTitle = document.getElementById('manualTripTitle').value.trim();

    if (!tripContent) {
      if (window.api && window.api.showToast) {
        window.api.showToast('请输入行程内容', 'warning');
      }
      return;
    }

    // 步骤2：调用后端API进行AI智能解析
    if (!window.api || !window.api.post) {
      throw new Error('API模块未加载，请检查脚本加载顺序');
    }

    // 显示加载提示
    if (window.api.showLoadingOverlay) {
      window.api.showLoadingOverlay();
    }

    let parsedData;
    try {
      parsedData = await window.api.post('/trip/parse-manual', {
        content: tripContent,
        title: tripTitle || undefined // 如果用户未填标题，传undefined让AI自动生成
      });
    } catch (apiError) {
      console.error('调用解析API失败：', apiError);
      if (window.api && window.api.showToast) {
        window.api.showToast(apiError.message || '行程解析失败，请简化内容后重试', 'error');
      }
      return;
    } finally {
      if (window.api.hideLoadingOverlay) {
        window.api.hideLoadingOverlay();
      }
    }

    if (!parsedData || !parsedData.itinerary || !Array.isArray(parsedData.itinerary)) {
      throw new Error('行程解析失败，返回格式不正确');
    }

    // 步骤3：构造标准行程数据（与AI生成格式一致）
    const newTripId = 'local_' + Date.now();
    currentTripId = newTripId;
    
    // 保存行程原始数据
    currentItineraryData = parsedData.itinerary;
    
    // 步骤4：显示生成结果（复用现有渲染函数）
    displayItinerary(parsedData.itinerary);
    
    // 显示生成结果区域
    const generateResult = document.getElementById('generateResult');
    if (generateResult) {
      generateResult.style.display = 'block';
      if (parsedData.itinerary && parsedData.itinerary.length > 0) {
        showSaveTripButton();
      }
    }
    
    // 设置标题（优先使用用户输入的标题，否则使用AI生成的标题）
    const finalTitle = tripTitle || parsedData.title || '未命名行程';
    const tripTitleElement = document.getElementById('tripTitle');
    if (tripTitleElement) {
      tripTitleElement.textContent = finalTitle;
    }
    
    // 步骤5：统一数据格式（确保日期格式为YYYY-MM-DD，与编辑页面兼容）
    const normalizedItinerary = parsedData.itinerary ? parsedData.itinerary.map((day, index) => ({
      day: day.day || index + 1,
      date: day.date || new Date().toISOString().split('T')[0], // 确保日期格式为YYYY-MM-DD
      items: (day.items || []).map(item => ({
        time: item.time || '00:00',
        place: item.place || '未命名地点',
        description: item.description || ''
      }))
    })) : [];
    
    // 步骤6：保存到localStorage（与AI生成行程的保存逻辑一致）
    const tripData = {
      tripId: newTripId,
      title: finalTitle,
      days: parsedData.days || normalizedItinerary.length,
      itinerary: normalizedItinerary,
      itineraryHtml: document.getElementById('generatedItinerary').innerHTML,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('validated_trip', JSON.stringify(tripData));
    saveTripToList(tripData);
    
    // 显示成功提示
    if (window.api && window.api.showToast) {
      const modelName = parsedData.modelName || 'AI';
      window.api.showToast(`手动行程生成成功（使用 ${modelName} 解析）`, 'success');
    }
    
    // 刷新行程列表
    setTimeout(() => {
      if (window.tripEditModule && window.tripEditModule.loadTripList) {
        window.tripEditModule.loadTripList();
      }
      if (window.shareModule && window.shareModule.loadTripList) {
        window.shareModule.loadTripList();
      }
    }, 500);
    
  } catch (err) {
    console.error('手动生成行程失败：', err);
    if (window.api && window.api.showToast) {
      window.api.showToast(err.message || '行程解析失败，请简化内容后重试', 'error');
    }
    if (window.api && window.api.hideLoadingOverlay) {
      window.api.hideLoadingOverlay();
    }
  }
}

/**
 * 初始化行程生成模块
 */
function initTripGenerate() {
  // 如果已初始化，跳过（避免重复绑定事件）
  if (isTripGenerateInitialized) {
    console.log('✅ 行程生成模块已初始化，跳过重复初始化');
    return;
  }

  try {
    // 检查关键模块是否存在
    if (!window.collectionModule) {
      throw new Error('collectionModule 模块未加载，请检查脚本加载顺序');
    }

    if (!window.userModule) {
      throw new Error('userModule 模块未加载，请检查脚本加载顺序');
    }

    // 检查按钮元素是否存在
    const generateBtn = document.getElementById('generateTripBtn');
    if (!generateBtn) {
      throw new Error('未找到ID为 generateTripBtn 的按钮元素，请检查HTML');
    }

    // 绑定点击事件（先移除可能存在的旧监听器，避免重复绑定）
    generateBtn.removeEventListener('click', generateTrip);
    generateBtn.addEventListener('click', generateTrip);
    
    // 初始化保存行程按钮
    const saveBtn = document.getElementById('saveGeneratedTripBtn');
    if (saveBtn) {
      saveBtn.removeEventListener('click', handleSaveTrip);
      saveBtn.addEventListener('click', handleSaveTrip);
    }
    
    // 初始化手动生成行程按钮
    const manualGenerateBtn = document.querySelector('.btn-manual-generate');
    if (manualGenerateBtn) {
      manualGenerateBtn.removeEventListener('click', generateManualTrip);
      manualGenerateBtn.addEventListener('click', generateManualTrip);
      console.log('✅ 手动生成行程按钮点击事件绑定成功');
    }
    
    // 初始化偏好模块交互逻辑
    initPreferenceModule();
    
    isTripGenerateInitialized = true;
    console.log('✅ 行程生成按钮点击事件绑定成功');
  } catch (error) {
    console.error('❌ 行程生成模块初始化失败：', error.message);
    if (window.api && window.api.showToast) {
      window.api.showToast(`初始化失败：${error.message}`, 'error');
    }
  }
}

// 导出行程生成相关函数
window.tripGenerateModule = {
  generateTrip,
  generateManualTrip,
  displayItinerary,
  initTripGenerate,
  handleSaveTrip,
  showSaveTripButton,
  hideSaveTripButton
};

// 页面加载时检查当前激活的标签是否为"生成行程"，如果是则初始化
function checkAndInitTripGenerate() {
  // 检查生成行程标签页是否激活
  const generateTab = document.getElementById('generateTab');
  const generateTabBtn = document.querySelector('.tab-btn[data-tab="generate"]');
  
  if (generateTab && generateTab.classList.contains('active')) {
    // 当前激活的是生成行程标签，执行初始化
    initTripGenerate();
  } else if (generateTabBtn && generateTabBtn.classList.contains('active')) {
    // 按钮处于激活状态，也执行初始化
    initTripGenerate();
  }
}

// 页面加载完成后检查并初始化（作为备用机制）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 延迟检查，确保 main.js 的 initTabs() 已执行
    setTimeout(checkAndInitTripGenerate, 100);
  });
} else {
  // 文档已加载完成，延迟检查确保标签页状态已恢复
  setTimeout(checkAndInitTripGenerate, 100);
}

