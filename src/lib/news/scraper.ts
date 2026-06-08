import * as cheerio from 'cheerio';

export type RawNewsItem = {
  title: string;
  url: string;
  source: string;
  published_at: Date;
  raw_content: string;
};

// Hàm cào RSS từ VnEconomy (Chuyên mục Tài chính)
export async function scrapeVnEconomyRSS(): Promise<RawNewsItem[]> {
  try {
    const rssUrl = "https://vneconomy.vn/tai-chinh.rss";
    const response = await fetch(rssUrl, { next: { revalidate: 3600 } });
    
    if (!response.ok) throw new Error("Failed to fetch VnEconomy RSS");
    
    const xmlData = await response.text();
    const $ = cheerio.load(xmlData, { xmlMode: true });
    
    const newsItems: RawNewsItem[] = [];
    
    // Lấy 5 bài báo mới nhất
    $('item').slice(0, 5).each((_, element) => {
      const title = $(element).find('title').text();
      const url = $(element).find('link').text();
      const pubDateStr = $(element).find('pubDate').text();
      const description = $(element).find('description').text();
      
      newsItems.push({
        title: title.trim(),
        url: url.trim(),
        source: 'VnEconomy',
        published_at: new Date(pubDateStr),
        raw_content: description.replace(/(<([^>]+)>)/gi, "").trim() // Bỏ HTML tags
      });
    });
    
    return newsItems;
  } catch (error) {
    console.error("Scrape VnEconomy Error:", error);
    return [];
  }
}

// Hàm cào RSS từ CafeF (Chuyên mục Tài chính - Ngân hàng)
export async function scrapeCafeFRSS(): Promise<RawNewsItem[]> {
  try {
    const rssUrl = "https://cafef.vn/tai-chinh-ngan-hang.rss";
    const response = await fetch(rssUrl, { next: { revalidate: 3600 } });
    
    if (!response.ok) throw new Error("Failed to fetch CafeF RSS");
    
    const xmlData = await response.text();
    const $ = cheerio.load(xmlData, { xmlMode: true });
    
    const newsItems: RawNewsItem[] = [];
    
    $('item').slice(0, 5).each((_, element) => {
      const title = $(element).find('title').text();
      const url = $(element).find('link').text();
      const pubDateStr = $(element).find('pubDate').text();
      const description = $(element).find('description').text();
      
      newsItems.push({
        title: title.trim(),
        url: url.trim(),
        source: 'CafeF',
        published_at: new Date(pubDateStr),
        raw_content: description.replace(/(<([^>]+)>)/gi, "").trim()
      });
    });
    
    return newsItems;
  } catch (error) {
    console.error("Scrape CafeF Error:", error);
    return [];
  }
}
