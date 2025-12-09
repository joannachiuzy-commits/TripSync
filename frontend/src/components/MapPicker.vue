<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
    @click.self="handleClose"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold text-gray-800">地图选点</h3>
        <button
          @click="handleClose"
          class="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <!-- 地图容器 -->
      <div class="flex-1 relative">
        <div
          id="map-picker-container"
          class="w-full h-[500px]"
        ></div>
        <!-- 选点提示 -->
        <div class="absolute top-4 left-4 bg-white px-3 py-2 rounded shadow-md text-sm">
          <p class="text-gray-700">点击地图选择地点</p>
        </div>
      </div>

      <!-- 底部信息栏 -->
      <div class="p-4 border-t bg-gray-50">
        <div class="space-y-2">
          <div>
            <label class="text-sm font-medium text-gray-700">选中位置：</label>
            <p v-if="selectedLocation" class="text-sm text-gray-600">
              {{ selectedLocation.address || `坐标: ${selectedLocation.lng}, ${selectedLocation.lat}` }}
            </p>
            <p v-else class="text-sm text-gray-400">请在地图上点击选择位置</p>
          </div>
          <div class="flex gap-2">
            <button
              @click="confirmSelection"
              :disabled="!selectedLocation"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              确认选择
            </button>
            <button
              @click="handleClose"
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
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'confirm'])

// 高德地图API Key
const AMAP_API_KEY = import.meta.env.VITE_AMAP_API_KEY || 'YOUR_AMAP_API_KEY'

// 地图相关
let mapInstance = null
let marker = null
const selectedLocation = ref(null)

// 初始化地图
const initMap = async () => {
  if (mapInstance) {
    return
  }

  // 动态加载高德地图JS API
  if (!window.AMap) {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_API_KEY}&callback=initMapPickerCallback`
    script.async = true
    window.initMapPickerCallback = () => {
      createMapInstance()
    }
    document.head.appendChild(script)
  } else {
    createMapInstance()
  }
}

const createMapInstance = () => {
  nextTick(() => {
    const container = document.getElementById('map-picker-container')
    if (!container) return

    mapInstance = new window.AMap.Map('map-picker-container', {
      zoom: 13,
      center: [116.397428, 39.90923] // 默认北京中心
    })

    // 地图点击事件
    mapInstance.on('click', async (e) => {
      const lng = e.lnglat.getLng()
      const lat = e.lnglat.getLat()

      // 更新标记位置
      if (marker) {
        marker.setPosition([lng, lat])
      } else {
        marker = new window.AMap.Marker({
          position: [lng, lat],
          map: mapInstance
        })
      }

      // 逆地理编码：将坐标转换为地址
      try {
        const response = await axios.post('http://localhost:3008/api/maps/reverse-geocode', {
          lng,
          lat
        }, {
          timeout: 5000
        })

        if (response.data && response.data.code === 200) {
          selectedLocation.value = {
            lng,
            lat,
            address: response.data.data.address || ''
          }
        } else {
          selectedLocation.value = {
            lng,
            lat,
            address: ''
          }
        }
      } catch (err) {
        console.error('逆地理编码失败', err)
        selectedLocation.value = {
          lng,
          lat,
          address: ''
        }
      }
    })
  })
}

// 确认选择
const confirmSelection = () => {
  if (selectedLocation.value) {
    emit('confirm', selectedLocation.value)
    handleClose()
  }
}

// 关闭弹窗
const handleClose = () => {
  selectedLocation.value = null
  if (marker) {
    marker.setMap(null)
    marker = null
  }
  emit('close')
}

// 监听show变化
watch(() => props.show, (newVal) => {
  if (newVal) {
    nextTick(() => {
      initMap()
    })
  } else {
    // 清理
    if (marker) {
      marker.setMap(null)
      marker = null
    }
    selectedLocation.value = null
  }
})

// 组件卸载时清理
onUnmounted(() => {
  if (mapInstance) {
    mapInstance.destroy()
    mapInstance = null
  }
  if (marker) {
    marker.setMap(null)
    marker = null
  }
})
</script>

<style scoped>
#map-picker-container {
  width: 100%;
  height: 100%;
}
</style>

