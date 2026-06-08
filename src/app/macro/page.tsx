import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase (Server Component)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Vì đây là Server Component (chạy trên server), ta dùng luôn SERVICE_ROLE_KEY để bypass RLS (Row Level Security)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const revalidate = 60; // Cache 60 giây

export default async function MacroDashboard() {
  // Lấy dữ liệu mới nhất từ market_data
  const { data: indicators, error } = await supabase
    .from('market_data')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Lỗi lấy dữ liệu:", error);
  }

  // Lọc ra các chỉ số mới nhất (distinct)
  const latestData = new Map();
  if (indicators) {
    indicators.forEach((ind: any) => {
      if (!latestData.has(ind.indicator_key)) {
        latestData.set(ind.indicator_key, ind);
      }
    });
  }

  const getIndicator = (key: string) => latestData.get(key);

  const yieldCurve = getIndicator('T10Y2Y');
  const sahmRule = getIndicator('SAHMREALTIME');
  const m2 = getIndicator('M2SL');

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a1a2e] p-8 font-serif">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 border-b-2 border-[#1a1a2e] pb-6">
          <div className="text-xs uppercase tracking-[0.3em] font-mono mb-2 text-gray-500">
            PHASE 1 USE CASE
          </div>
          <h1 className="text-4xl font-extrabold mb-4">Macro Intelligence Dashboard</h1>
          <p className="text-lg opacity-80 italic">
            Dữ liệu vĩ mô thời gian thực được lấy tự động từ Federal Reserve (FRED) qua Vercel Cron.
          </p>
        </header>

        {(!yieldCurve && !sahmRule && !m2) ? (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-6 text-yellow-900 font-mono text-sm">
            Hệ thống chưa có dữ liệu. Hãy chạy Crawler bằng cách gọi API /api/cron/crawl-fred với CRON_SECRET.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* T10Y2Y */}
            <div className={`p-6 border-2 border-[#1a1a2e] rounded-xl shadow-[4px_4px_0_#1a1a2e] ${yieldCurve?.indicator_value < 0 ? 'bg-red-50' : 'bg-white'}`}>
              <h2 className="text-sm uppercase font-mono font-bold mb-2">Đường cong lợi suất</h2>
              <div className="text-3xl font-black mb-1">{yieldCurve?.indicator_value || 'N/A'}%</div>
              <div className="text-xs font-mono text-gray-500">Mã: T10Y2Y</div>
              {yieldCurve?.indicator_value < 0 && (
                <div className="mt-4 text-xs font-bold text-red-600 bg-red-100 p-2 rounded">
                  CẢNH BÁO: Đảo ngược (Recession Indicator)
                </div>
              )}
            </div>

            {/* SAHM RULE */}
            <div className={`p-6 border-2 border-[#1a1a2e] rounded-xl shadow-[4px_4px_0_#1a1a2e] ${sahmRule?.indicator_value >= 0.5 ? 'bg-red-50' : 'bg-white'}`}>
              <h2 className="text-sm uppercase font-mono font-bold mb-2">Sahm Rule (Suy thoái)</h2>
              <div className="text-3xl font-black mb-1">{sahmRule?.indicator_value || 'N/A'}</div>
              <div className="text-xs font-mono text-gray-500">Mã: SAHMREALTIME</div>
              {sahmRule?.indicator_value >= 0.5 && (
                <div className="mt-4 text-xs font-bold text-red-600 bg-red-100 p-2 rounded">
                  CẢNH BÁO: Kinh tế bước vào suy thoái
                </div>
              )}
            </div>

            {/* M2SL */}
            <div className={`p-6 border-2 border-[#1a1a2e] rounded-xl shadow-[4px_4px_0_#1a1a2e] ${m2?.indicator_value < 0 ? 'bg-red-50' : 'bg-white'}`}>
              <h2 className="text-sm uppercase font-mono font-bold mb-2">Cung Tiền (M2) YoY</h2>
              <div className="text-3xl font-black mb-1">
                {m2 ? `${m2.indicator_value.toFixed(2)}%` : 'N/A'}
              </div>
              <div className="text-xs font-mono text-gray-500">Mã: M2SL (% YoY)</div>
            </div>

          </div>
        )}

        <footer className="mt-16 text-center text-xs font-mono text-gray-400">
          Hệ thống chạy tự động vào 03:00 sáng mỗi ngày. Được phân tích bởi MECE Framework.
        </footer>
      </div>
    </div>
  );
}
