import { supabase } from '../supabase';
import { RouterResponse } from './types';

export async function processQuery(params: RouterResponse): Promise<string> {
  const { query_type, person, date, period } = params;

  if (query_type === 'debt') {
    if (!person) return "Vui lòng cung cấp tên người cần tra cứu công nợ.";
    
    // Tìm các giao dịch công nợ của người này
    const { data, error } = await supabase
      .from('transactions')
      .select('sub_type, so_tien')
      .eq('ma_bp', person)
      .in('sub_type', ['Borrow', 'Lend', 'RepayPrincipal', 'CollectPrincipal']);
      
    if (error) return `Lỗi truy vấn dữ liệu: ${error.message}`;
    
    let duNo = 0;
    // Dương = Họ nợ mình. Âm = Mình nợ họ
    for (const tx of data) {
      if (tx.sub_type === 'Lend' || tx.sub_type === 'RepayPrincipal') duNo += tx.so_tien;
      if (tx.sub_type === 'Borrow' || tx.sub_type === 'CollectPrincipal') duNo -= tx.so_tien;
    }
    
    if (duNo === 0) return `Hiện tại sếp và ${person} không nợ nần gì nhau (Dư nợ = 0).`;
    if (duNo > 0) return `Tổng kết: **${person} đang nợ sếp ${duNo.toLocaleString('vi-VN')} đ**.`;
    return `Tổng kết: **Sếp đang nợ ${person} ${Math.abs(duNo).toLocaleString('vi-VN')} đ**.`;
  }
  
  if (query_type === 'daily' || query_type === 'metric') {
    // For simplicity in Phase 2, returning a placeholder.
    // Real implementation would calculate sum of Standard categories and Debt Interest.
    return `Tính năng báo cáo ${query_type} đang được nâng cấp ở Phase 2. Mời sếp quay lại sau!`;
  }

  return "Không hiểu yêu cầu tra cứu.";
}
