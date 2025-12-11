<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
    @click.self="handleClose"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h3 class="text-lg font-semibold text-gray-800">地图选点</h3>
        <button
          @click="handleClose"
          class="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>
      </div>

      <!-- 【新增】地图选择栏 -->
      <div class="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-700">地图类型：</span>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="amap"
              v-model="mapType"
              @change="switchMap"
              class="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">高德地图</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="google"
              v-model="mapType"
              @change="switchMap"
              class="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">Google地图</span>
          </label>
        </div>
      </div>

      <!-- 【修复】地图容器 - 强制设置固定宽高，添加加载占位（确保容器有明确尺寸） -->
      <div class="relative flex-shrink-0" style="height: 80%; min-height: 400px;">
        <div
          id="map-picker-container"
          class="w-full h-full"
          style="width: 100%; height: 100%; min-width: 800px; min-height: 600px; overflow: hidden; position: relative; border: 1px solid #e5e7eb;"
        >
          <!-- 【新增】加载占位 -->
          <div v-if="!mapLoaded && mapType === 'amap'" class="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p class="text-sm text-gray-600">高德地图加载中...</p>
            </div>
          </div>
          <div v-if="mapLoadError && mapType === 'amap'" class="absolute inset-0 flex items-center justify-center bg-gray-50 z-20">
            <div class="text-center p-4">
              <p class="text-sm text-red-600 mb-2">高德地图加载失败</p>
              <p class="text-xs text-gray-500 mb-3">{{ mapLoadError }}</p>
              <button
                @click="retryLoadMap"
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
        <!-- 选点提示 -->
        <div class="absolute top-4 left-4 bg-white px-3 py-2 rounded shadow-md text-sm z-10">
          <p class="text-gray-700">点击地图选择地点</p>
        </div>
      </div>

      <!-- 底部信息栏 -->
      <div class="p-4 border-t bg-gray-50 flex-shrink-0">
        <div class="space-y-2">
          <div>
            <label class="text-sm font-medium text-gray-700">选中位置：</label>
            <p v-if="selectedLocation && selectedLocation.address" class="text-sm text-gray-800 font-medium mt-1">
              {{ selectedLocation.address }}
            </p>
            <p v-else-if="selectedLocation" class="text-sm text-gray-600 mt-1">
              坐标: {{ selectedLocation.lng.toFixed(6) }}, {{ selectedLocation.lat.toFixed(6) }}
            </p>
            <p v-else class="text-sm text-gray-400 mt-1">请在地图上点击选择位置</p>
          </div>
          <div class="flex gap-2">
            <button
              @click="confirmSelection"
              :disabled="!selectedLocation"
              class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
// 【优化】使用统一的请求工具和配置
import { get } from '../utils/request.js'
import { API_BASE_URL, API_TIMEOUT } from '../config/index.js'
import { checkMapContainer, fetchAmapApiKey, loadAmapApiScript, clearMapInstance } from '../utils/mapHelpers.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  searchKeyword: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'confirm'])

// 【优化】从后端动态获取地图Keys（使用统一的请求工具）
const fetchMapKeys = async () => {
  console.log('🔑 地图弹窗打开，开始请求Key...')
  
  try {
    const response = await get('/api/map/key', {}, { timeout: API_TIMEOUT.map })
    
    // 统一返回格式：{ code: 200, data: { amap: "...", google: "..." }, msg: "成功" }
    const keyData = response.data || response
    
    console.log('✅ 地图Key请求成功:', keyData)
    
    // 确认打印出Key（不打印完整Key，只打印是否有效）
    if (keyData.amap) {
      console.log('✅ 高德地图Key已获取（长度:', keyData.amap.length, '）')
    } else {
      console.warn('⚠️ 高德地图Key为空，请检查后端配置')
    }
    
    return keyData
  } catch (err) {
    console.error('❌ 地图Key请求失败:', err.message, err)
    return {
      amap: null,
      google: null
    }
  }
}

// 【新增】地图类型（默认高德地图）
const mapType = ref('amap')

// 地图相关
let mapInstance = null
let marker = null
let googleMapInstance = null
let googleMarker = null
const selectedLocation = ref(null)

// 【新增】地图加载状态
const mapLoaded = ref(false)
const mapLoadError = ref('')

// 【优化】安全销毁高德地图实例（使用工具函数）
const safeDestroyMap = () => {
  clearMapInstance({
    mapInstance,
    marker,
    googleMapInstance,
    googleMarker
  })
  // 重置本地变量引用
  mapInstance = null
  marker = null
  googleMapInstance = null
  googleMarker = null
}

// 【新增】初始化地图 - 根据mapType选择地图类型
const initMap = async () => {
  if (mapType.value === 'amap') {
    await initAmapMap()
  } else if (mapType.value === 'google') {
    await initGoogleMap()
  }
}

// 【优化】已迁移到 utils/mapHelpers.js，使用工具函数
// checkContainer, getMapKey, loadAmapApi 等函数已移至 utils/mapHelpers.js

// 【重构】初始化高德地图 - 全链路修复（容器检查→Key校验→API加载→实例创建）
// 【修复】确保即使容器校验失败，只要Key获取成功，就继续加载API
const initAmapMap = async () => {
  console.log('🚀 [initAmapMap] ========== 开始初始化高德地图 ==========')
  // 重置加载状态
  mapLoaded.value = false
  mapLoadError.value = ''

  let amapKey = null
  let containerCheckPassed = false

  try {
    // 【优化】步骤1：检查地图容器（使用工具函数）
    console.log('📍 [initAmapMap] 步骤1：检查地图容器...')
    try {
      const container = await checkMapContainer()
      containerCheckPassed = container !== null
      if (containerCheckPassed) {
        console.log('✅ [initAmapMap] 容器检查通过')
      } else {
        console.warn('⚠️ [initAmapMap] 容器检查失败，但继续执行（容器可能在后续步骤中修复）')
      }
    } catch (err) {
      console.warn('⚠️ [initAmapMap] 容器检查异常，但继续执行:', err.message)
    }

    // 【优化】步骤2：获取并校验高德地图Key（使用工具函数）
    console.log('📍 [initAmapMap] 步骤2：获取并校验高德地图Key...')
    try {
      amapKey = await fetchAmapApiKey(fetchMapKeys)
      console.log('✅ [initAmapMap] Key获取成功，继续执行API加载')
    } catch (err) {
      console.error('❌ [initAmapMap] Key获取失败，无法继续:', err.message)
      throw err // Key获取失败，必须中断
    }

    // 【优化】步骤3：加载高德地图API（使用工具函数）
    console.log('📍 [initAmapMap] 步骤3：加载高德地图API（强制执行）...')
    try {
      await loadAmapApiScript(amapKey)
      console.log('✅ [initAmapMap] API加载完成')
    } catch (err) {
      console.error('❌ [initAmapMap] API加载失败:', err.message)
      // API加载失败不阻断流程，继续尝试创建实例（可能API已存在）
      console.warn('⚠️ [initAmapMap] API加载失败，但继续尝试创建实例（可能API已存在）')
    }

    // 步骤4：验证API是否完全加载
    console.log('📍 [initAmapMap] 步骤4：验证API是否完全加载...')
    if (!window.AMap || !window.AMap.Map) {
      throw new Error('API加载后AMap对象不存在：高德地图API未完全加载，请刷新页面重试')
    }
    console.log('✅ [initAmapMap] API验证通过')

    // 步骤5：创建地图实例
    console.log('📍 [initAmapMap] 步骤5：创建高德地图实例...')
    await createAmapInstanceWithKey(amapKey)
    console.log('✅ [initAmapMap] ========== 高德地图初始化完成 ==========')

  } catch (err) {
    // 【修复】整合所有错误处理 - 显示用户友好的错误提示
    let userMsg = ''
    const errorMessage = err.message || err.toString()

    if (errorMessage.includes('容器异常') || errorMessage.includes('DOM未找到') || errorMessage.includes('尺寸为0')) {
      userMsg = '地图容器异常：请检查页面是否有id为map-picker-container的元素，且设置了宽高（如width:800px;height:600px）'
    } else if (errorMessage.includes('Key无效') || errorMessage.includes('Key未配置') || errorMessage.includes('Key长度异常')) {
      userMsg = '地图Key配置错误：请在后端.env中配置正确的高德Web端Key，并确保白名单包含localhost'
    } else if (errorMessage.includes('API加载') || errorMessage.includes('API加载超时') || errorMessage.includes('AMap对象不存在')) {
      userMsg = '地图API加载失败：请检查：1.Key是否为Web端 2.Key白名单是否包含localhost 3.网络是否正常'
    } else {
      userMsg = `地图加载失败：${errorMessage}`
    }

    const errorMsg = `高德地图初始化失败: ${errorMessage}`
    console.error('❌ [initAmapMap]', errorMsg, err)
    mapLoadError.value = userMsg // 显示用户友好的错误提示

    // 【优化】即使出错，如果Key已获取，也尝试强制加载API（兜底，使用工具函数）
    if (amapKey && (!window.AMap || !window.AMap.Map)) {
      console.log('🔄 [initAmapMap] 尝试兜底：强制加载API...')
      try {
        await loadAmapApiScript(amapKey)
        console.log('✅ [initAmapMap] 兜底API加载成功')
      } catch (fallbackErr) {
        console.error('❌ [initAmapMap] 兜底API加载也失败:', fallbackErr.message)
      }
    }

    // 可选：在开发环境下也显示alert（生产环境可移除）
    if (import.meta.env.DEV) {
      console.warn('💡 [initAmapMap] 开发环境提示:', userMsg)
    }
  }
}

// 【重构】创建高德地图实例（接收Key参数，确保使用正确的Key）
const createAmapInstanceWithKey = async (apiKey) => {
  // 如果Google地图实例存在，先清理
  if (googleMapInstance) {
    googleMapInstance = null
  }
  if (googleMarker) {
    googleMarker.setMap(null)
    googleMarker = null
  }

  // 【修复】安全销毁旧的高德地图实例
  safeDestroyMap()

  // 确保PlaceSearch插件已加载
  if (!window.AMap.PlaceSearch) {
    window.AMap.plugin('AMap.PlaceSearch', () => {
      createAmapInstance()
    })
  } else {
    createAmapInstance()
  }
}

// 【新增】重试加载地图
const retryLoadMap = () => {
  if (mapType.value === 'amap') {
    initAmapMap()
  } else {
    initGoogleMap()
  }
}

// 【新增】初始化Google地图
const initGoogleMap = async () => {
  // 【修复】安全销毁高德地图实例
  safeDestroyMap()
  if (marker) {
    marker.setMap(null)
    marker = null
  }

  // 检查Google Maps API是否已加载
  if (!window.google || !window.google.maps) {
    console.warn('Google Maps API未加载，请检查index.html中的script标签')
    return
  }

  createGoogleInstance()
}

// 【修复】创建高德地图实例 - 强化容器检查和错误处理
const createAmapInstance = (retryCount = 0) => {
  const maxRetries = 10
  const retryDelay = 200

  nextTick(() => {
    const container = document.getElementById('map-picker-container')
    if (!container) {
      if (retryCount < maxRetries) {
        console.log(`地图容器不存在，${retryDelay}ms后重试 (${retryCount + 1}/${maxRetries})`)
        setTimeout(() => createAmapInstance(retryCount + 1), retryDelay)
        return
      } else {
        const errorMsg = '地图容器未找到，请检查DOM结构'
        console.error(errorMsg)
        mapLoadError.value = errorMsg
        return
      }
    }

    // 【修复】确保容器有明确的尺寸（强制检查）
    const containerWidth = container.offsetWidth || container.clientWidth
    const containerHeight = container.offsetHeight || container.clientHeight

    if (containerWidth === 0 || containerHeight === 0) {
      if (retryCount < maxRetries) {
        console.log(`地图容器尺寸为0 (${containerWidth}x${containerHeight})，${retryDelay}ms后重试 (${retryCount + 1}/${maxRetries})`)
        setTimeout(() => createAmapInstance(retryCount + 1), retryDelay)
        return
      } else {
        const errorMsg = `地图容器尺寸无效 (${containerWidth}x${containerHeight})，请检查CSS样式`
        console.error(errorMsg)
        mapLoadError.value = errorMsg
        return
      }
    }

    console.log(`✅ 地图容器尺寸: ${containerWidth}x${containerHeight}`)

    try {
      // 【修复】如果有搜索关键词，先解析地址获取坐标；否则使用默认位置
      let center = [116.403963, 39.915119] // 默认北京中心点（保底）
      
      if (selectedLocation.value) {
        // 如果有已选位置，使用该位置作为中心
        center = [selectedLocation.value.lng, selectedLocation.value.lat]
        console.log('📍 [createAmapInstance] 使用已选位置作为中心:', center)
      } else if (props.searchKeyword && props.searchKeyword.trim()) {
        // 【修复】如果有搜索关键词，先尝试解析地址（但地图初始化时可能API未完全加载，所以先使用默认位置，后续在complete事件中再定位）
        console.log('📍 [createAmapInstance] 检测到搜索关键词:', props.searchKeyword, '将在地图加载完成后自动定位')
        // 暂时使用默认位置，后续在complete事件中通过searchPlaceAmap定位
      }

      console.log('📍 [createAmapInstance] 开始创建高德地图实例，初始中心点:', center)

      // 【修复】创建地图实例，添加resizeEnable确保自动适配容器
      mapInstance = new window.AMap.Map('map-picker-container', {
        zoom: selectedLocation.value ? 15 : 14,
        center: center,
        viewMode: '2D',
        resizeEnable: true, // 自动适配容器尺寸变化
        expandZoomRange: true
      })

      // 【新增】验证地图是否加载成功
      mapInstance.on('complete', () => {
        console.log('✅ 高德地图初始化成功')
        mapLoaded.value = true
        mapLoadError.value = ''

        // 如果有已选位置，添加标记
        if (selectedLocation.value) {
          marker = new window.AMap.Marker({
            position: [selectedLocation.value.lng, selectedLocation.value.lat],
            map: mapInstance
          })
        }

        // 【修复】如果有搜索关键词，自动搜索并定位（确保地图完全加载后再执行）
        if (props.searchKeyword && props.searchKeyword.trim() && !selectedLocation.value) {
          console.log('📍 [createAmapInstance-complete] 检测到搜索关键词，开始自动定位:', props.searchKeyword)
          // 【修复】清除之前的错误提示（如果有）
          if (mapLoadError.value && mapLoadError.value.includes('请先在行程表单中输入地点名称')) {
            mapLoadError.value = ''
          }
          setTimeout(() => {
            searchPlaceAmap(props.searchKeyword.trim())
          }, 500) // 增加延迟确保地图完全渲染
        } else if (!props.searchKeyword || !props.searchKeyword.trim()) {
          // 【修复】如果没有搜索关键词，提示用户
          console.warn('⚠️ [createAmapInstance-complete] 未接收到地点名称，地图显示默认位置（北京）')
          if (!mapLoadError.value || !mapLoadError.value.includes('请先在行程表单中输入地点名称')) {
            mapLoadError.value = '提示：未接收到地点名称，地图显示默认位置。请先在行程表单中输入地点名称，然后点击"地图查地址"按钮。'
          }
        }
      })

      // 【新增】地图加载错误处理
      mapInstance.on('error', (err) => {
        const errorMsg = `高德地图加载错误: ${err.message || '未知错误'}`
        console.error(errorMsg, err)
        mapLoadError.value = errorMsg
        mapLoaded.value = false
      })

      // 地图点击事件 - 选点后显示地址
      mapInstance.on('click', async (e) => {
        const lng = e.lnglat.getLng()
        const lat = e.lnglat.getLat()
        await handleMapClick(lng, lat)
      })

      // 【新增】超时检查：如果3秒内地图未加载完成，显示错误
      setTimeout(() => {
        if (!mapLoaded.value && !mapLoadError.value) {
          const errorMsg = '高德地图加载超时，请检查网络或API Key'
          console.warn(errorMsg)
          mapLoadError.value = errorMsg
        }
      }, 3000)

    } catch (err) {
      const errorMsg = `创建高德地图实例失败: ${err.message || err.toString()}`
      console.error(errorMsg, err)
      mapLoadError.value = errorMsg
      mapLoaded.value = false
    }
  })
}

// 【新增】创建Google地图实例
const createGoogleInstance = () => {
  nextTick(() => {
    const container = document.getElementById('map-picker-container')
    if (!container) {
      console.error('地图容器不存在')
      return
    }

    // 确保容器有明确的尺寸
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn('地图容器尺寸为0，延迟创建')
      setTimeout(() => createGoogleInstance(), 100)
      return
    }

    try {
      // 如果有已选位置，使用该位置作为中心；否则使用默认位置
      const center = selectedLocation.value
        ? { lat: selectedLocation.value.lat, lng: selectedLocation.value.lng }
        : { lat: 39.90923, lng: 116.397428 } // 默认北京中心

      googleMapInstance = new window.google.maps.Map(container, {
        zoom: selectedLocation.value ? 15 : 13,
        center: center,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP
      })

      // 如果有已选位置，添加标记
      if (selectedLocation.value) {
        googleMarker = new window.google.maps.Marker({
          position: { lat: selectedLocation.value.lat, lng: selectedLocation.value.lng },
          map: googleMapInstance
        })
      }

      // 如果有搜索关键词，自动搜索并定位
      if (props.searchKeyword && !selectedLocation.value) {
        setTimeout(() => {
          searchPlaceGoogle(props.searchKeyword)
        }, 300)
      }

      // 地图点击事件
      googleMapInstance.addListener('click', async (e) => {
        const lng = e.latLng.lng()
        const lat = e.latLng.lat()
        await handleMapClick(lng, lat)
      })
    } catch (err) {
      console.error('创建Google地图实例失败', err)
    }
  })
}

// 【新增】处理地图点击事件（统一处理）
const handleMapClick = async (lng, lat) => {
  // 更新标记位置
  if (mapType.value === 'amap' && mapInstance) {
    if (marker) {
      marker.setPosition([lng, lat])
    } else {
      marker = new window.AMap.Marker({
        position: [lng, lat],
        map: mapInstance
      })
    }
  } else if (mapType.value === 'google' && googleMapInstance) {
    if (googleMarker) {
      googleMarker.setPosition({ lat, lng })
    } else {
      googleMarker = new window.google.maps.Marker({
        position: { lat, lng },
        map: googleMapInstance
      })
    }
  }

  // 【优化】逆地理编码：将坐标转换为地址（使用统一的请求工具）
  try {
    const response = await post('/api/maps/reverse-geocode', {
      lng,
      lat
    }, {
      timeout: API_TIMEOUT.map
    })

    // 统一返回格式：{ code: 200, data: { address: "..." }, msg: "成功" }
    if (response.code === 200 && response.data) {
      selectedLocation.value = {
        lng,
        lat,
        address: response.data.address || ''
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
}

// 【重构】搜索地点（高德地图）
// 【修复】地址解析功能 - 使用AMap.Geocoder将地点名称转换为坐标
const geocodeAddress = async (address) => {
  if (!mapInstance || !window.AMap) {
    console.warn('⚠️ [geocodeAddress] 高德地图实例未创建，无法解析地址')
    return null
  }

  if (!address || !address.trim()) {
    return null
  }

  return new Promise((resolve) => {
    try {
      // 使用AMap.Geocoder进行地址解析
      window.AMap.plugin('AMap.Geocoder', () => {
        const geocoder = new window.AMap.Geocoder({
          city: '全国' // 全国范围搜索
        })

        geocoder.getLocation(address.trim(), (status, result) => {
          if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
            const geocode = result.geocodes[0]
            const location = geocode.location
            
            console.log('✅ [geocodeAddress] 地址解析成功:', address, '→', [location.lng, location.lat])
            resolve({
              lng: location.lng,
              lat: location.lat,
              address: geocode.formattedAddress || address
            })
          } else {
            console.warn('⚠️ [geocodeAddress] 地址解析失败或无结果:', status, address)
            resolve(null)
          }
        })
      })
    } catch (err) {
      console.error('❌ [geocodeAddress] 地址解析异常:', err)
      resolve(null)
    }
  })
}

// 【修复】搜索地点功能 - 使用AMap.PlaceSearch搜索POI并定位
const searchPlaceAmap = async (keyword) => {
  console.log('🔍 [searchPlaceAmap] 开始搜索地点:', keyword)
  
  if (!mapInstance || !window.AMap) {
    console.warn('⚠️ [searchPlaceAmap] 高德地图实例未创建，无法搜索')
    return
  }

  if (!keyword || !keyword.trim()) {
    console.warn('⚠️ [searchPlaceAmap] 搜索关键词为空')
    return
  }

  try {
    // 【修复】优先使用PlaceSearch搜索POI（更准确）
    window.AMap.plugin('AMap.PlaceSearch', () => {
      const placeSearch = new window.AMap.PlaceSearch({
        pageSize: 1,
        pageIndex: 1,
        city: '全国' // 全国范围搜索
      })

      console.log('🔍 [searchPlaceAmap] 使用PlaceSearch搜索:', keyword.trim())
      placeSearch.search(keyword.trim(), (status, result) => {
        if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
          const poi = result.poiList.pois[0]
          const location = poi.location
          
          if (!location) {
            console.warn('⚠️ [searchPlaceAmap] POI没有位置信息，尝试使用Geocoder解析')
            // 如果PlaceSearch没有位置信息，尝试使用Geocoder
            geocodeAddress(keyword).then(geocodeResult => {
              if (geocodeResult) {
                mapInstance.setCenter([geocodeResult.lng, geocodeResult.lat])
                mapInstance.setZoom(15)
                selectedLocation.value = geocodeResult
              }
            })
            return
          }
          
          console.log('✅ [searchPlaceAmap] 搜索成功，定位到:', [location.lng, location.lat], poi.name)
          
          // 更新地图中心
          mapInstance.setCenter([location.lng, location.lat])
          mapInstance.setZoom(15)

          // 添加标记
          if (marker) {
            marker.setPosition([location.lng, location.lat])
          } else {
            marker = new window.AMap.Marker({
              position: [location.lng, location.lat],
              map: mapInstance
            })
          }

          // 自动填充地址和坐标
          selectedLocation.value = {
            lng: location.lng,
            lat: location.lat,
            address: poi.address || poi.name || keyword
          }
          
          console.log('✅ [searchPlaceAmap] 地图已定位到:', selectedLocation.value)
        } else {
          console.warn('⚠️ [searchPlaceAmap] PlaceSearch搜索失败或无结果，尝试使用Geocoder解析:', status)
          // 【修复】如果PlaceSearch失败，尝试使用Geocoder解析地址
          geocodeAddress(keyword).then(geocodeResult => {
            if (geocodeResult) {
              console.log('✅ [searchPlaceAmap] Geocoder解析成功，定位到:', [geocodeResult.lng, geocodeResult.lat])
              mapInstance.setCenter([geocodeResult.lng, geocodeResult.lat])
              mapInstance.setZoom(15)
              
              // 添加标记
              if (marker) {
                marker.setPosition([geocodeResult.lng, geocodeResult.lat])
              } else {
                marker = new window.AMap.Marker({
                  position: [geocodeResult.lng, geocodeResult.lat],
                  map: mapInstance
                })
              }
              
              selectedLocation.value = geocodeResult
              console.log('✅ [searchPlaceAmap] 地图已定位到:', selectedLocation.value)
            } else {
              console.error('❌ [searchPlaceAmap] 地址解析失败，未找到该地点:', keyword)
              mapLoadError.value = `未找到地点"${keyword}"，请检查名称是否正确`
            }
          })
        }
      })
    })
  } catch (err) {
    console.error('搜索地点失败', err)
  }
}

// 【新增】搜索地点（Google地图）
const searchPlaceGoogle = async (keyword) => {
  if (!googleMapInstance || !window.google || !window.google.maps) {
    console.warn('Google地图实例未创建，无法搜索')
    return
  }

  if (!keyword || !keyword.trim()) {
    return
  }

  try {
    const service = new window.google.maps.places.PlacesService(googleMapInstance)
    const request = {
      query: keyword.trim(),
      fields: ['name', 'geometry', 'formatted_address']
    }

    service.findPlaceFromQuery(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        const place = results[0]
        const location = place.geometry.location
        
        // 更新地图中心
        googleMapInstance.setCenter(location)
        googleMapInstance.setZoom(15)

        // 添加标记
        if (googleMarker) {
          googleMarker.setPosition(location)
        } else {
          googleMarker = new window.google.maps.Marker({
            position: location,
            map: googleMapInstance
          })
        }

        // 自动填充地址和坐标
        selectedLocation.value = {
          lng: location.lng(),
          lat: location.lat(),
          address: place.formatted_address || place.name || ''
        }
      } else {
        console.warn('地点搜索失败或无结果', status)
      }
    })
  } catch (err) {
    console.error('搜索地点失败', err)
  }
}

// 【修复】地图切换函数 - 重置加载状态
const switchMap = async () => {
  // 保存当前选中的位置
  const currentLocation = selectedLocation.value
  
  // 重置加载状态
  mapLoaded.value = false
  mapLoadError.value = ''
  
  // 清理当前地图的标记
  if (mapType.value === 'amap') {
    if (marker) {
      marker.setMap(null)
      marker = null
    }
  } else {
    if (googleMarker) {
      googleMarker.setMap(null)
      googleMarker = null
    }
  }

  // 初始化新地图
  await initMap()

  // 如果有已选位置，在新地图上恢复
  if (currentLocation) {
    setTimeout(() => {
      if (mapType.value === 'amap' && mapInstance) {
        mapInstance.setCenter([currentLocation.lng, currentLocation.lat])
        mapInstance.setZoom(15)
        marker = new window.AMap.Marker({
          position: [currentLocation.lng, currentLocation.lat],
          map: mapInstance
        })
      } else if (mapType.value === 'google' && googleMapInstance) {
        googleMapInstance.setCenter({ lat: currentLocation.lat, lng: currentLocation.lng })
        googleMapInstance.setZoom(15)
        googleMarker = new window.google.maps.Marker({
          position: { lat: currentLocation.lat, lng: currentLocation.lng },
          map: googleMapInstance
        })
      }
    }, 500)
  } else if (props.searchKeyword) {
    // 如果有搜索关键词，在新地图上搜索
    setTimeout(() => {
      if (mapType.value === 'amap') {
        searchPlaceAmap(props.searchKeyword)
      } else {
        searchPlaceGoogle(props.searchKeyword)
      }
    }, 500)
  }
}

// 确认选择
const confirmSelection = () => {
  if (selectedLocation.value) {
    emit('confirm', selectedLocation.value)
    handleClose()
  }
}

// 【优化】关闭弹窗 - 清理资源（使用工具函数）
const handleClose = () => {
  selectedLocation.value = null
  mapLoaded.value = false
  mapLoadError.value = ''
  
  // 清除标记（不销毁地图实例，保留以便下次使用）
  if (marker) {
    marker.setMap(null)
    marker = null
  }
  if (googleMarker) {
    googleMarker.setMap(null)
    googleMarker = null
  }
  
  emit('close')
}

// 【修复】监听show变化 - 弹窗打开时立即初始化地图
// 【修复】监听show变化 - 弹窗打开时立即初始化地图（兜底调用）
watch(() => props.show, async (newVal) => {
  if (newVal) {
    console.log('📍 [watch-show] 地图弹窗已打开，开始初始化流程...')
    console.log('📍 [watch-show] 搜索关键词:', props.searchKeyword || '无')
    
    // 【修复】参数校验：如果未接收到地点名称，提示用户
    if (!props.searchKeyword || !props.searchKeyword.trim()) {
      console.warn('⚠️ [watch-show] 未接收到地点名称，地图将显示默认位置（北京）')
      mapLoadError.value = '请先在行程表单中输入地点名称，然后点击"地图查地址"按钮'
      // 不阻止地图初始化，但提示用户
    } else {
      // 【修复】如果有搜索关键词，清除之前的错误提示
      if (mapLoadError.value && mapLoadError.value.includes('请先在行程表单中输入地点名称')) {
        mapLoadError.value = ''
      }
    }
    
    // 弹窗打开时，等待DOM更新后初始化地图
    await nextTick()
    // 延迟200ms确保容器已渲染
    setTimeout(async () => {
      console.log('🚀 [watch-show] 开始调用initMap()初始化地图...')
      try {
        await initMap()
        console.log('✅ [watch-show] initMap()执行完成')
        // 【修复】如果有关键词，在地图完全加载后再次尝试搜索（确保定位）
        if (props.searchKeyword && props.searchKeyword.trim()) {
          console.log('📍 [watch-show] 检测到搜索关键词，等待地图加载完成后自动定位:', props.searchKeyword)
          // 地图初始化时已经在complete事件中处理了搜索，这里作为兜底
          setTimeout(() => {
            if (mapType.value === 'amap' && mapInstance && mapLoaded.value) {
              console.log('🔄 [watch-show] 兜底：再次尝试搜索地点:', props.searchKeyword)
              searchPlaceAmap(props.searchKeyword.trim())
            } else if (mapType.value === 'google' && googleMapInstance) {
              searchPlaceGoogle(props.searchKeyword.trim())
            }
          }, 1000) // 延迟1秒确保地图完全加载
        }
      } catch (err) {
        console.error('❌ [watch-show] initMap()执行失败:', err)
        // 【修复】即使出错，也尝试强制初始化（兜底）
        console.log('🔄 [watch-show] 尝试兜底：强制初始化地图...')
        try {
          if (mapType.value === 'amap') {
            await initAmapMap()
          }
        } catch (fallbackErr) {
          console.error('❌ [watch-show] 兜底初始化也失败:', fallbackErr)
        }
      }
    }, 200) // 增加延迟到200ms
  } else {
    console.log('📍 [watch-show] 地图弹窗已关闭，清理资源...')
    // 弹窗关闭时清理标记和选中位置
    if (marker) {
      marker.setMap(null)
      marker = null
    }
    if (googleMarker) {
      googleMarker.setMap(null)
      googleMarker = null
    }
    selectedLocation.value = null
  }
})

// 【修复】监听搜索关键词变化 - 地图实例存在时才搜索（实时定位）
watch(() => props.searchKeyword, (newVal, oldVal) => {
  if (newVal && newVal.trim() && newVal !== oldVal && props.show) {
    console.log('📍 [watch-searchKeyword] 搜索关键词变化，开始定位:', newVal)
    setTimeout(() => {
      if (mapType.value === 'amap' && mapInstance && mapLoaded.value) {
        console.log('🔍 [watch-searchKeyword] 触发高德地图搜索:', newVal)
        searchPlaceAmap(newVal.trim())
      } else if (mapType.value === 'google' && googleMapInstance) {
        console.log('🔍 [watch-searchKeyword] 触发Google地图搜索:', newVal)
        searchPlaceGoogle(newVal.trim())
      } else {
        console.warn('⚠️ [watch-searchKeyword] 地图实例未就绪，延迟搜索')
        // 如果地图未就绪，等待一段时间后重试
        setTimeout(() => {
          if (mapType.value === 'amap' && mapInstance && mapLoaded.value) {
            searchPlaceAmap(newVal.trim())
          }
        }, 1000)
      }
    }, 300)
  }
})

// 【修复】组件卸载时清理 - 销毁地图实例
onUnmounted(() => {
  if (marker) {
    marker.setMap(null)
    marker = null
  }
  if (googleMarker) {
    googleMarker.setMap(null)
    googleMarker = null
  }
  // 【修复】使用安全销毁函数
  safeDestroyMap()
  googleMapInstance = null
})
</script>

<style scoped>
/* 【修复】地图容器样式 - 确保地图完全显示 */
#map-picker-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>

