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
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, CreditCard, Banknote, History } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();

  const [balance, setBalance] = useState({ bank: 0, cash: 0 });
  const [budget, setBudget] = useState(1000);
  const [transactions, setTransactions] = useState([]);
  const [activeWallet, setActiveWallet] = useState("bank"); // Default wallet for manual entry
  const [viewMode, setViewMode] = useState("daily"); // daily or monthly
  
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
  const [aiMessage, setAiMessage] = useState("สวัสดีครับ! ผมเป็นผู้ช่วยการเงินของคุณ บอกผมได้เลยว่าวันนี้จ่ายอะไรไปบ้าง");

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      if (session) {
        setIsLoading(true);
        try {
          const res = await fetch('/api/data');
          if (res.ok) {
            const data = await res.json();
            if (data.balance) setBalance(data.balance);
            if (data.budget) setBudget(data.budget);
            if (data.transactions) setTransactions(data.transactions);
          }
        } catch (error) {
          console.error("Failed to load data from MongoDB:", error);
        }
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [session]);


  // Fix Closure Bug for Voice Recognition:
  // Using a Ref ensures the voice handler always sees the LATEST state/balances
  const processVoiceRef = useRef();
  useEffect(() => {
    processVoiceRef.current = processVoiceCommand;
  }, [balance, activeWallet, session, transactions, budget]);

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
        if (processVoiceRef.current) processVoiceRef.current(result);
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

  function processVoiceCommand(text) {
    if (!text) return;
    const voiceTextLower = text.toLowerCase();
    
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
      return; 
    }

    if (amount === 0) return;
    
    // 1.4 Detect Target Wallet from Context
    let wallet = activeWallet;
    if (voiceTextLower.includes("เงินสด") || voiceTextLower.includes("ถอน") || voiceTextLower.includes("cash")) wallet = "cash";
    if (voiceTextLower.includes("ธนาคาร") || voiceTextLower.includes("โอน") || voiceTextLower.includes("bank") || voiceTextLower.includes("card")) wallet = "bank";

    // 1.5 Check for Balance Inquiry Commands
    const inquiryKeywords = ["เงินเหลือเท่าไหร่", "มีเงินเท่าไหร่", "ยอดเงิน", "เช็คยอด", "balance info", "how much money", "my balance", "how much i have"];
    const isInquiry = inquiryKeywords.some(kw => voiceTextLower.includes(kw));

    if (isInquiry) {
      setAiMessage(`ตอนนี้มีเงินในธนาคาร ฿${balance.bank.toLocaleString()} และเงินสด ฿${balance.cash.toLocaleString()} รวมทั้งหมด ฿${(balance.bank + balance.cash).toLocaleString()} ครับ`);
      return;
    }

    // 1.5.1 Check for Transfers (Between bank and cash)
    const isWithdraw = voiceTextLower.includes("ถอน") || voiceTextLower.includes("atm") || voiceTextLower.includes("withdraw");
    const isDeposit = voiceTextLower.includes("ฝากเงิน") || voiceTextLower.includes("deposit");

    if (isWithdraw) {
      const newBank = balance.bank - amount;
      const newCash = balance.cash + amount;
      setBalance({ bank: newBank, cash: newCash });
      
      // Sync to DB
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: { bank: newBank, cash: newCash } })
      });

      setAiMessage(`ถอนเงิน ฿${amount.toLocaleString()} จากธนาคารเข้ากระเป๋าเงินสดเรียบร้อยครับ`);
      return;
    }

    if (isDeposit) {
      const newBank = balance.bank + amount;
      const newCash = balance.cash - amount;
      setBalance({ bank: newBank, cash: newCash });
      
      // Sync to DB
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: { bank: newBank, cash: newCash } })
      });

      setAiMessage(`ฝากเงิน ฿${amount.toLocaleString()} เข้าบัญชีธนาคารเรียบร้อยครับ`);
      return;
    }

    // 1.6 Check for Balance Adjustment Commands (Set real money)
    const adjustKeywords = [
      "ปรับเงิน", "แก้เงิน", "แก้เป็น", "ปรับยอด", "เปลี่ยนเงิน", 
      "set balance", "update balance", "now have", "balance is", 
      "มีเงินอยู่", "มีเงิน", "มีอยู่", "ตอนนี้มี", "currently have", "i have", "is now"
    ];
    const isAdjustment = adjustKeywords.some(kw => voiceTextLower.includes(kw));

    if (isAdjustment) {
      const oldAmount = balance[wallet];
      const newBalance = { ...balance, [wallet]: amount };
      setBalance(newBalance);
      
      // Sync to DB
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance })
      });

      setAiMessage(`ปรับยอดเงินให้แล้วครับ! จาก ฿${oldAmount.toLocaleString()} เป็น ฿${amount.toLocaleString()} ใน${wallet === 'bank' ? 'บัญชีธนาคาร' : 'กระเป๋าเงินสด'}`);
      return;
    }
    
    // 2. Identify Transaction Type (Income vs Expense)
    const incomeKeywords = [
      "ได้", "เข้า", "บวก", "ขาย", "รายได้", "รับ", "โอนเข้า", "มาให้", "ให้มา", "ตกมา", "หยิบมา", "เจอ", "พบ", "เก็บได้",
      "เงินเดือน", "เบิก", "ค่าจ้าง", "ค่าแรง", "โอที", "เบี้ยเลี้ยง", "คอมมิชชั่น", "ค่าคอม", "โบนัส", "เงินรางวัล",
      "ถูกหวย", "ถูกรางวัล", "รางวัล", "อั่งเปา", "ของขวัญ", "เงินช่วย", "เงินอุดหนุน", "ทุน", "เงินทุน",
      "กำไร", "ปันผล", "ดอกเบี้ย", "ผลตอบแทน", "เงินปันผล", "ขายหุ้น", "ขายกองทุน",
      "กู้", "ยืมมา", "คืน", "ได้คืน", "เงินคืน", "รับคืน", "โอนคืน", "ทอน", "เงินทอน",
      "โอนมา", "ส่งมา", "ฝากมา", "เหลือ", "ประหยัด", "ลดราคา", "ส่วนลด",
      "get", "got", "received", "receive", "income", "plus", "add", "deposit", "credited",
      "salary", "wage", "bonus", "commission", "overtime", "allowance", "paycheck", "payroll",
      "win", "won", "prize", "reward", "gift", "lottery", "jackpot", "lucky",
      "profit", "dividend", "interest", "return", "yield", "gain", "capital gain",
      "borrow", "borrowed", "refund", "cashback", "rebate", "reimbursement", "returned",
      "earn", "earned", "collect", "save", "saved", "discount"
    ];
    const expenseKeywords = [
      "จ่าย", "ซื้อ", "เสีย", "ลบ", "ออก", "ค่า", "หมด", "ไป", "โอนออก", "โอนไป", "ส่งไป",
      "ชำระ", "จ่ายค่า", "จ่ายเงิน", "จ่ายบิล", "เสียค่า", "เสียเงิน", "หักเงิน",
      "ช้อป", "ช้อปปิ้ง", "สั่งซื้อ", "กดซื้อ", "เหมา", "ตุน",
      "เติม", "เติมเงิน", "เติมน้ำมัน", "เติมเครดิต", "ท็อปอัพ",
      "หาย", "สูญ", "เสียหาย", "โดนโกง", "โดนขโมย",
      "ทำบุญ", "บริจาค", "ใส่บาตร", "ถวาย", "ให้ทาน",
      "ผ่อน", "งวด", "หนี้", "ใช้หนี้", "คืนเงิน", "ชำระหนี้", "ติดหนี้",
      "ภาษี", "ปรับ", "ค่าปรับ", "โดนปรับ", "เสียภาษี",
      "ค่าน้ำ", "ค่าไฟ", "ค่าเน็ต", "ค่าโทร", "ค่าเช่า", "ค่าประกัน", "ค่าบริการ",
      "pay", "paid", "buy", "bought", "purchase", "spent", "spend", "loss", "minus", "out", "cost",
      "bill", "fee", "charge", "debit", "debited", "checkout", "invoice",
      "shop", "shopping", "order", "ordered",
      "topup", "top up", "reload", "recharge",
      "lost", "lose", "stolen", "scam", "scammed",
      "donate", "donated", "donation", "charity", "tip", "tipped",
      "loan", "installment", "debt", "repay", "repayment", "mortgage",
      "tax", "fine", "penalty", "surcharge",
      "subscription", "subscribe", "membership", "premium", "renewal",
      "expense", "withdrawal", "transfer"
    ];
    
    const isIncome = incomeKeywords.some((kw) => voiceTextLower.includes(kw));
    const isExpense = expenseKeywords.some((kw) => voiceTextLower.includes(kw));

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
      if (keywords.some(kw => voiceTextLower.includes(kw))) {
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

    addTransaction(amount, type, description, category, wallet);
    setAiMessage(`บันทึก${type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${description} ฿${amount.toLocaleString()} ใน${wallet === 'bank' ? 'ธนาคาร' : 'เงินสด'} เรียบร้อยครับ`);
  }

  const addTransaction = async (amount, type, description, category = "อื่นๆ", wallet = "bank") => {
    const data = {
      amount,
      type,
      description,
      category,
      wallet,
      date: new Date().toISOString(),
    };

    // Update UI Optimistically
    const tempId = Date.now();
    setTransactions((prev) => [{ ...data, id: tempId, _id: tempId }, ...prev]);
    setBalance((prev) => {
      const updated = { ...prev };
      if (type === "income") {
        updated[wallet] += amount;
      } else {
        updated[wallet] -= amount;
      }
      return updated;
    });

    // Save to MongoDB
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const saved = await res.json();
        // Replace tempId with real MongoDB _id
        setTransactions(prev => prev.map(t => t.id === tempId ? saved : t));
      }
    } catch (error) {
      console.warn("Failed to save to MongoDB, kept in local session");
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
    addTransaction(amount, manualType, manualDesc || (manualType === "income" ? "รายรับ" : "รายจ่าย"), category, activeWallet);
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
    const ocrTextLower = cleanedText.toLowerCase();
    
    console.log("Processing cleaned text:", cleanedText);

    // 2. Filter out common distractions (Dates, Times, long Ref IDs)
    cleanedText = cleanedText.replace(/\d{2}:\d{2}(:\d{2})?/g, " [TIME] ");
    cleanedText = cleanedText.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, " [DATE] ");
    cleanedText = cleanedText.replace(/\b\d{10,}\b/g, " [REF] ");

    // 3. Smart Amount Detection
    const amountKeywords = [
      "จำนวนเงิน", "ยอดโอน", "ยอดเงิน", "จ่ายแล้ว", "สำเร็จ",
      "ราคารวม", "รวมทั้งสิ้น", "รวมเงิน", "ยอดรวม", "เงินสด", "ยอดชำระ", "ชำระเงิน",
      "amount", "total", "net amount", "grand total", "paid", "transfer", "total due", "balance due", "subtotal", "vat", "tax"
    ];
    
    let finalAmount = 0;
    let found = false;

    // Search for number near keywords
    for (const kw of amountKeywords) {
      const idx = ocrTextLower.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        const windowText = cleanedText.substring(idx, idx + 60);
        const decimalMatch = windowText.match(/(\d+\.\d{2})/);
        if (decimalMatch) {
          finalAmount = parseFloat(decimalMatch[0]);
          found = true;
          break;
        }
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
      const decimalMatches = cleanedText.match(/(\d+\.\d{2})/g);
      if (decimalMatches) {
        finalAmount = Math.max(...decimalMatches.map(m => parseFloat(m)));
        found = true;
      } else {
        const allNumbers = cleanedText.match(/\d+(\.\d+)?/g);
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
      // 4. Determine Type
      let type = "expense";
      const incomeTriggers = [
        "รับเงิน", "เงินเข้า", "โอนเข้า", "รับโอน", "มีค่า", "เงินคืน", "ได้คืน", 
        "receiver", "income", "credit", "topup received", "refund", "deposit"
      ];
      const expenseTriggers = [
        "โอนเงินสำเร็จ", "ถอนเงิน", "ชำระค่า", "จ่ายให้", "โอนไป", "จ่ายบิล", 
        "transfer success", "withdrawal", "payment", "paid to", "bill payment"
      ];
      
      const isIncome = incomeTriggers.some(kw => ocrTextLower.includes(kw));
      const isExpense = expenseTriggers.some(kw => ocrTextLower.includes(kw));

      if (isIncome && !isExpense) type = "income";

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
        if (words.some(w => ocrTextLower.includes(w))) {
          category = cat;
          break;
        }
      }

      addTransaction(finalAmount, type, "สแกนจากสลิป/บิล", category);
    } else {
      alert("ไม่สามารถระบุจำนวนเงินได้ กรุณาลองปรับมุมกล้องหรือใส่เองครับ");
    }
  };

  const getAIInsight = () => {
    const todayExpenses = transactions.filter(t => t.type === 'expense');
    const totalSpent = todayExpenses.reduce((acc, t) => acc + t.amount, 0);
    const topCategory = Object.entries(todayExpenses.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}))
      .sort((a, b) => b[1] - a[1])[0];

    if (totalSpent === 0) return "วันนี้ยังไม่มีค่าใช้จ่ายเลย สุดยอดมากครับ! รักษาไว้นะ";
    
    if (totalSpent > budget) {
      return `วันนี้ใช้เงินเกินงบไปแล้ว ฿${(totalSpent - budget).toLocaleString()} ลองลดการใช้จ่ายในหมวด ${topCategory?.[0] || 'อื่นๆ'} ดูนะครับ`;
    }

    if (totalSpent > budget * 0.8) {
      return "งบประมาณวันนี้ใกล้จะหมดแล้วนะ อีกนิดเดียวจะถึงขีดจำกัดแล้ว ใจเย็นๆ ก่อนควักเงินนะครับ";
    }

    if (topCategory && topCategory[0] === 'อาหาร' && topCategory[1] > budget * 0.5) {
      return "วันนี้คุณเน้นเรื่องกินเป็นพิเศษเลยนะ ลองหาของกินที่ประหยัดลงหน่อยไหม?";
    }

    return "การใช้จ่ายวันนี้ดูปกติครับ คุณทำได้ดีมากในการคุมงบประมาณ!";
  };

  const deleteTransaction = async (id) => {
    const transaction = transactions.find((t) => (t._id || t.id) === id);
    if (transaction) {
      // Optimistic update
      setBalance((prev) => {
        const updated = { ...prev };
        if (transaction.type === "income") {
          updated[transaction.wallet || "bank"] -= transaction.amount;
        } else {
          updated[transaction.wallet || "bank"] += transaction.amount;
        }
        return updated;
      });
      setTransactions((prev) => prev.filter((t) => (t._id || t.id) !== id));

      // Sync with MongoDB
      try {
        await fetch(`/api/transactions?id=${transaction._id || transaction.id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.warn("Failed to delete from MongoDB");
      }
    }
  };

  const clearAppData = () => {
    if (window.confirm("คุณต้องการรีเซ็ตข้อมูลทั้งหมดใช่หรือไม่?")) {
      setBalance({ bank: 0, cash: 0 });
      setTransactions([]);
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;
    
    const headers = ["Date", "Description", "Amount", "Type", "Category", "Wallet"];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleString(),
      t.description,
      t.amount,
      t.type,
      t.category,
      t.wallet || "bank"
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `remiderme_transactions_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      <motion.div layout className="glass-card" style={{ padding: '1.5rem', background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'left' }}>
            <span className="text-sm">ยอดเงินรวมทั้งหมด</span>
            <div className="balance-amount" style={{ fontSize: '1.8rem' }}>฿{(balance.bank + balance.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <button onClick={exportToCSV} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}>
            <Download size={14} /> Export
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <motion.div 
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveWallet('bank')}
            style={{ 
              background: activeWallet === 'bank' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)', 
              padding: '1.25rem', 
              borderRadius: '20px', 
              border: `1px solid ${activeWallet === 'bank' ? '#3b82f6' : 'var(--glass-border)'}`,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', marginBottom: '8px' }}>
              <CreditCard size={16} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>ธนาคาร</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>฿{balance.bank.toLocaleString()}</div>
            {activeWallet === 'bank' && <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>● กระเป๋าหลักตอนนี้</div>}
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveWallet('cash')}
            style={{ 
              background: activeWallet === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)', 
              padding: '1.25rem', 
              borderRadius: '20px', 
              border: `1px solid ${activeWallet === 'cash' ? '#10b981' : 'var(--glass-border)'}`,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '8px' }}>
              <Banknote size={16} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>เงินสด</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>฿{balance.cash.toLocaleString()}</div>
            {activeWallet === 'cash' && <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>● กระเป๋าหลักตอนนี้</div>}
          </motion.div>
        </div>
        
        <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-sm">งบวันนี้ ({Math.min(100, Math.round((transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) / budget) * 100))}%)</span>
            <span className="text-sm">฿{transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0).toLocaleString()} / ฿{budget.toLocaleString()}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) / budget) * 100)}%` }} style={{ height: '100%', background: transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) > budget ? 'var(--danger)' : 'linear-gradient(to right, var(--primary), var(--accent-pink))' }} />
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
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                      <button onClick={() => setViewMode('daily')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'daily' ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 600 }}>รายวัน</button>
                      <button onClick={() => setViewMode('monthly')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'monthly' ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 600 }}>รายเดือน</button>
                    </div>

                    <p className="text-sm" style={{ fontWeight: 600, marginBottom: '1rem' }}>
                      {viewMode === 'daily' ? 'สรุปค่าใช้จ่ายประจําวัน' : 'แนวโน้มการใช้จ่าย 7 วันล่าสุด'}
                    </p>
                    
                    {/* AI Insight Buddy */}
                    <div style={{ 
                        padding: '1rem', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        borderRadius: '16px', 
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '12px' }}>
                            <Sparkles size={18} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6', marginBottom: '4px' }}>AI วิเคราะห์การเงิน</p>
                            <p className="text-sm" style={{ lineHeight: '1.4' }}>{getAIInsight()}</p>
                        </div>
                    </div>

                    {viewMode === 'daily' ? (
                      <>
                        {/* Chart Section */}
                        <div style={{ width: '100%', height: '220px', marginBottom: '1rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.entries(transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}))
                                            .map(([name, value]) => ({ name, value }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {Object.entries(transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {})).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={[
                                                '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#4b5563'
                                            ][index % 8]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* List Section */}
                        {Object.entries(transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {})).map(([cat, total], index) => (
                            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#4b5563'][index % 8] }}></div>
                                    <span className="text-sm">{cat}</span>
                                </div>
                                <span className="text-sm" style={{ fontWeight: 600 }}>฿{total.toLocaleString()}</span>
                            </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ width: '100%', height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={
                            [...Array(7)].map((_, i) => {
                              const d = new Date();
                              d.setDate(d.getDate() - (6 - i));
                              const dateStr = d.toDateString();
                              const amount = transactions
                                .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === dateStr)
                                .reduce((acc, t) => acc + t.amount, 0);
                              return { name: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }), amount };
                            })
                          }>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip 
                              contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                            />
                            <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    
                    {transactions.filter(t => t.type === 'expense').length === 0 && (
                        <p className="text-sm" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>ยังไม่มีข้อมูลในระบบ</p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>ยังไม่มีรายการ</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {transactions.map((t) => (
              <motion.div key={t._id || t.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="transaction-item">
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
                  <button onClick={() => deleteTransaction(t._id || t.id)} style={{ background: "none", border: "none", color: "var(--glass-border)", cursor: "pointer" }}><Trash2 size={16} /></button>
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
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                            <button type="button" onClick={() => setActiveWallet('bank')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: activeWallet === 'bank' ? '#3b82f6' : 'transparent', color: 'white', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <CreditCard size={12} /> ธนาคาร
                            </button>
                            <button type="button" onClick={() => setActiveWallet('cash')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: activeWallet === 'cash' ? '#10b981' : 'transparent', color: 'white', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <Banknote size={12} /> เงินสด
                            </button>
                        </div>
                        <input type="number" placeholder="บาท" value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} required />
                        <input type="text" placeholder="รายละเอียด" value={manualDesc} onChange={e => setManualDesc(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} />
                        <button type="submit" className="btn-primary">บันทึก</button>
                        <button type="button" onClick={() => setShowManualEntry(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>ยกเลิก</button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>

      <div className="mic-button-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <AnimatePresence>
          {aiMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="glass-card"
              style={{ padding: '0.75rem 1.25rem', maxWidth: '280px', borderRadius: '20px', fontSize: '13px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '5px' }}
            >
              {aiMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
    </div>
  );
}
