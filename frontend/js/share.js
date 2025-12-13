/**
 * 协作分享模块
 * 处理分享链接生成、验证、展示共享行程
 */

/**
 * 创建分享链接
 */
async function createShareLink() {
  const tripId = document.getElementById('shareTripSelector').value;
  const permission = document.getElementById('sharePermission').value;

  if (!tripId) {
    window.api.showToast('请选择行程', 'error');
    return;
  }

  try {
    const data = await window.api.post('/share/create', {
      tripId,
      permission
    });

    // 显示分享链接
    const shareLinkInput = document.getElementById('shareLinkInput');
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${data.shareLink}`;
    shareLinkInput.value = shareUrl;
    document.getElementById('shareResult').style.display = 'block';
    
    window.api.showToast('分享链接生成成功', 'success');
  } catch (error) {
    // 错误已在 api.js 中处理
  }
}

/**
 * 复制分享链接
 */
function copyShareLink() {
  const shareLinkInput = document.getElementById('shareLinkInput');
  shareLinkInput.select();
  document.execCommand('copy');
  window.api.showToast('链接已复制到剪贴板', 'success');
}

/**
 * 验证分享链接
 */
async function verifyShareLink() {
  const shareLink = document.getElementById('verifyShareInput').value.trim();

  if (!shareLink) {
    window.api.showToast('请输入分享链接', 'error');
    return;
  }

  // 提取链接中的 share 参数
  let shareCode = shareLink;
  try {
    const url = new URL(shareLink);
    shareCode = url.searchParams.get('share') || shareLink;
  } catch {
    // 如果不是完整 URL，直接使用输入值
  }

  try {
    const data = await window.api.post('/share/verify', {
      shareLink: shareCode
    });

    // 显示共享行程
    displaySharedTrip(data.trip, data.permission);
    document.getElementById('sharedTripContainer').style.display = 'block';
    
    window.api.showToast('链接验证成功', 'success');
  } catch (error) {
    // 错误已在 api.js 中处理
  }
}

/**
 * 展示共享行程
 * @param {Object} trip 行程数据
 * @param {string} permission 权限：edit | read
 */
function displaySharedTrip(trip, permission) {
  const container = document.getElementById('sharedTripContent');
  const isEditable = permission === 'edit';

  let html = `
    <div class="trip-info">
      <h4>${trip.title || '未命名行程'}</h4>
      <p>天数：${trip.days || ''} | 预算：${trip.budget || '不限'}</p>
      <p>权限：${isEditable ? '可编辑' : '只读'}</p>
    </div>
  `;

  if (trip.itinerary && trip.itinerary.length > 0) {
    html += trip.itinerary.map(day => `
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

  // 如果可编辑，添加编辑功能
  if (isEditable) {
    html += `
      <button class="btn btn-primary" onclick="editSharedTrip('${trip.tripId}', '${permission}')" style="margin-top: 1rem;">
        编辑行程
      </button>
    `;
  }

  container.innerHTML = html;
}

/**
 * 编辑共享行程（需要跳转到编辑页面）
 */
function editSharedTrip(tripId, permission) {
  // 切换到编辑标签
  const editTab = document.querySelector('.tab-btn[data-tab="edit"]');
  if (editTab) {
    editTab.click();
    
    // 设置行程选择器并加载
    setTimeout(() => {
      const selector = document.getElementById('tripSelector');
      if (selector) {
        selector.value = tripId;
        document.getElementById('loadTripBtn').click();
      }
    }, 100);
  }
}

/**
 * 加载行程列表（用于分享页面的选择器）
 */
async function loadTripList() {
  const user = window.userModule.getCurrentUser();
  if (!user) {
    return;
  }

  try {
    const data = await window.api.get('/trip/list', { userId: user.userId });
    const trips = data.trips || [];

    const selector = document.getElementById('shareTripSelector');
    selector.innerHTML = '<option value="">请选择行程</option>';
    
    trips.forEach(trip => {
      const option = document.createElement('option');
      option.value = trip.tripId;
      option.textContent = `${trip.title || '未命名行程'} (${trip.days || 0}天)`;
      selector.appendChild(option);
    });
  } catch (error) {
    console.error('加载行程列表失败:', error);
  }
}

/**
 * 检查 URL 中的分享参数
 */
function checkShareInUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareLink = urlParams.get('share');
  
  if (shareLink) {
    // 自动切换到分享标签并验证链接
    const shareTab = document.querySelector('.tab-btn[data-tab="share"]');
    if (shareTab) {
      shareTab.click();
      
      setTimeout(() => {
        document.getElementById('verifyShareInput').value = shareLink;
        verifyShareLink();
      }, 100);
    }
  }
}

/**
 * 初始化分享模块
 */
function initShare() {
  // 创建分享链接按钮
  document.getElementById('createShareBtn').addEventListener('click', createShareLink);

  // 复制链接按钮
  document.getElementById('copyShareBtn').addEventListener('click', copyShareLink);

  // 验证链接按钮
  document.getElementById('verifyShareBtn').addEventListener('click', verifyShareLink);

  // 加载行程列表
  loadTripList();

  // 检查 URL 中的分享参数
  checkShareInUrl();

  // 将函数挂载到全局
  window.editSharedTrip = editSharedTrip;
}

// 导出分享相关函数
window.shareModule = {
  createShareLink,
  verifyShareLink,
  loadTripList,
  initShare
};

