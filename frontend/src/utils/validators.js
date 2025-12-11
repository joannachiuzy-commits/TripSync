/**
 * 表单验证工具函数
 * 封装重复验证逻辑
 */

/**
 * 验证单日行程表单
 * @param {object} dayForm - 单日行程表单数据
 * @param {object} dayForm.date - 日期
 * @param {Array} dayForm.items - 行程站点数组
 * @returns {{valid: boolean, error: string}} 验证结果
 */
export const validateDayForm = (dayForm) => {
  // 验证日期
  if (!dayForm.date || !dayForm.date.trim()) {
    return {
      valid: false,
      error: '日期不能为空'
    }
  }

  // 验证至少需要一个站点
  if (!dayForm.items || dayForm.items.length === 0) {
    return {
      valid: false,
      error: '至少需要一个行程站点'
    }
  }

  // 验证所有站点都有地点名称
  for (let i = 0; i < dayForm.items.length; i++) {
    const item = dayForm.items[i]
    if (!item.place_name || !item.place_name.trim()) {
      return {
        valid: false,
        error: `第${i + 1}个站点的地点名称不能为空`
      }
    }
  }

  return {
    valid: true,
    error: ''
  }
}

/**
 * 验证行程基本信息
 * @param {object} trip - 行程数据
 * @param {string} trip.trip_name - 行程名称
 * @returns {{valid: boolean, error: string}} 验证结果
 */
export const validateTripInfo = (trip) => {
  if (!trip.trip_name || !trip.trip_name.trim()) {
    return {
      valid: false,
      error: '行程名称不能为空'
    }
  }

  return {
    valid: true,
    error: ''
  }
}

/**
 * 验证站点信息
 * @param {object} site - 站点数据
 * @param {string} site.site_name - 站点名称
 * @returns {{valid: boolean, error: string}} 验证结果
 */
export const validateSiteInfo = (site) => {
  if (!site.site_name || !site.site_name.trim()) {
    return {
      valid: false,
      error: '站点名称不能为空'
    }
  }

  return {
    valid: true,
    error: ''
  }
}


