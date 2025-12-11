/**
 * 存储适配层 - 统一封装JSON和Supabase存储操作
 * 通过 STORAGE_MODE 环境变量控制存储方式（local/supabase）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 存储模式：local 或 supabase
const STORAGE_MODE = process.env.STORAGE_MODE || 'local'

// Supabase客户端（延迟加载）
let supabase = null
let supabaseInitialized = false

// JSON文件路径
const DATA_DIR = path.join(__dirname, 'data')
const SITES_JSON_PATH = path.join(DATA_DIR, 'xhs_sites.json')
const TRIPS_JSON_PATH = path.join(DATA_DIR, 'trips.json')
const TRIP_SITES_JSON_PATH = path.join(DATA_DIR, 'trip_sites.json')
const TRIP_ITEMS_JSON_PATH = path.join(DATA_DIR, 'trip_items.json')

/**
 * 初始化Supabase客户端（仅在supabase模式下）
 */
const initSupabase = async () => {
  if (STORAGE_MODE !== 'supabase' || supabaseInitialized) {
    return supabase
  }

  try {
    const { supabase: supabaseClient } = await import('./config/supabase.js')
    supabase = supabaseClient || null
    supabaseInitialized = true
    
    if (supabase) {
      console.log('✅ Supabase客户端初始化成功')
    } else {
      console.warn('⚠️ Supabase客户端初始化失败，将使用本地存储')
    }
  } catch (err) {
    console.warn('⚠️ Supabase配置导入失败，将使用本地存储:', err.message)
    supabase = null
    supabaseInitialized = true
  }

  return supabase
}

/**
 * 确保数据目录存在
 */
const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * 初始化JSON文件（如果不存在则创建空数组）
 */
const initJsonFile = (filePath) => {
  ensureDataDir()
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8')
  }
}

// ==================== 站点（xhs_sites）存储适配 ====================

/**
 * 读取所有站点
 */
export const readSites = async () => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.warn('⚠️ Supabase查询站点失败，降级到本地存储:', error.message)
          return readSitesFromFile()
        }
        return data || []
      } catch (err) {
        console.warn('⚠️ Supabase查询站点异常，降级到本地存储:', err.message)
        return readSitesFromFile()
      }
    }
  }
  
  return readSitesFromFile()
}

/**
 * 根据ID读取单个站点
 */
export const readSiteById = async (id) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase查询站点失败，降级到本地存储:', error.message)
          return readSiteByIdFromFile(id)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase查询站点异常，降级到本地存储:', err.message)
        return readSiteByIdFromFile(id)
      }
    }
  }
  
  return readSiteByIdFromFile(id)
}

/**
 * 保存站点
 */
export const saveSite = async (siteData) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .insert([siteData])
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase保存站点失败，降级到本地存储:', error.message)
          return saveSiteToFile(siteData)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase保存站点异常，降级到本地存储:', err.message)
        return saveSiteToFile(siteData)
      }
    }
  }
  
  return saveSiteToFile(siteData)
}

/**
 * 更新站点
 */
export const updateSite = async (id, updates) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('xhs_sites')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase更新站点失败，降级到本地存储:', error.message)
          return updateSiteInFile(id, updates)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase更新站点异常，降级到本地存储:', err.message)
        return updateSiteInFile(id, updates)
      }
    }
  }
  
  return updateSiteInFile(id, updates)
}

/**
 * 删除站点
 */
export const deleteSite = async (id) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { error } = await supabase
          .from('xhs_sites')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.warn('⚠️ Supabase删除站点失败，降级到本地存储:', error.message)
          return deleteSiteFromFile(id)
        }
        return true
      } catch (err) {
        console.warn('⚠️ Supabase删除站点异常，降级到本地存储:', err.message)
        return deleteSiteFromFile(id)
      }
    }
  }
  
  return deleteSiteFromFile(id)
}

/**
 * 搜索站点（按关键词和标签）
 */
export const searchSites = async (search, tag) => {
  const allSites = await readSites()
  
  let filtered = allSites
  
  // 关键词搜索
  if (search) {
    const searchLower = search.toLowerCase()
    filtered = filtered.filter(site => 
      (site.site_name && site.site_name.toLowerCase().includes(searchLower)) ||
      (site.content && site.content.toLowerCase().includes(searchLower)) ||
      (site.notes && site.notes.toLowerCase().includes(searchLower))
    )
  }
  
  // 标签筛选
  if (tag) {
    filtered = filtered.filter(site => 
      site.tags && Array.isArray(site.tags) && site.tags.includes(tag)
    )
  }
  
  return filtered
}

// ==================== JSON文件操作方法（站点） ====================

const readSitesFromFile = () => {
  try {
    initJsonFile(SITES_JSON_PATH)
    const data = fs.readFileSync(SITES_JSON_PATH, 'utf-8')
    const sites = JSON.parse(data || '[]')
    return Array.isArray(sites) ? sites : []
  } catch (error) {
    console.error('读取站点JSON文件失败:', error)
    return []
  }
}

const readSiteByIdFromFile = (id) => {
  const sites = readSitesFromFile()
  return sites.find(s => s.id === id) || null
}

const saveSiteToFile = (siteData) => {
  try {
    ensureDataDir()
    const sites = readSitesFromFile()
    const newSite = {
      id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...siteData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    sites.push(newSite)
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(sites, null, 2), 'utf-8')
    return newSite
  } catch (error) {
    console.error('保存站点JSON文件失败:', error)
    throw error
  }
}

const updateSiteInFile = (id, updates) => {
  try {
    ensureDataDir()
    const sites = readSitesFromFile()
    const index = sites.findIndex(s => s.id === id)
    
    if (index === -1) {
      throw new Error('站点不存在')
    }
    
    sites[index] = {
      ...sites[index],
      ...updates,
      updated_at: new Date().toISOString()
    }
    
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(sites, null, 2), 'utf-8')
    return sites[index]
  } catch (error) {
    console.error('更新站点JSON文件失败:', error)
    throw error
  }
}

const deleteSiteFromFile = (id) => {
  try {
    ensureDataDir()
    const sites = readSitesFromFile()
    const filtered = sites.filter(s => s.id !== id)
    fs.writeFileSync(SITES_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除站点JSON文件失败:', error)
    throw error
  }
}

// ==================== 行程（trips）存储适配 ====================

/**
 * 读取所有行程
 */
export const readTrips = async () => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.warn('⚠️ Supabase查询行程失败，降级到本地存储:', error.message)
          return readTripsFromFile()
        }
        return data || []
      } catch (err) {
        console.warn('⚠️ Supabase查询行程异常，降级到本地存储:', err.message)
        return readTripsFromFile()
      }
    }
  }
  
  return readTripsFromFile()
}

/**
 * 根据ID读取单个行程
 */
export const readTripById = async (id) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase查询行程失败，降级到本地存储:', error.message)
          return readTripByIdFromFile(id)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase查询行程异常，降级到本地存储:', err.message)
        return readTripByIdFromFile(id)
      }
    }
  }
  
  return readTripByIdFromFile(id)
}

/**
 * 保存行程
 */
export const saveTrip = async (tripData) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .insert([tripData])
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase保存行程失败，降级到本地存储:', error.message)
          return saveTripToFile(tripData)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase保存行程异常，降级到本地存储:', err.message)
        return saveTripToFile(tripData)
      }
    }
  }
  
  return saveTripToFile(tripData)
}

/**
 * 更新行程
 */
export const updateTrip = async (id, updates) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trips')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase更新行程失败，降级到本地存储:', error.message)
          return updateTripInFile(id, updates)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase更新行程异常，降级到本地存储:', err.message)
        return updateTripInFile(id, updates)
      }
    }
  }
  
  return updateTripInFile(id, updates)
}

/**
 * 删除行程
 */
export const deleteTrip = async (id) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { error } = await supabase
          .from('trips')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.warn('⚠️ Supabase删除行程失败，降级到本地存储:', error.message)
          return deleteTripFromFile(id)
        }
        return true
      } catch (err) {
        console.warn('⚠️ Supabase删除行程异常，降级到本地存储:', err.message)
        return deleteTripFromFile(id)
      }
    }
  }
  
  return deleteTripFromFile(id)
}

// ==================== JSON文件操作方法（行程） ====================

const readTripsFromFile = () => {
  try {
    initJsonFile(TRIPS_JSON_PATH)
    const data = fs.readFileSync(TRIPS_JSON_PATH, 'utf-8')
    const trips = JSON.parse(data || '[]')
    return Array.isArray(trips) ? trips : []
  } catch (error) {
    console.error('读取行程JSON文件失败:', error)
    return []
  }
}

const readTripByIdFromFile = (id) => {
  const trips = readTripsFromFile()
  return trips.find(t => t.id === id) || null
}

const saveTripToFile = (tripData) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const newTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...tripData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    trips.push(newTrip)
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(trips, null, 2), 'utf-8')
    return newTrip
  } catch (error) {
    console.error('保存行程JSON文件失败:', error)
    throw error
  }
}

const updateTripInFile = (id, updates) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const index = trips.findIndex(t => t.id === id)
    
    if (index === -1) {
      throw new Error('行程不存在')
    }
    
    trips[index] = {
      ...trips[index],
      ...updates,
      updated_at: new Date().toISOString()
    }
    
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(trips, null, 2), 'utf-8')
    return trips[index]
  } catch (error) {
    console.error('更新行程JSON文件失败:', error)
    throw error
  }
}

const deleteTripFromFile = (id) => {
  try {
    ensureDataDir()
    const trips = readTripsFromFile()
    const filtered = trips.filter(t => t.id !== id)
    fs.writeFileSync(TRIPS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程JSON文件失败:', error)
    throw error
  }
}

// ==================== 行程内容（trip_items）存储适配 ====================

/**
 * 读取行程的所有内容项
 */
export const readTripItems = async (tripId, date = null) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        let query = supabase
          .from('trip_items')
          .select('*')
          .eq('trip_id', tripId)
        
        if (date) {
          query = query.eq('date', date)
        }
        
        query = query.order('date', { ascending: true })
          .order('sort_order', { ascending: true })
        
        const { data, error } = await query
        
        if (error) {
          console.warn('⚠️ Supabase查询行程内容失败，降级到本地存储:', error.message)
          return readTripItemsFromFile(tripId, date)
        }
        return data || []
      } catch (err) {
        console.warn('⚠️ Supabase查询行程内容异常，降级到本地存储:', err.message)
        return readTripItemsFromFile(tripId, date)
      }
    }
  }
  
  return readTripItemsFromFile(tripId, date)
}

/**
 * 保存行程内容项
 */
export const saveTripItem = async (tripId, itemData) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_items')
          .insert([{ ...itemData, trip_id: tripId }])
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase保存行程内容失败，降级到本地存储:', error.message)
          return saveTripItemToFile(tripId, itemData)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase保存行程内容异常，降级到本地存储:', err.message)
        return saveTripItemToFile(tripId, itemData)
      }
    }
  }
  
  return saveTripItemToFile(tripId, itemData)
}

/**
 * 批量保存行程内容项（按日期和主题）
 */
export const saveTripItemsByDate = async (tripId, date, theme, items) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        // 先删除该日期下的所有项
        await supabase
          .from('trip_items')
          .delete()
          .eq('trip_id', tripId)
          .eq('date', date)
        
        // 批量插入新项
        const itemsToInsert = items.map((item, index) => ({
          ...item,
          trip_id: tripId,
          date,
          theme,
          sort_order: index
        }))
        
        const { data, error } = await supabase
          .from('trip_items')
          .insert(itemsToInsert)
          .select()
        
        if (error) {
          console.warn('⚠️ Supabase批量保存行程内容失败，降级到本地存储:', error.message)
          return saveTripItemsByDateToFile(tripId, date, theme, items)
        }
        return data || []
      } catch (err) {
        console.warn('⚠️ Supabase批量保存行程内容异常，降级到本地存储:', err.message)
        return saveTripItemsByDateToFile(tripId, date, theme, items)
      }
    }
  }
  
  return saveTripItemsByDateToFile(tripId, date, theme, items)
}

/**
 * 更新行程内容项
 */
export const updateTripItem = async (tripId, itemId, updates) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trip_items')
          .update(updates)
          .eq('id', itemId)
          .eq('trip_id', tripId)
          .select()
          .single()
        
        if (error) {
          console.warn('⚠️ Supabase更新行程内容失败，降级到本地存储:', error.message)
          return updateTripItemInFile(tripId, itemId, updates)
        }
        return data
      } catch (err) {
        console.warn('⚠️ Supabase更新行程内容异常，降级到本地存储:', err.message)
        return updateTripItemInFile(tripId, itemId, updates)
      }
    }
  }
  
  return updateTripItemInFile(tripId, itemId, updates)
}

/**
 * 删除行程内容项
 */
export const deleteTripItem = async (tripId, itemId) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { error } = await supabase
          .from('trip_items')
          .delete()
          .eq('id', itemId)
          .eq('trip_id', tripId)
        
        if (error) {
          console.warn('⚠️ Supabase删除行程内容失败，降级到本地存储:', error.message)
          return deleteTripItemFromFile(tripId, itemId)
        }
        return true
      } catch (err) {
        console.warn('⚠️ Supabase删除行程内容异常，降级到本地存储:', err.message)
        return deleteTripItemFromFile(tripId, itemId)
      }
    }
  }
  
  return deleteTripItemFromFile(tripId, itemId)
}

/**
 * 删除行程的所有内容项
 */
export const deleteTripItems = async (tripId) => {
  if (STORAGE_MODE === 'supabase') {
    await initSupabase()
    if (supabase) {
      try {
        const { error } = await supabase
          .from('trip_items')
          .delete()
          .eq('trip_id', tripId)
        
        if (error) {
          console.warn('⚠️ Supabase删除行程内容失败，降级到本地存储:', error.message)
          return deleteTripItemsFromFile(tripId)
        }
        return true
      } catch (err) {
        console.warn('⚠️ Supabase删除行程内容异常，降级到本地存储:', err.message)
        return deleteTripItemsFromFile(tripId)
      }
    }
  }
  
  return deleteTripItemsFromFile(tripId)
}

// ==================== JSON文件操作方法（行程内容） ====================

const readTripItemsFromFile = (tripId, date = null) => {
  try {
    initJsonFile(TRIP_ITEMS_JSON_PATH)
    const data = fs.readFileSync(TRIP_ITEMS_JSON_PATH, 'utf-8')
    const items = JSON.parse(data || '[]')
    let filtered = Array.isArray(items) ? items.filter(item => item.trip_id === tripId) : []
    
    if (date) {
      filtered = filtered.filter(item => item.date === date)
    }
    
    // 按日期和排序字段排序
    filtered.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }
      return (a.sort_order || 0) - (b.sort_order || 0)
    })
    
    return filtered
  } catch (error) {
    console.error('读取行程内容JSON文件失败:', error)
    return []
  }
}

const saveTripItemToFile = (tripId, itemData) => {
  try {
    ensureDataDir()
    const items = readTripItemsFromFile(tripId)
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...itemData,
      trip_id: tripId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    items.push(newItem)
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(items, null, 2), 'utf-8')
    return newItem
  } catch (error) {
    console.error('保存行程内容JSON文件失败:', error)
    throw error
  }
}

const saveTripItemsByDateToFile = (tripId, date, theme, items) => {
  try {
    ensureDataDir()
    const allItems = readTripItemsFromFile(tripId)
    
    // 删除该日期下的所有项
    const filtered = allItems.filter(item => !(item.trip_id === tripId && item.date === date))
    
    // 添加新项
    const newItems = items.map((item, index) => ({
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
      ...item,
      trip_id: tripId,
      date,
      theme,
      sort_order: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
    
    const updatedItems = [...filtered, ...newItems]
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(updatedItems, null, 2), 'utf-8')
    return newItems
  } catch (error) {
    console.error('批量保存行程内容JSON文件失败:', error)
    throw error
  }
}

const updateTripItemInFile = (tripId, itemId, updates) => {
  try {
    ensureDataDir()
    const allItems = readTripItemsFromFile(tripId)
    const index = allItems.findIndex(item => item.id === itemId && item.trip_id === tripId)
    
    if (index === -1) {
      throw new Error('行程内容不存在')
    }
    
    allItems[index] = {
      ...allItems[index],
      ...updates,
      updated_at: new Date().toISOString()
    }
    
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(allItems, null, 2), 'utf-8')
    return allItems[index]
  } catch (error) {
    console.error('更新行程内容JSON文件失败:', error)
    throw error
  }
}

const deleteTripItemFromFile = (tripId, itemId) => {
  try {
    ensureDataDir()
    const allItems = readTripItemsFromFile(tripId)
    const filtered = allItems.filter(item => !(item.id === itemId && item.trip_id === tripId))
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程内容JSON文件失败:', error)
    throw error
  }
}

const deleteTripItemsFromFile = (tripId) => {
  try {
    ensureDataDir()
    const allItems = readTripItemsFromFile(tripId)
    const filtered = allItems.filter(item => item.trip_id !== tripId)
    fs.writeFileSync(TRIP_ITEMS_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('删除行程内容JSON文件失败:', error)
    throw error
  }
}

// ==================== 导出存储模式信息 ====================

/**
 * 获取当前存储模式
 */
export const getStorageMode = () => STORAGE_MODE

/**
 * 检查是否为Supabase模式
 */
export const isSupabaseMode = () => STORAGE_MODE === 'supabase'

/**
 * 检查是否为本地模式
 */
export const isLocalMode = () => STORAGE_MODE === 'local'

