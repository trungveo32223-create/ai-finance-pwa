import { z } from "zod";

const FredResponseSchema = z.object({
  observations: z
    .array(
      z.object({
        date: z.string(),
        value: z.string(),
      })
    )
    .min(1),
});

export type FredData = {
  indicator_key: string;
  indicator_value: number;
  source: string;
  is_stale: boolean;
  recorded_at: Date;
};

// Hàm hỗ trợ kiểm tra Data Freshness (quá 24h là stale)
function isDataStale(dateString: string): boolean {
  const recordDate = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60);
  
  // FRED thường có độ trễ công bố dữ liệu (ví dụ: M2 cập nhật theo tháng).
  // Tuy nhiên, đối với yêu cầu MECE, ta strict check xem data có được kéo mới nhất không.
  // Thực tế, FRED API date là ngày của dữ liệu, KHÔNG PHẢI ngày kéo. 
  // Để chính xác, ta so sánh ngày lấy dữ liệu với "bây giờ". 
  // Trong trường hợp này, "is_stale" ám chỉ dữ liệu kéo về đã quá cũ so với thời điểm hiện hành.
  // Ở đây cấu hình tạm thời là > 720h (1 tháng) cho M2, còn daily indicator thì > 48h.
  return diffInHours > 720; 
}

export async function fetchFredIndicator(seriesId: string, units: string = "lin"): Promise<FredData | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.error("Missing FRED_API_KEY in environment variables.");
    return null;
  }

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=1&sort_order=desc&units=${units}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 }, // Không cache, luôn fetch mới khi gọi
    });

    if (!response.ok) {
      throw new Error(`FRED API Error: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();
    
    // Gate 2: Schema Validation (Zod)
    const parsedData = FredResponseSchema.safeParse(rawData);
    
    if (!parsedData.success) {
      console.error(`Invalid schema returned for ${seriesId}:`, parsedData.error);
      return null;
    }

    const latestObservation = parsedData.data.observations[0];
    
    // Gate 3: No Hallucination - nếu value là '.' (FRED trả '.' cho dữ liệu missing)
    if (latestObservation.value === ".") {
      console.warn(`FRED returned '.' (missing data) for ${seriesId}`);
      return null;
    }

    const numericValue = parseFloat(latestObservation.value);
    
    if (isNaN(numericValue)) {
      console.error(`Parsed value is NaN for ${seriesId}: ${latestObservation.value}`);
      return null;
    }

    // Xác định stale rule tùy vào indicator. (T10Y2Y là daily, M2SL là monthly)
    let staleCheck = false;
    const now = new Date();
    const obsDate = new Date(latestObservation.date);
    const diffHours = (now.getTime() - obsDate.getTime()) / (1000 * 60 * 60);

    const DAILY = ["T10Y2Y","BAMLH0A0HYM2","DGS10","DGS2","DTWEXBGS","RRPONTSYD"];
    const staleLimit = DAILY.includes(seriesId) ? 96 : 1100; // 96h (4 ngày) cho Daily, 1100h (45 ngày) cho Monthly
    staleCheck = diffHours > staleLimit;

    return {
      indicator_key: seriesId,
      indicator_value: numericValue,
      source: "FRED",
      is_stale: staleCheck,
      recorded_at: new Date(), // Thời điểm CRAWL
    };

  } catch (error) {
    console.error(`Failed to fetch ${seriesId} from FRED:`, error);
    return null;
  }
}
