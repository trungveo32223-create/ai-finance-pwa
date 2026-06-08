import { supabase } from '../supabase';
import { RouterResponse } from './types';

// Hàm lấy thời gian hiện tại theo UTC+7
function nowVN() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

function computeDateRange(period?: string, n: number = 7, explicitDate?: string) {
  const now = nowVN();
  let start = new Date(now);
  let end = new Date(now);

  if (explicitDate) {
    if (explicitDate === "today") {
      // Do nothing, uses 'now'
    } else if (explicitDate === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else {
      const parts = explicitDate.split('-');
      if (parts.length === 3) {
        start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        end = new Date(start);
      }
    }
  } else {
    switch (period) {
      case "this_week": {
        const dow = now.getDay();
        const back = dow === 0 ? 6 : dow - 1;
        start.setDate(start.getDate() - back);
        end.setDate(start.getDate() + 6);
        break;
      }
      case "last_week": {
        const dow = now.getDay();
        const back = dow === 0 ? 6 : dow - 1;
        end.setDate(end.getDate() - back - 1);
        start.setDate(end.getDate() - 6);
        break;
      }
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "this_year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case "last_n_days":
        start.setDate(start.getDate() - (n - 1));
        break;
    }
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toVNTimestamp(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}+07`;
}

function getPeriodTitle(period?: string, explicitDate?: string) {
  if (explicitDate === "today") return "Hôm nay";
  if (explicitDate === "yesterday") return "Hôm qua";
  if (explicitDate) return `Ngày ${explicitDate}`;
  switch(period) {
    case "this_week": return "Tuần này";
    case "last_week": return "Tuần trước";
    case "this_month": return "Tháng này";
    case "last_month": return "Tháng trước";
    case "this_year": return "Năm nay";
    default: return "Kỳ báo cáo";
  }
}

export async function processQuery(params: RouterResponse): Promise<any> {
  const { query_type, person, date, period, n } = params;

  // Xử lý nợ (Debt Query)
  if (query_type === 'debt') {
    if (!person) return { error: "Vui lòng cung cấp tên người cần tra cứu công nợ." };
    
    const [aggRes, rawRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('sub_type, so_tien')
        .eq('ma_bp', person)
        .in('sub_type', ['Borrow', 'Lend', 'RepayPrincipal', 'CollectPrincipal']),
        
      supabase
        .from('transactions')
        .select('tx_date, phan_loai, sub_type, so_tien, ghi_chu, ma_bp')
        .eq('ma_bp', person)
        .in('sub_type', ['Borrow', 'Lend', 'RepayPrincipal', 'CollectPrincipal'])
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    if (aggRes.error) return { error: `Lỗi truy vấn dữ liệu: ${aggRes.error.message}` };
    
    let duNo = 0;
    for (const tx of aggRes.data) {
      if (tx.sub_type === 'Lend' || tx.sub_type === 'RepayPrincipal') duNo += tx.so_tien;
      if (tx.sub_type === 'Borrow' || tx.sub_type === 'CollectPrincipal') duNo -= tx.so_tien;
    }
    
    let summaryText = "";
    if (duNo === 0) summaryText = `Hiện tại sếp và **${person}** không nợ nần gì nhau (Dư nợ = 0).`;
    else if (duNo > 0) summaryText = `Tổng kết: **${person} đang nợ sếp ${duNo.toLocaleString('vi-VN')} đ**.`;
    else summaryText = `Tổng kết: **Sếp đang nợ ${person} ${Math.abs(duNo).toLocaleString('vi-VN')} đ**.`;

    return {
      type: 'debt',
      message: summaryText,
      raw_data: rawRes.data || [],
      total_count: aggRes.data.length
    };
  }
  
  // Xử lý báo cáo (Metric/Daily Query)
  if (query_type === 'daily' || query_type === 'metric') {
    const { start, end } = computeDateRange(period, n, date);
    const title = getPeriodTitle(period, date);
    const endPlusOne = new Date(end.getTime() + 1);

    const startTs = toVNTimestamp(start);
    const endTs = toVNTimestamp(endPlusOne);

    // Chạy song song 2 Query CÙNG WHERE CLAUSE
    const [aggRes, rawRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('phan_loai, sub_type, so_tien')
        .gte('created_at', startTs)
        .lt('created_at', endTs),
        
      supabase
        .from('transactions')
        .select('tx_date, phan_loai, lv2, so_tien, ghi_chu, ma_bp')
        .gte('created_at', startTs)
        .lt('created_at', endTs)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    if (aggRes.error) return { error: `Lỗi truy vấn: ${aggRes.error.message}` };

    let thu = 0, chi = 0, tietKiem = 0, dauTu = 0;

    for (const tx of aggRes.data) {
      const p = tx.phan_loai;
      const s = tx.sub_type;
      const tien = tx.so_tien;

      if (p === "Thu nhập" || s === "CollectInterest") thu += tien;
      else if (p === "Chi phí" || s === "RepayInterest") chi += tien;
      else if (p === "Tiết kiệm") tietKiem += tien;
      else if (p === "Đầu tư" || p === "Đầu tư (Vốn)") dauTu += tien;
    }

    return {
      type: 'metric',
      title: `Báo cáo ${title}`,
      periodStr: `Từ ${start.toLocaleDateString('vi-VN')} đến ${end.toLocaleDateString('vi-VN')}`,
      summary: { thu, chi, tietKiem, dauTu, dongTien: thu - chi },
      raw_data: rawRes.data || [],
      total_count: aggRes.data.length
    };
  }

  return { error: "Không hiểu yêu cầu tra cứu." };
}
