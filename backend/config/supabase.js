import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 加载环境变量（确保在创建客户端前执行）
dotenv.config()

// 从环境变量读取Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url'
const supabaseKey = process.env.SUPABASE_KEY || 'your-supabase-key'

// 创建Supabase客户端实例
export const supabase = createClient(supabaseUrl, supabaseKey)

// 说明：此文件被后端服务直接导入
/**
 * 


/**
 * 数据库表结构示例（在Supabase SQL编辑器中执行）：
 * 
 * CREATE TABLE guides (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   title VARCHAR(255) NOT NULL,
 *   description TEXT NOT NULL,
 *   location VARCHAR(255) NOT NULL,
 *   content TEXT,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * -- 启用Row Level Security（行级安全）
 * ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
 * 
 * -- 创建策略：允许所有人读取
 * CREATE POLICY "允许所有人读取攻略" ON guides
 *   FOR SELECT USING (true);
 * 
 * -- 创建策略：允许所有人插入（可根据需要修改）
 * CREATE POLICY "允许所有人创建攻略" ON guides
 *   FOR INSERT WITH CHECK (true);
 * 
 * -- 创建策略：允许所有人更新（可根据需要修改）
 * CREATE POLICY "允许所有人更新攻略" ON guides
 *   FOR UPDATE USING (true);
 * 
 * -- 创建策略：允许所有人删除（可根据需要修改）
 * CREATE POLICY "允许所有人删除攻略" ON guides
 *   FOR DELETE USING (true);
 */

