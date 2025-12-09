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
          <p class="text-gray-600 mt-1">设置行程信息，添加小红书站点</p>
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

    <!-- 站点管理 -->
    <div v-if="!loading && trip" class="bg-white rounded-lg shadow p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-800">站点管理</h2>
        <button
          @click="showAddSiteModal = true"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          + 添加站点
        </button>
      </div>

      <!-- 按天数分组显示站点 -->
      <div v-if="groupedSites.length > 0" class="space-y-6">
        <div
          v-for="group in groupedSites"
          :key="group.day"
          class="border border-gray-200 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold text-gray-800 mb-3">
            Day {{ group.day }}
          </h3>

          <div class="space-y-3">
            <div
              v-for="tripSite in group.sites"
              :key="tripSite.id"
              class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div class="flex-1">
                <h4 class="font-semibold text-gray-800 mb-1">
                  {{ tripSite.xhs_sites?.site_name || '未知站点' }}
                </h4>
                <p v-if="tripSite.xhs_sites?.notes" class="text-sm text-gray-600 mb-2">
                  {{ tripSite.xhs_sites.notes }}
                </p>
                <a
                  v-if="tripSite.xhs_sites?.xhs_url"
                  :href="tripSite.xhs_sites.xhs_url"
                  target="_blank"
                  class="text-sm text-primary-600 hover:underline"
                >
                  查看小红书链接 →
                </a>
              </div>
              <div class="flex gap-2">
                <select
                  :value="tripSite.day_number"
                  @change="updateSiteDay(tripSite.id, parseInt($event.target.value))"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option v-for="day in maxDay" :key="day" :value="day">
                    Day {{ day }}
                  </option>
                </select>
                <button
                  @click="removeSite(tripSite.id)"
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
        <p>还没有添加站点，点击"添加站点"按钮开始添加</p>
      </div>
    </div>

    <!-- 添加站点弹窗 -->
    <div
      v-if="showAddSiteModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeAddSiteModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">选择站点</h2>

        <!-- 搜索框 -->
        <div class="mb-4">
          <input
            v-model="siteSearch"
            type="text"
            placeholder="搜索站点名称..."
            class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

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

        <!-- 站点列表 -->
        <div v-if="availableSites.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="site in availableSites"
            :key="site.id"
            @click="addSiteToTrip(site.id)"
            class="p-3 border border-gray-200 rounded-lg hover:bg-primary-50 cursor-pointer"
          >
            <h4 class="font-semibold text-gray-800">{{ site.site_name }}</h4>
            <p v-if="site.notes" class="text-sm text-gray-600 mt-1">{{ site.notes }}</p>
          </div>
        </div>
        <div v-else class="text-center py-8 text-gray-500">
          <p>没有可用的站点，先去站点库添加一些站点吧</p>
          <router-link
            to="/sites"
            class="mt-2 inline-block text-primary-600 hover:underline"
          >
            去站点库 →
          </router-link>
        </div>

        <div class="mt-4 pt-4 border-t">
          <button
            @click="closeAddSiteModal"
            class="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

// 行程数据
const trip = ref(null)
const tripSites = ref([])
const allSites = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

// 添加站点相关
const showAddSiteModal = ref(false)
const siteSearch = ref('')
const selectedDay = ref(1)

// 获取行程详情
const fetchTripDetail = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const { data } = await axios.get(`http://localhost:3001/api/trips/${route.params.id}`)
    trip.value = data
    tripSites.value = data.sites || []
  } catch (err) {
    console.error('获取行程详情失败', err)
    error.value = '获取行程详情失败，请检查后端服务是否已启动'
    if (err?.response?.status === 404) {
      router.push('/trips')
    }
  } finally {
    loading.value = false
  }
}

// 获取所有站点
const fetchAllSites = async () => {
  try {
    const { data } = await axios.get('http://localhost:3001/api/xhs/sites')
    allSites.value = data || []
  } catch (err) {
    console.error('获取站点列表失败', err)
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
    await axios.put(`http://localhost:3001/api/trips/${route.params.id}`, {
      trip_name: trip.value.trip_name,
      start_date: trip.value.start_date,
      end_date: trip.value.end_date,
      notes: trip.value.notes
    })
    error.value = ''
    alert('保存成功！')
  } catch (err) {
    console.error('保存行程信息失败', err)
    error.value = err?.response?.data?.error || '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

// 按天数分组的站点
const groupedSites = computed(() => {
  const groups = {}
  tripSites.value.forEach(tripSite => {
    // 兼容数据库返回的格式（xhs_sites）和JSON文件格式（直接包含站点信息）
    const site = tripSite.xhs_sites || tripSite
    const day = tripSite.day_number || 1
    if (!groups[day]) {
      groups[day] = []
    }
    groups[day].push({
      ...tripSite,
      xhs_sites: site // 确保xhs_sites字段存在
    })
  })
  
  return Object.keys(groups)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(day => ({
      day: parseInt(day),
      sites: groups[day].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
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

// 可用的站点（过滤已添加的）
const availableSites = computed(() => {
  const addedSiteIds = new Set(tripSites.value.map(ts => ts.site_id))
  let filtered = allSites.value.filter(site => !addedSiteIds.has(site.id))
  
  if (siteSearch.value) {
    const search = siteSearch.value.toLowerCase()
    filtered = filtered.filter(site =>
      site.site_name?.toLowerCase().includes(search) ||
      site.notes?.toLowerCase().includes(search)
    )
  }
  
  return filtered
})

// 添加站点到行程
const addSiteToTrip = async (siteId) => {
  try {
    await axios.post(`http://localhost:3001/api/trips/${route.params.id}/sites`, {
      site_id: siteId,
      day_number: selectedDay.value,
      sort_order: tripSites.value.length
    })
    closeAddSiteModal()
    fetchTripDetail()
  } catch (err) {
    console.error('添加站点失败', err)
    error.value = err?.response?.data?.error || '添加站点失败，请稍后重试'
  }
}

// 移除站点
const removeSite = async (tripSiteId) => {
  if (!confirm('确定要移除这个站点吗？')) return
  
  try {
    await axios.delete(`http://localhost:3001/api/trips/${route.params.id}/sites/${tripSiteId}`)
    fetchTripDetail()
  } catch (err) {
    console.error('移除站点失败', err)
    error.value = err?.response?.data?.error || '移除站点失败，请稍后重试'
  }
}

// 更新站点天数
const updateSiteDay = async (tripSiteId, dayNumber) => {
  try {
    await axios.put(`http://localhost:3001/api/trips/${route.params.id}/sites/${tripSiteId}/order`, {
      day_number: dayNumber
    })
    fetchTripDetail()
  } catch (err) {
    console.error('更新站点天数失败', err)
    error.value = err?.response?.data?.error || '更新失败，请稍后重试'
  }
}

// 关闭添加站点弹窗
const closeAddSiteModal = () => {
  showAddSiteModal.value = false
  siteSearch.value = ''
  selectedDay.value = 1
}

// 组件挂载时获取数据
onMounted(() => {
  fetchTripDetail()
  fetchAllSites()
})
</script>

