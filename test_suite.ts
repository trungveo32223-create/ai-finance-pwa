import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '.env.local') });

import { routeIntent } from './src/lib/agents/Router';
import { processStandard } from './src/lib/agents/Standard';
import { processDebt } from './src/lib/agents/Debt';

async function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
    }
  }

  console.log("=== BẮT ĐẦU TEST SUITE (R/S/D) ===");

  try {
    // [R] Router Tests
    console.log("\n--- [R] Router Tests ---");
    let r1 = await routeIntent("Mua gạo 100k");
    assert(r1.intent === 'Standard', 'Router: "Mua gạo 100k" -> intent: Standard');

    let r2 = await routeIntent("Vay Nam 5tr");
    assert(r2.intent === 'Debt' && r2.sub_type === 'Borrow', 'Router: "Vay Nam 5tr" -> intent: Debt, sub_type: Borrow');

    let r3 = await routeIntent("Tổng chi hôm nay");
    assert(r3.intent === 'Query' && r3.query_type === 'metric', 'Router: "Tổng chi hôm nay" -> intent: Query, query_type: metric');

    let r4 = await routeIntent("chuyển 50k");
    assert(r4.intent === 'Unclear', 'Router: "chuyển 50k" -> intent: Unclear');

    // [S] Standard Tests
    console.log("\n--- [S] Standard Tests ---");
    let s1 = await processStandard("Tiền điện 500k");
    assert(s1.so_tien === 500000 && s1.phan_loai === 'Chi phí', 'Standard: "Tiền điện 500k" -> 500k, Chi phí');

    let s2 = await processStandard("Lương tháng này 20 củ");
    assert(s2.so_tien === 20000000 && s2.phan_loai === 'Thu nhập', 'Standard: "Lương tháng này 20 củ" -> 20tr, Thu nhập');

    let s3 = await processStandard("Rút tiết kiệm 5tr");
    assert(s3.so_tien === -5000000 && s3.phan_loai === 'Tiết kiệm', 'Standard: "Rút tiết kiệm 5tr" -> -5tr, Tiết kiệm');

    let s4 = await processStandard("Mua cổ phiếu VNM 10 củ");
    assert(s4.so_tien === 10000000 && s4.phan_loai === 'Đầu tư (Vốn)', 'Standard: "Mua cổ phiếu VNM 10 củ" -> 10tr, Đầu tư (Vốn)');

    // [D] Debt Tests
    console.log("\n--- [D] Debt Tests ---");
    let d1 = await processDebt("Vay Tùng 200k", "Borrow");
    assert(d1.ma_bp?.toLowerCase() === 'tùng' && d1.so_tien === 200000 && d1.sub_type === 'Borrow', 'Debt: "Vay Tùng 200k" -> Tùng, 200k, Borrow');

    let d2 = await processDebt("Tùng trả nợ 100k", "CollectPrincipal");
    assert(d2.ma_bp?.toLowerCase() === 'tùng' && d2.so_tien === 100000 && d2.sub_type === 'CollectPrincipal', 'Debt: "Tùng trả nợ 100k" -> Tùng, 100k, CollectPrincipal');

    let d3 = await processDebt("Vay 500k", "Borrow");
    assert((d3 as any).error === 'MissingPartner', 'Debt: "Vay 500k" -> Lỗi MissingPartner');

    console.log(`\n=== TỔNG KẾT: ${passed}/${total} PASS ===`);

  } catch (err: any) {
    console.error("Test execution failed:", err.message);
  }
}

runTests();
