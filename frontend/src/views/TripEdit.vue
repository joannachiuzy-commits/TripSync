<template>
  <div class="trip-edit space-y-6">
    <!-- 标题和返回按钮 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <router-link
          to="/trips"
          class="text-gray-600 hover:text-primary-600"
        >
          ← 返回
        </router-link>
        <div>
          <h1 class="text-3xl font-bold text-gray-800">编辑行程</h1>
          <p class="text-gray-600 mt-1">设置行程信息，管理详细行程内容</p>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
      {{ error }}
    </div>

    <!-- 行程信息编辑 -->
    <div v-if="!loading && trip" class="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 class="text-xl font-semibold text-gray-800">行程信息</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">行程名称 *</label>
          <input
            v-model="trip.trip_name"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              v-model="trip.start_date"
              type="date"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              v-model="trip.end_date"
              type="date"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
        <textarea
          v-model="trip.notes"
          rows="3"
          class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
        ></textarea>
      </div>

      <div class="flex gap-2">
        <button
          @click="saveTripInfo"
          :disabled="saving"
          class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
        >
          {{ saving ? '保存中...' : '保存行程信息' }}
        </button>
      </div>
    </div>

    <!-- 【重构1】详细行程管理 - 移除页签，改为单一手动输入区域 -->
    <div v-if="!loading && trip" class="bg-white rounded-lg shadow p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">详细行程管理</h2>
        <button
          @click="showAddContentModal = true"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          + 添加行程内容
        </button>
      </div>

      <!-- 【重构2】显示行程内容（支持混合格式：文本+可跳转站点） -->
      <div v-if="groupedAllContent.length > 0" class="space-y-6">
        <div
          v-for="group in groupedAllContent"
          :key="group.day"
          class="border border-gray-200 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold text-gray-800 mb-3">
            Day {{ group.day }}
          </h3>

          <div class="space-y-3">
            <!-- 显示手动录入的行程内容（支持混合格式） -->
            <div
              v-for="item in group.items"
              :key="`item-${item.id}`"
              class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border-l-4 border-gray-400"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs bg-gray-500 text-white px-2 py-0.5 rounded">手动录入</span>
                  <h4 class="font-semibold text-gray-800">
                    {{ item.place_name }}
                  </h4>
                </div>
                <div class="text-sm text-gray-600 space-y-1">
                  <p v-if="item.address">📍 {{ item.address }}</p>
                  <!-- 【重构3】解析并显示混合格式的描述（文本+可跳转站点） -->
                  <div 
                    v-if="item.description" 
                    class="description-content" 
                    v-html="parseDescription(item.description)"
                    @click="handleSiteLinkClick"
                  ></div>
                  <div class="flex gap-4 mt-2">
                    <span v-if="item.duration">⏱️ {{ item.duration }}</span>
                    <span v-if="item.budget">💰 {{ item.budget }}</span>
                  </div>
                  <p v-if="item.notes" class="text-gray-500 italic mt-1">{{ item.notes }}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  @click="editItem(item)"
                  class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  编辑
                </button>
                <select
                  :value="item.day_number"
                  @change="updateItemDay(item.id, parseInt($event.target.value))"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option v-for="day in maxDay" :key="day" :value="day">
                    Day {{ day }}
                  </option>
                </select>
                <button
                  @click="removeItem(item.id)"
                  class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500">
        <p>还没有添加行程内容，点击"添加行程内容"按钮开始添加</p>
      </div>
    </div>

    <!-- 【新增功能】地图选点弹窗 -->
    <MapPicker
      :show="showMapPicker"
      @close="showMapPicker = false"
      @confirm="handleMapPickerConfirm"
    />

    <!-- 【重构4】添加/编辑行程内容弹窗 - 移除页签，改为单一手动输入区域 -->
    <div
      v-if="showAddContentModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeAddContentModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">{{ isEditing ? '编辑行程内容' : '添加行程内容' }}</h2>

        <!-- 选择天数 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">选择天数</label>
          <select
            v-model="selectedDay"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option v-for="day in maxDay" :key="day" :value="day">
              Day {{ day }}
            </option>
          </select>
        </div>

        <!-- 【重构5】手动输入主要行程区域 -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">地点名称 *</label>
            <input
              v-model="manualForm.place_name"
              type="text"
              placeholder="例如：东京塔"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">地址</label>
            <div class="flex gap-2">
              <input
                v-model="manualForm.address"
                type="text"
                placeholder="例如：东京都港区芝公园4-2-8"
                class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <button
                @click="showMapPicker = true"
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
              >
                🗺️ 地图选点
              </button>
            </div>
          </div>

          <!-- 【重构6】行程描述 - 支持混合输入（文本+可跳转站点） -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-gray-700">行程描述</label>
              <button
                @click="showSiteSelector = true"
                type="button"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📎 插入素材库站点
              </button>
            </div>
            <textarea
              ref="descriptionTextarea"
              v-model="manualForm.description"
              rows="5"
              placeholder="例如：下午休息，晚上新年倒数。可以点击'插入素材库站点'按钮插入可跳转的站点..."
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              @focus="saveCursorPosition"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">
              提示：插入的站点会以蓝色可点击链接形式显示，点击可查看详情
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">耗时</label>
              <input
                v-model="manualForm.duration"
                type="text"
                placeholder="例如：2小时"
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">预算</label>
              <input
                v-model="manualForm.budget"
                type="text"
                placeholder="例如：100元"
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              v-model="manualForm.notes"
              rows="2"
              placeholder="其他备注信息..."
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t flex gap-2">
          <button
            @click="isEditing ? updateItem() : addManualItem()"
            :disabled="!manualForm.place_name || adding"
            class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
          >
            {{ adding ? (isEditing ? '更新中...' : '添加中...') : (isEditing ? '更新' : '添加') }}
          </button>
          <button
            @click="closeAddContentModal"
            class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 【重构7】素材库站点选择弹窗 -->
    <div
      v-if="showSiteSelector"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
      @click.self="showSiteSelector = false"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-gray-800 mb-4">选择素材库站点</h3>
        
        <!-- 搜索框 -->
        <div class="mb-4">
          <input
            v-model="siteSearch"
            type="text"
            placeholder="搜索站点名称..."
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        <!-- 站点列表 -->
        <div v-if="filteredSites.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="site in filteredSites"
            :key="site.id"
            @click="insertSiteToDescription(site)"
            class="p-3 border border-gray-200 rounded-lg hover:bg-primary-50 cursor-pointer"
          >
            <h4 class="font-semibold text-gray-800">{{ site.site_name }}</h4>
            <p v-if="site.notes" class="text-sm text-gray-600 mt-1">{{ site.notes }}</p>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-500">
          <p>没有可用的站点，先去第三方攻略库添加一些站点吧</p>
          <router-link
            to="/sites"
            class="mt-2 inline-block text-primary-600 hover:underline"
          >
            去第三方攻略库 →
          </router-link>
        </div>

        <div class="mt-4 pt-4 border-t">
          <button
            @click="showSiteSelector = false"
            class="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 【重构8】站点详情弹窗 -->
    <div
      v-if="showSiteDetail"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
      @click.self="showSiteDetail = false"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-gray-800">站点详情</h3>
          <button
            @click="showSiteDetail = false"
            class="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div v-if="selectedSiteDetail" class="space-y-4">
          <div>
            <h4 class="text-lg font-semibold text-gray-800 mb-2">{{ selectedSiteDetail.site_name }}</h4>
            <p v-if="selectedSiteDetail.address" class="text-sm text-gray-600 mb-2">
              📍 {{ selectedSiteDetail.address }}
            </p>
          </div>

          <div v-if="selectedSiteDetail.content" class="text-sm text-gray-700">
            <p class="font-medium mb-1">内容：</p>
            <p class="whitespace-pre-wrap">{{ selectedSiteDetail.content }}</p>
          </div>

          <div v-if="selectedSiteDetail.images && selectedSiteDetail.images.length > 0" class="flex gap-2 flex-wrap">
            <img
              v-for="(img, idx) in selectedSiteDetail.images.slice(0, 3)"
              :key="idx"
              :src="img"
              :alt="selectedSiteDetail.site_name"
              class="w-24 h-24 object-cover rounded"
            />
          </div>

          <div v-if="selectedSiteDetail.tags && selectedSiteDetail.tags.length > 0" class="flex gap-2 flex-wrap">
            <span
              v-for="tag in selectedSiteDetail.tags"
              :key="tag"
              class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
            >
              {{ tag }}
            </span>
          </div>

          <div v-if="selectedSiteDetail.xhs_url" class="pt-4 border-t">
            <a
              :href="selectedSiteDetail.xhs_url"
              target="_blank"
              class="text-primary-600 hover:underline"
            >
              查看小红书链接 →
            </a>
          </div>
        </div>

        <div v-else class="text-center py-8 text-gray-500">
          <p>加载中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import MapPicker from '../components/MapPicker.vue'

const route = useRoute()
const router = useRouter()

// 行程数据
const trip = ref(null)
const tripItems = ref([]) // 手动录入的行程内容
const allSites = ref([])
const loading = ref(false)
const saving = ref(false)
const adding = ref(false)
const error = ref('')

// 添加内容相关
const showAddContentModal = ref(false)
const selectedDay = ref(1)
const descriptionTextarea = ref(null)
const cursorPosition = ref(0)
const manualForm = ref({
  place_name: '',
  address: '',
  description: '',
  duration: '',
  budget: '',
  notes: '',
  lat: null,
  lng: null
})

// 素材库站点选择相关
const showSiteSelector = ref(false)
const siteSearch = ref('')

// 站点详情相关
const showSiteDetail = ref(false)
const selectedSiteDetail = ref(null)

// 地图选点相关
const showMapPicker = ref(false)

// 编辑相关
const editingItem = ref(null)
const isEditing = ref(false)

// 获取行程详情
const fetchTripDetail = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await axios.get(`http://localhost:3008/api/trips/${route.params.id}`, {
      timeout: 10000
    })
    
    let tripData = null
    if (response.data && response.data.code === 200) {
      tripData = response.data.data
    } else {
      tripData = response.data
    }
    
    if (!tripData) {
      throw new Error('行程数据为空')
    }
    
    trip.value = tripData
    tripItems.value = tripData.items || []
  } catch (err) {
    console.error('获取行程详情失败', err)
    if (err.response) {
      if (err.response.status === 404) {
        error.value = '行程不存在'
        router.push('/trips')
      } else {
        error.value = `获取行程详情失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
      }
    } else if (err.request) {
      error.value = '获取行程详情失败：无法连接到后端服务（请确保后端服务在3008端口运行）'
    } else {
      error.value = `获取行程详情失败: ${err.message || '未知错误'}`
    }
  } finally {
    loading.value = false
  }
}

// 获取所有站点（第三方攻略库）
const fetchAllSites = async () => {
  try {
    const { data } = await axios.get('http://localhost:3008/api/xhs/sites', {
      timeout: 10000
    })
    allSites.value = data || []
  } catch (err) {
    console.error('获取攻略列表失败', err)
    allSites.value = []
  }
}

// 保存行程信息
const saveTripInfo = async () => {
  if (!trip.value.trip_name) {
    error.value = '行程名称不能为空'
    return
  }
  
  saving.value = true
  
  try {
    await axios.put(`http://localhost:3008/api/trips/${route.params.id}`, {
      trip_name: trip.value.trip_name,
      start_date: trip.value.start_date,
      end_date: trip.value.end_date,
      notes: trip.value.notes
    }, {
      timeout: 10000
    })
    error.value = ''
    alert('保存成功！')
  } catch (err) {
    console.error('保存行程信息失败', err)
    if (err.response) {
      error.value = `保存失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '保存失败：无法连接到后端服务'
    } else {
      error.value = `保存失败: ${err.message || '未知错误'}`
    }
  } finally {
    saving.value = false
  }
}

// 【重构9】合并所有内容并按天数分组（只显示手动录入的内容）
const groupedAllContent = computed(() => {
  const groups = {}
  
  tripItems.value.forEach(item => {
    const day = item.day_number || 1
    if (!groups[day]) {
      groups[day] = { items: [] }
    }
    groups[day].items.push(item)
  })
  
  return Object.keys(groups)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(day => ({
      day: parseInt(day),
      items: groups[day].items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }))
})

// 最大天数
const maxDay = computed(() => {
  if (!trip.value?.start_date || !trip.value?.end_date) return 7
  const start = new Date(trip.value.start_date)
  const end = new Date(trip.value.end_date)
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(days, 7)
})

// 【重构10】过滤站点列表（用于素材库选择）
const filteredSites = computed(() => {
  let filtered = allSites.value
  
  if (siteSearch.value) {
    const search = siteSearch.value.toLowerCase()
    filtered = filtered.filter(site =>
      site.site_name?.toLowerCase().includes(search) ||
      site.notes?.toLowerCase().includes(search)
    )
  }
  
  return filtered
})

// 【重构11】保存光标位置
const saveCursorPosition = () => {
  if (descriptionTextarea.value) {
    cursorPosition.value = descriptionTextarea.value.selectionStart || 0
  }
}

// 【重构12】插入站点到描述（在光标位置插入特殊标记）
const insertSiteToDescription = (site) => {
  // 【优化】在插入前再次保存光标位置，确保位置准确
  if (descriptionTextarea.value) {
    cursorPosition.value = descriptionTextarea.value.selectionStart || descriptionTextarea.value.value.length || 0
  }
  
  const siteMark = `[site:${site.id}:${site.site_name}]`
  const currentDesc = manualForm.value.description || ''
  const before = currentDesc.substring(0, cursorPosition.value)
  const after = currentDesc.substring(cursorPosition.value)
  manualForm.value.description = before + siteMark + after
  
  // 关闭站点选择弹窗
  showSiteSelector.value = false
  siteSearch.value = ''
  
  // 更新光标位置
  nextTick(() => {
    if (descriptionTextarea.value) {
      const newPosition = cursorPosition.value + siteMark.length
      descriptionTextarea.value.setSelectionRange(newPosition, newPosition)
      descriptionTextarea.value.focus()
    }
  })
}

// 【重构13】解析描述内容，将站点标记转换为可点击链接
const parseDescription = (description) => {
  if (!description) return ''
  
  // 匹配格式：[site:站点ID:站点名称]
  const sitePattern = /\[site:([^:]+):([^\]]+)\]/g
  
  return description.replace(sitePattern, (match, siteId, siteName) => {
    return `<span class="site-link text-blue-600 underline cursor-pointer hover:text-blue-800" data-site-id="${siteId}">${siteName}</span>`
  })
}

// 【重构14】处理站点链接点击事件（通过事件委托）
const handleSiteLinkClick = (event) => {
  // 查找最近的 .site-link 元素（支持嵌套情况）
  let target = event.target
  while (target && target !== event.currentTarget) {
    if (target.classList && target.classList.contains('site-link')) {
      const siteId = target.getAttribute('data-site-id')
      if (siteId) {
        event.preventDefault()
        event.stopPropagation()
        showSiteDetailById(siteId)
        return
      }
    }
    target = target.parentElement
  }
}

// 【重构15】根据站点ID显示详情
const showSiteDetailById = async (siteId) => {
  try {
    // 先从本地缓存查找
    const cachedSite = allSites.value.find(s => s.id === siteId)
    if (cachedSite) {
      selectedSiteDetail.value = cachedSite
      showSiteDetail.value = true
      return
    }
    
    // 如果本地没有，调用后端接口
    const response = await axios.get(`http://localhost:3008/api/xhs/sites/${siteId}`, {
      timeout: 10000
    })
    
    let siteData = null
    if (response.data && response.data.code === 200) {
      siteData = response.data.data
    } else if (response.data && !response.data.code) {
      // 兼容旧格式（直接返回对象）
      siteData = response.data
    } else {
      throw new Error('站点数据格式错误')
    }
    
    if (!siteData) {
      throw new Error('站点不存在')
    }
    
    selectedSiteDetail.value = siteData
    showSiteDetail.value = true
  } catch (err) {
    console.error('获取站点详情失败', err)
    if (err.response && err.response.status === 404) {
      error.value = '站点不存在'
    } else {
      error.value = '获取站点详情失败，请稍后重试'
    }
  }
}

// 添加手动录入的行程内容
const addManualItem = async () => {
  if (!manualForm.value.place_name) {
    error.value = '地点名称不能为空'
    return
  }
  
  adding.value = true
  
  try {
    await axios.post(`http://localhost:3008/api/trips/${route.params.id}/items`, {
      ...manualForm.value,
      day_number: selectedDay.value,
      sort_order: tripItems.value.length
    }, {
      timeout: 10000
    })
    closeAddContentModal()
    fetchTripDetail()
  } catch (err) {
    console.error('添加行程内容失败', err)
    if (err.response) {
      error.value = `添加行程内容失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '添加行程内容失败：无法连接到后端服务'
    } else {
      error.value = `添加行程内容失败: ${err.message || '未知错误'}`
    }
  } finally {
    adding.value = false
  }
}

// 移除手动录入的内容
const removeItem = async (itemId) => {
  if (!confirm('确定要删除这个行程内容吗？')) return
  
  try {
    await axios.delete(`http://localhost:3008/api/trips/${route.params.id}/items/${itemId}`, {
      timeout: 10000
    })
    fetchTripDetail()
  } catch (err) {
    console.error('删除行程内容失败', err)
    if (err.response) {
      error.value = `删除行程内容失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '删除行程内容失败：无法连接到后端服务'
    } else {
      error.value = `删除行程内容失败: ${err.message || '未知错误'}`
    }
  }
}

// 更新手动录入内容的天数
const updateItemDay = async (itemId, dayNumber) => {
  try {
    await axios.put(`http://localhost:3008/api/trips/${route.params.id}/items/${itemId}`, {
      day_number: dayNumber
    }, {
      timeout: 10000
    })
    fetchTripDetail()
  } catch (err) {
    console.error('更新行程内容天数失败', err)
    if (err.response) {
      error.value = `更新失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '更新失败：无法连接到后端服务'
    } else {
      error.value = `更新失败: ${err.message || '未知错误'}`
    }
  }
}

// 关闭添加内容弹窗
const closeAddContentModal = () => {
  showAddContentModal.value = false
  isEditing.value = false
  editingItem.value = null
  selectedDay.value = 1
  manualForm.value = {
    place_name: '',
    address: '',
    description: '',
    duration: '',
    budget: '',
    notes: '',
    lat: null,
    lng: null
  }
  cursorPosition.value = 0
}

// 地图选点确认
const handleMapPickerConfirm = async (location) => {
  manualForm.value.address = location.address || ''
  manualForm.value.lat = location.lat
  manualForm.value.lng = location.lng
  
  // 如果地址为空，尝试逆地理编码获取地址
  if (!location.address && location.lat && location.lng) {
    try {
      const response = await axios.post('http://localhost:3008/api/maps/reverse-geocode', {
        lng: location.lng,
        lat: location.lat
      }, {
        timeout: 5000
      })
      
      if (response.data && response.data.code === 200 && response.data.data.address) {
        manualForm.value.address = response.data.data.address
      }
    } catch (err) {
      console.warn('逆地理编码失败', err)
    }
  }
}

// 编辑行程内容
const editItem = (item) => {
  editingItem.value = { ...item }
  isEditing.value = true
  manualForm.value = {
    place_name: item.place_name || '',
    address: item.address || '',
    description: item.description || '',
    duration: item.duration || '',
    budget: item.budget || '',
    notes: item.notes || '',
    lat: item.lat || null,
    lng: item.lng || null
  }
  selectedDay.value = item.day_number || 1
  showAddContentModal.value = true
}

// 更新行程内容
const updateItem = async () => {
  if (!manualForm.value.place_name) {
    error.value = '地点名称不能为空'
    return
  }
  
  adding.value = true
  
  try {
    await axios.put(`http://localhost:3008/api/trips/${route.params.id}/items/${editingItem.value.id}`, {
      ...manualForm.value,
      day_number: selectedDay.value
    }, {
      timeout: 10000
    })
    closeAddContentModal()
    fetchTripDetail()
  } catch (err) {
    console.error('更新行程内容失败', err)
    if (err.response) {
      error.value = `更新行程内容失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '更新行程内容失败：无法连接到后端服务'
    } else {
      error.value = `更新行程内容失败: ${err.message || '未知错误'}`
    }
  } finally {
    adding.value = false
  }
}

// 组件挂载时获取数据
onMounted(() => {
  fetchTripDetail()
  fetchAllSites()
  // 注意：事件委托已通过 @click 指令绑定到 .description-content 容器上
})
</script>

<style scoped>
/* 【重构17】站点链接样式 */
.site-link {
  transition: color 0.2s;
}
</style>
