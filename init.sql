-- Chạy toàn bộ Script này trong mục SQL Editor của Supabase

-- 1. Tạo bảng Danh Mục (Categories)
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phan_loai TEXT NOT NULL,
    lv1 TEXT NOT NULL,
    lv2 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tạo bảng Đối Tác (Partners)
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tạo bảng Giao Dịch (Transactions)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_date DATE NOT NULL,
    phan_loai TEXT NOT NULL,
    lv1 TEXT NOT NULL,
    lv2 TEXT NOT NULL,
    so_tien NUMERIC NOT NULL,
    ghi_chu TEXT,
    ma_bp TEXT,
    raw_text TEXT, -- Câu chat gốc của user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Bật Row Level Security (RLS) cho tất cả các bảng
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Cấp quyền: Vì đây là app nội bộ chạy API qua Service Role Key, 
-- ta tạm thời có thể tạo Policy cho phép đọc/ghi từ API (anon key) nếu cần,
-- hoặc cấp full quyền cho authenticated users.
-- Tạm thời cấp quyền ĐỌC/GHI tự do (Chỉ dùng cho bước Prototype này, sau này gắn Auth sẽ sửa lại)
CREATE POLICY "Cho phép truy cập tự do tạm thời" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Cho phép truy cập tự do tạm thời" ON public.categories FOR ALL USING (true);
CREATE POLICY "Cho phép truy cập tự do tạm thời" ON public.partners FOR ALL USING (true);

-- 6. Insert data mẫu cho Categories
INSERT INTO public.categories (phan_loai, lv1, lv2) VALUES 
('Chi phí', 'Ăn uống', 'Ăn uống'),
('Chi phí', 'Đi lại', 'Xăng xe'),
('Thu nhập', 'Tiền lương', 'Tiền lương');

-- 7. Insert data mẫu cho Partners
INSERT INTO public.partners (code, name) VALUES 
('BP-001', 'Tùng'),
('BP-002', 'Đức'),
('BP-003', 'Phước');
