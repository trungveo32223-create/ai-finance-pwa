-- ============================================================
-- MIGRATION 0002: Bảng Tin Tức & Chỉ số phái sinh (Phase 2)
-- ============================================================

-- Bảng Tin tức đã bóc tách (Gemini News Extractor)
CREATE TABLE IF NOT EXISTS news_digest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source VARCHAR(50) NOT NULL, -- cafef, vneconomy...
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Kết quả từ Gemini (AI Output)
    sentiment VARCHAR(20) NOT NULL, -- positive, negative, neutral
    impacted_entities TEXT[], -- Các mảng bị ảnh hưởng (BĐS, Ngân hàng...)
    summary TEXT NOT NULL, -- Tóm tắt 1 câu cốt lõi
    raw_content TEXT, -- (Optional) Text thô để debug
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Chỉ số phái sinh (Derived Indexes do AI/Hệ thống tự tính)
CREATE TABLE IF NOT EXISTS derived_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    index_key VARCHAR(50) NOT NULL, -- net_liquidity, shadow_tightening, real_estate_hype
    index_value DECIMAL(15, 4) NOT NULL,
    components JSONB, -- Chứa công thức hoặc các thành phần tạo nên chỉ số (để minh bạch)
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_digest(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_derived_index_key ON derived_indexes(index_key);

-- RLS
ALTER TABLE news_digest ENABLE ROW LEVEL SECURITY;
ALTER TABLE derived_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for news_digest" ON news_digest FOR SELECT USING (true);
CREATE POLICY "Public read access for derived_indexes" ON derived_indexes FOR SELECT USING (true);
