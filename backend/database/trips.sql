-- 行程管理表
-- 在Supabase SQL编辑器中执行此脚本创建行程相关表

-- 创建行程表
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_name VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 【新增1】创建行程内容表（手动录入的行程项）
CREATE TABLE IF NOT EXISTS trip_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_name VARCHAR(255) NOT NULL COMMENT '地点名称',
  address TEXT COMMENT '地址',
  description TEXT COMMENT '描述',
  duration VARCHAR(50) COMMENT '耗时，如"2小时"',
  budget VARCHAR(50) COMMENT '预算，如"100元"',
  notes TEXT COMMENT '备注',
  day_number INTEGER NOT NULL DEFAULT 1 COMMENT '天数，如1表示Day1',
  sort_order INTEGER NOT NULL DEFAULT 0 COMMENT '排序，数字越小越靠前',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建行程-站点关联表
CREATE TABLE IF NOT EXISTS trip_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES xhs_sites(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1 COMMENT '天数，如1表示Day1',
  sort_order INTEGER NOT NULL DEFAULT 0 COMMENT '排序，数字越小越靠前',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, site_id, day_number) -- 防止重复添加
);

-- 添加表注释
COMMENT ON TABLE trips IS '行程表';
COMMENT ON COLUMN trips.trip_name IS '行程名称';
COMMENT ON COLUMN trips.start_date IS '开始日期';
COMMENT ON COLUMN trips.end_date IS '结束日期';
COMMENT ON COLUMN trips.notes IS '备注';

COMMENT ON TABLE trip_sites IS '行程-第三方攻略关联表';
COMMENT ON COLUMN trip_sites.day_number IS '天数，如1表示Day1';
COMMENT ON COLUMN trip_sites.sort_order IS '排序，数字越小越靠前';

COMMENT ON TABLE trip_items IS '行程内容表（手动录入）';
COMMENT ON COLUMN trip_items.place_name IS '地点名称';
COMMENT ON COLUMN trip_items.address IS '地址';
COMMENT ON COLUMN trip_items.description IS '描述';
COMMENT ON COLUMN trip_items.duration IS '耗时';
COMMENT ON COLUMN trip_items.budget IS '预算';
COMMENT ON COLUMN trip_items.notes IS '备注';
COMMENT ON COLUMN trip_items.day_number IS '天数，如1表示Day1';
COMMENT ON COLUMN trip_items.sort_order IS '排序，数字越小越靠前';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_sites_trip_id ON trip_sites(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_sites_site_id ON trip_sites(site_id);
CREATE INDEX IF NOT EXISTS idx_trip_sites_day_number ON trip_sites(trip_id, day_number, sort_order);
CREATE INDEX IF NOT EXISTS idx_trip_items_trip_id ON trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_day_number ON trip_items(trip_id, day_number, sort_order);

-- 启用Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人操作行程
CREATE POLICY "允许所有人操作行程" ON trips
  FOR ALL USING (true);

-- 创建策略：允许所有人操作行程站点关联
CREATE POLICY "允许所有人操作行程站点关联" ON trip_sites
  FOR ALL USING (true);

-- 创建策略：允许所有人操作行程内容
CREATE POLICY "允许所有人操作行程内容" ON trip_items
  FOR ALL USING (true);

-- 创建更新时间触发器
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trip_items_updated_at BEFORE UPDATE ON trip_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

