import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFredIndicator } from '@/lib/crawlers/fred';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1. Xác thực Request đến từ Vercel Cron (Bảo mật)
  const authHeader = request.headers.get('authorization');
  const expectedAuthHeader = `Bearer ${process.env.CRON_SECRET}`;
  
  const url = new URL(request.url);
  const isTest = url.searchParams.get('test') === 'true';

  if (!isTest) {
    if (!process.env.CRON_SECRET) {
      console.warn("CRON_SECRET is not set in environment variables. Running without auth check.");
    } else if (authHeader !== expectedAuthHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log("Starting FRED Macro Data Crawler...");

  // 2. Cấu hình Supabase Admin Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 3. Danh sách các chỉ báo Hằng Số Vĩ Mô (Constants) cần crawl
  const SERIES_CONFIG: Record<string, { units: string }> = {
    "M2SL":        { units: "pc1" },
    "WALCL":       { units: "lin" },
    "WTREGEN":     { units: "lin" },
    "RRPONTSYD":   { units: "lin" },
    "T10Y2Y":      { units: "lin" },
    "SAHMREALTIME":{ units: "lin" },
    "BAMLH0A0HYM2":{ units: "lin" },
    "CPIAUCSL":    { units: "pc1" },
    "FEDFUNDS":    { units: "lin" },
    "DTWEXBGS":    { units: "lin" },
    "DGS10":       { units: "lin" },
    "DGS2":        { units: "lin" },
    "UNRATE":      { units: "lin" },
    "PCEPI":       { units: "pc1" },
    "GDPC1":       { units: "pc1" },
  };
  
  const results = [];

  // 4. Kéo dữ liệu và lưu vào Database
  for (const [seriesId, config] of Object.entries(SERIES_CONFIG)) {
    const data = await fetchFredIndicator(seriesId, config.units);
    
    if (data) {
      // Upsert vào Supabase
      // Lưu ý: Chúng ta lưu indicator_key là DUY NHẤT cho lần lấy mới nhất, 
      // hoặc insert một record mới theo ngày. 
      // Để theo dõi biểu đồ lịch sử, ta dùng insert (không upsert).
      const { error } = await supabase
        .from('market_data')
        .insert({
          indicator_key: data.indicator_key,
          indicator_value: data.indicator_value,
          source: data.source,
          is_stale: data.is_stale,
          recorded_at: data.recorded_at.toISOString(),
        });

      if (error) {
        console.error(`Supabase DB Error for ${seriesId}:`, error);
        results.push({ seriesId, status: 'failed', error: error.message });
      } else {
        results.push({ seriesId, status: 'success', value: data.indicator_value, stale: data.is_stale });
      }
    } else {
      results.push({ seriesId, status: 'failed', error: 'fetch_or_validation_failed' });
    }
  }

  // 5. Tính toán chỉ số phái sinh: Net Liquidity (Thanh khoản ròng)
  // Công thức: Net Liquidity = WALCL - WTREGEN - RRPONTSYD
  // Chú ý: WALCL và WTREGEN đơn vị là Triệu USD. RRPONTSYD đơn vị là Tỷ USD -> phải nhân 1000
  const getVal = (id: string) => results.find(r => r.seriesId === id && r.status === 'success')?.value;
  const walcl = getVal("WALCL");
  const tga = getVal("WTREGEN");
  const rrp = getVal("RRPONTSYD");

  if (walcl !== undefined && tga !== undefined && rrp !== undefined) {
    const netLiq = walcl - tga - (rrp * 1000);
    const { error } = await supabase.from('market_data').insert({
      indicator_key: "NET_LIQUIDITY",
      indicator_value: netLiq,
      source: "FRED_DERIVED",
      is_stale: false,
      recorded_at: new Date().toISOString()
    });
    if (!error) {
      results.push({ seriesId: "NET_LIQUIDITY", status: "success", value: netLiq, stale: false });
    }
  }

  console.log("FRED Crawler Finished.", results);

  return NextResponse.json({
    success: true,
    message: 'Crawl operation completed',
    results,
  });
}
