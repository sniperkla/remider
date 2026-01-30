"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Mic,
  MicOff,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Calendar,
  HelpCircle,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { data: session, status } = useSession();

  const [balance, setBalance] = useState(0);
  const [budget, setBudget] = useState(1000);
  const [transactions, setTransactions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [manualAmount, setManualAmount] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualType, setManualType] = useState("expense");

  const recognitionRef = useRef(null);

  // Load data from localStorage (In real app, we'd use the API)
  useEffect(() => {
    if (session) {
      const userId = session.user.email;
      const savedBalance = localStorage.getItem(`remiderme_balance_${userId}`);
      const savedBudget = localStorage.getItem(`remiderme_budget_${userId}`);
      const savedTransactions = localStorage.getItem(`remiderme_transactions_${userId}`);

      if (savedBalance) setBalance(parseFloat(savedBalance));
      if (savedBudget) setBudget(parseFloat(savedBudget));
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    }
  }, [session]);

  // Save data to localStorage
  useEffect(() => {
    if (session) {
      const userId = session.user.email;
      localStorage.setItem(`remiderme_balance_${userId}`, balance.toString());
      localStorage.setItem(`remiderme_budget_${userId}`, budget.toString());
      localStorage.setItem(`remiderme_transactions_${userId}`, JSON.stringify(transactions));
    }
  }, [balance, transactions, budget, session]);

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "th-TH";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      
      recognitionRef.current.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
        processVoiceCommand(result);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      recognitionRef.current.start();
    }
  };

  const processVoiceCommand = (text) => {
    const cleanedText = text.replace(/,/g, "");
    const amountMatch = cleanedText.match(/\d+(\.\d+)?/g);
    if (!amountMatch) return;

    const amount = parseFloat(amountMatch[0]);
    let type = "expense";
    
    const incomeKeywords = ["ได้", "เข้า", "บวก", "ขาย", "รายได้", "เงินเดือน", "คืน"];
    const expenseKeywords = ["จ่าย", "ซื้อ", "เสีย", "ลบ", "ออก", "ค่า"];
    const isIncome = incomeKeywords.some((kw) => text.includes(kw));
    const isExpense = expenseKeywords.some((kw) => text.includes(kw));

    if (isIncome && !isExpense) type = "income";

    let category = "อื่นๆ";
    const catMap = {
      "อาหาร": ["กิน", "ข้าว", "น้ำ", "กาแฟ", "ขนม", "มื้อ"],
      "การเดินทาง": ["รถ", "น้ำมัน", "แท็กซี่", "bts", "mrt", "วิน"],
      "ของใช้": ["ซื้อของ", "เซเว่น", "ซุปเปอร์", "ห้าง"],
      "บันเทิง": ["หนัง", "เกม", "เที่ยว"],
      "ที่พัก": ["ค่าเช่า", "น้ำไฟ", "ห้อง"],
      "โอน/ถอน": ["โอน", "ถอน", "ตู้"],
      "รายได้": ["เงินเดือน", "โบนัส", "ขายของ"]
    };

    for (const [cat, keywords] of Object.entries(catMap)) {
      if (keywords.some(kw => text.includes(kw))) {
        category = cat;
        break;
      }
    }

    const originalNumberMatch = text.match(/[\d,.]+/);
    let description = text;
    if (originalNumberMatch) {
      description = description.replace(originalNumberMatch[0], "");
    }
    description = description.replace("บาท", "").replace("วันนี้", "").trim();
    if (!description) description = type === "income" ? "รายรับ" : "รายจ่าย";

    addTransaction(amount, type, description, category);
  };

  const addTransaction = (amount, type, description, category = "อื่นๆ") => {
    const newTransaction = {
      id: Date.now(),
      amount,
      type,
      description,
      category,
      date: new Date().toISOString(),
    };

    setTransactions((prev) => [newTransaction, ...prev]);
    if (type === "income") {
      setBalance((prev) => prev + amount);
    } else {
      setBalance((prev) => prev - amount);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("กรุณาใส่จำนวนเงินที่ถูกต้อง");
      return;
    }
    let category = manualType === "income" ? "รายได้" : "อื่นๆ";
    addTransaction(amount, manualType, manualDesc || (manualType === "income" ? "รายรับ" : "รายจ่าย"), category);
    setManualAmount("");
    setManualDesc("");
    setManualType("expense");
    setShowManualEntry(false);
  };

  const deleteTransaction = (id) => {
    const transaction = transactions.find((t) => t.id === id);
    if (transaction) {
      if (transaction.type === "income") {
        setBalance((prev) => prev - transaction.amount);
      } else {
        setBalance((prev) => prev + transaction.amount);
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const clearAppData = () => {
    if (window.confirm("คุณต้องการรีเซ็ตข้อมูลทั้งหมดใช่หรือไม่?")) {
      setBalance(0);
      setTransactions([]);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  if (status === "loading") {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>กำลังโหลด...</div>;
  }

  if (!session) {
    return (
      <div className="app-container login-page">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card"
          style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent-pink))', width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={40} color="white" />
          </div>
          <div>
            <h1>RemiderMe</h1>
            <p className="text-sm" style={{ marginTop: '0.5rem' }}>จดบันทึกรายรับรายจ่ายด้วยเสียงที่ง่ายที่สุด</p>
          </div>
          <button onClick={() => signIn("google")} className="btn-primary" style={{ marginTop: '1rem' }}>
             เข้าสู่ระบบด้วย Google (Gmail)
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={session.user.image} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
          <div>
            <h1 style={{ fontSize: "1.2rem" }}>หวัดดี, {session.user.name.split(' ')[0]}</h1>
            <p className="text-sm">{new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric" })}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <Settings size={22} />
          </button>
          <button onClick={() => setShowHelp(!showHelp)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <HelpCircle size={22} />
          </button>
          <button onClick={() => signOut()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glass-card" style={{ marginBottom: '1rem', border: '1px solid var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>ตั้งค่างบประมาณ</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'white' }}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="number" value={budget} onChange={(e) => setBudget(parseFloat(e.target.value) || 0)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '12px', color: 'white' }} />
              <button onClick={() => setShowSettings(false)} className="btn-primary">ตกลง</button>
            </div>
            <button onClick={clearAppData} className="text-sm" style={{ marginTop: '1rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>ลบข้อมูลทั้งหมด</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card" style={{ marginBottom: "1rem" }}>
            <h3>วิธีใช้งาน</h3>
            <p className="text-sm">• "จ่ายค่าข้าว 120"<br/>• "ได้เงินเดือน 30000"</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className="glass-card" style={{ textAlign: "center", background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))" }}>
        <span className="text-sm">ยอดเงินคงเหลือ</span>
        <div className="balance-amount">฿{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        
        <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-sm">งบวันนี้ ({Math.min(100, Math.round((transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0) / budget) * 100))}%)</span>
            <span className="text-sm">฿{transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0).toLocaleString()} / ฿{budget.toLocaleString()}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0) / budget) * 100)}%` }} style={{ height: '100%', background: transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0) > budget ? 'var(--danger)' : 'linear-gradient(to right, var(--primary), var(--accent-pink))' }} />
          </div>
        </div>
      </motion.div>

      <div className="transaction-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={16} /> <span className="text-sm">วันนี้</span>
          </div>
          <button onClick={() => setShowSummary(!showSummary)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <BarChart3 size={18} /> <span className="text-sm">ดูรายงาน</span>
          </button>
        </div>

        <AnimatePresence>
            {showSummary && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ marginBottom: '1rem' }}>
                    <p className="text-sm" style={{ fontWeight: 600 }}>สรุปค่าใช้จ่าย</p>
                    {Object.entries(transactions.filter(t => t.type === 'expense').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {})).map(([cat, total]) => (
                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                            <span className="text-sm">{cat}</span>
                            <span className="text-sm">฿{total.toLocaleString()}</span>
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>ยังไม่มีรายการ</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {transactions.map((t) => (
              <motion.div key={t.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="transaction-item">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: "10px", borderRadius: "12px", background: t.type === "income" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: t.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {t.type === "income" ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: "600" }}>{t.description}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <span className="text-sm">{formatDate(t.date)}</span>
                       <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>{t.category}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ fontWeight: "700", color: t.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {t.type === "income" ? "+" : "-"} {t.amount.toLocaleString()}
                  </div>
                  <button onClick={() => deleteTransaction(t.id)} style={{ background: "none", border: "none", color: "var(--glass-border)", cursor: "pointer" }}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div style={{ height: '100px' }}></div>

        <AnimatePresence>
            {showManualEntry && (
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="glass-card" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 110, borderRadius: '32px 32px 0 0' }}>
                    <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => setManualType('expense')} className="btn-primary" style={{ flex: 1, background: manualType === 'expense' ? 'var(--danger)' : 'var(--glass)' }}>รายจ่าย</button>
                            <button type="button" onClick={() => setManualType('income')} className="btn-primary" style={{ flex: 1, background: manualType === 'income' ? 'var(--success)' : 'var(--glass)' }}>รายรับ</button>
                        </div>
                        <input type="number" placeholder="บาท" value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} required />
                        <input type="text" placeholder="รายละเอียด" value={manualDesc} onChange={e => setManualDesc(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} />
                        <button type="submit" className="btn-primary">บันทึก</button>
                        <button type="button" onClick={() => setShowManualEntry(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>ยกเลิก</button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>

      <div className="mic-button-container" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button onClick={() => setShowManualEntry(true)} className="btn-outline" style={{ borderRadius: '50%', width: '56px', height: '56px' }}>
          <Wallet size={24} />
        </button>
        <div style={{ position: 'relative' }}>
            <button className={`mic-button ${isListening ? 'active' : ''}`} onClick={toggleListening}>
                {isListening ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
        </div>
        <button onClick={() => setShowSummary(!showSummary)} className="btn-outline" style={{ borderRadius: '50%', width: '56px', height: '56px' }}>
          <BarChart3 size={24} />
        </button>
      </div>
    </div>
  );
}
