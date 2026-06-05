import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { txData } = await req.json();
    
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
