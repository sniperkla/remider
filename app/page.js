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
  Camera,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";

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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

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
    // 1. Identify Amount (Smarter extraction with Thai word support)
    const cleanedText = text.replace(/,/g, "");
    
    // Support Thai number words
    const thaiMultipliers = {
      "ล้าน": 1000000,
      "แสน": 100000,
      "หมื่น": 10000,
      "พัน": 1000,
      "ร้อย": 100
    };

    let amount = 0;
    const amountMatch = cleanedText.match(/\d+(\.\d+)?/g);
    
    if (amountMatch) {
      amount = parseFloat(amountMatch[0]);
      
      // Check for multipliers right after the number
      for (const [word, multiplier] of Object.entries(thaiMultipliers)) {
        if (cleanedText.includes(`${amountMatch[0]} ${word}`) || cleanedText.includes(`${amountMatch[0]}${word}`)) {
          amount = amount * multiplier;
          break;
        }
      }
    } else {
      // Check for words without digits (e.g., "หนึ่งล้าน")
      // This is a simplified version, can be expanded
      return; 
    }

    if (amount === 0) return;
    
    // 2. Identify Transaction Type (Income vs Expense)
    const incomeKeywords = [
      // Thai - General
      "ได้", "เข้า", "บวก", "ขาย", "รายได้", "รับ", "โอนเข้า", "มาให้", "ให้มา", "ตกมา", "หยิบมา", "เจอ", "พบ", "เก็บได้",
      // Thai - Salary/Work
      "เงินเดือน", "เบิก", "ค่าจ้าง", "ค่าแรง", "โอที", "เบี้ยเลี้ยง", "คอมมิชชั่น", "ค่าคอม", "โบนัส", "เงินรางวัล",
      // Thai - Gifts/Luck
      "ถูกหวย", "ถูกรางวัล", "รางวัล", "อั่งเปา", "ของขวัญ", "เงินช่วย", "เงินอุดหนุน", "ทุน", "เงินทุน",
      // Thai - Investment/Finance
      "กำไร", "ปันผล", "ดอกเบี้ย", "ผลตอบแทน", "เงินปันผล", "ขายหุ้น", "ขายกองทุน",
      // Thai - Borrow/Return
      "กู้", "ยืมมา", "คืน", "ได้คืน", "เงินคืน", "รับคืน", "โอนคืน", "ทอน", "เงินทอน",
      // Thai - Other
      "โอนมา", "ส่งมา", "ฝากมา", "เหลือ", "ประหยัด", "ลดราคา", "ส่วนลด",
      // English - General
      "get", "got", "received", "receive", "income", "plus", "add", "deposit", "credited",
      // English - Salary/Work
      "salary", "wage", "bonus", "commission", "overtime", "allowance", "paycheck", "payroll",
      // English - Gifts/Luck
      "win", "won", "prize", "reward", "gift", "lottery", "jackpot", "lucky",
      // English - Investment/Finance
      "profit", "dividend", "interest", "return", "yield", "gain", "capital gain",
      // English - Borrow/Return
      "borrow", "borrowed", "refund", "cashback", "rebate", "reimbursement", "returned",
      // English - Other
      "earn", "earned", "collect", "save", "saved", "discount"
    ];
    const expenseKeywords = [
      // Thai - General
      "จ่าย", "ซื้อ", "เสีย", "ลบ", "ออก", "ค่า", "หมด", "ไป", "โอนออก", "โอนไป", "ส่งไป",
      // Thai - Payment
      "ชำระ", "จ่ายค่า", "จ่ายเงิน", "จ่ายบิล", "เสียค่า", "เสียเงิน", "หักเงิน",
      // Thai - Shopping
      "ช้อป", "ช้อปปิ้ง", "สั่งซื้อ", "กดซื้อ", "เหมา", "ตุน",
      // Thai - Top up/Add
      "เติม", "เติมเงิน", "เติมน้ำมัน", "เติมเครดิต", "ท็อปอัพ",
      // Thai - Loss
      "หาย", "สูญ", "เสียหาย", "โดนโกง", "โดนขโมย",
      // Thai - Donation/Charity
      "ทำบุญ", "บริจาค", "ใส่บาตร", "ถวาย", "ให้ทาน",
      // Thai - Debt/Installment
      "ผ่อน", "งวด", "หนี้", "ใช้หนี้", "คืนเงิน", "ชำระหนี้", "ติดหนี้",
      // Thai - Tax/Fine
      "ภาษี", "ปรับ", "ค่าปรับ", "โดนปรับ", "เสียภาษี",
      // Thai - Bills
      "ค่าน้ำ", "ค่าไฟ", "ค่าเน็ต", "ค่าโทร", "ค่าเช่า", "ค่าประกัน", "ค่าบริการ",
      // English - General
      "pay", "paid", "buy", "bought", "purchase", "spent", "spend", "loss", "minus", "out", "cost",
      // English - Payment
      "bill", "fee", "charge", "debit", "debited", "checkout", "invoice",
      // English - Shopping
      "shop", "shopping", "order", "ordered",
      // English - Top up
      "topup", "top up", "reload", "recharge",
      // English - Loss
      "lost", "lose", "stolen", "scam", "scammed",
      // English - Donation
      "donate", "donated", "donation", "charity", "tip", "tipped",
      // English - Debt/Installment
      "loan", "installment", "debt", "repay", "repayment", "mortgage",
      // English - Tax/Fine
      "tax", "fine", "penalty", "surcharge",
      // English - Subscription
      "subscription", "subscribe", "membership", "premium", "renewal",
      // English - Other
      "expense", "withdrawal", "transfer"
    ];
    
    const lowerText = text.toLowerCase();
    const isIncome = incomeKeywords.some((kw) => lowerText.includes(kw));
    const isExpense = expenseKeywords.some((kw) => lowerText.includes(kw));

    let type = "expense"; // Default to expense
    if (isIncome && !isExpense) type = "income";

    // 3. Identify Category (Detailed mapping for both languages)
    let category = "อื่นๆ";
    const catMap = {
      "อาหาร": ["กิน", "ข้าว", "น้ำ", "กาแฟ", "ขนม", "มื้อ", "อาหาร", "หิว", "สั่ง", "ชา", "ต้ม", "ผัด", "แกง", "ทอด", "eat", "food", "rice", "water", "coffee", "drink", "snack", "meal", "dinner", "lunch", "breakfast", "cafe", "starbucks", "grabfood", "lineman", "foodpanda"],
      "เดินทาง": ["รถ", "น้ำมัน", "แท็กซี่", "วิน", "มา", "ไป", "โบลท์", "กรับ", "ค่ารถ", "เรือ", "เครื่องบิน", "ตั๋ว", "parking", "car", "gas", "petrol", "taxi", "bts", "mrt", "bus", "train", "flight", "fare", "grab", "bolt"],
      "ของใช้": ["ซื้อของ", "เซเว่น", "ซุปเปอร์", "ห้าง", "เสื้อ", "กางเกง", "ของใช้", "ช้อป", "แอป", "ของกินของใช้", "buy", "shop", "mall", "market", "7-11", "supermarket", "cloth", "item", "stuff", "shopee", "lazada", "tiktok"],
      "บันเทิง": ["หนัง", "เกม", "เที่ยว", "ปาร์ตี้", "ดูหนัง", "เล่นเกม", "ฟังเพลง", "คอนเสิร์ต", "movie", "game", "travel", "trip", "leisure", "party", "netflix", "spotify", "youtube"],
      "ที่พัก": ["ค่าเช่า", "น้ำไฟ", "ห้อง", "บ้าน", "เน็ต", "ไวไฟ", "บิล", "คอนโด", "หอพัก", "rent", "room", "water", "electric", "bill", "wifi", "internet", "house", "condo"],
      "การเงิน": ["โอน", "ถอน", "ตู้", "ธนาคาร", "ค่าธรรมเนียม", "ดอกเบี้ย", "เงินกู้", "transfer", "atm", "withdraw", "bank", "fee", "interest", "loan"],
      "สุขภาพ": ["โรงพยาบาล", "ยา", "หาหมอ", "ยิม", "คลินิก", "ประกัน", "ฟิตเนส", "หน้า", "สปา", "hospital", "drug", "medicine", "doctor", "gym", "fitness", "insurance", "skincare"],
      "รายได้": ["เงินเดือน", "โบนัส", "ขายของ", "กำไร", "คอมมิชชั่น", "ทิป", "ปันผล", "ถูกหวย", "รางวัล", "salary", "bonus", "sell", "earn", "profit", "commission", "tip", "dividend"]
    };

    for (const [cat, keywords] of Object.entries(catMap)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        category = cat;
        break;
      }
    }

    // 4. Construct Description (Clean up the text)
    const originalNumberMatch = text.match(/[\d,.]+/);
    let description = text;
    if (originalNumberMatch) {
      description = description.replace(originalNumberMatch[0], "");
    }
    
    // Remove common filter words
    const filterWords = ["บาท", "วันนี้", "เมื่อกี้", "เมื่อวาน", "baht", "today", "yesterday", "this"];
    filterWords.forEach(word => {
      description = description.replace(word, "");
    });
    
    description = description.trim();
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

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessingImage(true);
    setBatchProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      setScanProgress(0);
      
      try {
        const result = await Tesseract.recognize(files[i], "tha+eng", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setScanProgress(Math.round(m.progress * 100));
            }
          },
        });

        const text = result.data.text;
        console.log(`OCR Result (File ${i + 1}):`, text);
        processOcrText(text);
      } catch (error) {
        console.error(`OCR Error (File ${i + 1}):`, error);
      }
    }

    setIsProcessingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processOcrText = (text) => {
    // 1. Normalize text (keep decimals and basic structure)
    let cleanedText = text.replace(/,/g, ""); 
    const lowerText = cleanedText.toLowerCase();
    
    console.log("Processing cleaned text:", cleanedText);

    // 2. Filter out common distractions (Dates, Times, long Ref IDs)
    // Remove times: HH:mm:ss or HH:mm
    cleanedText = cleanedText.replace(/\d{2}:\d{2}(:\d{2})?/g, " [TIME] ");
    // Remove dates: DD/MM/YY, DD-MM-YYYY, etc.
    cleanedText = cleanedText.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, " [DATE] ");
    // Remove long numbers (Ref IDs / Account numbers) - usually 10+ digits with no dot
    cleanedText = cleanedText.replace(/\b\d{10,}\b/g, " [REF] ");

    // 3. Smart Amount Detection
    // Priority 1: Numbers with 2 decimals that follow "Amount" or Thai equivalent
    const amountKeywords = [
      // Bank Slips
      "จำนวนเงิน", "ยอดโอน", "ยอดเงิน", "จ่ายแล้ว", "สำเร็จ",
      // Retail / 7-11 / Receipts
      "ราคารวม", "รวมทั้งสิ้น", "รวมเงิน", "ยอดรวม", "เงินสด", "ยอดชำระ", "ชำระเงิน",
      // English / International
      "amount", "total", "net amount", "grand total", "paid", "transfer", "total due", "balance due", "subtotal", "vat", "tax"
    ];
    
    let finalAmount = 0;
    let found = false;

    // Search for number near keywords
    for (const kw of amountKeywords) {
      const idx = cleanedText.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        // Look at the text shortly after the keyword
        const windowText = cleanedText.substring(idx, idx + 60);
        // Look for number with decimal first (most accurate for amounts)
        const decimalMatch = windowText.match(/(\d+\.\d{2})/);
        if (decimalMatch) {
          finalAmount = parseFloat(decimalMatch[0]);
          found = true;
          break;
        }
        // Then look for any number
        const numberMatch = windowText.match(/(\d+(\.\d+)?)/);
        if (numberMatch) {
          finalAmount = parseFloat(numberMatch[0]);
          found = true;
          break;
        }
      }
    }

    // Priority 2: If no keyword match, look for the most "amount-like" number
    if (!found) {
      // Find all numbers with exactly 2 decimal places (Very common for bills)
      const decimalMatches = cleanedText.match(/(\d+\.\d{2})/g);
      if (decimalMatches) {
        // Take the largest one with decimals (usually the total)
        finalAmount = Math.max(...decimalMatches.map(m => parseFloat(m)));
        found = true;
      } else {
        // Last resort: find any number and guess
        const allNumbers = cleanedText.match(/(\d+(\.\d+)?)/g);
        if (allNumbers) {
          const skipYears = [2023, 2024, 2025, 2566, 2567, 2568];
          const candidates = allNumbers
            .map(m => parseFloat(m))
            .filter(n => n > 0 && n < 5000000 && !skipYears.includes(n));
          
          if (candidates.length > 0) {
            finalAmount = Math.max(...candidates);
            found = true;
          }
        }
      }
    }

    if (found && finalAmount > 0) {
      // 4. Determine Type (Default to expense unless "receiver" keywords present)
      let type = "expense";
      const incomeTriggers = ["รับเงิน", "เงินเข้า", "โอนเข้า", "receiver", "income", "credit"];
      if (incomeTriggers.some(kw => lowerText.includes(kw))) {
        type = "income";
      }

      // 5. Category detection
      let category = "อื่นๆ";
      const catKeywords = {
        "อาหาร": ["cafe", "coffee", "restaurant", "food", "ข้าว", "น้ำ", "กาแฟ", "grabfood", "lineman", "foodpanda", "kfc", "mcdonald", "starbucks"],
        "เดินทาง": ["taxi", "grab", "bolt", "ptt", "shell", "bangchak", "น้ำมัน", "ค่ารถ", "bts", "mrt", "ทางด่วน"],
        "ที่พัก": ["ค่าน้ำ", "ค่าไฟ", "ค่าเช่า", "rent", "electricity", "water bill", "pea", "mea", "mwa", "pwa", "คอนโด", "หอพัก"],
        "ของใช้": ["7-11", "cp all", "shopee", "lazada", "ห้าง", "เซเว่น", "lotus", "big c", "tops", "makro", "watsons"],
        "การเงิน": ["fee", "ค่าธรรมเนียม", "ดอกเบี้ย", "insurance", "ประกัน", "ภาษี", "tax"],
        "สื่อสาร": ["ais", "true", "dtac", "ค่าโทร", "อินเตอร์เน็ต", "wifi", "internet", "netflix", "youtube", "spotify"]
      };

      for (const [cat, words] of Object.entries(catKeywords)) {
        if (words.some(w => lowerText.includes(w))) {
          category = cat;
          break;
        }
      }

      addTransaction(finalAmount, type, "สแกนจากสลิป/บิล", category);
    } else {
      alert("ไม่สามารถระบุจำนวนเงินได้ กรุณาลองปรับมุมกล้องหรือใส่เองครับ");
    }
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
        <input 
          type="file" 
          accept="image/*" 
          multiple
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          style={{ display: 'none' }} 
        />
        <button 
          onClick={() => fileInputRef.current.click()} 
          className="btn-outline" 
          style={{ borderRadius: '50%', width: '56px', height: '56px', position: 'relative' }}
          disabled={isProcessingImage}
        >
          {isProcessingImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Loader2 className="animate-spin" size={20} />
              <span style={{ fontSize: '10px', marginTop: '2px' }}>{batchProgress.current}/{batchProgress.total}</span>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>{scanProgress}%</span>
            </div>
          ) : (
            <Camera size={24} />
          )}
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
