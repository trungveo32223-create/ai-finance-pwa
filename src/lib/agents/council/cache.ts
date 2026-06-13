import { createHash } from 'crypto';
import { supabase } from '../../supabase';
import { CouncilContext, DebateResult } from './types';

export function generateCacheHash(query: string, context: CouncilContext): string {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Rút gọn Funnel Report thành 1 chuỗi để hash
  const funnelState = `
    L:${context.funnelReport.liquidity.status}
    R:${context.funnelReport.recession.status}
    C:${context.funnelReport.cycle.status}
    P:${context.funnelReport.policy_vn.status}
    M:${context.funnelReport.micro_allocation.status}
  `.trim();

  const data = `${normalizedQuery}|${funnelState}`;
  return createHash('md5').update(data).digest('hex');
}

export async function getCachedVerdict(hash: string): Promise<DebateResult | null> {
  try {
    const { data, error } = await supabase
      .from('verdict_cache')
      .select('verdict_json, created_at')
      .eq('id', hash)
      .single();

    if (error || !data) return null;

    // Check TTL: 6 hours
    const now = new Date().getTime();
    const createdAt = new Date(data.created_at).getTime();
    if (now - createdAt > 6 * 60 * 60 * 1000) {
      return null;
    }

    return JSON.parse(data.verdict_json) as DebateResult;
  } catch (err) {
    console.warn("Lỗi đọc cache Supabase:", err);
    return null;
  }
}

export async function setCachedVerdict(hash: string, query: string, result: DebateResult): Promise<void> {
  try {
    await supabase
      .from('verdict_cache')
      .upsert({
        id: hash,
        query: query,
        verdict_json: JSON.stringify(result)
      }, { onConflict: 'id' });
  } catch (err) {
    console.warn("Lỗi lưu cache Supabase:", err);
  }
}
