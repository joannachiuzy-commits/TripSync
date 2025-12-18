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
    
    // 保存行程原始数据
    currentItineraryData = data.itinerary;
    
    // 重置标题为默认值"未命名行程"
    const tripTitle = document.getElementById('tripTitle');
    if (tripTitle) {
      tripTitle.textContent = '未命名行程';
    }
    
    // 显示生成结果
    displayItinerary(data.itinerary);
    
    const generateResult = document.getElementById('generateResult');
    if (generateResult) {
      generateResult.style.display = 'block';
      // 如果有行程内容，显示保存按钮和删除按钮
      if (data.itinerary && data.itinerary.length > 0) {
        showSaveTripButton();
        const deleteBtn = document.getElementById('deleteTripBtn');
        if (deleteBtn) {
          deleteBtn.style.display = 'block';
        }
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
            <span class="item-time trip-editable" data-type="time" data-day="${dayIndex}" data-item="${itemIndex}">${item.time || ''}</span>
            <span class="item-place trip-editable" data-type="place" data-day="${dayIndex}" data-item="${itemIndex}">${item.place || '未设置地点'}</span>
            <span class="item-description trip-editable" data-type="description" data-day="${dayIndex}" data-item="${itemIndex}">${item.description || ''}</span>
            <button class="btn-delete" onclick="handleDeleteTripItem(${dayIndex}, ${itemIndex})">×</button>
          </div>
        `).join('') : '<p class="empty-tip">暂无安排</p>'}
      </div>
    </div>
  `).join('');
  
  // 初始化编辑功能
  initTripEditFeatures();
  
  // 显示删除按钮
  const deleteBtn = document.getElementById('deleteTripBtn');
  if (deleteBtn) {
    deleteBtn.style.display = 'block';
  }
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
  
  // 初始化删除功能
  initDeleteTrip();
  
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
 * 初始化删除行程功能
 */
function initDeleteTrip() {
  const deleteBtn = document.getElementById('deleteTripBtn');
  if (!deleteBtn) return;
  
  deleteBtn.addEventListener('click', function() {
    if (!confirm('确定删除该行程吗？')) {
      return;
    }
    
    // 清空行程数据
    currentItineraryData = null;
    currentTripId = null;
    
    // 清空显示
    const container = document.getElementById('generatedItinerary');
    if (container) {
      container.innerHTML = '';
    }
    
    // 隐藏结果区域
    const generateResult = document.getElementById('generateResult');
    if (generateResult) {
      generateResult.style.display = 'none';
    }
    
    // 隐藏保存按钮和删除按钮
    hideSaveTripButton();
    deleteBtn.style.display = 'none';
    
    // 清除localStorage
    localStorage.removeItem('validated_trip');
    
    window.api.showToast('行程已删除', 'success');
  });
}

/**
 * 初始化单个行程项目删除功能
 */
function initDeleteTripItem() {
  const container = document.getElementById('generatedItinerary');
  if (!container) return;
  
  // 使用事件委托处理删除按钮点击
  // 使用 capture 阶段确保优先处理
  container.addEventListener('click', function(e) {
    // 检查点击目标是否是删除按钮或其子元素
    const deleteBtn = e.target.closest('.trip-item-delete-btn');
    if (!deleteBtn) return;
    
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
    
    // 获取要删除的项目信息
    const dayIndex = parseInt(deleteBtn.dataset.day);
    const itemIndex = parseInt(deleteBtn.dataset.item);
    
    if (isNaN(dayIndex) || isNaN(itemIndex)) {
      console.error('删除失败：无效的索引', dayIndex, itemIndex);
      return;
    }
    
    // 弹出确认提示
    if (!confirm('确定删除该行程项目吗？')) {
      return;
    }
    
    // 从数据中删除项目
    if (currentItineraryData && currentItineraryData[dayIndex] && currentItineraryData[dayIndex].items) {
      const items = currentItineraryData[dayIndex].items;
      
      // 验证索引有效性
      if (itemIndex < 0 || itemIndex >= items.length) {
        console.error('删除失败：索引超出范围', itemIndex, items.length);
        return;
      }
      
      // 删除项目
      items.splice(itemIndex, 1);
      
      // 重新渲染行程（这会重新初始化编辑功能）
      displayItinerary(currentItineraryData);
      
      // 更新localStorage
      updateLocalStorageTripData({ itinerary: currentItineraryData });
      
      // 验证删除结果
      verifyDeleteResult(dayIndex, itemIndex);
      
      window.api.showToast('行程项目已删除', 'success');
    } else {
      console.error('删除失败：数据不存在', dayIndex, itemIndex);
      window.api.showToast('删除失败：数据不存在', 'error');
    }
  }, true); // 使用 capture 阶段，确保优先处理
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
 * 保存行程到行程列表
 */
function saveTripToList(tripData) {
  try {
    // 获取现有行程列表
    let tripList = [];
    const listData = localStorage.getItem('trip_list');
    if (listData) {
      tripList = JSON.parse(listData);
    }
    
    // 查找是否已存在（根据tripId）
    const existingIndex = tripList.findIndex(t => t.tripId === tripData.tripId);
    
    const tripListItem = {
      tripId: tripData.tripId,
      title: tripData.title || '未命名行程',
      days: tripData.days || 0,
      savedAt: tripData.savedAt || new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      // 更新现有项
      tripList[existingIndex] = tripListItem;
    } else {
      // 添加新项
      tripList.push(tripListItem);
    }
    
    // 保存回localStorage
    localStorage.setItem('trip_list', JSON.stringify(tripList));
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
    
    const tripData = {
      tripId: tripId, // 行程ID
      title: title, // 保存标题
      days: parseInt(daysInput.value) || 0,
      budget: budgetInput ? budgetInput.value.trim() : '',
      modelType: modelTypeSelect ? modelTypeSelect.value : 'auto',
      preference: preferenceInput ? preferenceInput.value.trim() : '',
      itinerary: currentItineraryData, // 保存原始行程数据
      itineraryHtml: generatedItinerary.innerHTML, // 保存HTML内容
      savedAt: new Date().toISOString() // 保存时间
    };
    
    // 存储到localStorage（当前行程）
    localStorage.setItem('validated_trip', JSON.stringify(tripData));
    
    // 保存到行程列表
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

