'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Wallet, Lock, XCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isConfirmCard?: boolean;
  confirmData?: any;
  confirmType?: 'Standard' | 'Debt';
  isReport?: boolean;
  reportData?: any;
  isMacro?: boolean;
  structuredData?: any;
}

// Simple SHA-256 hash
async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);                    
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function ReportCard({ data }: { data: any }) {
  const [showTable, setShowTable] = useState(false);

  if (data.type === 'debt') {
    return (
      <div className="mt-2 w-full">
        <p className="whitespace-pre-wrap mb-2">{data.message}</p>
        {data.total_count > 0 && (
          <div className="mt-3">
            <button 
              onClick={() => setShowTable(!showTable)}
              className="flex items-center text-emerald-400 font-medium text-sm hover:text-emerald-300 transition-colors"
            >
              {showTable ? <><ChevronUp size={16} className="mr-1"/> ⬆️ Thu gọn</> : <><ChevronDown size={16} className="mr-1"/> 📋 Xem chi tiết ({data.total_count} GD)</>}
            </button>
            
            {showTable && (
              <FactCheckTable rawData={data.raw_data} totalCount={data.total_count} />
            )}
          </div>
        )}
      </div>
    );
  }

  // Metric
  const dongTienStr = data.summary.dongTien > 0 ? `+${data.summary.dongTien.toLocaleString('vi-VN')}` : data.summary.dongTien.toLocaleString('vi-VN');
  
  return (
    <div className="mt-2 w-full bg-neutral-900 rounded-xl border border-neutral-700 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">📊</span>
        <h3 className="font-bold text-white">{data.title}</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-4">{data.periodStr}</p>
      
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between"><span className="text-neutral-400">💰 Tổng thu:</span> <span className="font-semibold text-emerald-400">{data.summary.thu.toLocaleString('vi-VN')} đ</span></div>
        <div className="flex justify-between"><span className="text-neutral-400">💸 Tổng chi:</span> <span className="font-semibold text-red-400">{data.summary.chi.toLocaleString('vi-VN')} đ</span></div>
        <div className="flex justify-between"><span className="text-neutral-400">🏦 Tiết kiệm:</span> <span>{data.summary.tietKiem.toLocaleString('vi-VN')} đ</span></div>
        <div className="flex justify-between"><span className="text-neutral-400">📈 Đầu tư:</span> <span>{data.summary.dauTu.toLocaleString('vi-VN')} đ</span></div>
      </div>
      
      <div className="border-t border-neutral-700 pt-3 pb-1 mb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm text-neutral-300">DÒNG TIỀN THUẦN:</span>
          <span className={`font-bold ${data.summary.dongTien >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {dongTienStr} đ
          </span>
        </div>
      </div>

      {data.total_count > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-800">
          <button 
            onClick={() => setShowTable(!showTable)}
            className="flex items-center text-emerald-400 font-medium text-sm hover:text-emerald-300 transition-colors w-full justify-center"
          >
            {showTable ? <><ChevronUp size={16} className="mr-1"/> ⬆️ Thu gọn</> : <><ChevronDown size={16} className="mr-1"/> 📋 Xem chi tiết ({data.total_count} GD)</>}
          </button>
          
          {showTable && (
            <FactCheckTable rawData={data.raw_data} totalCount={data.total_count} />
          )}
        </div>
      )}
    </div>
  );
}

function FactCheckTable({ rawData, totalCount }: { rawData: any[], totalCount: number }) {
  return (
    <div className="mt-3 w-full animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="max-h-[320px] overflow-y-auto overflow-x-auto border border-neutral-700 rounded-lg custom-scrollbar bg-neutral-900/50">
        <table className="w-full min-w-[380px] text-[13px] border-collapse text-left">
          <thead className="sticky top-0 bg-neutral-800 z-10 shadow-sm">
            <tr>
              <th className="p-2 border-b border-neutral-700 font-semibold whitespace-nowrap text-neutral-300">Ngày</th>
              <th className="p-2 border-b border-neutral-700 font-semibold whitespace-nowrap text-neutral-300">Loại</th>
              <th className="p-2 border-b border-neutral-700 font-semibold whitespace-nowrap text-right text-neutral-300">Tiền</th>
              <th className="p-2 border-b border-neutral-700 font-semibold whitespace-nowrap text-neutral-300">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rawData.map((row, idx) => {
              // Parse date to dd/mm
              const dateStr = row.tx_date ? row.tx_date.split('-').slice(1).reverse().join('/') : '--/--';
              // Loại (Lv2 or SubType)
              let typeStr = row.lv2 || row.sub_type || row.phan_loai;
              if (row.ma_bp) typeStr = row.ma_bp.replace('MỚI - ', '');
              
              const isPositive = row.phan_loai === 'Thu nhập' || row.sub_type === 'CollectInterest';
              const isNegative = row.phan_loai === 'Chi phí' || row.sub_type === 'RepayInterest';
              const colorClass = isPositive ? 'text-emerald-400' : (isNegative ? 'text-red-400' : 'text-neutral-300');

              return (
                <tr key={idx} className="hover:bg-neutral-800/50 transition-colors">
                  <td className="p-2 border-b border-neutral-800 whitespace-nowrap text-neutral-400">{dateStr}</td>
                  <td className="p-2 border-b border-neutral-800 whitespace-nowrap truncate max-w-[80px]" title={typeStr}>{typeStr}</td>
                  <td className={`p-2 border-b border-neutral-800 whitespace-nowrap text-right font-medium ${colorClass}`}>
                    {row.so_tien.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-2 border-b border-neutral-800 whitespace-normal max-w-[120px]">
                    <div className="truncate" title={row.ghi_chu}>{row.ghi_chu}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalCount > 10 && (
        <p className="text-[11px] text-center text-neutral-500 mt-2 italic">
          Hiển thị 10/{totalCount} giao dịch mới nhất
        </p>
      )}
    </div>
  );
}

function ConfirmCard({ msg, msgIndex, handleConfirm, handleCancel }: { msg: any, msgIndex: number, handleConfirm: any, handleCancel: any }) {
  const [partnerMode, setPartnerMode] = useState<'text' | 'input'>('text');
  const [partnerName, setPartnerName] = useState(msg.confirmData?.ma_bp || '');

  const onConfirm = () => {
    const updatedData = { ...msg.confirmData };
    if (msg.confirmType === 'Debt') {
      updatedData.ma_bp = partnerName;
    }
    handleConfirm(msgIndex, updatedData, msg.confirmType);
  };

  return (
    <div className="mt-3 p-3 bg-neutral-900 rounded-xl border border-neutral-700 text-sm">
      {msg.confirmType === 'Standard' ? (
        <>
          <p><span className="text-neutral-400">Loại:</span> {msg.confirmData.phan_loai}</p>
          <p><span className="text-neutral-400">Danh mục:</span> {msg.confirmData.lv1} {'>'} {msg.confirmData.lv2}</p>
        </>
      ) : (
        <>
          <p><span className="text-neutral-400">Loại nợ:</span> {msg.confirmData.sub_type}</p>
          <div className="flex items-center gap-2 mt-1 mb-1">
            <span className="text-neutral-400">Đối tác:</span>
            {partnerMode === 'text' ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{partnerName}</span>
                <button onClick={() => setPartnerMode('input')} className="text-xs text-emerald-400 hover:text-emerald-300">
                  ✏️ Sửa
                </button>
              </div>
            ) : (
              <input 
                autoFocus
                type="text" 
                value={partnerName} 
                onChange={e => setPartnerName(e.target.value)} 
                className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-emerald-500 flex-1"
                placeholder="Nhập đối tác mới..."
              />
            )}
          </div>
        </>
      )}
      <p><span className="text-neutral-400">Số tiền:</span> <span className="font-bold text-emerald-400">{msg.confirmData.so_tien.toLocaleString()}đ</span></p>
      <p><span className="text-neutral-400">Ghi chú:</span> {msg.confirmData.ghi_chu}</p>
      
      <div className="flex gap-2 mt-4">
        <button onClick={onConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors">
          <CheckCircle size={16} /> Thực Hiện
        </button>
        <button onClick={() => handleCancel(msgIndex)} className="flex-1 bg-red-600/80 hover:bg-red-500 py-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors">
          <XCircle size={16} /> Hủy
        </button>
      </div>
    </div>
  );
}

function MacroCard({ data }: { data: any }) {
  if (!data) return null;
  const tLight = data.traffic_light;
  const tColor = tLight === 'GREEN' ? 'bg-emerald-500 shadow-emerald-500/50' : (tLight === 'RED' ? 'bg-red-500 shadow-red-500/50' : 'bg-yellow-500 shadow-yellow-500/50');

  return (
    <div className="mt-2 w-full space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 bg-neutral-900/80 p-3 rounded-lg border border-neutral-700">
        <div className={`w-4 h-4 rounded-full shadow-[0_0_10px] ${tColor}`} />
        <span className="font-bold text-sm text-neutral-200 tracking-wide">
          {tLight === 'GREEN' ? 'XANH - TÍCH CỰC' : (tLight === 'RED' ? 'ĐỎ - RỦI RO CAO' : 'VÀNG - THẬN TRỌNG')}
        </span>
      </div>

      {data.three_answers && (
        <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-700 text-[13px] space-y-2">
          <p><span className="text-neutral-400 font-semibold">Tâm lý TT:</span> {data.three_answers.greed_or_fear}</p>
          <p><span className="text-neutral-400 font-semibold">Cửa tử:</span> {data.three_answers.loss_probability}</p>
          <p><span className="text-neutral-400 font-semibold">SBV Hành động:</span> {data.three_answers.government_actions}</p>
        </div>
      )}

      {data.scenarios && data.scenarios.length > 0 && (
        <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-700">
          <h4 className="text-xs font-bold text-neutral-400 mb-2 uppercase">Kịch bản có thể xảy ra</h4>
          <div className="space-y-2">
            {data.scenarios.map((sc: any, idx: number) => (
              <div key={idx} className="text-[13px] border-l-2 border-emerald-600/50 pl-2">
                <span className="font-semibold text-emerald-400">{sc.name} ({sc.probability}%):</span> <span className="text-neutral-300">{sc.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.key_risk && (
        <div className="bg-red-950/30 p-3 rounded-lg border border-red-900/50 text-[13px]">
          <span className="font-bold text-red-400">⚠️ Rủi ro chính:</span> <span className="text-red-200/90">{data.key_risk}</span>
        </div>
      )}

      {data.dissenting_view && (
        <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-700 text-[13px] italic text-neutral-400">
          <span className="font-semibold text-neutral-300">Phản biện:</span> {data.dissenting_view}
        </div>
      )}
      
      {data.data_gaps && data.data_gaps.length > 0 && (
        <div className="text-[11px] text-neutral-500">
          * Thiếu dữ liệu: {data.data_gaps.join(", ")}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Chào sếp! Sếp muốn ghi sổ hay tra cứu gì hôm nay ạ?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.cookie.includes('auth_token=')) {
      setIsAuthenticated(true);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const hash = await sha256(passphrase);
    
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passHash: hash })
    });

    if (res.ok) {
      setIsAuthenticated(true);
    } else {
      const data = await res.json();
      setAuthError(data.error || 'Sai mật khẩu!');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      if (userMessage.toLowerCase().includes('xóa cái vừa rồi') || userMessage.toLowerCase() === 'undo') {
        const res = await fetch('/api/transactions', { method: 'DELETE' });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setIsLoading(false);
        return;
      }

      const history = newMessages.slice(-5).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history })
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        
        // Tạo placeholder cho stream Macro
        setMessages(prev => [...prev, { role: 'assistant', content: 'Đang kết nối Hội đồng...', isMacro: true, structuredData: null }]);

        while (reader && !done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.substring(6));
                  if (event.type === 'phase') {
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1].content = event.label;
                      return updated;
                    });
                  } else if (event.type === 'verdict') {
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1].content = event.text;
                      if (event.structuredData) {
                        updated[updated.length - 1].structuredData = event.structuredData;
                      }
                      return updated;
                    });
                  }
                } catch (e) {
                  // ignore partial JSON chunks
                }
              }
            }
          }
        }
      } else {
        const data = await res.json();

        if (data.action === 'UNCLEAR' || data.action === 'MESSAGE') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        } else if (data.action === 'CONFIRM_REQUIRED') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Sếp kiểm tra lại thông tin trước khi ghi sổ nhé:',
            isConfirmCard: true,
            confirmData: data.data,
            confirmType: data.type
          }]);
        } else if (data.action === 'REPORT') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: '',
            isReport: true,
            reportData: data.data
          }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Lỗi hệ thống' }]);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lỗi kết nối máy chủ.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (msgIndex: number, txData: any, type: string) => {
    setIsLoading(true);
    try {
      const dbData = type === 'Standard' ? {
        phan_loai: txData.phan_loai,
        lv1: txData.lv1,
        lv2: txData.lv2,
        so_tien: txData.so_tien,
        ghi_chu: txData.ghi_chu,
        tx_date: txData.ngay
      } : {
        phan_loai: 'Công nợ',
        sub_type: txData.sub_type,
        ma_bp: txData.ma_bp,
        so_tien: txData.so_tien,
        ghi_chu: txData.ghi_chu,
        tx_date: txData.ngay
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txData: dbData })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => {
          const updated = [...prev];
          updated[msgIndex] = { role: 'assistant', content: `✅ Đã ghi sổ thành công! (ID: ${data.txId})` };
          return updated;
        });
      }
    } catch (err) {
      alert("Lỗi khi lưu!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = (msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { role: 'assistant', content: '🚫 Đã hủy giao dịch.' };
      return updated;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-neutral-900 text-white items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-neutral-800 p-8 rounded-2xl w-full max-w-sm flex flex-col gap-4">
          <div className="flex justify-center mb-4"><Lock size={48} className="text-emerald-500" /></div>
          <h1 className="text-2xl font-bold text-center">Xác Thực</h1>
          <input 
            type="password" 
            value={passphrase} 
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Nhập Passphrase..." 
            className="p-3 rounded-lg bg-neutral-700 text-white outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
          <button type="submit" className="bg-emerald-600 p-3 rounded-lg font-bold mt-2 hover:bg-emerald-500">Mở Khóa</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <header className="flex items-center justify-center p-4 bg-neutral-800/80 backdrop-blur border-b border-neutral-700/50 sticky top-0 z-10">
        <Wallet className="w-6 h-6 mr-2 text-emerald-400" />
        <h1 className="text-lg font-bold tracking-wide">AI Finance App</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-24">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`px-4 py-3 max-w-[90%] rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-neutral-800 text-neutral-100 rounded-tl-sm w-full'}`}>
              
              {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
              
              {msg.isReport && msg.reportData && (
                <ReportCard data={msg.reportData} />
              )}

              {msg.isMacro && msg.structuredData && (
                <MacroCard data={msg.structuredData} />
              )}

              {msg.isConfirmCard && msg.confirmData && (
                <ConfirmCard 
                  msg={msg} 
                  msgIndex={index} 
                  handleConfirm={handleConfirm} 
                  handleCancel={handleCancel} 
                />
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-neutral-800 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              <span className="text-neutral-400 text-sm">Đang truy xuất...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-3 bg-neutral-800/90 backdrop-blur border-t border-neutral-700/50 absolute bottom-0 w-full">
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-neutral-900 p-1.5 rounded-3xl border border-neutral-700 focus-within:border-emerald-500/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: Nợ Tùng bao nhiêu..."
            className="flex-1 bg-transparent border-none text-white focus:ring-0 px-4 py-2 text-sm outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 text-white p-2.5 rounded-full hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
