import { NextResponse } from 'next/server';
import { routeIntent } from '@/lib/agents/Router';
import { processStandard } from '@/lib/agents/Standard';
import { processDebt } from '@/lib/agents/Debt';
import { processQuery } from '@/lib/agents/Query';
import { MessageContext } from '@/lib/agents/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;
    const history: MessageContext[] = body.history || [];

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // 1. Phân luồng bằng Agent_Router
    const routerParams = await routeIntent(message, history);

    // 2. Chuyển hướng theo Nhãn
    if (routerParams.intent === 'Unclear') {
      return NextResponse.json({ 
        action: 'UNCLEAR', 
        message: routerParams.message || "Xin lỗi, sếp có thể nói rõ hơn khoản này là chi tiêu hay nợ không ạ?" 
      });
    }

    if (routerParams.intent === 'Query') {
      const result = await processQuery(routerParams);
      if (result.error) {
        return NextResponse.json({ action: 'MESSAGE', message: result.error });
      }
      return NextResponse.json({ 
        action: 'REPORT', 
        data: result 
      });
    }

    if (routerParams.intent === 'Standard') {
      const data = await processStandard(message, history);
      return NextResponse.json({
        action: 'CONFIRM_REQUIRED',
        type: 'Standard',
        data: data
      });
    }

    if (routerParams.intent === 'Debt') {
      const subType = routerParams.sub_type;
      if (!subType) throw new Error("Lỗi Router: Mất sub_type của luồng Debt");
      
      const data = await processDebt(message, subType, history);
      
      if (data.error === 'MissingPartner') {
        return NextResponse.json({
          action: 'UNCLEAR',
          message: "Giao dịch công nợ nhưng em không thấy Tên Người. Sếp giao dịch với ai thế ạ?"
        });
      }
      
      if (data.error === 'MissingAmount') {
        return NextResponse.json({
          action: 'UNCLEAR',
          message: "Sếp giao dịch công nợ bao nhiêu tiền thế ạ?"
        });
      }

      return NextResponse.json({
        action: 'CONFIRM_REQUIRED',
        type: 'Debt',
        data: data
      });
    }

    if (routerParams.intent === 'Valuation') {
      return NextResponse.json({ action: 'MESSAGE', message: "Tính năng cập nhật giá trị (Valuation) sẽ ra mắt ở Phase 3!" });
    }

    return NextResponse.json({ action: 'ERROR', message: "Không nhận diện được ý định." });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
