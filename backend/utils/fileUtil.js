/**
 * JSON 文件读写工具
 * 提供并发安全的文件读写方法，使用文件锁机制避免数据覆盖
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// 日志级别控制（可选：DEBUG/PROD）
const LOG_LEVEL = process.env.LOG_LEVEL || 'PROD';

// 日志辅助函数
function logInfo(msg) {
  if (LOG_LEVEL === 'DEBUG') console.log(msg);
}
function logWarn(msg) {
  console.warn(msg); // 警告始终打印
}
function logError(msg) {
  console.error(msg); // 错误始终打印
}

// 文件锁映射（内存锁，用于避免并发写入）
const fileLocks = new Map();

/**
 * 获取文件锁
 * @param {string} filePath 文件路径
 * @returns {Promise} Promise 对象
 */
async function acquireLock(filePath) {
  while (fileLocks.has(filePath)) {
    // 如果文件正在被写入，等待一小段时间后重试
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  fileLocks.set(filePath, true);
}

/**
 * 释放文件锁
 * @param {string} filePath 文件路径
 */
function releaseLock(filePath) {
  fileLocks.delete(filePath);
}

/**
 * 读取 JSON 文件
 * @param {string} filePath 文件路径（相对于 data 目录）
 * @returns {Promise<Object|Array>} 解析后的 JSON 数据
 */
async function readJsonFile(filePath) {
  const fullPath = path.join(__dirname, '../data', filePath);
  
  try {
    const data = await fs.readFile(fullPath, 'utf-8');
    const parsedData = JSON.parse(data);
    // 【简化】仅在文件数据为空时打印（去掉每次读取的长度日志）
    if (!parsedData || (Array.isArray(parsedData) && parsedData.length === 0)) {
      logInfo(`[fileUtil] ${filePath} 数据为空，初始化默认值`);
    }
    return parsedData;
  } catch (error) {
    // 【保留】错误日志（含路径，方便定位）
    if (error.code === 'ENOENT') {
      const isArrayType = /s\.json$/.test(filePath);
      logWarn(`[fileUtil] ${filePath} 不存在，返回默认值`);
      return isArrayType ? [] : {};
    }
    if (error instanceof SyntaxError) {
      logError(`[fileUtil] ${filePath} JSON格式错误: ${error.message}`);
      // 修复：格式错误时备份原文件并返回空数据（避免阻断流程）
      try {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        if (fsSync.existsSync(fullPath)) {
          fsSync.copyFileSync(fullPath, backupPath);
          logWarn(`[fileUtil] 已备份错误文件到${backupPath}`);
        }
      } catch (backupErr) {
        logError(`[fileUtil] 备份文件失败: ${backupErr.message}`);
      }
      const isArrayType = /s\.json$/.test(filePath);
      return isArrayType ? [] : {};
    }
    throw error;
  }
}

/**
 * 写入 JSON 文件（并发安全）
 * @param {string} filePath 文件路径（相对于 data 目录）
 * @param {Object|Array} data 要写入的数据
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, data) {
  const fullPath = path.join(__dirname, '../data', filePath);
  
  // 确保目录存在
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  
  // 获取文件锁
  await acquireLock(filePath);
  
  try {
    // 直接写入数据（writeJsonFile 用于完全覆盖，appendToJsonArray 用于追加）
    const dataToWrite = data;
    
    // 写入文件（使用临时文件确保原子性）
    const tempPath = fullPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(dataToWrite, null, 2), 'utf-8');
    await fs.rename(tempPath, fullPath);
  } finally {
    // 释放文件锁
    releaseLock(filePath);
  }
}

/**
 * 追加数据到 JSON 数组文件（并发安全）
 * @param {string} filePath 文件路径（相对于 data 目录）
 * @param {Object} item 要追加的项
 * @returns {Promise<void>}
 */
async function appendToJsonArray(filePath, item) {
  const fullPath = path.join(__dirname, '../data', filePath);
  
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await acquireLock(filePath);
  
  try {
    let data = [];
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      data = JSON.parse(content);
    } catch (readErr) {
      // 【简化】读取失败时仅打印一次警告
      if (readErr.code === 'ENOENT' || readErr instanceof SyntaxError) {
        data = [];
        logWarn(`[fileUtil] ${filePath} 读取失败，初始化空数组`);
      } else {
        throw readErr;
      }
    }
    
    data.push(item);
    
    // 【保留】仅打印"追加成功"的关键日志（去掉长度对比）
    const tempPath = fullPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, fullPath);
    console.log(`[fileUtil] 成功追加数据到 ${filePath}`);
  } finally {
    releaseLock(filePath);
  }
}

/**
 * 更新 JSON 数组中的某个项（并发安全）
 * @param {string} filePath 文件路径
 * @param {string} idKey ID 字段名（如 'userId', 'tripId'）
 * @param {string} idValue ID 值
 * @param {Object} updateData 要更新的数据
 * @returns {Promise<boolean>} 是否更新成功
 */
async function updateJsonArrayItem(filePath, idKey, idValue, updateData) {
  const fullPath = path.join(__dirname, '../data', filePath);
  
  await acquireLock(filePath);
  
  try {
    let data;
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      data = JSON.parse(content);
    } catch {
      return false;
    }
    
    const index = data.findIndex(item => item[idKey] === idValue);
    if (index === -1) {
      return false;
    }
    
    data[index] = { ...data[index], ...updateData };
    
    const tempPath = fullPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, fullPath);
    
    return true;
  } finally {
    releaseLock(filePath);
  }
}

/**
 * 查找 JSON 数组中的某个项
 * @param {string} filePath 文件路径
 * @param {string} idKey ID 字段名
 * @param {string} idValue ID 值
 * @returns {Promise<Object|null>}
 */
async function findJsonArrayItem(filePath, idKey, idValue) {
  const data = await readJsonFile(filePath);
  return data.find(item => item[idKey] === idValue) || null;
}

/**
 * 从 JSON 数组中删除某个项（并发安全）
 * @param {string} filePath 文件路径
 * @param {string} idKey ID 字段名（如 'collectionId', 'tripId'）
 * @param {string} idValue ID 值
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteJsonArrayItem(filePath, idKey, idValue) {
  const fullPath = path.join(__dirname, '../data', filePath);
  
  await acquireLock(filePath);
  
  try {
    let data;
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      data = JSON.parse(content);
    } catch {
      return false;
    }
    
    const index = data.findIndex(item => item[idKey] === idValue);
    if (index === -1) {
      return false;
    }
    
    data.splice(index, 1);
    
    const tempPath = fullPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, fullPath);
    
    return true;
  } finally {
    releaseLock(filePath);
  }
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  appendToJsonArray,
  updateJsonArrayItem,
  findJsonArrayItem,
  deleteJsonArrayItem
};

