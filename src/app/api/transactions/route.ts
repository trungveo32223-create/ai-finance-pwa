import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const VALID_PHAN_LOAI = ["Thu nhập", "Chi phí", "Tiết kiệm", "Đầu tư (Vốn)", "Đầu tư (Thị giá)", "Công nợ"];

function validateTx(txData: any) {
  if (typeof txData.so_tien !== 'number' || isNaN(txData.so_tien)) {
    throw new Error("Số tiền (so_tien) phải là kiểu số hợp lệ.");
  }
  // Cho phép rút tiết kiệm là số âm
  if (txData.so_tien <= 0 && txData.phan_loai !== 'Tiết kiệm') {
    throw new Error("Số tiền giao dịch phải lớn hơn 0.");
  }
  if (!VALID_PHAN_LOAI.includes(txData.phan_loai)) {
    throw new Error(`Loại giao dịch không hợp lệ: ${txData.phan_loai}. Vui lòng phân loại đúng Cây Danh Mục.`);
  }
  if (txData.tx_date && isNaN(Date.parse(txData.tx_date))) {
    throw new Error("Ngày giao dịch (tx_date) không hợp lệ.");
  }
}

export async function POST(req: Request) {
  try {
    const { txData } = await req.json();
    
    // Server-side validation
    validateTx(txData);
    
    // Lưu vào bảng transactions
    const { data, error } = await supabase
      .from('transactions')
      .insert([txData])
      .select('id')
      .single();

    if (error) throw error;
    
    return NextResponse.json({ success: true, txId: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const txId = searchParams.get('txId');
    
    if (!txId) {
      // Xóa giao dịch gần nhất (fallback bằng text "Undo")
      const { data: latest, error: fetchErr } = await supabase
        .from('transactions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fetchErr) throw fetchErr;
      
      const { error: delErr } = await supabase.from('transactions').delete().eq('id', latest.id);
      if (delErr) throw delErr;
      
      return NextResponse.json({ success: true, message: 'Đã hoàn tác giao dịch cuối.' });
    } else {
      // Xóa theo ID cụ thể
      const { error } = await supabase.from('transactions').delete().eq('id', txId);
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: 'Đã hoàn tác giao dịch.' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
