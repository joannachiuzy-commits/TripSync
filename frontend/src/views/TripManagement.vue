<template>
  <div class="trip-management space-y-6">
    <!-- 标题和新建按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">行程管理</h1>
        <p class="text-gray-600 mt-1">管理你的旅行行程，关联小红书站点</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
      >
        + 新建行程
      </button>
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

    <!-- 行程列表 -->
    <div v-if="!loading && trips.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="trip in trips"
        :key="trip.id"
        class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
      >
        <h3 class="text-xl font-semibold text-gray-800 mb-2">{{ trip.trip_name }}</h3>
        
        <div class="text-sm text-gray-600 space-y-1 mb-4">
          <p v-if="trip.start_date || trip.end_date">
            📅 {{ trip.start_date || '未设置' }} 至 {{ trip.end_date || '未设置' }}
          </p>
          <p v-if="trip.notes" class="text-gray-500 italic">
            {{ trip.notes }}
          </p>
        </div>

        <div class="flex gap-2 pt-4 border-t">
          <router-link
            :to="`/trips/${trip.id}/edit`"
            class="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm text-center"
          >
            编辑
          </router-link>
          <button
            @click="deleteTrip(trip.id)"
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && trips.length === 0" class="text-center py-12 bg-white rounded-lg shadow-md">
      <div class="text-6xl mb-4">✈️</div>
      <p class="text-gray-600 text-lg">还没有行程，快来创建一个吧！</p>
      <button
        @click="showCreateModal = true"
        class="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
      >
        创建第一个行程
      </button>
    </div>

    <!-- 新建行程弹窗 -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeCreateModal"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">新建行程</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">行程名称 *</label>
            <input
              v-model="newTrip.trip_name"
              type="text"
              placeholder="例如：日本东京7日游"
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
              <input
                v-model="newTrip.start_date"
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
              <input
                v-model="newTrip.end_date"
                type="date"
                class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              v-model="newTrip.notes"
              rows="3"
              placeholder="行程备注..."
              class="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            ></textarea>
          </div>

          <div class="flex gap-2 pt-4">
            <button
              @click="createTrip"
              :disabled="!newTrip.trip_name || creating"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              {{ creating ? '创建中...' : '创建' }}
            </button>
            <button
              @click="closeCreateModal"
              class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()

// 行程列表
const trips = ref([])
const loading = ref(false)
const error = ref('')
const showCreateModal = ref(false)
const creating = ref(false)

// 新建行程表单
const newTrip = ref({
  trip_name: '',
  start_date: '',
  end_date: '',
  notes: ''
})

// 获取行程列表
const fetchTrips = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 【统一修复1】获取行程列表 - 添加超时和统一错误处理
    const response = await axios.get('http://localhost:3008/api/trips', {
      timeout: 10000
    })
    
    // 【统一修复2】适配后端统一返回格式：{ code: 200, data: [...], msg: "成功" }
    if (response.data && response.data.code === 200) {
      trips.value = response.data.data || []
    } else {
      // 兼容旧格式（直接返回数组）
      trips.value = Array.isArray(response.data) ? response.data : []
    }
  } catch (err) {
    console.error('获取行程列表失败', err)
    if (err.response) {
      error.value = `获取行程列表失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '获取行程列表失败：无法连接到后端服务（请确保后端服务在3008端口运行）'
    } else {
      error.value = `获取行程列表失败: ${err.message || '未知错误'}`
    }
    trips.value = []
  } finally {
    loading.value = false
  }
}

// 创建行程
const createTrip = async () => {
  if (!newTrip.value.trip_name) return
  
  creating.value = true
  
  try {
    // 【统一修复2】创建行程 - 添加超时和统一错误处理
    const { data } = await axios.post('http://localhost:3008/api/trips', newTrip.value, {
      timeout: 10000
    })
    closeCreateModal()
    fetchTrips()
    // 跳转到编辑页面
    router.push(`/trips/${data.id}/edit`)
  } catch (err) {
    console.error('创建行程失败', err)
    if (err.response) {
      error.value = `创建行程失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '创建行程失败：无法连接到后端服务'
    } else {
      error.value = `创建行程失败: ${err.message || '未知错误'}`
    }
  } finally {
    creating.value = false
  }
}

// 删除行程
const deleteTrip = async (tripId) => {
  if (!confirm('确定要删除这个行程吗？删除后关联的站点也会被移除。')) return
  
  try {
    // 【统一修复3】删除行程 - 添加超时和统一错误处理
    await axios.delete(`http://localhost:3008/api/trips/${tripId}`, {
      timeout: 10000
    })
    fetchTrips()
  } catch (err) {
    console.error('删除行程失败', err)
    if (err.response) {
      error.value = `删除行程失败: ${err.response.data?.error || err.response.statusText || '服务器错误'}`
    } else if (err.request) {
      error.value = '删除行程失败：无法连接到后端服务'
    } else {
      error.value = `删除行程失败: ${err.message || '未知错误'}`
    }
  }
}

// 关闭创建弹窗
const closeCreateModal = () => {
  showCreateModal.value = false
  newTrip.value = {
    trip_name: '',
    start_date: '',
    end_date: '',
    notes: ''
  }
}

// 组件挂载时获取行程列表
onMounted(() => {
  fetchTrips()
})
</script>

