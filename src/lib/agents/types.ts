export type IntentLabel = 'Standard' | 'Debt' | 'Query' | 'Unclear' | 'Valuation' | 'Macro';

export type DebtSubType = 
  | 'Borrow' 
  | 'Lend' 
  | 'RepayPrincipal' 
  | 'CollectPrincipal' 
  | 'RepayInterest' 
  | 'CollectInterest';

export interface RouterResponse {
  intent: IntentLabel;
  sub_type?: DebtSubType; // Only for Debt
  query_type?: 'debt' | 'daily' | 'metric'; // Only for Query
  person?: string; // Only for Query type debt
  date?: string; // Only for Query type daily
  period?: 'this_week' | 'this_month' | 'last_month' | 'last_n_days'; // Only for Query type metric
  n?: number; // Only for Query type metric when last_n_days
  message?: string; // Only for Unclear
  ticker?: string | null; // Only for Macro
}

export interface StandardResult {
  phan_loai: string;
  lv1: string;
  lv2: string;
  so_tien: number;
  ghi_chu: string;
  ngay: string;
  danh_muc_confidence?: 'cao' | 'thap';
  alternatives?: string[];
}

export interface DebtResult {
  sub_type: DebtSubType;
  ma_bp: string;
  so_tien: number;
  ghi_chu: string;
  ngay: string;
  error?: 'MissingPartner' | 'MissingAmount';
}

export interface MessageContext {
  role: 'user' | 'assistant';
  content: string;
}
