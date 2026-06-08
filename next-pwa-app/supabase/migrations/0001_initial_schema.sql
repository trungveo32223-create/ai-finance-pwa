-- =====================================================================================
-- KỊCH BẢN TÍCH HỢP: CHỈ TẠO CÁC BẢNG NEW MODULE (Thị trường & AI)
-- =====================================================================================

-- Bật extension cho UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PHẦN 1: BẢNG DỮ LIỆU THỊ TRƯỜNG (NEW MODULE)
-- ============================================================

-- Bảng Dữ liệu Vĩ mô (Được Crawler tự động cập nhật)
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_key VARCHAR(50) NOT NULL, -- M2SL, T10Y2Y, SAHMREALTIME
    indicator_value DECIMAL(15, 4) NOT NULL,
    source VARCHAR(50) NOT NULL, -- FRED, Binance...
    is_stale BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Lịch sử Tranh luận (Debates)
CREATE TABLE IF NOT EXISTS debates_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Giữ nguyên UUID để sau này map với auth.users của sếp
    question_context TEXT NOT NULL,
    architect_opinion TEXT,
    wealth_opinion TEXT,
    mogul_opinion TEXT,
    commissar_opinion TEXT,
    psychologist_opinion TEXT,
    banker_opinion TEXT,
    lawyer_opinion TEXT,
    monitor_conclusion TEXT NOT NULL,
    confidence_score DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng Trạng thái Chu kỳ (Cycle State)
CREATE TABLE IF NOT EXISTS cycle_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    current_phase VARCHAR(50) NOT NULL,
    policy_wind VARCHAR(20) NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_market_data_key ON market_data(indicator_key);
CREATE INDEX IF NOT EXISTS idx_debates_log_user ON debates_log(user_id);

-- Row Level Security
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_state ENABLE ROW LEVEL SECURITY;

-- Note: Để mọi người có thể đọc market_data (vì nó là data public)
CREATE POLICY "Public read access for market_data" ON market_data FOR SELECT USING (true);
CREATE POLICY "Public read access for cycle_state" ON cycle_state FOR SELECT USING (true);

