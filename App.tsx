
import React, { useState, useEffect, useMemo } from 'react';
import { 
  AccountingError, 
  ErrorStatus, 
  ErrorPriority, 
  ErrorCategory, 
  DashboardStats,
  ChatMessage 
} from './types';
import ErrorCard from './components/ErrorCard';
import StatusBadge from './components/StatusBadge';
import { analyzeAccountingError, chatWithErrorContext } from './services/geminiService';

const INITIAL_ERRORS: AccountingError[] = [
  {
    id: '1',
    title: 'Sai lệch số dư đầu kỳ VCB',
    description: 'Số dư đầu kỳ tài khoản 112101 không khớp với sao kê ngân hàng Vietcombank tháng 01/2024. Chênh lệch 2,500,000đ.',
    category: ErrorCategory.LEDGER,
    priority: ErrorPriority.HIGH,
    status: ErrorStatus.PENDING,
    createdAt: Date.now() - 86400000 * 3,
    reporter: 'Nguyễn Văn A',
    amount: 2500000,
    chatHistory: []
  },
  {
    id: '2',
    title: 'Hóa đơn đầu vào không hợp lệ',
    description: 'Hóa đơn số 001234 của NCC Công ty X sai địa chỉ công ty, cần yêu cầu xuất hóa đơn điều chỉnh.',
    category: ErrorCategory.INVOICE,
    priority: ErrorPriority.MEDIUM,
    status: ErrorStatus.PROCESSING,
    createdAt: Date.now() - 86400000,
    reporter: 'Trần Thị B',
    voucherNo: 'HD001234',
    chatHistory: []
  }
];

const App: React.FC = () => {
  const [errors, setErrors] = useState<AccountingError[]>(INITIAL_ERRORS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'issues' | 'create' | 'help'>('dashboard');
  const [selectedError, setSelectedError] = useState<AccountingError | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: ErrorCategory.OTHER,
    priority: ErrorPriority.MEDIUM,
    amount: '',
    voucherNo: '',
  });
  const [base64Image, setBase64Image] = useState<string | undefined>(undefined);

  // Compute Stats
  const stats = useMemo<DashboardStats>(() => ({
    total: errors.length,
    pending: errors.filter(e => e.status === ErrorStatus.PENDING).length,
    processing: errors.filter(e => e.status === ErrorStatus.PROCESSING).length,
    fixed: errors.filter(e => e.status === ErrorStatus.FIXED).length,
  }), [errors]);

  const filteredErrors = useMemo(() => {
    return errors.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [errors, searchQuery]);

  const handleExportExcel = () => {
    const headers = "ID,Tieu de,Danh muc,Uu tien,Trang thai,Nguoi bao cao,Ngay tao\n";
    const rows = errors.map(e => `${e.id},${e.title},${e.category},${e.priority},${e.status},${e.reporter},${new Date(e.createdAt).toLocaleDateString()}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "accounfix_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncDynamics = (id: string) => {
    alert(`Đang kết nối hệ thống Microsoft Dynamics 365...`);
    setTimeout(() => {
      setErrors(prev => prev.map(e => e.id === id ? { ...e, msDynamicsId: `MS-DYN-${Math.floor(Math.random() * 10000)}` } : e));
      alert("Dữ liệu lỗi đã được đẩy lên Cloud của Microsoft thành công!");
    }, 1200);
  };

  const handleCreateError = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    const analysis = await analyzeAccountingError(formData.description, base64Image);
    const newError: AccountingError = {
      id: (errors.length + 1).toString(),
      title: formData.title,
      description: formData.description,
      category: analysis.category || formData.category,
      priority: analysis.priority || formData.priority,
      status: ErrorStatus.PENDING,
      createdAt: Date.now(),
      reporter: 'Admin Web',
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      voucherNo: formData.voucherNo,
      imageUrl: base64Image,
      aiSuggestion: analysis.suggestion,
      chatHistory: []
    };
    setErrors([newError, ...errors]);
    setIsAnalyzing(false);
    setActiveTab('issues');
    setFormData({ title: '', description: '', category: ErrorCategory.OTHER, priority: ErrorPriority.MEDIUM, amount: '', voucherNo: '' });
    setBase64Image(undefined);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedError) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    const updatedHistory = [...(selectedError.chatHistory || []), userMsg];
    setChatLoading(true);
    setChatInput('');
    try {
      const aiResponseText = await chatWithErrorContext(
        `Tiêu đề: ${selectedError.title}. Mô tả: ${selectedError.description}`,
        updatedHistory,
        chatInput
      );
      const aiMsg: ChatMessage = { role: 'model', text: aiResponseText || "Hệ thống AI đang bận, vui lòng thử lại." };
      const newHistory = [...updatedHistory, aiMsg];
      const updatedError = { ...selectedError, chatHistory: newHistory };
      setErrors(prev => prev.map(e => e.id === selectedError.id ? updatedError : e));
      setSelectedError(updatedError);
    } catch (error) {
      console.error(error);
    } finally {
      setChatLoading(false);
    }
  };

  const updateStatus = (id: string, newStatus: ErrorStatus) => {
    setErrors(prev => prev.map(err => err.id === id ? { ...err, status: newStatus } : err));
    if (selectedError?.id === id) {
      setSelectedError(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl">A</div>
          <span className="text-xl font-bold tracking-tight">AccounFix</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedError(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Tổng quan
          </button>
          <button 
            onClick={() => { setActiveTab('issues'); setSelectedError(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'issues' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Danh sách lỗi
          </button>
          <button 
            onClick={() => { setActiveTab('create'); setSelectedError(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Tạo yêu cầu
          </button>
          <div className="pt-4 border-t border-slate-800 mt-4">
            <button 
              onClick={() => { setActiveTab('help'); setSelectedError(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'help' ? 'bg-amber-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Hướng dẫn vận hành
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 m-4 bg-slate-800/50 rounded-xl">
           <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.4 24l-11.4-11.4 11.4-11.4 11.4 11.4-11.4 11.4zM2.8 12.6l8.6 8.6 8.6-8.6-8.6-8.6-8.6 8.6z"/></svg>
            <span className="text-[10px] font-bold uppercase text-slate-300">MS Cloud Connected</span>
          </div>
          <p className="text-[10px] text-slate-500">Hệ thống đang sẵn sàng đồng bộ với Microsoft 365.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
            {activeTab === 'dashboard' && 'Bảng điều khiển'}
            {activeTab === 'issues' && 'Quản lý yêu cầu'}
            {activeTab === 'create' && 'Gửi báo cáo lỗi'}
            {activeTab === 'help' && 'Tài liệu hướng dẫn'}
          </h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1.8 18H14l-2-3.4-2 3.4H8.2l2.9-4.5-2.8-4.5H10l1.9 3.3 1.9-3.3h1.8l-2.8 4.5 2.9 4.5zM13 9V3.5L18.5 9H13z"/></svg>
              Xuất Excel
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <span className="text-slate-400 text-sm font-medium">Tổng số lỗi</span>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{stats.total}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-yellow-400">
                  <span className="text-slate-400 text-sm font-medium">Chờ duyệt</span>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{stats.pending}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-400">
                  <span className="text-slate-400 text-sm font-medium">Đang xử lý</span>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{stats.processing}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-green-400">
                  <span className="text-slate-400 text-sm font-medium">Đã khắc phục</span>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{stats.fixed}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-lg">Hoạt động gần đây</h3>
                  <button onClick={() => setActiveTab('issues')} className="text-blue-600 text-sm font-medium hover:underline">Xem tất cả</button>
                </div>
                <div className="divide-y divide-slate-100">
                  {errors.slice(0, 5).map(e => (
                    <div key={e.id} className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors">
                      <div className="flex gap-4 items-center">
                        <div className={`w-2 h-2 rounded-full ${e.priority === ErrorPriority.URGENT ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <div>
                          <p className="font-semibold text-slate-800">{e.title}</p>
                          <p className="text-xs text-slate-400">{e.reporter} • {new Date(e.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.msDynamicsId && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Synced MS</span>}
                        <StatusBadge type="status" value={e.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'issues' && !selectedError && (
            <div>
              <div className="mb-6">
                <input 
                  type="text" 
                  placeholder="Lọc theo tiêu đề hoặc nội dung lỗi..."
                  className="w-full max-w-md px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredErrors.map(error => (
                  <ErrorCard key={error.id} error={error} onClick={(err) => setSelectedError(err)} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'issues' && selectedError && (
            <div className="max-w-6xl mx-auto flex gap-6 h-full">
              <div className="flex-1 space-y-6 overflow-y-auto pb-10 pr-2 custom-scrollbar">
                <button onClick={() => setSelectedError(null)} className="mb-4 text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Quay lại danh sách
                </button>

                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 flex gap-3">
                    <button 
                      onClick={() => handleSyncDynamics(selectedError.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {selectedError.msDynamicsId ? 'Cập nhật Dynamics' : 'Đẩy lên Dynamics'}
                    </button>
                    <StatusBadge type="status" value={selectedError.status} />
                  </div>
                  
                  <div className="mb-8">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">{selectedError.category}</span>
                    <h1 className="text-3xl font-black text-slate-900 mt-4 leading-tight">{selectedError.title}</h1>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 leading-relaxed whitespace-pre-wrap mb-8">
                    {selectedError.description}
                  </div>

                  <div className="flex gap-2 border-t pt-8">
                    <button onClick={() => updateStatus(selectedError.id, ErrorStatus.PROCESSING)} className="px-6 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-bold border border-blue-200">Đang xử lý</button>
                    <button onClick={() => updateStatus(selectedError.id, ErrorStatus.FIXED)} className="px-6 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors text-sm font-bold border border-green-200">Đã xong</button>
                  </div>
                </div>

                {selectedError.aiSuggestion && (
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm border-l-[12px] border-l-blue-600">
                    <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Phân tích nghiệp vụ (Gemini AI)
                    </h3>
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-blue-900 font-medium italic leading-relaxed">
                      {selectedError.aiSuggestion}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Column */}
              <div className="w-[380px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-bold">Trợ lý Nghiệp vụ</span>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 custom-scrollbar">
                  {selectedError.chatHistory?.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && <div className="text-xs text-slate-400 italic">AI đang xử lý yêu cầu...</div>}
                </div>
                <div className="p-4 bg-white border-t border-slate-100">
                  <input 
                    type="text" 
                    placeholder="Hỏi về nghiệp vụ/cách hạch toán..."
                    className="w-full px-4 py-3 bg-slate-100 rounded-2xl outline-none text-sm"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-10">
               <h2 className="text-3xl font-black text-slate-900 mb-6">Báo cáo sai sót mới</h2>
               <form onSubmit={handleCreateError} className="space-y-6">
                  <input 
                    type="text" 
                    required
                    placeholder="Tiêu đề lỗi (Ví dụ: Sai thuế suất, Chênh lệch tiền...)"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                  <textarea 
                    required
                    rows={6}
                    placeholder="Mô tả chi tiết sai sót. Hãy nêu rõ chứng từ và số tiền để AI hỗ trợ tốt nhất."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                  <button 
                    type="submit" 
                    disabled={isAnalyzing}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-lg shadow-xl disabled:opacity-50"
                  >
                    {isAnalyzing ? 'AI đang phân tích & Phân loại...' : 'Gửi cho Kế toán ngay'}
                  </button>
               </form>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-3xl font-black text-slate-900 mb-6 border-b pb-4">Cách vận hành phần mềm AccounFix</h2>
                
                <div className="space-y-10">
                  <section>
                    <h3 className="text-xl font-bold text-blue-600 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">1</span>
                      Gửi báo cáo lỗi
                    </h3>
                    <p className="text-slate-600 leading-relaxed pl-10">
                      Nhân viên vào tab <b>"Tạo yêu cầu"</b>, nhập tiêu đề và mô tả chi tiết lỗi nghiệp vụ. AI của Gemini sẽ tự động đọc nội dung để phân loại danh mục (Thuế, Hóa đơn,...) và gợi ý mức độ ưu tiên (Thấp, Trung bình, Cao).
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-blue-600 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">2</span>
                      Phân tích AI & Trợ lý ảo
                    </h3>
                    <p className="text-slate-600 leading-relaxed pl-10">
                      Trong phần chi tiết mỗi lỗi, bạn sẽ thấy mục <b>"Phân tích nghiệp vụ"</b>. Đây là nơi AI đưa ra hướng giải quyết dựa trên các quy định kế toán hiện hành. Nếu chưa rõ, hãy dùng ô <b>Chat</b> bên phải để hỏi AI về các hàm Excel cần dùng hoặc cách hạch toán tài khoản.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-blue-600 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">3</span>
                      Kết nối Microsoft Dynamics 365
                    </h3>
                    <p className="text-slate-600 leading-relaxed pl-10">
                      Khi Kế toán xác nhận lỗi, có thể nhấn nút <b>"Đẩy lên Dynamics"</b> để đồng bộ dữ liệu với hệ thống quản trị doanh nghiệp (ERP) của Microsoft. Dữ liệu sẽ được lưu vết để làm bằng chứng kiểm toán sau này.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-blue-600 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm">4</span>
                      Báo cáo & Xuất Excel
                    </h3>
                    <p className="text-slate-600 leading-relaxed pl-10">
                      Cuối tháng, trưởng bộ phận có thể nhấn <b>"Xuất Excel"</b> ở góc trên bên phải để tải file CSV tổng hợp tất cả các lỗi và tiến độ xử lý, phục vụ việc đánh giá KPI và rà soát sai sót định kỳ.
                    </p>
                  </section>
                </div>

                <div className="mt-12 p-6 bg-slate-900 rounded-2xl text-white">
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/></svg>
                    Lưu ý về API Key
                  </h4>
                  <p className="text-sm text-slate-400">
                    Để AI hoạt động, hệ thống yêu cầu biến môi trường <code>API_KEY</code> từ Google Gemini. Nếu bạn đang chạy local, hãy đảm bảo đã cấu hình tệp <code>.env</code>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
