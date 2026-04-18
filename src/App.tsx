import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  BookOpen, 
  History, 
  Upload, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  RefreshCcw, 
  ChevronRight, 
  Image as ImageIcon,
  Loader2,
  Download,
  X,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { cn } from './lib/utils';
import { processWrongQuestion, regenerateSimilarQuestions } from './services/geminiService';
import { WrongQuestionRecord, Question } from './types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import ReactMarkdown from 'react-markdown';

export default function App() {
  const [activeTab, setActiveTab] = useState<'identify' | 'notebook'>('identify');
  const [records, setRecords] = useState<WrongQuestionRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<Partial<WrongQuestionRecord> | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load records from local storage
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions_v1');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved records', e);
      }
    }
  }, []);

  // Save records to local storage
  useEffect(() => {
    localStorage.setItem('wrong_questions_v1', JSON.stringify(records));
  }, [records]);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const data = await processWrongQuestion(base64.split(',')[1], file.type);
      setCurrentResult({
        id: crypto.randomUUID(),
        originalImage: base64,
        originalQuestion: data.originalQuestion,
        knowledgePoint: data.knowledgePoint,
        similarQuestions: data.similarQuestions,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('Processing error:', error);
      alert('识别失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const saveCurrentRecord = () => {
    if (currentResult && currentResult.originalQuestion && currentResult.knowledgePoint && currentResult.similarQuestions) {
      const newRecord = currentResult as WrongQuestionRecord;
      setRecords([newRecord, ...records]);
      setCurrentResult(null);
      setActiveTab('notebook');
    }
  };

  const handleRegenerate = async () => {
    if (!currentResult?.knowledgePoint || !currentResult?.originalQuestion || isGeneratingSimilar) return;
    setIsGeneratingSimilar(true);
    try {
      const data = await regenerateSimilarQuestions(currentResult.knowledgePoint, currentResult.originalQuestion);
      setCurrentResult({ ...currentResult, similarQuestions: data.similarQuestions });
    } catch (error) {
      alert('重新生成失败');
    } finally {
      setIsGeneratingSimilar(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedRecords(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteRecord = (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      setRecords(records.filter(r => r.id !== id));
      setSelectedRecords(selectedRecords.filter(i => i !== id));
    }
  };

  const generatePDF = async () => {
    if (selectedRecords.length === 0) return alert('请先选择要打印的题目');
    
    // Show a global loader for PDF generation
    setIsProcessing(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const container = document.createElement('div');
      container.style.width = '210mm';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.padding = '20mm';
      container.style.backgroundColor = 'white';
      container.style.color = 'black';
      container.className = 'pdf-container';
      document.body.appendChild(container);

      const itemsToPrint = records
        .filter(r => selectedRecords.includes(r.id))
        .sort((a, b) => b.createdAt - a.createdAt);

      for (let i = 0; i < itemsToPrint.length; i++) {
        const record = itemsToPrint[i];
        const itemDiv = document.createElement('div');
        itemDiv.style.marginBottom = '20px';
        itemDiv.style.pageBreakInside = 'avoid';
        itemDiv.innerHTML = `
          <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
            <h2 style="font-size: 18px; margin: 0;">知识点：${record.knowledgePoint}</h2>
            <div style="font-size: 12px; color: #666;">生成时间: ${new Date(record.createdAt).toLocaleString()}</div>
          </div>
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; margin-bottom: 10px; color: #111;">【原题回顾】</h3>
            <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${record.originalQuestion.content}</div>
          </div>
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; margin-bottom: 15px; color: #111;">【举一反三】</h3>
            ${record.similarQuestions.map((q, idx) => `
              <div style="margin-bottom: 25px; padding-left: 10px; border-left: 3px solid #eee;">
                <div style="font-weight: bold; margin-bottom: 5px;">题目 ${idx + 1}：</div>
                <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 10px;">${q.content}</div>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 10px;">
                  <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">[答案与解析]</div>
                  <div style="font-size: 13px; line-height: 1.5;">${q.answer}</div>
                  <div style="font-size: 12px; color: #444; margin-top: 5px; border-top: 1px dashed #ccc; pt-4;">
                    <span style="color: #d97706; font-weight: bold;">易错分析：</span>${q.analysis}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(itemDiv);
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Since it can be multiple pages, we might need a different strategy if it's very long
      // Simpler approach: if overflow, we just output the long image and jspdf handles it? No.
      // Better strategy: print each record as a separate canvas or split the long canvas.
      // For this prototype, I'll export as a simple continuous image on 1 or more pages.
      
      let heightLeft = pdfHeight;
      let position = 0;
      let pageHeight = doc.internal.pageSize.getHeight();

      doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      doc.save(`错题打印_${new Date().getTime()}.pdf`);
      document.body.removeChild(container);
    } catch (err) {
      console.error(err);
      alert('PDF 生成失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.knowledgePoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.originalQuestion.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-[#1A1A1A] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Printer size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">错题举一反三打印机</h1>
            <p className="text-xs text-gray-400">智能同步 & 变式练习</p>
          </div>
        </div>
        
        {activeTab === 'notebook' && records.length > 0 && (
          <button 
            onClick={generatePDF}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200",
              selectedRecords.length === 0 && "opacity-50 cursor-not-allowed bg-gray-400"
            )}
          >
            <Printer size={16} />
            <span>打印已选 ({selectedRecords.length})</span>
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'identify' ? (
            <motion.div 
              key="identify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!currentResult ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer bg-white group hover:border-indigo-400 hover:bg-indigo-50/30",
                    isDragActive ? "border-indigo-500 bg-indigo-50 text-indigo-500 scale-[0.98]" : "border-gray-300"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                    {isProcessing ? <Loader2 className="animate-spin" size={40} /> : <Camera size={40} />}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{isProcessing ? "AI 识别中..." : "点击或拖拽上传错题照片"}</h3>
                  <p className="text-sm text-gray-500 text-center max-w-xs">
                    支持拍照上传或从相册选择图片，自动提取题目、生成解析
                  </p>
                  
                  {isProcessing && (
                    <div className="mt-8 w-full max-w-xs bg-gray-200 rounded-full h-1 overflow-hidden">
                      <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="bg-indigo-600 h-full w-1/3"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => setCurrentResult(null)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                    <h2 className="text-2xl font-bold">识别结果</h2>
                  </div>

                  {/* Identification Result Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Original Image & Basic Info */}
                    <div className="md:col-span-1 space-y-4">
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">原图参考</h3>
                        {currentResult.originalImage && (
                          <img 
                            src={currentResult.originalImage} 
                            alt="Original" 
                            className="w-full rounded-lg object-contain bg-gray-50 h-48 border border-gray-100"
                          />
                        )}
                        <div className="mt-4">
                          <label className="text-xs font-bold text-gray-400 block mb-1">知识点</label>
                          <input 
                            type="text" 
                            value={currentResult.knowledgePoint}
                            onChange={(e) => setCurrentResult({...currentResult, knowledgePoint: e.target.value})}
                            className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>
                      
                      <button 
                        onClick={saveCurrentRecord}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg active:scale-95"
                      >
                        <CheckCircle2 size={24} />
                        保存到错题本
                      </button>
                    </div>

                    {/* Question Editing Area */}
                    <div className="md:col-span-2 space-y-6">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold">原题详情</h3>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">可手动修正</span>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">题目文本</label>
                            <textarea 
                              className="w-full h-32 p-4 bg-gray-50 rounded-xl resize-none text-sm leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500/10 outline-none border border-transparent focus:border-indigo-200 transition-all"
                              value={currentResult.originalQuestion?.content}
                              onChange={(e) => setCurrentResult({
                                ...currentResult, 
                                originalQuestion: { ...currentResult.originalQuestion!, content: e.target.value } 
                              })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-gray-400 block mb-1">答案</label>
                              <input 
                                className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none"
                                value={currentResult.originalQuestion?.answer || ''}
                                onChange={(e) => setCurrentResult({
                                  ...currentResult, 
                                  originalQuestion: { ...currentResult.originalQuestion!, answer: e.target.value } 
                                })}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-gray-400 block mb-1">解析</label>
                              <input 
                                className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none"
                                value={currentResult.originalQuestion?.analysis || ''}
                                onChange={(e) => setCurrentResult({
                                  ...currentResult, 
                                  originalQuestion: { ...currentResult.originalQuestion!, analysis: e.target.value } 
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Similar Questions Preview */}
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            <RefreshCcw size={18} className="text-indigo-600" />
                            智能举一反三
                          </h3>
                          <button 
                            onClick={handleRegenerate}
                            disabled={isGeneratingSimilar}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
                          >
                            {isGeneratingSimilar ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                            重新生成
                          </button>
                        </div>

                        <div className="space-y-4">
                          {currentResult.similarQuestions?.map((q, idx) => (
                            <div key={idx} className="p-4 bg-gray-50 rounded-2xl group hover:bg-white hover:ring-2 hover:ring-indigo-100 transition-all border border-transparent">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded uppercase">变式 {idx+1}</span>
                                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded text-gray-400 transition-all">
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                              <div className="text-sm line-clamp-3 text-gray-700 leading-relaxed markdown-content">
                                <ReactMarkdown>{q.content}</ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="notebook"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Notebook Toolbar */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="搜索知识点或题目..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      if (selectedRecords.length === filteredRecords.length) setSelectedRecords([]);
                      else setSelectedRecords(filteredRecords.map(r => r.id));
                    }}
                    className="flex-1 md:flex-none text-xs font-bold px-4 py-2 rounded-xl text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    {selectedRecords.length === filteredRecords.length ? '取消全选' : '全选'}
                  </button>
                  {selectedRecords.length > 0 && (
                    <button 
                      onClick={() => {
                        if (confirm(`确定要删除选中的 ${selectedRecords.length} 条记录吗？`)) {
                          setRecords(records.filter(r => !selectedRecords.includes(r.id)));
                          setSelectedRecords([]);
                        }
                      }}
                      className="flex-1 md:flex-none text-xs font-bold px-4 py-2 rounded-xl text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      批量删除
                    </button>
                  )}
                </div>
              </div>

              {/* Records List */}
              {filteredRecords.length === 0 ? (
                <div className="bg-white rounded-[40px] p-20 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6">
                    <BookOpen size={48} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">错题本空空如也</h3>
                  <p className="text-gray-400 max-w-xs mb-8">开始拍照识题，构建你的专属个性化复习库吧！</p>
                  <button 
                    onClick={() => setActiveTab('identify')}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    去拍照识题
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredRecords.map((record) => (
                    <RecordCard 
                      key={record.id}
                      record={record}
                      selected={selectedRecords.includes(record.id)}
                      onToggle={() => toggleSelect(record.id)}
                      onDelete={() => deleteRecord(record.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-gray-100 p-2 rounded-full shadow-2xl flex gap-1 z-50">
        <button 
          onClick={() => setActiveTab('identify')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all",
            activeTab === 'identify' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <Camera size={18} />
          <span>错题识别</span>
        </button>
        <button 
          onClick={() => setActiveTab('notebook')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all",
            activeTab === 'notebook' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <History size={18} />
          <span>历史错题本</span>
          {records.length > 0 && (
            <span className={cn(
              "ml-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px]",
              activeTab === 'notebook' ? "bg-white text-indigo-600" : "bg-gray-100 text-gray-500"
            )}>
              {records.length}
            </span>
          )}
        </button>
      </nav>

      {/* Transition Loader Overlay */}
      <AnimatePresence>
        {isProcessing && activeTab === 'identify' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-white/20 backdrop-blur-sm pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecordCard({ record, selected, onToggle, onDelete }: { 
  record: WrongQuestionRecord, 
  selected: boolean, 
  onToggle: () => void,
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "group relative bg-white rounded-3xl overflow-hidden transition-all duration-300 border",
      selected ? "border-indigo-600 ring-4 ring-indigo-50 shadow-md" : "border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200"
    )}>
      {/* Top Section / Summary */}
      <div className="p-5 flex gap-4 items-start">
        <div 
          onClick={onToggle}
          className={cn(
            "mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
            selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-200 hover:border-indigo-300"
          )}
        >
          {selected && <CheckCircle2 size={16} />}
        </div>
        
        <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {record.knowledgePoint}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(record.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h4 className="font-bold text-gray-800 mb-1 line-clamp-2 leading-snug">
            {record.originalQuestion.content}
          </h4>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Plus size={10} className="text-indigo-400" />
            包含 3 个“举一反三”变式题
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button 
            onClick={onDelete}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 size={18} />
          </button>
          <button 
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "p-2 text-indigo-400 hover:bg-indigo-50 rounded-xl transition-all",
              expanded && "bg-indigo-50 rotate-90"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50 border-t border-gray-100"
          >
            <div className="p-6 space-y-6">
              {/* Original Content */}
              <div className="bg-white p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between mb-4">
                  <h5 className="text-sm font-bold flex items-center gap-2">
                    <div className="w-1 h-3 bg-gray-400 rounded-full" />
                    原题回顾
                  </h5>
                  {record.originalImage && (
                    <button 
                      onClick={() => window.open(record.originalImage, '_blank')}
                      className="text-[10px] font-bold text-indigo-600 flex items-center gap-1"
                    >
                      查看原图 <ImageIcon size={12} />
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap markdown-content">
                  <ReactMarkdown>{record.originalQuestion.content}</ReactMarkdown>
                </div>
                <div className="space-y-2 border-t border-dashed border-gray-100 pt-4">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-gray-400 shrink-0 mt-0.5">答案：</span>
                    <span className="text-sm font-semibold text-indigo-600">{record.originalQuestion.answer}</span>
                  </div>
                  {record.originalQuestion.analysis && (
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold text-gray-400 shrink-0 mt-0.5">解析：</span>
                        <div className="text-xs text-gray-500 leading-relaxed markdown-content">
                          <ReactMarkdown>{record.originalQuestion.analysis}</ReactMarkdown>
                        </div>
                      </div>
                  )}
                </div>
              </div>

              {/* Similar Questions */}
              <div className="space-y-4">
                <h5 className="text-sm font-bold flex items-center gap-2 ml-1">
                  <div className="w-1 h-3 bg-indigo-600 rounded-full" />
                  “举一反三” 变式集
                </h5>
                <div className="grid grid-cols-1 gap-4">
                  {record.similarQuestions.map((q, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200/50">
                      <div className="text-xs font-bold text-indigo-400 mb-2">题目 {idx+1}</div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap markdown-content">
                        <ReactMarkdown>{q.content}</ReactMarkdown>
                      </p>
                      
                      <details className="group border-t border-dashed border-gray-100 pt-3">
                        <summary className="list-none flex items-center gap-1 text-[10px] font-bold text-indigo-600 cursor-pointer uppercase tracking-widest hover:text-indigo-700 transition-colors">
                          <Download size={10} /> 
                          显示答案与易错点分析
                        </summary>
                        <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl space-y-2">
                          <div className="text-xs">
                            <span className="font-bold text-indigo-600 mr-2">答案:</span>
                            {q.answer}
                          </div>
                          <div className="text-xs leading-relaxed markdown-content">
                            <span className="font-bold text-orange-600 mr-2">易错点:</span>
                            <ReactMarkdown>{q.analysis}</ReactMarkdown>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
