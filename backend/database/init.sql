-- TripSync 数据库初始化脚本
-- 在Supabase SQL编辑器中执行此脚本创建所需的数据表

-- 创建攻略表
CREATE TABLE IF NOT EXISTS guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用Row Level Security（行级安全）
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取攻略
CREATE POLICY "允许所有人读取攻略" ON guides
  FOR SELECT USING (true);

-- 创建策略：允许所有人创建攻略
CREATE POLICY "允许所有人创建攻略" ON guides
  FOR INSERT WITH CHECK (true);

-- 创建策略：允许所有人更新攻略
CREATE POLICY "允许所有人更新攻略" ON guides
  FOR UPDATE USING (true);

-- 创建策略：允许所有人删除攻略
CREATE POLICY "允许所有人删除攻略" ON guides
  FOR DELETE USING (true);

-- 创建更新时间触发器（自动更新updated_at字段）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入示例数据（可选）
INSERT INTO guides (title, description, location, content) VALUES
('日本东京旅游攻略', '探索东京的必游景点和美食', '东京, 日本', '东京是日本的首都，拥有丰富的文化和美食。推荐景点：浅草寺、东京塔、新宿御苑等。'),
('巴黎浪漫之旅', '感受巴黎的浪漫与艺术', '巴黎, 法国', '巴黎是浪漫之都，拥有埃菲尔铁塔、卢浮宫等世界著名景点。'),
('泰国曼谷美食之旅', '品尝正宗的泰式美食', '曼谷, 泰国', '曼谷是美食天堂，街头小吃丰富多样，价格实惠。');


