import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapeVnEconomyRSS, scrapeCafeFRSS } from '@/lib/news/scraper';
import { extractNewsLogicWithGemini } from '@/lib/news/gemini_extractor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isTest = url.searchParams.get('test') === 'true';

  if (!isTest) {
    const authHeader = request.headers.get('authorization');
    const expectedAuthHeader = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET) {
      console.warn("CRON_SECRET is not set.");
    } else if (authHeader !== expectedAuthHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting Daily Sync (Phase 2)...");
  
  // 1. Cào tin tức thô
  const vneNews = await scrapeVnEconomyRSS();
  const cafefNews = await scrapeCafeFRSS();
  const allNews = [...vneNews, ...cafefNews];
  
  const processedNews: any[] = [];

  // 2. Chạy Gemini bóc tách từng tin
  for (const item of allNews) {
    // Kiểm tra xem tin đã tồn tại trong DB chưa (dựa trên URL)
    const { data: existing } = await supabase
      .from('news_digest')
      .select('id')
      .eq('url', item.url)
      .single();
      
    if (existing) {
      continue; // Đã cào và phân tích rồi thì bỏ qua
    }

    const aiAnalysis = await extractNewsLogicWithGemini(item.title, item.raw_content);
    
    if (aiAnalysis) {
      const { error } = await supabase
        .from('news_digest')
        .insert({
          title: item.title,
          url: item.url,
          source: item.source,
          published_at: item.published_at.toISOString(),
          sentiment: aiAnalysis.sentiment,
          impacted_entities: aiAnalysis.impacted_entities,
          summary: aiAnalysis.summary,
          raw_content: item.raw_content,
        });

      if (!error) {
        processedNews.push({ title: item.title, analysis: aiAnalysis });
      } else {
        console.error("Lỗi insert news:", error);
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Daily Sync Phase 2 completed',
    news_processed: processedNews.length,
    results: processedNews
  });
}
