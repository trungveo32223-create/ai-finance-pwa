# 📜 TÀI LIỆU BẺ LÁI & ROADMAP TỔNG — AI FINANCE ADVISOR (VIETNAM PIVOT)

> Tài liệu này là **nguồn sự thật duy nhất (Single Source of Truth)** cho đợt refactor.
> Gồm 5 phần: (I) Phán quyết đối chiếu, (II) Bảng audit 33 đồng thuận, (III) Master Prompt bẻ lái Gemini, (IV) Checklist nghiệm thu cho Gemini, (V) Roadmap triển khai cho bạn + hướng scale.
> Khuyến nghị: commit file này vào repo dưới tên `CONSENSUS.md` — mọi PR phải đối chiếu với nó.

---

# PHẦN I — PHÁN QUYẾT: DỰ ÁN CÒN ĐI THEO LẬP LUẬN CŨ KHÔNG?

**Trả lời ngắn: CÒN XƯƠNG, MẤT THỊT.**

Sau khi đối chiếu handover brief + source code hiện tại (`Router.ts`, `debate_engine/`) với toàn bộ 6 tài liệu tranh luận (2 chuyên gia → 3 → 4 → 7 chuyên gia, tổng cộng **33 điểm đồng thuận**), kết quả:

| Trạng thái | Số lượng | Ý nghĩa |
|---|---|---|
| ✅ CÒN GIỮ | 4 | Xương sống kiến trúc còn nguyên |
| ⚠️ LỆCH / CHƯA CODIFY | 6 | Ý tưởng còn nhưng chưa thành code, hoặc làm nửa vời |
| ❌ MẤT / VI PHẠM | 23 | Rơi rụng hoàn toàn trong quá trình pivot |

**Cái còn giữ:** Đội hình 7 Persona + Monitor (khớp chính xác roster cuối cùng), Funnel kế thừa flowchart 6 bước của tài liệu "Hằng số vs Biến số", nguyên tắc Modular Monolith 1 database, tinh thần "mở rộng không thay thế / tuần nào cũng có output chạy được".

**3 nhóm mất mát nghiêm trọng nhất (xếp theo độ nguy hiểm):**

1. **🔴 VI PHẠM PHÁP LÝ & PRIVACY (đóng góp của Lawyer bị xóa sạch):**
   - Judge prompt hiện tại ra lệnh *"State a decisive VERDICT boldly"* với giọng *"brutally honest Wall Street"* — **đây CHÍNH XÁC là thứ Lawyer cấm** ở Tranh luận #1 (Legal Language Filter). Output kiểu "MUA VIC ngay" = tư vấn đầu tư cần giấy phép UBCKNN theo Luật Chứng khoán 2019.
   - Kế hoạch Giai đoạn 2C nối `v_user_financial_snapshot` (dữ liệu tài chính cá nhân) vào debate context gửi lên **Groq** = vi phạm trực tiếp đồng thuận "KHÔNG BAO GIỜ gửi PII lên AI API" (Nghị định 13/2023/NĐ-CP về dữ liệu nhạy cảm).
   - Disclaimer, Privacy Policy, Consent flow, Data export/delete: không tồn tại.

2. **🟠 MẤT TOÀN BỘ "BỘ CHỈ SỐ ĐẶC THÙ VN" (đóng góp của Commissar + Banker bị xóa):**
   Pipeline tin tức (Gemini News Analyst quét cafef/vneconomy/baochinhphu 4x/ngày) đã biến mất khỏi kiến trúc → kéo theo 7 chỉ số chết theo: Policy Wind Direction 🟢🟡🔴, VN Policy Tightening Score (5 tín hiệu), Shadow Tightening Index (4 tín hiệu), Governance Risk per stock, Crypto Legal Risk Score, Implementation Gap Score, BĐS Hype Index. Đây là toàn bộ lợi thế cạnh tranh "framework riêng VN" mà 6 buổi tranh luận xây nên.

3. **🟡 MẤT TOÀN BỘ NÂNG CẤP TÀI CHÍNH CÁ NHÂN (Banker + Psychologist):**
   True Net Worth (liquidity-adjusted − tax − guarantees − disputed), bảng `guarantees` + hard limit 10%, Debt true cost (floating rate sau ưu đãi + phí trả trước hạn + CIC), Bank Product Decoder, Stress test 2 tầng phòng thủ/tấn công, Accountability Log. System of Record hiện tại chỉ ghi chép thu-chi-nợ cơ bản.

**Ghi chú về stack drift (chấp nhận được, không cần bẻ lái):** Council chạy Groq llama-3.3 thay vì Gemini = OK vì tốc độ và song song hóa. Nhưng phải **trả lại cho Gemini vai trò News Analyst** đúng như đồng thuận gốc (free tier 15 RPM + grounding quét tin tiếng Việt là việc Gemini làm tốt nhất). Phân công: **Groq = tranh luận, Gemini = tình báo tin tức.** Vercel Cron thay Supabase Edge Function = OK, giữ nguyên.

---

# PHẦN II — BẢNG AUDIT 33 ĐỒNG THUẬN (KHÔNG SÓT)

Nguồn: T1 = Architect×Wealth (6 đồng thuận) · T2 = +Mogul (6) · T3 = +Commissar (5) · T4 = +Banker&Lawyer (8) · T0 = Hằng số vs Biến số (nguyên tắc nền) · T00 = Bộ chỉ báo chu kỳ.

## Nhóm A — Council & Output (não của hệ thống)

| # | Đồng thuận | Nguồn | Trạng thái | Hành động |
|---|---|---|---|---|
| A1 | Đội hình 7 Persona (Banker, Lawyer, Wealth, Mogul, Commissar, Psychologist, Architect) + Monitor | T2-T4 | ✅ CÒN | Giữ nguyên roster trong brief |
| A2 | Funnel 6 bước kế thừa flowchart: Liquidity → Cycle → Recession → FX/DXY → VN Opportunity → Allocation | T0 | ⚠️ LỆCH | Brief liệt kê 7 bước và đang để dạng prompt. Phải thành **code gate deterministic** (xem Phần V) |
| A3 | KHÔNG dự báo — chỉ kịch bản if-then + xác suất + historical precedent + contrary evidence + confidence % | T1#3, T2#3 | ❌ MẤT | Judge prompt cũ không có trường nào trong số này. Phải ép JSON output |
| A4 | Đèn giao thông Xanh/Vàng/Đỏ + trả lời 3 câu hỏi bình dân ("Tham lam hay sợ?", "Xác suất mất 20%?", "Chính phủ đang làm gì?") trong 30 giây | T2#3 | ❌ MẤT | Đưa vào schema StructuredVerdict |
| A5 | Conviction Decay: dự báo càng xa confidence càng thấp, 5 khung thời gian 5 phương pháp | T1#5 | ❌ MẤT | Codify trong funnel.ts |
| A6 | Không bao giờ dự đoán ngày cụ thể (bài học "đỉnh BTC 26/10/2025") | T1#3, T0 | ⚠️ CHƯA CODIFY | Thêm rule vào Monitor prompt + validator |
| A7 | **Legal Language Filter**: "gợi ý khung" thay vì "chỉ đạo mua/bán", disclaimer cố định mọi output | T4#1 | ❌ **VI PHẠM TRỰC TIẾP** | Judge cũ đòi verdict bạo. Viết lại Monitor prompt + filter layer cuối |
| A8 | Khi hằng số và biến số mâu thuẫn → ưu tiên hằng số. Hộp An toàn ≥20%, Mạo hiểm ≤15% | T0 | ❌ MẤT | Hard constraint trong funnel allocation gate |

## Nhóm B — Bộ chỉ số đặc thù VN (lợi thế cạnh tranh)

| # | Đồng thuận | Nguồn | Trạng thái | Hành động |
|---|---|---|---|---|
| B1 | Gemini News Analyst quét tin VN 4x/ngày (cafef, vneconomy, baochinhphu) + sentiment scoring | T1#2 | ❌ MẤT | Khôi phục pipeline — đây là **nguồn nuôi của B2→B8** |
| B2 | Policy Wind Direction 🟢🟡🔴 (đọc Nghị quyết Đảng/QH = bản đồ #1) + detector "rủi ro đổi gió" (tần suất tin thanh tra) | T3#1 | ❌ MẤT | Bảng `vn_policy_signals`, Gemini phân loại |
| B3 | VN Policy Tightening Score 0-5 (UBCKNN cảnh báo, NHNN dự trữ bắt buộc, BTC thuế CK, báo nhà nước nói "bong bóng", họp đột xuất Thủ tướng). 3+/5 = giảm exposure | T3#4 | ❌ MẤT | Thành 1 gate trong funnel |
| B4 | Shadow Tightening Index 4 tín hiệu (gap lãi suất ON vs LS chính sách, tín phiếu NHNN, credit room utilization, NIM spread). 2/4 = cảnh báo siết ngầm | T4#4 | ⚠️ 1/4 | Brief đã cào lãi suất ON (tín hiệu #1 có data). Bổ sung 3 tín hiệu còn lại |
| B5 | VN Credit Tightness Index (dư nợ BĐS / tổng dư nợ vs cap) + credit growth YTD vs target | T4#3 | ❌ MẤT | Crawler NHNN quarterly |
| B6 | Governance Risk per stock: quét "khởi tố/điều tra/thanh tra" + tên DN trong portfolio → auto-flag | T3#5 | ❌ MẤT | Filter trong News Analyst |
| B7 | Crypto Legal Risk Score 1-10 + **cap crypto 5%** + disclaimer tự động + priority trigger "Nghị định tài sản ảo" | T3#2 | ❌ MẤT | Hard rule trong funnel allocation |
| B8 | BĐS: Pháp lý Score 1-10 (chỉ khuyến nghị ≥7), tách "tạo giá trị vs đầu cơ", Implementation Gap Score, flag khu vực tranh chấp bảng giá đất | T3#3, T4#2 | ❌ MẤT | Fields trong `investments` + news filter |
| B9 | VN Score riêng tách khỏi Global Score, weights: DXY 25%, USD/VND 20%, Tín dụng 15%, Xuất khẩu 15%, Breadth 15%, Global M2 10% | T2#5 | ⚠️ CÓ DATA, CHƯA CÓ MODEL | Data FRED+TCBS đã cào. Viết scoring function |
| B10 | "VN đặc sản": giá thép HPG + xi măng + BĐS Hype Index (đếm tin BĐS cafef/ngày) | T2#5 | ⚠️ 1/3 | HPG đã cào. Thêm xi măng + hype counter |

## Nhóm C — Tài chính cá nhân nâng cao (System of Record v2)

| # | Đồng thuận | Nguồn | Trạng thái | Hành động |
|---|---|---|---|---|
| C1 | Debt true cost = floating rate sau ưu đãi + phí trả trước hạn − CIC benefit. KHÔNG BAO GIỜ tính bằng lãi ưu đãi. Hiển thị chi phí toàn vòng đời | T4#3 | ❌ MẤT | Fields: `promotional_rate_end_date`, `floating_rate_estimate`, `early_repayment_fee_pct` |
| C2 | Bank Product Decoder: dịch marketing ngân hàng → true cost + stress test lãi +3%. Hợp pháp vì là calculator | T4#6 | ❌ MẤT | Tính năng giá trị nhất cho user — ưu tiên cao |
| C3 | 3 loại nợ (tiêu dùng=giết / tạo dòng tiền=vũ khí / không dòng tiền=đánh bạc) + 2 tầng chiến lược, tầng Tấn công khóa sau stress test (lãi+3%, giá−30%, dòng tiền−50%, DSCR>1.5) | T2#4 | ❌ MẤT | `strategy_tier` field + stress test function |
| C4 | True Net Worth = Liquidity-Adjusted Assets − Debts − Tax − Guarantees − Disputed. Entity separation (cá nhân/vợ/pháp nhân). Introduce dần tránh sốc | T4#5 | ❌ MẤT | Đại tu `investments` table |
| C5 | Guarantee Exposure Map + **hard limit bảo lãnh ≤10% true net worth** + warning khi nhập | T4#8 | ❌ MẤT | Bảng `guarantees` mới |
| C6 | IRR trả nợ vs ROI đầu tư + refinance timing nối với data lãi suất NHNN | T1#4 | ❌ MẤT | Nối Query agent với market_data |
| C7 | Accountability Log: weekly compliance %, behavior gap, mirror không phán xét. Onboarding theo bậc | T2#6 | ❌ MẤT | Bảng `accountability_log` |

## Nhóm D — Hạ tầng, dữ liệu, pháp lý

| # | Đồng thuận | Nguồn | Trạng thái | Hành động |
|---|---|---|---|---|
| D1 | Modular Monolith, 1 database Supabase, audit trail | T1#1 | ✅ CÒN | Giữ |
| D2 | Mỗi indicator: Primary → Fallback → Cache (cờ stale) | T1#2 | ⚠️ CHƯA RÕ | Codify trong crawler layer |
| D3 | Daily backup → GitHub repo riêng của user + export JSON/CSV (chống vendor lock-in) | T1#1, T2#2 | ❌ MẤT | GitHub Action + export endpoint |
| D4 | RLS mọi bảng + AES-256 client-side cho trường nhạy cảm | T1#6 | ⚠️ KHÔNG NHẮC | Verify lại trên Supabase |
| D5 | **KHÔNG gửi PII lên AI API** — chỉ gửi tham số ẩn danh ("user có khoản nợ lãi X%, tỷ trọng crypto Y%") | T1#6, T4#7 | ❌ **SẮP VI PHẠM** | Kế hoạch 2C phải sửa: thêm Anonymization Layer trước khi snapshot vào context |
| D6 | Privacy Policy + Data Map + Consent flow + quyền export/delete (Nghị định 13, chuẩn bị Luật BVDLCN) | T4#7 | ❌ MẤT | Bắt buộc trước khi cho người khác dùng |
| D7 | Tuần nào cũng có output chạy được, build & invest song song, margin an toàn 50x rate limit | T2#1, T2#2 | ✅ CÒN | Tinh thần đang đúng — duy trì |
| D8 | Behavioral safeguards (Psychologist): cooling queue, pre-commitments, devil's advocate mode, graduated access L1/L2/L3 | T4 (kiến trúc tổng) | ❌ MẤT | Phase sau cùng, không block refactor |


---

# PHẦN III — MASTER PROMPT BẺ LÁI CHO GEMINI

> Copy nguyên khối dưới đây paste cho Gemini. Prompt tự chứa đủ bối cảnh, không cần gửi kèm 6 tài liệu tranh luận cũ. Sau prompt này, mọi phiên làm việc với Gemini nên mở đầu bằng: *"Tuân thủ HIẾN PHÁP DỰ ÁN đã nạp. Hôm nay làm mục [X] trong checklist."*

```text
# ROLE
Bạn là Kỹ sư trưởng (Lead Engineer) của dự án "AI Finance Advisor — Vietnam Pivot".
Bạn làm việc dưới một HIẾN PHÁP DỰ ÁN bất biến được chốt bởi hội đồng 7 chuyên gia
(Banker, Lawyer, Wealth Manager, Mogul, Commissar, Psychologist, Architect).
Nhiệm vụ của bạn KHÔNG phải là sáng tạo kiến trúc mới — mà là KHÔI PHỤC và TRIỂN KHAI
đúng các đồng thuận đã bị rơi rụng trong quá trình pivot, đồng thời không phá vỡ
hệ thống đang chạy.

# HIỆN TRẠNG HỆ THỐNG (ĐỌC KỸ)
- Stack: Next.js + Supabase (bảng market_data dùng chung, phân biệt qua indicator_key),
  Vercel Cron, Groq llama-3.3-70b cho agents.
- ĐANG CHẠY ỔN ĐỊNH (CẤM PHÁ): src/lib/crawlers/fred.ts (16 chỉ báo Mỹ),
  src/lib/agents/Standard.ts, Debt.ts, Query.ts, Router.ts (System of Record).
- ĐÃ XONG: crawler vietnam.ts (VN-Index, VN30, HPG, tỷ giá, lãi suất ON liên ngân hàng),
  endpoint /api/cron/crawl-vn.
- ĐANG REFACTOR: src/lib/agents/debate_engine/ (bộ 6 expert cũ: macro/degen/risk/
  fundamental/behavioral/data) → thay bằng Council 7+1 Persona mới, xây song song
  trong thư mục src/lib/agents/council/, gate bằng env flag COUNCIL_V2.

# HIẾN PHÁP — 12 LUẬT BẤT BIẾN (vi phạm = reject code)
L1. LEGAL LANGUAGE FILTER: Mọi output advisory TUYỆT ĐỐI KHÔNG dùng mệnh lệnh
    "Mua X / Bán Y / Giảm 5% crypto ngay". Chỉ dùng dạng: "Dữ liệu cho thấy X có các
    tín hiệu [liệt kê]. Khung phân bổ gợi ý: [range]. Quyết định là của bạn."
    + Disclaimer cố định cuối mọi output: "Đây là thông tin phân tích, không phải
    tư vấn đầu tư. Mọi quyết định là trách nhiệm của người dùng."
L2. NO PII TO AI: Không bao giờ gửi dữ liệu định danh/nhạy cảm của user (tên chủ nợ,
    tên ngân hàng, số tiền tuyệt đối, tên người) lên Groq/Gemini. Snapshot tài chính
    cá nhân phải đi qua Anonymization Layer: chuyển thành tỷ lệ và phân loại
    (VD: "nợ tiêu dùng lãi 18% chiếm 12% thu nhập tháng; crypto = 9% tổng tài sản").
L3. NO PREDICTION: Không dự đoán giá/ngày cụ thể. Output = kịch bản if-then + xác suất
    + historical precedent + contrary evidence + confidence %. Confidence giảm dần
    theo khung thời gian (Conviction Decay).
L4. FUNNEL LÀ CODE, KHÔNG PHẢI PROMPT: 6 gate (Liquidity → Recession → Cycle →
    FX/Capital → Policy VN → Micro/Allocation) là pure function TypeScript đọc
    market_data, có unit test, chạy TRƯỚC mọi LLM call. LLM tranh luận bên trong
    khung gate, không được vẽ lại khung.
L5. PERSONA CÓ QUYỀN ABSTAIN: Mỗi persona khai báo requiredData[]. Thiếu data thuộc
    chuyên môn → trả NO_DATA, không bịa. Cấm ép "decisive stance" khi không có số liệu.
L6. MONITOR OUTPUT JSON: {verdict, traffic_light(green/yellow/red), confidence,
    three_answers{greed_or_fear, loss_probability, government_actions}, key_risk,
    dissenting_view, data_gaps[]}. Sau đó mới format tiếng Việt. data_gaps bắt buộc.
L7. HARD ALLOCATION LIMITS: Crypto ≤ 5% tổng tài sản. Hộp An toàn ≥ 20%.
    Hộp Mạo hiểm ≤ 15%. Bảo lãnh ≤ 10% True Net Worth. Code enforce, LLM không
    được override.
L8. HẰNG SỐ THẮNG BIẾN SỐ: Khi tín hiệu mâu thuẫn (VD: Global M2 giảm nhưng FTSE
    upgrade thuận), gate hằng số (Liquidity/Recession) quyết định trần rủi ro.
L9. GIÁ LIVE KHÔNG ĐƯỢC BỊA: fetchLiveTicker chỉ nhận mã trong whitelist VN30
    (regex deterministic chạy trước LLM). Fetch fail → dùng giá gần nhất trong DB
    kèm timestamp + cờ stale, hoặc từ chối phân tích micro. Mọi data point trong
    context đều kèm timestamp.
L10. KHÔNG TÍNH NỢ BẰNG LÃI ƯU ĐÃI: Mọi tính toán nợ dùng floating rate sau ưu đãi
    + phí trả trước hạn. Hiển thị chi phí toàn vòng đời.
L11. PHÂN CÔNG AI: Groq = council debate (song song, nhanh). Gemini = News Analyst
    (quét tin VN 4x/ngày, sentiment, phân loại policy signals). Không đảo vai.
L12. MỞ RỘNG KHÔNG THAY THẾ: Xây song song trong council/, giữ debate_engine/ cũ
    chạy production đến khi parity, cutover bằng flag, rồi mới xóa.

# BỘ CHỈ SỐ VN PHẢI KHÔI PHỤC (output của News Analyst + crawlers)
1. policy_wind_direction: GREEN/YELLOW/RED — Gemini đọc tin Nghị quyết/chỉ đạo,
   kèm "wind_change_risk" (tần suất tin thanh tra/kiểm tra tăng đột biến).
2. vn_policy_tightening_score: 0-5 từ 5 tín hiệu (UBCKNN cảnh báo thao túng,
   NHNN tăng dự trữ bắt buộc, Bộ TC đề xuất thuế CK, báo nhà nước đăng "bong bóng",
   họp đột xuất Thủ tướng + NHNN + UBCKNN trên baochinhphu.vn). ≥3 = gate Policy đỏ.
3. shadow_tightening_index: 0-4 từ 4 tín hiệu (lãi ON tăng nhưng LS chính sách
   đứng yên [ĐÃ CÓ DATA], tín phiếu NHNN phát hành đột biến, credit room hết sớm,
   NIM spread thu hẹp). ≥2 = cảnh báo siết ngầm.
4. vn_credit_tightness: dư nợ BĐS/tổng dư nợ vs cap + credit growth YTD vs target 14-15%.
5. governance_risk: quét "khởi tố|điều tra|thanh tra" + tên DN → flag portfolio.
6. crypto_legal_score: 1-10 từ tin pháp lý crypto VN. >8 = auto-alert.
   Priority trigger riêng cho "Nghị định tài sản ảo".
7. bds_hype_index: số bài BĐS/ngày trên cafef (MA 7 ngày). >20 = bubble, <5 = đáy.
8. vn_risk_score: weighted DXY 25% + USD/VND 20% + Tín dụng 15% + Xuất khẩu 15%
   + VN-Index breadth 15% + Global M2 10%. TÁCH RIÊNG khỏi global_risk_score.

# QUY TRÌNH LÀM VIỆC
- Mỗi response của bạn chỉ giải quyết 1 mục checklist, theo đúng thứ tự ưu tiên.
- Mỗi file code phải kèm: (a) đường dẫn chính xác, (b) lý do tồn tại 1 dòng,
  (c) test case hoặc cách verify thủ công.
- Trước khi viết code chạm vào file đang chạy production, phải liệt kê rủi ro
  regression và cách rollback.
- Kết thúc mỗi response: tự chấm mục checklist vừa làm (DONE/PARTIAL) và nêu mục
  tiếp theo.
- Nếu yêu cầu của tôi mâu thuẫn với 12 Luật trên → từ chối và trích dẫn số Luật.

Xác nhận đã nạp Hiến pháp bằng cách tóm tắt 12 Luật trong 12 dòng, sau đó chờ tôi
giao mục checklist đầu tiên.
```

---

# PHẦN IV — CHECKLIST NGHIỆM THU CHO GEMINI

> Dán checklist này vào đầu mỗi sprint. Gemini tự đánh dấu, bạn verify trước khi sang mục kế.

## Sprint 1 — Council Engine 7+1 (P0, ~1 tuần)
- [ ] 1.1 `council/types.ts`: PersonaId, PersonaDefinition (có `requiredData[]`), GateResult, FunnelReport, CouncilContext (mọi field kèm `timestamp` + `stale`), StructuredVerdict (đúng schema Luật L6)
- [ ] 1.2 `council/funnel.ts`: 6 gate = pure functions, mỗi gate có ≥3 unit test (case xanh/đỏ/thiếu data). Gate Allocation enforce Luật L7
- [ ] 1.3 `council/context_builder.ts`: query market_data → CouncilContext + data-availability manifest. Read-only
- [ ] 1.4 `council/personas.ts`: 8 prompt (7 persona + Monitor). Mỗi persona có abstain rule (L5). Monitor prompt có Legal Language Filter (L1) + cấm prediction (L3) + ép JSON (L6)
- [ ] 1.5 `council/ticker.ts`: whitelist VN30 hardcode + regex, timeout 4s, fallback giá DB kèm stale flag (L9). Tái sử dụng hàm trong vietnam.ts, không copy code
- [ ] 1.6 `council/orchestrator.ts`: funnel chạy trước → short-circuit chọn persona theo gate → Promise.allSettled + timeout (bê pattern cũ) → Monitor JSON → format tiếng Việt + disclaimer
- [ ] 1.7 `Router.ts`: regex VN30 chạy TRƯỚC LLM call, thêm intent "Macro". Nhánh Standard/Debt/Query/Unclear không đổi 1 ký tự. Flag COUNCIL_V2
- [ ] 1.8 Test parity: 10 câu hỏi mẫu chạy cả engine cũ và mới, so sánh, log kết quả

## Sprint 2 — News Pipeline & Bộ chỉ số VN (P1, ~1-2 tuần)
- [ ] 2.1 `crawlers/news_analyst.ts`: Gemini quét tin 4x/ngày (cafef, vneconomy, baochinhphu, sbv.gov.vn), output bảng `news_digests` (sentiment −5→+5, category, source_url)
- [ ] 2.2 `bds_hype_index`: đếm bài BĐS/ngày, MA7, ghi vào market_data với indicator_key riêng
- [ ] 2.3 `policy_wind_direction` + `wind_change_risk`: Gemini phân loại GREEN/YELLOW/RED
- [ ] 2.4 `vn_policy_tightening_score` (0-5) + `shadow_tightening_index` (0-4): hàm tổng hợp từ news_digests + lãi suất ON đã cào. Tích hợp vào gate Policy của funnel
- [ ] 2.5 `governance_risk`: scan tên DN trong portfolio vs tin điều tra → bảng risk_alerts
- [ ] 2.6 `crypto_legal_score` + priority trigger "Nghị định tài sản ảo" + hard cap 5% trong funnel
- [ ] 2.7 `vn_risk_score` vs `global_risk_score`: 2 scoring function riêng, đúng weights T2#5
- [ ] 2.8 Thêm crawler: giá xi măng, xuất nhập khẩu GSO, FDI, tín dụng YoY (primary + fallback + cache, cờ stale — Luật D2)

## Sprint 3 — Tài chính cá nhân v2 (P1, ~1-2 tuần)
- [ ] 3.1 Migration `debts`: thêm promotional_rate_end_date, floating_rate_estimate, early_repayment_fee_pct, debt_nature (consumer/cashflow/speculative)
- [ ] 3.2 True cost calculator + hiển thị chi phí toàn vòng đời (L10). Debt agent (NLP) bóc tách được các field mới
- [ ] 3.3 Bank Product Decoder: input thông tin vay → output 1 trang true cost + stress test lãi +3% (thuần calculator, không advisory)
- [ ] 3.4 Stress test 2 tầng: defensive default; offensive unlock khi survival ≥80% (lãi+3%, giá−30%, dòng tiền−50%), DSCR > 1.5
- [ ] 3.5 Migration `investments`: entity_type, liquidity_factor, is_collateral, is_disputed, legal_score, tax_obligation_estimate. Dashboard hiện Gross vs True Net Worth (introduce dần)
- [ ] 3.6 Bảng `guarantees` + hard limit 10% True Net Worth + warning khi nhập (L7)
- [ ] 3.7 Bảng `accountability_log`: weekly review, compliance %, behavior gap

## Sprint 4 — Privacy, Compliance & Resilience (P0 trước khi mở cho người khác dùng)
- [ ] 4.1 Anonymization Layer: hàm chuyển snapshot cá nhân → tỷ lệ/phân loại ẩn danh TRƯỚC khi vào CouncilContext (L2). View v_user_financial_snapshot chỉ được dùng SAU layer này
- [ ] 4.2 Verify RLS bật trên mọi bảng + AES-256 client-side cho trường nhạy cảm
- [ ] 4.3 Privacy Policy + Data Map + Consent flow lần đầu mở app + endpoint export JSON/CSV + delete
- [ ] 4.4 GitHub Action daily backup pg_dump → private repo của private repo của user
- [ ] 4.5 Disclaimer cố định ở UI layer (không chỉ trong prompt)
- [ ] 4.6 Cutover: bật COUNCIL_V2 production, theo dõi 1 tuần, xóa debate_engine/ cũ

## Sprint 5 — Behavioral Safeguards (P2, làm sau cùng)
- [ ] 5.1 Cooling queue cho quyết định lớn + pre_commitments table
- [ ] 5.2 Devil's Advocate mode trong Monitor (bắt buộc nêu case ngược)
- [ ] 5.3 Graduated access L1/L2/L3 + onboarding theo bậc (tuần 1: đèn giao thông + 3 câu hỏi)

---

# PHẦN V — ROADMAP CHO BẠN (NGƯỜI ĐIỀU HÀNH) + HƯỚNG SCALE

## 5.1 Nguyên tắc điều hành đợt refactor

Tích hợp nguyên trạng kết luận kiến trúc từ phiên review trước:

1. **Code quyết định fact và constraint, LLM chỉ quyết định diễn giải.** Nhiều persona không chống được hallucination — cả 8 "người" là cùng 1 model, cùng 1 context. Nếu data thiếu, bạn nhận 7 lời ảo giác với 7 giọng văn rồi Monitor tổng hợp thành 1 bản ảo giác tự tin. Thứ chống ảo giác thật sự: funnel deterministic (Luật L4), quyền abstain (L5), data manifest + timestamp (L9), và trường `data_gaps` bắt buộc trong verdict (L6).
2. **Xây song song, không đập trước** (L12): council/ mới sống cạnh debate_engine/ cũ, flag COUNCIL_V2, parity test 10 câu hỏi, rồi mới cutover. Đúng tinh thần Giai đoạn 2A đã làm với vietnam.ts.
3. **Funnel short-circuit để tiết kiệm Groq:** 8 call/câu hỏi với 2 key xoay vòng sẽ chết rate limit nhanh. Khi Liquidity Gate hoặc Recession Gate đỏ tuyệt đối → chỉ gọi 3-4 persona phòng thủ (Wealth, Banker, Lawyer, Psychologist), bỏ qua persona tấn công. Rẻ hơn, nhanh hơn, đúng tinh thần funnel hơn.
4. **Mỗi tuần phải có output chạy được** (đồng thuận T2#1 — quy tắc của Mogul). Cuối Sprint 1 bạn phải hỏi được "Đánh giá FPT" và nhận verdict có đèn giao thông + disclaimer. Nếu tuần 1 không demo được, cắt scope, không cắt deadline.

## 5.2 Thứ tự ưu tiên và lý do (nếu thiếu thời gian, làm từ trên xuống)

| Ưu tiên | Việc | Lý do |
|---|---|---|
| P0 | Sprint 1 (Council) + mục 4.1, 4.5 (Anonymization + Disclaimer) | Legal Language Filter và No-PII là rủi ro pháp lý thật theo Lawyer — không phải tính năng, là điều kiện tồn tại |
| P1a | Sprint 2 (News pipeline + chỉ số VN) | Toàn bộ lợi thế cạnh tranh của hệ thống nằm ở đây; không có nó, council chỉ là wrapper quanh data Mỹ |
| P1b | Sprint 3 (Tài chính cá nhân v2) | Bank Product Decoder + True Net Worth là giá trị thực cao nhất cho user theo Wealth Manager |
| P2 | Sprint 4 còn lại + Sprint 5 | Cần trước khi thương mại hóa/chia sẻ, không block việc dùng cá nhân |

## 5.3 Thứ tự code Sprint 1 (chi tiết, từ ít rủi ro → nhiều rủi ro)

1. `council/types.ts` — contract trước, zero risk, ép nghĩ kỹ kiến trúc.
2. `council/funnel.ts` + unit tests — logic ngân hàng nhất, test offline không cần LLM/network. **Đầu tư kỹ nhất ở đây.**
3. `council/context_builder.ts` — read-only Supabase, không phá được gì.
4. `council/personas.ts` — viết sau funnel vì prompt tham chiếu tên trường FunnelReport.
5. `council/ticker.ts` — gọi hàm sẵn có trong vietnam.ts, whitelist + timeout + stale flag. **Điểm chống bịa giá quan trọng thứ nhì.**
6. `council/orchestrator.ts` — ghép tất cả; bê pattern Promise.allSettled/timeout/degraded-mode từ orchestrator cũ (phần đó viết tốt, giữ lại).
7. `Router.ts` — chạm production cuối cùng, tối thiểu: regex VN30 trước LLM + intent Macro, nhánh cũ giữ nguyên từng chữ.
8. Parity test → cutover → xóa code cũ.

## 5.4 Hướng đi scalable & dễ triển khai nhất

**a) Một quy ước indicator_key thống nhất = scale không cần migration.**
Mọi chỉ số mới (policy_wind, shadow_tightening, bds_hype...) đều là 1 row trong `market_data` với key riêng — đúng pattern "mở rộng không thay thế" đã chứng minh ở 2A. Thêm chỉ số = thêm crawler + thêm key, không đụng schema, không đụng council (context_builder tự pick up key mới qua manifest).

**b) News pipeline batch trong giới hạn Gemini free (15 RPM).**
1 lần quét = 1 call Gemini duy nhất trả JSON đa nhiệm: `{digests[], policy_wind, tightening_signals, governance_hits[], crypto_legal_signals, bds_article_count}`. 4 lần/ngày = 4 call/ngày. Đừng tách mỗi chỉ số 1 call — vừa tốn quota vừa mất tính nhất quán ngữ cảnh.

**c) Council 2 chế độ để tiết kiệm và scale người dùng:**
- *Fast mode* (mặc định): 1 call Groq duy nhất, prompt yêu cầu model đóng cả 7 vai trong 1 response JSON → rẻ 8 lần, nhanh, đủ tốt cho câu hỏi thường.
- *Full mode* (khi user yêu cầu hoặc câu hỏi có ticker cụ thể): 7 call song bắt Monitor như thiết kế gốc.
Cùng types, cùng funnel, cùng Monitor schema — chỉ khác orchestration. Đây là cách scale chi phí mượt nhất khi có thêm user.

**d) Cache verdict theo (câu hỏi chuẩn hóa + hash của FunnelReport):**
FunnelReport chỉ đổi khi data đổi (cron 6h). Hai user hỏi "thị trường thế nào" trong cùng khung data → trả cache, 0 call LLM. Riêng câu hỏi có ticker thì bypass cache.

**e) Alert là row, không phải push:** bảng `risk_alerts` + chatbot poll khi user mở app. Khi nào cần real-time mới thêm webhook/Telegram — đừng xây hạ tầng push sớm.

**f) Mọi gate/scoring function đều pure + có test** → sau này muốn đổi weights (VD user tự chỉnh DXY weight như đồng thuận T1#5) chỉ là đổi config object, không đổi logic.

## 5.5 Định nghĩa "XONG" của toàn đợt bẻ lái

Hệ thống được coi là đã quay về đúng đồng thuận khi:
1. Hỏi "Đánh giá FPT" → nhận: đèn giao thông, 3 câu trả lời bình dân, kịch bản + xác suất + contrary evidence, data_gaps, ngôn ngữ "gợi ý khung", disclaimer — và **không có một mệnh lệnh mua/bán nào**.
2. Tất cả 8 chỉ số VN (mục B của bảng audit) có data tươi < 24h trong market_data.
3. Không một byte PII nào xuất hiện trong payload gửi Groq/Gemini (kiểm bằng log middleware).
4. Funnel có unit test xanh 100%, crypto >5% bị code chặn dù Monitor "muốn" khuyến nghị khác.
5. Bảng audit Phần II không còn ô ❌ nào ở nhóm A, B, C1-C5, D5.

---

*"Hệ thống tốt nhất là hệ thống mà 7 kẻ thù cùng xây." — Đừng để pivot kỹ thuật xóa mất 7 kẻ thù đó.*
