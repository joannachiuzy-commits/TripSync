/**
 * 行程生成模块
 * 处理 AI 生成行程、展示生成结果
 */

let currentTripId = null;

/**
 * 生成行程
 * 【游客权限逻辑】游客模式下需要登录才能生成行程
 */
async function generateTrip() {
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

  const days = parseInt(document.getElementById('tripDays').value);
  const budget = document.getElementById('tripBudget').value.trim();

  if (!days || days < 1) {
    window.api.showToast('请输入有效的行程天数', 'error');
    return;
  }

  const user = window.userModule.getCurrentUser();
  if (!user) {
    window.api.showToast('请先登录', 'error');
    return;
  }

  try {
    const data = await window.api.post('/trip/generate', {
      userId: user.userId,
      collectionIds: selectedCollections.map(c => c.collectionId),
      days,
      budget
    });

    currentTripId = data.tripId;
    
    // 显示生成结果
    displayItinerary(data.itinerary);
    
    document.getElementById('generateResult').style.display = 'block';
    window.api.showToast('行程生成成功', 'success');

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
    // 错误已在 api.js 中处理
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
    return;
  }

  container.innerHTML = itinerary.map(day => `
    <div class="day-section">
      <div class="day-header">第 ${day.day} 天 ${day.date ? `(${day.date})` : ''}</div>
      ${day.items && day.items.length > 0 ? day.items.map(item => `
        <div class="trip-item">
          <div class="trip-time">${item.time}</div>
          <div class="trip-content">
            <div class="trip-place">${item.place || '未设置地点'}</div>
            <div class="trip-description">${item.description || ''}</div>
          </div>
        </div>
      `).join('') : '<p class="empty-tip">暂无安排</p>'}
    </div>
  `).join('');
}

/**
 * 初始化行程生成模块
 */
function initTripGenerate() {
  // 生成按钮
  document.getElementById('generateTripBtn').addEventListener('click', generateTrip);
}

// 导出行程生成相关函数
window.tripGenerateModule = {
  generateTrip,
  displayItinerary,
  initTripGenerate
};

