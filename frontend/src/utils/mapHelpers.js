/**
 * 地图工具函数
 * 拆分 MapPicker.vue 中的耦合函数
 */

import { MAP_CONFIG } from '../config/index.js'

/**
 * 检查地图容器
 * @param {string} containerId - 容器ID（默认'map-picker-container'）
 * @returns {Promise<HTMLElement|null>} 容器元素，如果检查失败返回null
 */
export const checkMapContainer = async (containerId = 'map-picker-container') => {
  const maxRetries = 3
  const retryDelay = 500
  let retryCount = 0

  while (retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, retryDelay))
    
    const container = document.getElementById(containerId)
    if (!container) {
      retryCount++
      console.log(`⚠️ 容器未找到，重试第 ${retryCount}/${maxRetries} 次...`)
      continue
    }

    let offsetWidth = container.offsetWidth || container.clientWidth
    let offsetHeight = container.offsetHeight || container.clientHeight

    // 弱化校验：如果尺寸为0，自动修复
    if (offsetWidth === 0 || offsetHeight === 0) {
      console.warn(`⚠️ 容器尺寸为0 (${offsetWidth}x${offsetHeight})，自动修复为${MAP_CONFIG.containerMinSize.width}x${MAP_CONFIG.containerMinSize.height}...`)
      container.style.width = `${MAP_CONFIG.containerMinSize.width}px`
      container.style.height = `${MAP_CONFIG.containerMinSize.height}px`
      // 等待样式应用
      await new Promise(resolve => setTimeout(resolve, 100))
      offsetWidth = container.offsetWidth || container.clientWidth
      offsetHeight = container.offsetHeight || container.clientHeight
      console.log(`✅ 容器已修复，新尺寸: ${offsetWidth}x${offsetHeight}`)
    }

    if (offsetWidth > 0 && offsetHeight > 0) {
      console.log(`✅ 容器检查通过，尺寸: ${offsetWidth}x${offsetHeight}`)
      return container
    }

    retryCount++
    console.log(`⚠️ 容器尺寸仍为0，重试第 ${retryCount}/${maxRetries} 次...`)
  }

  // 不抛出错误，仅警告，允许流程继续
  console.warn('⚠️ 容器检查失败，但继续执行API加载（容器可能在后续步骤中修复）')
  return null
}

/**
 * 获取高德地图API Key
 * @param {Function} fetchMapKeys - 获取地图Keys的函数
 * @returns {Promise<string>} 高德地图API Key
 */
export const fetchAmapApiKey = async (fetchMapKeys) => {
  console.log('🔑 开始获取高德地图Key...')
  const keyData = await fetchMapKeys()
  const amapKey = keyData.amap

  if (!amapKey) {
    throw new Error('Key无效：高德地图API Key未配置，请在后端.env文件中设置AMAP_API_KEY')
  }

  // 基本检查：Key长度
  if (amapKey.length < 10) {
    throw new Error(`Key无效：Key长度异常，请确认是Web端Key，当前Key长度：${amapKey.length}`)
  }

  console.log('✅ 高德Key校验通过（请确认白名单包含localhost）', amapKey.substring(0, 10) + '...')
  return amapKey
}

/**
 * 加载高德地图API脚本
 * @param {string} amapKey - 高德地图API Key
 * @returns {Promise<void>}
 */
export const loadAmapApiScript = async (amapKey) => {
  console.log('🚀 [loadAmapApiScript] 开始加载高德地图API，Key:', amapKey.substring(0, 10) + '...')
  
  const maxRetry = 1
  let retry = 0

  while (retry <= maxRetry) {
    try {
      return await new Promise((resolve, reject) => {
        // 如果API已加载，先清理旧的script标签
        if (window.AMap && window.AMap.Map) {
          console.log('⚠️ 高德地图API已存在，但强制重新加载以确保Network可见...')
          const oldScript = document.querySelector('script[src*="webapi.amap.com"]')
          if (oldScript) {
            oldScript.remove()
            console.log('✅ 已移除旧的API script标签')
          }
        }

        // 检查是否正在加载
        if (window.amapLoading) {
          const checkInterval = setInterval(() => {
            if (window.AMap) {
              clearInterval(checkInterval)
              console.log('✅ 高德地图API已加载（其他请求已完成）')
              resolve()
            }
          }, 100)
          setTimeout(() => {
            clearInterval(checkInterval)
            if (!window.AMap) {
              reject(new Error('API加载超时（等待其他请求）'))
            }
          }, 15000)
          return
        }

        window.amapLoading = true
        const script = document.createElement('script')
        const apiUrl = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&plugin=AMap.PlaceSearch,AMap.Geocoder&callback=initAmapCallback`
        script.src = apiUrl
        script.async = true
        script.defer = true

        console.log('📦 [loadAmapApiScript] 创建script标签，URL:', apiUrl)

        // 设置超时（15秒）
        const timeoutId = setTimeout(() => {
          window.amapLoading = false
          console.error('❌ [loadAmapApiScript] API加载超时：15秒内未完成加载')
          reject(new Error('API加载超时：15秒内未完成加载'))
        }, 15000)

        // 设置全局回调
        window.initAmapCallback = () => {
          clearTimeout(timeoutId)
          window.amapLoading = false
          console.log('✅ [loadAmapApiScript] initAmapCallback被调用')
          if (window.AMap && window.AMap.Map) {
            console.log('✅ [loadAmapApiScript] 高德地图API动态加载成功，AMap对象已存在')
            resolve()
          } else {
            console.error('❌ [loadAmapApiScript] API加载后AMap对象不存在')
            reject(new Error('API加载后AMap对象不存在'))
          }
        }

        script.onerror = (err) => {
          clearTimeout(timeoutId)
          window.amapLoading = false
          console.error('❌ [loadAmapApiScript] script.onerror被触发，加载失败:', err)
          reject(new Error(`API加载失败（第${retry + 1}次）`))
        }

        script.onload = () => {
          console.log('✅ [loadAmapApiScript] script.onload被触发（但需等待callback）')
        }

        // 添加到head前，先检查是否已存在相同的script
        const existingScript = document.querySelector(`script[src="${apiUrl}"]`)
        if (existingScript) {
          console.warn('⚠️ [loadAmapApiScript] 发现已存在的相同script标签，先移除')
          existingScript.remove()
        }

        document.head.appendChild(script)
        console.log('✅ [loadAmapApiScript] script标签已添加到document.head')
      })
    } catch (err) {
      retry++
      if (retry > maxRetry) {
        throw err
      }
      console.log(`⚠️ API加载失败，重试第 ${retry} 次...`)
      // 移除失败的script标签
      const failedScript = document.querySelector(`script[src*="webapi.amap.com"]`)
      if (failedScript) {
        failedScript.remove()
      }
      // 等待1秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

/**
 * 清除地图实例和标记
 * @param {object} options - 配置选项
 * @param {object} options.mapInstance - 高德地图实例
 * @param {object} options.marker - 高德地图标记
 * @param {object} options.googleMapInstance - Google地图实例
 * @param {object} options.googleMarker - Google地图标记
 */
export const clearMapInstance = ({ mapInstance, marker, googleMapInstance, googleMarker }) => {
  // 清除高德地图标记
  if (marker) {
    try {
      marker.setMap(null)
      marker = null
    } catch (err) {
      console.warn('清除高德地图标记失败:', err)
    }
  }

  // 安全销毁高德地图实例
  if (mapInstance && typeof mapInstance.destroy === 'function') {
    try {
      mapInstance.destroy()
      console.log('✅ 高德地图实例销毁成功')
    } catch (err) {
      console.warn('⚠️ 销毁高德地图实例时出现非致命错误', err)
    }
    mapInstance = null
  } else if (mapInstance) {
    console.warn('⚠️ 高德地图实例存在但无destroy方法，直接重置')
    mapInstance = null
  }

  // 清除Google地图标记
  if (googleMarker) {
    try {
      googleMarker.setMap(null)
      googleMarker = null
    } catch (err) {
      console.warn('清除Google地图标记失败:', err)
    }
  }

  // 清除Google地图实例（Google Maps不需要显式销毁）
  if (googleMapInstance) {
    googleMapInstance = null
  }
}


