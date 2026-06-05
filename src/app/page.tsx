'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Wallet, Lock, XCircle, CheckCircle, Undo2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isConfirmCard?: boolean;
  confirmData?: any;
  confirmType?: 'Standard' | 'Debt';
  isUnclear?: boolean;
}

// Simple SHA-256 hash
async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);                    
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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
    // Check if auth_token cookie exists (simple check, real verification is on server)
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
      // Nếu là Undo text
      if (userMessage.toLowerCase().includes('xóa cái vừa rồi') || userMessage.toLowerCase() === 'undo') {
        const res = await fetch('/api/transactions', { method: 'DELETE' });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        setIsLoading(false);
        return;
      }

      // Xây dựng context_history (Lấy 5 tin nhắn gần nhất)
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

      const data = await res.json();

      if (data.action === 'UNCLEAR' || data.action === 'QUERY' || data.action === 'MESSAGE') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else if (data.action === 'CONFIRM_REQUIRED') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sếp kiểm tra lại thông tin trước khi ghi sổ nhé:',
          isConfirmCard: true,
          confirmData: data.data,
          confirmType: data.type
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Lỗi hệ thống' }]);
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
      // Map properties for DB
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
            <div className={`px-4 py-3 max-w-[85%] rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-neutral-800 text-neutral-100 rounded-tl-sm'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              
              {msg.isConfirmCard && msg.confirmData && (
                <div className="mt-3 p-3 bg-neutral-900 rounded-xl border border-neutral-700 text-sm">
                  {msg.confirmType === 'Standard' ? (
                    <>
                      <p><span className="text-neutral-400">Loại:</span> {msg.confirmData.phan_loai}</p>
                      <p><span className="text-neutral-400">Danh mục:</span> {msg.confirmData.lv1} {'>'} {msg.confirmData.lv2}</p>
                    </>
                  ) : (
                    <>
                      <p><span className="text-neutral-400">Loại nợ:</span> {msg.confirmData.sub_type}</p>
                      <p><span className="text-neutral-400">Đối tác:</span> {msg.confirmData.ma_bp}</p>
                    </>
                  )}
                  <p><span className="text-neutral-400">Số tiền:</span> <span className="font-bold text-emerald-400">{msg.confirmData.so_tien.toLocaleString()}đ</span></p>
                  <p><span className="text-neutral-400">Ghi chú:</span> {msg.confirmData.ghi_chu}</p>
                  
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleConfirm(index, msg.confirmData, msg.confirmType!)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors">
                      <CheckCircle size={16} /> Thực Hiện
                    </button>
                    <button onClick={() => handleCancel(index)} className="flex-1 bg-red-600/80 hover:bg-red-500 py-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-colors">
                      <XCircle size={16} /> Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-neutral-800 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              <span className="text-neutral-400 text-sm">Đang suy nghĩ...</span>
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
            placeholder="Ví dụ: Đổ xăng 50k..."
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
