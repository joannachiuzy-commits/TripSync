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

    <!-- 【重构】单日行程管理 - 按日期分组，折叠/展开 -->
    <div v-if="!loading && trip" class="bg-white rounded-lg shadow p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">详细行程管理</h2>
        <button
          @click="openAddDayModal"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          + 添加单日行程
        </button>
      </div>

      <!-- 【重构】按日期分组的行程列表（折叠/展开） -->
      <div v-if="groupedByDate.length > 0" class="space-y-4">
        <div
          v-for="group in groupedByDate"
          :key="group.date"
          class="border border-gray-200 rounded-lg overflow-hidden"
        >
          <!-- 日期+主题标题（可点击折叠/展开） -->
          <div
            @click="toggleDateGroup(group.date)"
            class="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <span class="text-lg font-semibold text-gray-800">
                {{ formatDate(group.date) }}
              </span>
              <span v-if="group.theme" class="text-sm text-gray-600">
                - {{ group.theme }}
              </span>
            </div>
            <span class="text-gray-500">
              {{ expandedDates.has(group.date) ? '▼' : '▶' }}
            </span>
          </div>

          <!-- 展开后显示所有平级站点 -->
          <div v-if="expandedDates.has(group.date)" class="p-4 space-y-3">
            <div
              v-for="(item, index) in group.items"
              :key="item.id"
              class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border-l-4 border-blue-400"
            >
              <!-- 序号 -->
              <div class="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                {{ index + 1 }}
              </div>

              <!-- 站点信息 -->
              <div class="flex-1">
                <h4 class="font-semibold text-gray-800 mb-1">
                  {{ item.place_name }}
                </h4>
                <div class="text-sm text-gray-600 space-y-1">
                  <p v-if="item.address">📍 {{ item.address }}</p>
                  <p v-if="item.description">{{ item.description }}</p>
                  <div class="flex gap-4 mt-2">
                    <span v-if="item.duration">⏱️ {{ item.duration }}</span>
                    <span v-if="item.budget">💰 {{ item.budget }}</span>
                  </div>
                  <p v-if="item.notes" class="text-gray-500 italic mt-1">{{ item.notes }}</p>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <button
                  @click="editDayItem(group.date, item)"
                  class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  编辑
                </button>
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
        <p>还没有添加行程内容，点击"添加单日行程"按钮开始添加</p>
      </div>
    </div>

    <!-- 【重构】添加/编辑单日行程弹窗 -->
    <div
      v-if="showDayModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeDayModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">
          {{ editingDate ? '编辑单日行程' : '添加单日行程' }}
        </h2>

        <!-- 基础区：日期选择 + 行程主题 -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
            <input
              v-model="dayForm.date"
              type="date"
              :disabled="!!editingDate"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">行程主题（选填）</label>
            <input
              v-model="dayForm.theme"
              type="text"
              placeholder="例如：市区游览"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>

        <!-- 站点区：多个平级站点行 -->
        <div class="space-y-4 mb-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-800">行程站点</h3>
            <button
              @click="addSiteRow"
              class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              + 添加站点
            </button>
          </div>

          <div
            v-for="(site, index) in dayForm.items"
            :key="site._id"
            class="border border-gray-200 rounded-lg p-4 space-y-3"
          >
            <!-- 序号 -->
            <div class="flex items-center gap-2 mb-2">
              <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {{ index + 1 }}
              </span>
              <span class="text-sm text-gray-600">行程站点 {{ index + 1 }}</span>
              <button
                v-if="dayForm.items.length > 1"
                @click="removeSiteRow(index)"
                class="ml-auto px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
              >
                删除
              </button>
            </div>

            <!-- 【重构】地点名称输入 + 功能按钮 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">地点名称 *</label>
              <div class="flex gap-2">
                <!-- 【修复】添加动态 ref 绑定，确保每个输入框的实时值可通过索引获取 -->
                <input
                  v-model="site.place_name"
                  :ref="(el) => placeInputs[index] = el"
                  type="text"
                  placeholder="例如：乐天水族馆"
                  class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                <button
                  @click="openMapSearch(index)"
                  type="button"
                  :disabled="!site.place_name"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                >
                  🗺️ 地图查地址
                </button>
                <button
                  @click="searchDianpingInfo(index)"
                  type="button"
                  :disabled="!site.place_name || loadingDianping === index"
                  class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                >
                  {{ loadingDianping === index ? '查询中...' : '📱 大众查信息' }}
                </button>
              </div>
            </div>

            <!-- 地址输入框 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">地址</label>
              <input
                v-model="site.address"
                type="text"
                placeholder="例如：东京都港区芝公园4-2-8（可点击'地图查地址'自动填充）"
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <!-- 耗时/预算/描述 -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">耗时</label>
                <input
                  v-model="site.duration"
                  type="text"
                  placeholder="例如：2小时"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">预算</label>
                <input
                  v-model="site.budget"
                  type="text"
                  placeholder="例如：100元"
                  class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea
                v-model="site.description"
                rows="2"
                placeholder="行程描述..."
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="mt-4 pt-4 border-t flex gap-2">
          <button
            @click="saveDayItems"
            :disabled="!dayForm.date || dayForm.items.length === 0 || adding"
            class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
          >
            {{ adding ? '保存中...' : '保存行程' }}
          </button>
          <button
            @click="closeDayModal"
            class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 【重构】地图查地址弹窗（支持自动搜索） -->
    <MapPicker
      v-if="showMapPicker"
      :show="showMapPicker"
      :search-keyword="mapSearchKeyword"
      @close="showMapPicker = false"
      @confirm="handleMapPickerConfirm"
      @select-address="handleAddressSelect"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// 【优化】使用统一的请求工具和配置
import { get, post, put, del } from '../utils/request.js'
import { API_TIMEOUT } from '../config/index.js'
import { validateDayForm, validateTripInfo } from '../utils/validators.js'
import MapPicker from '../components/MapPicker.vue'

const route = useRoute()
const router = useRouter()

// 行程数据
const trip = ref(null)
const tripItems = ref([])
const loading = ref(false)
const saving = ref(false)
const adding = ref(false)
const error = ref('')

// 单日行程弹窗相关
const showDayModal = ref(false)
const editingDate = ref(null) // 正在编辑的日期
const dayForm = ref({
  date: '',
  theme: '',
  items: []
})

// 地图选点相关
const showMapPicker = ref(false)
const currentMapPickerIndex = ref(-1) // 当前正在选点的站点索引
const mapSearchKeyword = ref('') // 【新增】地图搜索关键词

// 【修复】用于存储每个地点输入框的实时 DOM 引用，确保获取输入框的实时值（而非响应式缓存值）
const placeInputs = ref([])

// 大众点评查询相关
const loadingDianping = ref(-1) // 【新增】正在查询的站点索引（-1表示无查询）

// 折叠/展开状态
const expandedDates = ref(new Set())

// 获取行程详情
const fetchTripDetail = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 【优化】使用统一的请求工具
    const response = await get(`/api/trips/${route.params.id}`, {}, { timeout: API_TIMEOUT.default })
    
    // 统一返回格式：{ code: 200, data: {...}, msg: "成功" }
    let tripData = null
    if (response.code === 200) {
      tripData = response.data
    } else {
      tripData = response
    }
    
    if (!tripData) {
      throw new Error('行程数据为空')
    }
    
    trip.value = tripData
    tripItems.value = tripData.items || []
    
    // 默认展开所有日期
    const dates = new Set(tripItems.value.map(item => item.date || item.day_number))
    expandedDates.value = dates
    
  } catch (err) {
    console.error('获取行程详情失败', err)
    // 【优化】统一错误处理（request.js已处理，这里只需要设置错误消息）
    if (err.status === 404) {
      error.value = '行程不存在'
      router.push('/trips')
    } else {
      error.value = `获取行程详情失败: ${err.message || '未知错误'}`
    }
  } finally {
    loading.value = false
  }
}

// 【优化】保存行程信息（使用统一的请求工具和验证函数）
const saveTripInfo = async () => {
  // 【优化】使用统一的验证函数
  const validation = validateTripInfo(trip.value)
  if (!validation.valid) {
    error.value = validation.error
    return
  }
  
  saving.value = true
  
  try {
    // 【优化】使用统一的请求工具
    await put(`/api/trips/${route.params.id}`, {
      trip_name: trip.value.trip_name,
      start_date: trip.value.start_date,
      end_date: trip.value.end_date,
      notes: trip.value.notes
    }, {
      timeout: API_TIMEOUT.default
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

// 【重构】按日期分组
const groupedByDate = computed(() => {
  const groups = {}
  
  tripItems.value.forEach(item => {
    const date = item.date || (item.day_number ? `day_${item.day_number}` : new Date().toISOString().split('T')[0])
    if (!groups[date]) {
      groups[date] = {
        date,
        theme: item.theme || '',
        items: []
      }
    }
    groups[date].items.push(item)
  })
  
  return Object.keys(groups)
    .sort((a, b) => {
      // 如果是day_X格式，按数字排序；否则按日期排序
      if (a.startsWith('day_') && b.startsWith('day_')) {
        return parseInt(a.replace('day_', '')) - parseInt(b.replace('day_', ''))
      }
      return a.localeCompare(b)
    })
    .map(date => ({
      date,
      theme: groups[date].theme,
      items: groups[date].items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    }))
})

// 格式化日期显示
const formatDate = (dateStr) => {
  if (dateStr.startsWith('day_')) {
    return `Day ${dateStr.replace('day_', '')}`
  }
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

// 切换日期组折叠/展开
const toggleDateGroup = (date) => {
  if (expandedDates.value.has(date)) {
    expandedDates.value.delete(date)
  } else {
    expandedDates.value.add(date)
  }
}

// 打开添加单日行程弹窗
const openAddDayModal = () => {
  editingDate.value = null
  dayForm.value = {
    date: trip.value?.start_date || new Date().toISOString().split('T')[0],
    theme: '',
    items: [createEmptySite()]
  }
  showDayModal.value = true
}

// 编辑单日行程
const editDayItem = (date, item) => {
  // 加载该日期的所有站点
  const dayItems = tripItems.value.filter(i => (i.date || (i.day_number ? `day_${i.day_number}` : '')) === date)
  editingDate.value = date
  
  dayForm.value = {
    date,
    theme: dayItems[0]?.theme || '',
    items: dayItems.map(item => ({
      _id: `temp_${Date.now()}_${Math.random()}`,
      place_name: item.place_name || '',
      address: item.address || '',
      description: item.description || '',
      duration: item.duration || '',
      budget: item.budget || '',
      notes: item.notes || '',
      lat: item.lat || null,
      lng: item.lng || null
    }))
  }
  showDayModal.value = true
}

// 创建空站点
const createEmptySite = () => ({
  _id: `temp_${Date.now()}_${Math.random()}`,
  place_name: '',
  address: '',
  description: '',
  duration: '',
  budget: '',
  notes: '',
  lat: null,
  lng: null
})

// 添加站点行
const addSiteRow = () => {
  dayForm.value.items.push(createEmptySite())
}

// 删除站点行
const removeSiteRow = (index) => {
  dayForm.value.items.splice(index, 1)
}

// 【修复】打开地图查地址（自动搜索地点）- 确保地点名称正确传递
const openMapSearch = async (index) => {
  // 【修复】清空旧关键词残留，避免重复搜索旧关键词
  mapSearchKeyword.value = ''
  
  // 【修复】通过输入框的 ref 获取实时值（而非依赖响应式缓存值），确保获取到用户最新输入的内容
  const inputElement = placeInputs.value[index]
  const rawValue = inputElement?.value || dayForm.value.items[index]?.place_name || ''
  
  // 【修复】强化关键词读取与验证：修剪空格并校验
  const trimmedKeyword = rawValue.trim()
  
  // 【修复】打印"关键词读取与传递"全链路日志
  console.log('📤 读取输入框实时值:', rawValue, '修剪后关键词:', trimmedKeyword)
  
  // 【修复】新增关键词有效性校验：若修剪后为空，弹窗提示并终止流程
  if (!trimmedKeyword) {
    error.value = '请输入有效地点名称（不可为空格）'
    console.warn('⚠️ [openMapSearch] 关键词为空，终止流程')
    return
  }
  
  // 【修复】新增关键词长度校验：至少2个字符
  if (trimmedKeyword.length < 2) {
    error.value = '请输入至少 2 个字符的地点名称'
    console.warn('⚠️ [openMapSearch] 关键词过短:', trimmedKeyword.length, '个字符，终止流程')
    return
  }
  
  console.log('📍 [openMapSearch] 打开地图查地址，地点名称:', trimmedKeyword, '索引:', index)
  
  // 【修复】先设置搜索关键词，确保在打开弹窗前已更新
  currentMapPickerIndex.value = index
  
  // 【修复】确保 mapSearchKeyword 响应式更新完成后再打开弹窗：使用双重 nextTick
  await nextTick()
  mapSearchKeyword.value = trimmedKeyword
  // 【修复】打印传递给MapPicker的关键词
  console.log('📤 传递给MapPicker的关键词:', mapSearchKeyword.value)
  
  await nextTick() // 确保MapPicker已接收最新props
  
  // 【修复】打开弹窗
  showMapPicker.value = true
  
  // 【修复】打开弹窗后，新增 100ms 兜底延迟（仅用于日志验证）
  setTimeout(() => {
    console.log('📤 弹窗打开后，MapPicker接收的关键词:', mapSearchKeyword.value)
  }, 100)
}

// 【新增】查询大众点评信息
const searchDianpingInfo = async (index) => {
  // 【修复】通过输入框的 ref 获取实时值（与 openMapSearch 保持一致）
  const inputElement = placeInputs.value[index]
  const rawValue = inputElement?.value || dayForm.value.items[index]?.place_name || ''
  
  // 【修复】强化关键词读取与验证：修剪空格并校验（与 openMapSearch 保持一致）
  const trimmedKeyword = rawValue.trim()
  
  // 【修复】新增关键词有效性校验：若修剪后为空，弹窗提示并终止流程
  if (!trimmedKeyword) {
    error.value = '请输入有效地点名称（不可为空格）'
    return
  }
  
  // 【修复】新增关键词长度校验：至少2个字符
  if (trimmedKeyword.length < 2) {
    error.value = '请输入至少 2 个字符的地点名称'
    return
  }
  
  const keyword = trimmedKeyword
  
  loadingDianping.value = index
  
  try {
    // 【优化】使用统一的请求工具
    const response = await post('/api/dianping/search', {
      keyword
    }, {
      timeout: API_TIMEOUT.dianping || API_TIMEOUT.default
    })
    
    // 【优化】统一返回格式：{ code: 200, data: {...}, msg: "成功" }
    if (response.code === 200 && response.data) {
      const info = response.data
      // 自动填充耗时和预算
      if (info.duration) {
        dayForm.value.items[index].duration = info.duration
      }
      if (info.budget) {
        dayForm.value.items[index].budget = info.budget
      }
      // 如果有地址信息，也可以填充
      if (info.address && !dayForm.value.items[index].address) {
        dayForm.value.items[index].address = info.address
      }
    } else {
      error.value = '未找到该地点的信息，请手动填写'
    }
  } catch (err) {
    console.error('查询大众点评信息失败', err)
    error.value = '查询失败，请手动填写信息'
  } finally {
    loadingDianping.value = -1
  }
}

// 【重构】地图选点确认（自动填充地址）
const handleMapPickerConfirm = (location) => {
  if (currentMapPickerIndex.value >= 0) {
    dayForm.value.items[currentMapPickerIndex.value].address = location.address || ''
    dayForm.value.items[currentMapPickerIndex.value].lat = location.lat
    dayForm.value.items[currentMapPickerIndex.value].lng = location.lng
  }
  showMapPicker.value = false
  currentMapPickerIndex.value = -1
  mapSearchKeyword.value = ''
}

// 【新增】处理地图选点后的地址选择事件
// 当用户在地图上点击选点并确认填充时，将地址自动填入行程表单的"地址"输入框
const handleAddressSelect = (addressData) => {
  console.log('📥 [handleAddressSelect] 接收到选点地址:', addressData)
  
  // 确保有有效的站点索引
  if (currentMapPickerIndex.value >= 0 && currentMapPickerIndex.value < dayForm.value.items.length) {
    // 将解析后的formattedAddress赋值给行程表单的"地址"输入框（v-model变量）
    dayForm.value.items[currentMapPickerIndex.value].address = addressData.formattedAddress || addressData.address || ''
    
    // 同时保存经纬度信息（可选，用于后续定位）
    if (addressData.lng !== undefined) {
      dayForm.value.items[currentMapPickerIndex.value].lng = addressData.lng
    }
    if (addressData.lat !== undefined) {
      dayForm.value.items[currentMapPickerIndex.value].lat = addressData.lat
    }
    
    console.log('✅ [handleAddressSelect] 地址已填充到表单:', addressData.formattedAddress || addressData.address)
    console.log('📍 [handleAddressSelect] 坐标已保存:', addressData.lng, addressData.lat)
  } else {
    console.warn('⚠️ [handleAddressSelect] 无效的站点索引，无法填充地址')
  }
  
  // 注意：不关闭地图弹窗，保留标记点方便用户核对，用户可继续选点或手动关闭
}

// 【优化】保存单日行程（使用统一的验证函数和请求工具）
const saveDayItems = async () => {
  // 【优化】使用统一的验证函数
  const validation = validateDayForm(dayForm.value)
  if (!validation.valid) {
    error.value = validation.error
    return
  }
  
  adding.value = true
  error.value = ''
  
  try {
    const items = dayForm.value.items.map((item, index) => ({
      place_name: item.place_name,
      address: item.address || null,
      description: item.description || null,
      duration: item.duration || null,
      budget: item.budget || null,
      notes: item.notes || null,
      lat: item.lat || null,
      lng: item.lng || null
    }))
    
    // 【优化】使用统一的请求工具
    await post(`/api/trips/${route.params.id}/day-items`, {
      date: dayForm.value.date,
      theme: dayForm.value.theme || null,
      items
    }, {
      timeout: API_TIMEOUT.default
    })
    
    closeDayModal()
    fetchTripDetail()
    alert('保存成功！')
  } catch (err) {
    console.error('保存单日行程失败', err)
    if (err.response) {
      error.value = `保存失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '保存失败：无法连接到后端服务'
    } else {
      error.value = `保存失败: ${err.message || '未知错误'}`
    }
  } finally {
    adding.value = false
  }
}

// 【优化】删除行程内容（使用统一的请求工具）
const removeItem = async (itemId) => {
  if (!confirm('确定要删除这个行程内容吗？')) return
  
  try {
    // 【优化】使用统一的请求工具
    await del(`/api/trips/${route.params.id}/items/${itemId}`, {
      timeout: API_TIMEOUT.default
    })
    fetchTripDetail()
  } catch (err) {
    console.error('删除行程内容失败', err)
    // 【优化】统一错误处理（request.js已处理，这里只需要设置错误消息）
    error.value = `删除失败: ${err.message || '未知错误'}`
  }
}

// 关闭单日行程弹窗
const closeDayModal = () => {
  showDayModal.value = false
  editingDate.value = null
  dayForm.value = {
    date: '',
    theme: '',
    items: []
  }
  currentMapPickerIndex.value = -1
  mapSearchKeyword.value = '' // 【新增】清理搜索关键词
  loadingDianping.value = -1 // 【新增】清理查询状态
}

// 组件挂载时获取数据
onMounted(() => {
  fetchTripDetail()
})
</script>

<style scoped>
/* 样式 */
</style>

