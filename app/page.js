"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import useMobileDetect from "./hooks/useMobileDetect";
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
  Edit2,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, CreditCard, Banknote, History, Languages } from "lucide-react";
import { translations } from "@/lib/translations";

// --- Smart Categorization & Visuals ---
const CATEGORY_COLORS = {
  "อาหาร": "#f59e0b",
  "เดินทาง": "#3b82f6",
  "ของใช้": "#ec4899",
  "บันเทิง": "#8b5cf6",
  "ที่พัก": "#6366f1",
  "การเงิน": "#10b981",
  "สุขภาพ": "#ef4444",
  "รายได้": "#06b6d4",
  "อื่นๆ": "#64748b"
};

const detectCategory = (text) => {
  if (!text) return "อื่นๆ";
  const lowerText = text.toLowerCase();
  
  const categories = {
    "อาหาร": {
      keywords: ["กิน", "ข้าว", "น้ำ", "กาแฟ", "ขนม", "อาหาร", "มื้อ", "หิว", "สั่ง", "ชา", "ต้ม", "ผัด", "แกง", "ทอด", "ปิ้ง", "ย่าง", "บุฟเฟ่ต์", "มาม่า", "ส้มตำ", "สเต็ก", "ร้านอาหาร", "คาเฟ่", "eat", "food", "rice", "water", "coffee", "drink", "snack", "meal", "dinner", "lunch", "breakfast", "cafe", "starbucks", "kfc", "mcdonald", "grabfood", "lineman", "foodpanda", "swensen", "burger", "pizza"],
      weight: 2
    },
    "เดินทาง": {
      keywords: ["รถ", "น้ำมัน", "แท็กซี่", "วิน", "มา", "ไป", "โบลท์", "กรับ", "ค่ารถ", "เรือ", "เครื่องบิน", "ตั๋ว", "ทางด่วน", "มอเตอร์ไซค์", "เติมน้ำมัน", "จอดรถ", "ขนส่ง", "รถทัวร์", "car", "gas", "petrol", "taxi", "bts", "mrt", "bus", "train", "flight", "fare", "grab", "bolt", "fuel", "parking", "expressway"],
      weight: 2
    },
    "ที่พัก": {
      keywords: ["ค่าเช่า", "ค่าน้ำ", "ค่าไฟ", "ค่าหอ", "คอนโด", "หอพัก", "บ้าน", "ห้อง", "เน็ต", "อินเทอร์เน็ต", "rent", "electricity", "water bill", "pea", "mea", "mwa", "pwa", "condo", "apartment", "housing", "bill", "utilities", "wifi", "3bb", "ais fibre", "true online"],
      weight: 3
    },
    "ของใช้": {
      keywords: ["ซื้อ", "ของ", "ของใช้", "ห้าง", "เซเว่น", "ช้อป", "แอป", "ตลาด", "เสื้อผ้า", "ซุปเปอร์", "ไอโฟน", "มือถือ", "ทิชชู่", "สบู่", "แชมพู", "buy", "shop", "mall", "market", "7-11", "supermarket", "shopee", "lazada", "tiktok", "item", "stuff", "cloth"],
      weight: 1
    },
    "บันเทิง": {
      keywords: ["เกม", "หนัง", "เที่ยว", "เหล้า", "เบียร์", "ปาร์ตี้", "คอนเสิร์ต", "ดูหนัง", "ฟังเพลง", "สตรีมมิ่ง", "ดิสนีย์พลัส", "โรงแรม", "รีสอร์ท", "game", "movie", "netflix", "youtube", "spotify", "concert", "party", "alcohol", "beer", "wine", "pub", "club", "holiday", "vacation", "trip"],
      weight: 2
    },
    "การเงิน": {
      keywords: ["ภาษี", "ประกัน", "ค่าธรรมเนียม", "ดอกเบี้ย", "หุ้น", "ออมเงิน", "ลงทุน", "เงินกู้", "ผ่อน", "เทรด", "คริปโต", "tax", "fee", "insurance", "invest", "stock", "crypto", "dividend", "interest", "loan", "savings"],
      weight: 3
    },
    "สุขภาพ": {
      keywords: ["ยา", "หมอ", "โรงพยาบาล", "คลินิก", "ฟิตเนส", "สปา", "นวด", "ตัดผม", "เสริมสวย", "ทำเล็บ", "หาหมอ", "ทำฟัน", "hospital", "pharmacy", "doctor", "medicine", "gym", "fitness", "spa", "massage", "skincare", "beauty", "clinic", "vitamin", "dental"],
      weight: 3
    },
    "รายได้": {
      keywords: ["เงินเดือน", "โบนัส", "รับเงิน", "กำไร", "รายได้", "ปันผล", "ถูกหวย", "รางวัล", "salary", "wage", "bonus", "commission", "profit", "income", "refund", "cashback", "dividend", "earn", "paycheck"],
      weight: 4
    }
  };

  let bestCategory = "อื่นๆ";
  let maxScore = 0;

  for (const [cat, data] of Object.entries(categories)) {
    let score = 0;
    data.keywords.forEach(kw => {
      if (lowerText.includes(kw.toLowerCase())) {
        score += data.weight;
      }
    });
    
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
};

const parseThaiNumber = (str) => {
  if (!str) return 0;
  // Heal numbers like "1, 520" or "1,520" by removing comma and optional space between digits
  const healedStr = str.replace(/(\d)\s*,\s*(\d)/g, "$1$2");
  const cleanStr = healedStr.replace(/,/g, "").trim();
  if (/^\d+(\.\d+)?$/.test(cleanStr)) return parseFloat(cleanStr);

  const thaiDigits = {
    "ศูนย์": 0, "หนึ่ง": 1, "เอ็ด": 1, "สอง": 2, "ยี่": 2, "สาม": 3,
    "สี่": 4, "ห้า": 5, "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10
  };
  const thaiMults = {
    "ล้าน": 1000000, "แสน": 100000, "หมื่น": 10000, "พัน": 1000, "ร้อย": 100, "สิบ": 10
  };

  let total = 0;
  let remaining = cleanStr;

  // 1. Handle MIXED patterns like "1 พัน" or "5 แสน"
  for (const [multWord, multValue] of Object.entries(thaiMults)) {
    const regex = new RegExp(`(\\d+)\\s*${multWord}`, 'g');
    remaining = remaining.replace(regex, (match, num) => {
      total += parseFloat(num) * multValue;
      return " ";
    });
  }

  // 2. Handle WORD patterns like "หนึ่งแสน" or "สี่สิบ"
  for (const [multWord, multValue] of Object.entries(thaiMults)) {
    const idx = remaining.indexOf(multWord);
    if (idx !== -1) {
      const before = remaining.substring(Math.max(0, idx - 10), idx).trim();
      let digitValue = 1;
      let foundDigit = false;
      let lastMatchIdx = -1;
      let matchedWord = "";

      for (const [dw, dv] of Object.entries(thaiDigits)) {
        const dIdx = before.lastIndexOf(dw);
        if (dIdx !== -1 && dIdx > lastMatchIdx) {
          lastMatchIdx = dIdx;
          digitValue = dv;
          foundDigit = true;
          matchedWord = dw;
        }
      }

      total += digitValue * multValue;
      remaining = remaining.replace(multWord, " ");
      if (foundDigit) remaining = remaining.replace(matchedWord, " ");
    }
  }

  // 3. Handle standalone digits and pure numbers
  const leftoverNums = remaining.match(/\d+(\.\d+)?/g);
  if (leftoverNums) {
    leftoverNums.forEach(n => {
      total += parseFloat(n);
      remaining = remaining.replace(n, " ");
    });
  }

  for (const [dw, dv] of Object.entries(thaiDigits)) {
    if (remaining.includes(dw)) {
      total += dv;
      remaining = remaining.replace(dw, " ");
    }
  }

  return total;
};
// --- End Smart Categorization ---

export default function Home() {
  const { data: session, status } = useSession();

  const [balance, setBalance] = useState({ bank: 0, cash: 0 });
  const [budget, setBudget] = useState(1000);
  const [monthlyBudget, setMonthlyBudget] = useState(30000);
  const [defaultWallet, setDefaultWallet] = useState("bank");
  const [nickname, setNickname] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [activeWallet, setActiveWallet] = useState("bank"); // Default wallet for manual entry
  const [viewMode, setViewMode] = useState("daily"); // daily or monthly
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState("th"); // 'th' or 'en'
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", onConfirm: null });
  const t = translations[lang];
  
  const [manualAmount, setManualAmount] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualType, setManualType] = useState("expense");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [aiMessage, setAiMessage] = useState(translations.th.ai_greeting);

  useEffect(() => {
    // Update the greeting if it's still the default greeting
    if (aiMessage === translations.th.ai_greeting || aiMessage === translations.en.ai_greeting) {
      setAiMessage(t.ai_greeting);
    }
  }, [lang]);
  const [aiInsight, setAiInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const isVoiceActiveRef = useRef(false); // Track if voice should be actively listening
  const silenceTimeoutRef = useRef(null);
  const [interimTranscript, setInterimTranscript] = useState(""); // For showing partial speech
  const isMobile = useMobileDetect();
  const isMobileRef = useRef(false); // Ref to access latest isMobile inside closed-over callbacks
  
  // Sync Ref with State
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  const lastProcessedTextRef = useRef(""); // Track last text to avoid mobile duplicates
  const lastProcessTimeRef = useRef(0); // Cooldown for processing
  const lastRestartTimeRef = useRef(0); // Cooldown for restarts to avoid loops
  const restartCountRef = useRef(0); // Count rapid restarts



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
            if (data.monthlyBudget) setMonthlyBudget(data.monthlyBudget);
            if (data.defaultWallet) {
              setDefaultWallet(data.defaultWallet);
              setActiveWallet(data.defaultWallet);
            }
            if (data.nickname) setNickname(data.nickname);
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
      // Android Chrome bug: 'continuous: true' is unstable. Use 'false' and manual restart.
      recognitionRef.current.continuous = false; 
      recognitionRef.current.interimResults = true; // Show partial results
      recognitionRef.current.lang = lang === 'th' ? "th-TH" : "en-US";
      recognitionRef.current.maxAlternatives = 1;

      // Track processed results to prevent duplicates on mobile
      const lastSessionIndexRef = { current: -1 };

      // Function to reset silence timer
      const resetSilenceTimer = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        // Mobile: 3 seconds | Desktop: 5 seconds
        const timeoutDuration = isMobileRef.current ? 3000 : 5000;
        
        silenceTimeoutRef.current = setTimeout(() => {
          console.log("Auto-stopping mic due to silence/noise");
          isVoiceActiveRef.current = false;
          if (recognitionRef.current) recognitionRef.current.stop();
          
          const timeoutMsg = lang === 'th' 
            ? "ไม่ได้ยินเสียงพูดเลยปิดก่อนนะคะ (Noise/Silence) 🎀" 
            : "Didn't hear anything, stopping to save power! 🎀";
            
          setAiMessage(timeoutMsg);
        }, timeoutDuration);
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        isVoiceActiveRef.current = true;
        lastSessionIndexRef.current = -1;
        resetSilenceTimer();
      };
      
      recognitionRef.current.onend = () => {
        // Only set listening to false if we are actually STOPPING. 
        // If we are auto-restarting (Desktop), keep the UI in "listening" state to prevent flicker.
        // On Mobile, we always stop fully (no auto-restart).
        // IMPORTANT: Use Ref here because this callback is closed over initial render state!
        if (!isVoiceActiveRef.current || isMobileRef.current) {
          setIsListening(false);
          setInterimTranscript("");
        }

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        // Auto-restart ONLY on Desktop
        if (isVoiceActiveRef.current && !isMobileRef.current) {
          const now = Date.now();
          // If it restarted too fast (less than 2s), increment count
          if (now - lastRestartTimeRef.current < 2000) {
            restartCountRef.current++;
          } else {
            restartCountRef.current = 0;
          }

          // Safety break: if it loops more than 5 times rapidly, stop auto-restart
          if (restartCountRef.current < 5) {
            lastRestartTimeRef.current = now;
            // Delay restart slightly for stability
            setTimeout(() => {
              if (isVoiceActiveRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  // Ignore
                }
              }
            }, 300);
          } else {
            console.log("Mic loop detected - disabling auto-restart");
            isVoiceActiveRef.current = false;
            setAiMessage(lang === 'th' ? "เรมี่ขอพักก่อนนะ ไมค์เหมือนจะมีปัญหานิดหน่อยค่ะ 🎀" : "Mic seems unstable, taking a break! 🎀");
          }
        }
      };
      
      recognitionRef.current.onresult = (event) => {
        let currentText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          
          // Always append text for display, so user sees what's happening
          if (text) currentText += text;

          if (result.isFinal) {
            // Check if we've already processed this specific result index in this session
            if (i > lastSessionIndexRef.current) {
              const trimmedText = text.trim();
              const now = Date.now();
              
              // Mobile Optimization: Block duplicates within 1 second if text is similar
              if (trimmedText && (trimmedText !== lastProcessedTextRef.current || now - lastProcessTimeRef.current > 1000)) {
                lastSessionIndexRef.current = i;
                lastProcessedTextRef.current = trimmedText;
                lastProcessTimeRef.current = now;
                
                console.log("Processing final result at index:", i, trimmedText);
                setTranscript(trimmedText);
                // We don't clear interim yet, let the UI show the full sentence for a moment
                if (processVoiceRef.current) {
                  processVoiceRef.current(trimmedText);
                }
              } else {
                console.log("Ignored duplicate/too-fast result:", trimmedText);
              }
            }
          }
        }
        
        // Only reset the timer if we actually heard SOME text (not just empty noise)
        if (currentText.trim().length > 0) {
          resetSilenceTimer();
        }
        
        // Update UI with whatever text we have (interim or final)
        if (currentText) {
          setInterimTranscript(currentText);
        }
      };
      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isVoiceActiveRef.current = false;
          setIsListening(false);
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        }
      };
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  // Update speech recognition language when app language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang === 'th' ? "th-TH" : "en-US";
    }
  }, [lang]);

  const toggleListening = () => {
    if (isListening) {
      isVoiceActiveRef.current = false; // Stop auto-restart
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      setInterimTranscript("");
      isVoiceActiveRef.current = !isMobile; // Only auto-restart on Desktop
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    }
  };

  const lastProcessedRef = useRef({ text: "", time: 0 });

  function processVoiceCommand(text) {
    if (!text || !text.trim()) return;
    
    // Strengthen Duplicate prevention for Mobile:
    // 1. Ignore if same as last text within 3 seconds
    // 2. Ignore if new text is a substring of last processed text within 2.5 seconds
    const nowTime = Date.now();
    const timeDiff = nowTime - lastProcessedRef.current.time;
    const lastText = lastProcessedRef.current.text;
    
    if (text === lastText && timeDiff < 3000) {
      console.log("Ignoring exact duplicate:", text);
      return;
    }
    
    if (lastText.includes(text) && text.length > 2 && timeDiff < 2500) {
      console.log("Ignoring cached / partial duplicate:", text);
      return;
    }

    lastProcessedRef.current = { text, time: nowTime };

    const voiceTextLower = text.toLowerCase();
    
    // 1. Check for Summary Commands (Today, Week, Month) - No amount needed
    const summaryKeywords = ["สรุป", "รายงาน", "summary", "report", "total", "รวมทั้งหมด", "ใช้ไปเท่าไหร่"];
    const isSummaryRequest = summaryKeywords.some(kw => voiceTextLower.includes(kw));

    if (isSummaryRequest) {
      const now = new Date();
      let startDate = new Date();
      let periodLabel = lang === 'th' ? "วันนี้" : "Today";

      if (voiceTextLower.includes("อาทิตย์") || voiceTextLower.includes("สัปดาห์") || voiceTextLower.includes("week")) {
        startDate.setDate(now.getDate() - 7);
        periodLabel = lang === 'th' ? "7 วันที่ผ่านมา" : "Last 7 days";
      } else if (voiceTextLower.includes("เดือน") || voiceTextLower.includes("month")) {
        startDate.setMonth(now.getMonth() - 1);
        periodLabel = lang === 'th' ? "เดือนนี้" : "This month";
      } else if (voiceTextLower.includes("ปี") || voiceTextLower.includes("year")) {
        startDate.setFullYear(now.getFullYear() - 1);
        periodLabel = lang === 'th' ? "ปีนี้" : "This year";
      } else {
        startDate.setHours(0, 0, 0, 0);
      }

      const filtered = transactions.filter(t => new Date(t.date) >= startDate);
      const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const net = income - expense;

      setAiMessage(t.voice_summary(periodLabel, income.toLocaleString(), expense.toLocaleString(), net.toLocaleString()));
      return;
    }

    // 2. Check for Balance Inquiry Commands - No amount needed
    const inquiryKeywords = ["เงินเหลือเท่าไหร่", "มีเงินเท่าไหร่", "ยอดเงิน", "เช็คยอด", "balance info", "how much money", "my balance", "how much i have"];
    const isInquiry = inquiryKeywords.some(kw => voiceTextLower.includes(kw));

    if (isInquiry) {
      setAiMessage(t.voice_balance((balance.bank || 0).toLocaleString(), (balance.cash || 0).toLocaleString(), ((balance.bank || 0) + (balance.cash || 0)).toLocaleString()));
      return;
    }

    // 3. Identify Amount (Robust Thai support)
    const amount = parseThaiNumber(text);
    if (amount === 0) return;
    
    // Pattern to clean up description by removing amount-related parts
    let cleanedText = text;
    // Remove digits and common Thai units
    cleanedText = cleanedText.replace(/\d+[\d,.]*/g, "");
    ["ล้าน", "แสน", "หมื่น", "พัน", "ร้อย", "สิบ", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "บาท", "baht"].forEach(w => {
       cleanedText = cleanedText.replace(new RegExp(w, 'g'), "");
    });
    cleanedText = cleanedText.trim();
    
    // 4. Detect Target Wallet from Context
    let wallet = activeWallet;
    if (voiceTextLower.includes("เงินสด") || voiceTextLower.includes("ถอน") || voiceTextLower.includes("cash")) wallet = "cash";
    if (voiceTextLower.includes("ธนาคาร") || voiceTextLower.includes("โอน") || voiceTextLower.includes("bank") || voiceTextLower.includes("card")) wallet = "bank";

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

      setAiMessage(t.voice_withdraw(amount.toLocaleString()));
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

      setAiMessage(t.voice_deposit(amount.toLocaleString()));
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
      console.log("=== VOICE COMMAND DEBUG ===");
      console.log("Raw text:", text);
      console.log("Lower text:", voiceTextLower);
      
      // Check for multi-wallet balance setting (e.g., "มีเงินในธนาคารห้าพันบาท และ เงินสดสองพันบาท")
      // This handles sentences that contain BOTH bank and cash amounts
      const hasBankMention = voiceTextLower.includes("ธนาคาร") || voiceTextLower.includes("bank");
      const hasCashMention = voiceTextLower.includes("เงินสด") || voiceTextLower.includes("cash");
      
      if (hasBankMention && hasCashMention) {
        // Multi-wallet balance adjustment
        let bankAmount = 0;
        let cashAmount = 0;
        
        // Helper function to parse Thai amount text
        const parseThaiAmount = (segment) => parseThaiNumber(segment);
        
        // Split by common connectors and find amounts for each wallet
        const segments = text.split(/และ|และก็|กับ|,|and/i);
        
        for (const seg of segments) {
          const segLower = seg.toLowerCase();
          if ((segLower.includes("ธนาคาร") || segLower.includes("bank")) && bankAmount === 0) {
            bankAmount = parseThaiAmount(seg);
            console.log("Bank segment:", seg, "-> Amount:", bankAmount);
          }
          if ((segLower.includes("เงินสด") || segLower.includes("cash")) && cashAmount === 0) {
            cashAmount = parseThaiAmount(seg);
            console.log("Cash segment:", seg, "-> Amount:", cashAmount);
          }
        }
        
        // If segment splitting didn't work, try extracting amounts from full text
        // and assign based on position relative to wallet keywords
        if (bankAmount === 0 || cashAmount === 0) {
          console.log("Fallback parsing for text:", text);
          
          // Find all Thai number amounts in the text
          const findAllAmounts = (str) => {
            const amounts = [];
            const thaiDigits = {
              "หนึ่ง": 1, "เอ็ด": 1, "สอง": 2, "ยี่": 2, "สาม": 3,
              "สี่": 4, "ห้า": 5, "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9
            };
            const thaiMults = { "ล้าน": 1000000, "แสน": 100000, "หมื่น": 10000, "พัน": 1000, "ร้อย": 100 };
            
            // Look for patterns like "ห้าพัน", "เจ็ดพัน", etc.
            for (const [multWord, multValue] of Object.entries(thaiMults)) {
              let searchFrom = 0;
              while (true) {
                const multIdx = str.indexOf(multWord, searchFrom);
                if (multIdx === -1) break;
                
                // Look backwards from the multiplier to find a digit word
                const beforeMult = str.substring(Math.max(0, multIdx - 10), multIdx);
                let digitValue = 1;
                
                for (const [digitWord, digitVal] of Object.entries(thaiDigits)) {
                  if (beforeMult.includes(digitWord)) {
                    digitValue = digitVal;
                    break;
                  }
                }
                
                amounts.push({ index: multIdx, amount: digitValue * multValue });
                searchFrom = multIdx + 1;
              }
            }
            
            // Also check for numeric values
            const numRegex = /(\d+)/g;
            let match;
            while ((match = numRegex.exec(str)) !== null) {
              const num = parseInt(match[1]);
              if (num >= 100) { // Only consider significant amounts
                amounts.push({ index: match.index, amount: num });
              }
            }
            
            return amounts.sort((a, b) => a.index - b.index);
          };
          
          const allAmounts = findAllAmounts(text);
          console.log("Found amounts:", allAmounts);
          
          // Find wallet keyword positions
          const bankIdx = voiceTextLower.indexOf("ธนาคาร") !== -1 ? voiceTextLower.indexOf("ธนาคาร") : voiceTextLower.indexOf("bank");
          const cashIdx = voiceTextLower.indexOf("เงินสด") !== -1 ? voiceTextLower.indexOf("เงินสด") : voiceTextLower.indexOf("cash");
          
          console.log("Wallet positions - bank:", bankIdx, "cash:", cashIdx);
          
          // Assign amounts to the nearest wallet keyword
          for (const a of allAmounts) {
            const distToBank = bankIdx !== -1 ? Math.abs(a.index - bankIdx) : Infinity;
            const distToCash = cashIdx !== -1 ? Math.abs(a.index - cashIdx) : Infinity;
            
            if (distToBank < distToCash && bankAmount === 0) {
              bankAmount = a.amount;
            } else if (distToCash <= distToBank && cashAmount === 0) {
              cashAmount = a.amount;
            }
          }
        }
        
        // If we got both amounts, update both wallets
        if (bankAmount > 0 || cashAmount > 0) {
          const newBalance = { 
            bank: bankAmount > 0 ? bankAmount : balance.bank, 
            cash: cashAmount > 0 ? cashAmount : balance.cash 
          };
          setBalance(newBalance);
          
          // Sync to DB
          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: newBalance })
          });

          // Build feedback message
          let msg = lang === 'th' ? "ปรับยอดเงินแล้ว: " : "Balance updated: ";
          if (bankAmount > 0) msg += `${t.bank} ฿${bankAmount.toLocaleString()}`;
          if (bankAmount > 0 && cashAmount > 0) msg += lang === 'th' ? " และ " : " & ";
          if (cashAmount > 0) msg += `${t.cash} ฿${cashAmount.toLocaleString()}`;
          
          setAiMessage(msg);
          return;
        }
      }
      
      // Single wallet adjustment (original logic)
      const oldAmount = balance[wallet];
      const newBalance = { ...balance, [wallet]: amount };
      setBalance(newBalance);
      
      // Sync to DB
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance })
      });

      setAiMessage(t.voice_adjusted(oldAmount.toLocaleString(), amount.toLocaleString(), t[wallet]));
      return;
    }
    
    // 2. CHECK FOR MULTI-TRANSACTION (e.g., "ซื้อกาแฟ 50 และ ข้าว 80")
    // Split by connectors and check if multiple segments have amounts
    const connectorPattern = /\s*(?:และ|และก็|กับ|and)\s*|,\s*(?!\d)/gi;
    const segments = text.split(connectorPattern).filter(s => s.trim());
    
    console.log("=== MULTI-TRANSACTION CHECK ===");
    console.log("Segments:", segments);
    
    // Helper function to parse Thai numbers
    const parseThaiNumberInContext = (str) => parseThaiNumber(str);
    
    // Helper function to detect transaction type for a segment
    const detectSegmentType = (segText) => {
      const segLower = segText.toLowerCase();
      const incomeKw = ["ได้", "เข้า", "รับ", "ขาย", "รายได้", "income", "receive", "got", "earn"];
      const expenseKw = ["จ่าย", "ซื้อ", "ค่า", "กิน", "เติม", "buy", "pay", "spent", "purchase"];
      
      const hasIncome = incomeKw.some(kw => segLower.includes(kw));
      const hasExpense = expenseKw.some(kw => segLower.includes(kw));
      
      if (hasIncome && !hasExpense) return "income";
      return "expense"; // Default
    };
    
    // Helper function to detect category for a segment
    const detectSegmentCategory = (segText) => detectCategory(segText);
    
    // Parse amounts for each segment
    const parsedSegments = segments.map(seg => ({
      text: seg.trim(),
      amount: parseThaiNumberInContext(seg),
      type: detectSegmentType(seg),
      category: detectSegmentCategory(seg)
    })).filter(s => s.amount > 0);
    
    console.log("Parsed segments:", parsedSegments);
    
    // If we have multiple segments with amounts, process as multi-transaction
    if (parsedSegments.length > 1) {
      console.log("Processing as MULTI-TRANSACTION");
      
      let totalAmount = 0;
      const descriptions = [];
      
      for (const seg of parsedSegments) {
        // Clean description
        let desc = seg.text.replace(/\d+[\d,.]*/g, "").trim();
        desc = desc.replace(/บาท|baht/gi, "").trim();
        if (!desc) desc = seg.type === "income" ? "รายรับ" : "รายจ่าย";
        
        // Add transaction
        addTransaction(seg.amount, seg.type, desc, seg.category, activeWallet);
        
        totalAmount += seg.amount;
        descriptions.push(`${desc} ฿${seg.amount.toLocaleString()}`);
      }
      
      // Show confirmation message
      const msg = lang === 'th' 
        ? `บันทึก ${parsedSegments.length} รายการ: ${descriptions.join(", ")}`
        : `Recorded ${parsedSegments.length} items: ${descriptions.join(", ")}`;
      
      setAiMessage(msg);
      return;
    }
    
    // SINGLE TRANSACTION PROCESSING (original logic)
    // Use the already parsed amount from earlier, or parse again
    let singleAmount = amount; // Reuse the amount parsed earlier
    
    // If we don't have an amount yet (shouldn't happen, but safety check)
    if (singleAmount === 0) {
      singleAmount = parseThaiNumber(text);
      if (singleAmount === 0) return;
    }
    
    // Wallet was already detected earlier, reuse it
    // (wallet variable already exists from earlier in the function)

    // 5. Identify Transaction Type (Income vs Expense)
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
    // 6. Identify Category (Smart unified detection)
    let category = detectCategory(text);

    // 7. Construct Description (Clean up the text)
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

    addTransaction(singleAmount, type, description, category, wallet);
    setAiMessage(t.voice_recorded(type, description, singleAmount.toLocaleString(), t[wallet]));
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

  const openEdit = (txn) => {
    setEditingTransaction(txn);
    setManualAmount(txn.amount.toString());
    setManualDesc(txn.description);
    setManualType(txn.type);
    setActiveWallet(txn.wallet || "bank");
    setShowManualEntry(true);
  };

  const updateTransaction = async (id, updatedData) => {
    const oldTxn = transactions.find(t => (t._id || t.id) === id);
    if (!oldTxn) return;

    // Optimistically update transactions and balance
    setTransactions(prev => prev.map(t => (t._id || t.id) === id ? { ...t, ...updatedData } : t));
    
    setBalance(prev => {
      const updated = { ...prev };
      // Reverse old effect
      if (oldTxn.type === "income") {
        updated[oldTxn.wallet || "bank"] -= oldTxn.amount;
      } else {
        updated[oldTxn.wallet || "bank"] += oldTxn.amount;
      }
      // Apply new effect
      if (updatedData.type === "income") {
        updated[updatedData.wallet || "bank"] += updatedData.amount;
      } else {
        updated[updatedData.wallet || "bank"] -= updatedData.amount;
      }
      return updated;
    });

    try {
      await fetch(`/api/transactions?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
    } catch (error) {
      console.warn("Failed to update in MongoDB");
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      setConfirmModal({
        show: true,
        title: t.invalid_amount,
        isAlert: true
      });
      return;
    }

    const data = {
      amount,
      type: manualType,
      description: manualDesc || (manualType === "income" ? t.income : t.expense),
      wallet: activeWallet,
      // Keep category if editing, or detect if new
      category: editingTransaction ? editingTransaction.category : (manualType === "income" ? (lang === 'th' ? "รายได้" : "Income") : (lang === 'th' ? "อื่นๆ" : "Other"))
    };

    if (editingTransaction) {
      updateTransaction(editingTransaction._id || editingTransaction.id, data);
    } else {
      addTransaction(data.amount, data.type, data.description, data.category, data.wallet);
    }

    setManualAmount("");
    setManualDesc("");
    setManualType("expense");
    setEditingTransaction(null);
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
    // 1. Normalize text
    let cleanedText = text.replace(/,/g, ""); 
    
    // Catch signed numbers before cleaning symbols (+1,400.00)
    const signedMatches = [];
    const signedRegex = /[+\-]\s?(\d+\.\d{2})/g;
    let sMatch;
    while ((sMatch = signedRegex.exec(cleanedText)) !== null) {
      signedMatches.push({ val: parseFloat(sMatch[1]), pos: sMatch.index, priority: 3 });
    }

    // Aggressively replace Thai/English currency symbols with a clear marker
    cleanedText = cleanedText.replace(/[฿B]\s?(\d)/g, " TXT_AMT $1");
    const ocrTextLower = cleanedText.toLowerCase();
    console.log("Processing cleaned text:", cleanedText);

    // 2. Filter out common distractions
    cleanedText = cleanedText.replace(/\d{2}:\d{2}(:\d{2})?/g, " [TIME] ");
    cleanedText = cleanedText.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, " [DATE] ");
    cleanedText = cleanedText.replace(/\b\d{9,}\b/g, " [LONGNUMBER] ");

    // 3. Smart Amount Detection
    // Exclusion keywords (Balance, not transaction)
    const ignoreKeywords = ["ยอดเงินที่ใช้ได้", "available balance", "ยอดเงินคงเหลือ", "คงเหลือ", "เงินในบัญชี"];
    
    // High Priority: Transaction specific
    const highPriorityKeywords = [
      "โอนเงินสำเร็จ", "เงินเข้า", "รับเงิน", "โอนให้", "ชำระเงินสำเร็จ", "รายการเงินเข้า", "รายการเงินออก",
      "รวมทั้งสิ้น", "ยอดรวมสุทธิ", "สุทธิ", "ยอดชำระ", "จ่ายแล้ว", "รวมเป็นเงิน",
      "grand total", "total due", "total amount", "net amount", "paid", "amount paid"
    ];
    
    // Secondary: Might be an amount
    const secondaryKeywords = [
      "จำนวนเงิน", "ยอดโอน", "ยอดเงิน", "รวมเงิน", "ยอดรวม", "เงินสด", "ชำระเงิน", "ราคา",
      "amount", "subtotal", "price"
    ];
    
    let candidates = [...signedMatches];

    // Search for keywords and pick numbers in a window
    const allKeywords = [...highPriorityKeywords, ...secondaryKeywords];
    
    allKeywords.forEach(kw => {
      let pos = ocrTextLower.indexOf(kw.toLowerCase());
      while (pos !== -1) {
        // Is this keyword in the ignore list?
        const isIgnored = ignoreKeywords.some(ik => ocrTextLower.substring(Math.max(0, pos - 20), pos + 20).includes(ik));
        
        if (!isIgnored) {
          const windowText = cleanedText.substring(pos, pos + 80);
          const matches = windowText.match(/\d+\.\d{2}\b/g) || windowText.match(/\d+\.\d+\b/g);
          
          if (matches) {
            const isHigh = highPriorityKeywords.includes(kw);
            matches.forEach(m => {
              candidates.push({
                val: parseFloat(m),
                priority: isHigh ? 2 : 1,
                pos: pos
              });
            });
          }
        }
        pos = ocrTextLower.indexOf(kw.toLowerCase(), pos + 1);
      }
    });

    let finalAmount = 0;
    let found = false;

    const skipYears = [2023, 2024, 2025, 2026, 2566, 2567, 2568, 2569];
    const validCandidates = candidates.filter(c => 
      c.val > 0 && c.val < 1000000 && !skipYears.includes(c.val) && c.val.toString().length < 9
    );

    if (validCandidates.length > 0) {
      // Logic:
      // 1. Prefer Signed numbers (+1,400)
      // 2. Prefer High priority keywords
      // 3. Prefer numbers with decimals
      // 4. Receipts usually put the TOTAL at the BOTTOM, but Bank Slips often have TOTAL at TOP.
      // For bank slips, the first 'high priority' match is often the correct one.
      validCandidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.pos - b.pos; // Earlier in the doc (usually top for bank slips)
      });
      
      finalAmount = validCandidates[0].val;
      found = true;
    }

    // fallback: Global detection if no keywords or signs found anything
    if (!found) {
      const allNumbers = cleanedText.match(/\d+(\.\d+)?/g);
      if (allNumbers) {
        const globalCandidates = allNumbers
          .map(m => parseFloat(m))
          .filter(n => n > 0 && n < 1000000 && !skipYears.includes(n));
        
        if (globalCandidates.length > 0) {
          const decimalMatches = cleanedText.match(/(\d+\.\d{2})/g);
          finalAmount = decimalMatches ? Math.max(...decimalMatches.map(m => parseFloat(m))) : Math.max(...globalCandidates);
          found = true;
        }
      }
    }

    if (found && finalAmount > 0) {
      // 4. Determine Type
      let type = "expense";
      const incomeTriggers = [
        "เงินเข้า", "รับเงิน", "ฝากเงิน", "โอนเข้า", "รับโอน", "income", "received", "deposit", "transfer in", "refund"
      ];
      const expenseTriggers = [
        "โอนเงินสำเร็จ", "ถอนเงิน", "ชำระค่า", "จ่ายให้", "โอนไป", "จ่ายบิล", 
        "transfer success", "withdrawal", "payment", "paid to", "bill payment"
      ];
      
      // Explicitly check for "+" in original text near amount
      const hasPlus = text.includes(`+${finalAmount.toLocaleString()}`) || text.includes(`+${finalAmount}`) || text.includes(`+ ${finalAmount}`);
      
      if (hasPlus || (incomeTriggers.some(kw => ocrTextLower.includes(kw)) && !expenseTriggers.some(kw => ocrTextLower.includes(kw)))) {
        type = "income";
      }
      
      // 5. Category detection
      const category = detectCategory(ocrTextLower);

      // 6. Wallet & Bank detection
      let wallet = defaultWallet; 
      const cashTriggers = ["เงินสด", "cash", "receipt", "ใบเสร็จ"];
      const bankTriggers = ["โอน", "transfer", "slip", "ธนาคาร", "สลิป", "success", "สำเร็จ"];
      
      const hasCash = cashTriggers.some(kw => ocrTextLower.includes(kw));
      const hasBank = bankTriggers.some(kw => ocrTextLower.includes(kw));

      // Detect Bank Name
      const bankNames = {
        "SCB": ["scb", "ไทยพาณิชย์"],
        "KBank": ["kbank", "กสิกร"],
        "K-Bank": ["กสิกรไทย"],
        "BBL": ["bbl", "กรุงเทพ", "bangkok bank"],
        "KTB": ["ktb", "กรุงไทย", "krungthai"],
        "GSB": ["gsb", "ออมสิน"],
        "Krungsri": ["krungsri", "bay", "กรุงศรี"],
        "TTB": ["ttb", "ทีทีบี"]
      };

      let detectedBank = "";
      for (const [name, keywords] of Object.entries(bankNames)) {
        if (keywords.some(kw => ocrTextLower.includes(kw))) {
          detectedBank = name;
          break;
        }
      }

      if (hasCash && !hasBank) wallet = "cash";
      else if (hasBank) wallet = "bank";

      const finalDescription = detectedBank 
        ? (lang === 'th' ? `สแกนจากสลิป ${detectedBank}` : `Scanned from ${detectedBank} slip`)
        : t.ocr_description;

      addTransaction(finalAmount, type, finalDescription, category, wallet);
    } else {
      setConfirmModal({
        show: true,
        title: t.ocr_failed,
        isAlert: true
      });
    }
  };

  const getAIInsight = (customTransactions = transactions) => {
    const todayExpenses = customTransactions.filter(t => t.type === 'expense');
    const totalSpent = todayExpenses.reduce((acc, t) => acc + t.amount, 0);
    const topCategory = Object.entries(todayExpenses.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}))
      .sort((a, b) => b[1] - a[1])[0];

    if (totalSpent === 0) return t.local_insight_zero;
    
    let base = "";
    if (totalSpent > budget) {
      base = t.local_insight_over((totalSpent - budget).toLocaleString(), topCategory?.[0] || (lang === 'th' ? 'อื่นๆ' : 'Other'));
    } else if (totalSpent > budget * 0.8) {
      base = t.local_insight_limit;
    } else {
      base = t.local_insight_good;
    }

    if (topCategory && (topCategory[0] === 'อาหาร' || topCategory[0] === 'Food') && topCategory[1] > budget * 0.5) {
      base += t.local_insight_food;
    }

    return base;
  };

  const updateAIInsight = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, budget, balance, lang })
      });
      const data = await res.json();
      if (data.insight) {
        setAiInsight(data.insight);
      } else {
        setAiInsight(getAIInsight());
      }
    } catch (error) {
      setAiInsight(getAIInsight());
    }
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (showSummary && !aiInsight) {
      updateAIInsight();
    }
  }, [showSummary]);

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

  const saveSettings = async () => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, monthlyBudget, defaultWallet, nickname })
      });
    } catch (error) {
      console.error("Failed to save settings");
    }
  };

  const clearAppData = () => {
    setBalance({ bank: 0, cash: 0 });
    setTransactions([]);
    
    // Also sync to DB
    fetch('/api/data', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [], balance: { bank: 0, cash: 0 } })
    });
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
    return date.toLocaleTimeString(lang === 'th' ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };

  if (status === "loading") {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>{lang === 'th' ? 'กำลังโหลด...' : 'Loading...'}</div>;
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
          <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.5)' }}>
            <Wallet size={40} color="white" />
          </div>
          <div>
            <h1>RemiderMe</h1>
            <p className="text-sm" style={{ marginTop: '0.5rem' }}>จดบันทึกรายรับรายจ่ายด้วยเสียงที่ง่ายที่สุด</p>
          </div>
          <button onClick={() => signIn("google")} className="btn-google" style={{ marginTop: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header-main">
        <div className="profile-section">
          <img src={session.user.image} style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
          <div className="profile-info">
            <h1>{t.greeting}, {nickname || session.user.name.split(' ')[0]}</h1>
            <p className="text-sm">{new Date().toLocaleDateString(lang === 'th' ? "th-TH" : "en-US", { weekday: "long", day: "numeric" })}</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            title={t.language}
            style={{ 
              background: "rgba(255, 255, 255, 0.05)", 
              border: "1px solid var(--glass-border)", 
              color: "white", 
              padding: "8px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Languages size={18} />
          </button>
          <button 
            onClick={() => { setShowSummary(true); updateAIInsight(); }} 
            className={`btn-icon-ai ${isAnalyzing ? 'analyzing' : ''}`}
            style={{ 
              background: "rgba(139, 92, 246, 0.2)", 
              border: "1px solid var(--primary)", 
              color: "var(--primary)", 
              padding: "8px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Sparkles size={20} className={isAnalyzing ? "animate-pulse" : ""} />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <Settings size={22} />
          </button>
          <button onClick={() => setShowHelp(!showHelp)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <HelpCircle size={22} />
          </button>
          <button 
            onClick={() => {
              setEditingTransaction(null);
              setManualAmount("");
              setManualDesc("");
              setActiveWallet(defaultWallet);
              setShowManualEntry(true);
            }} 
            style={{ 
              background: "rgba(255, 255, 255, 0.05)", 
              border: "1px solid var(--glass-border)", 
              color: "white", 
              padding: "8px 12px",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Edit3 size={16} /> <span className="btn-manual-text">{t.add_manual}</span>
          </button>
          <button onClick={() => signOut()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="modal-overlay"
            onClick={() => { saveSettings(); setShowSettings(false); }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="modal-content"
              style={{ maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t.settings}</h2>
                <button onClick={() => { saveSettings(); setShowSettings(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                   <Trash2 size={24} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Nickname */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "ชื่อเล่นของคุณ" : "Your Nickname"}
                  </label>
                  <input 
                    type="text" 
                    value={nickname} 
                    placeholder={session.user.name.split(' ')[0]}
                    onChange={(e) => setNickname(e.target.value)} 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '12px', color: 'white' }} 
                  />
                </div>

                {/* 2. Language Toggle */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t.language}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setLang('th')} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: lang === 'th' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600 }}>ภาษาไทย</button>
                    <button onClick={() => setLang('en')} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: lang === 'en' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600 }}>English</button>
                  </div>
                </div>

                {/* 3. Daily Budget */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "งบประมาณรายวัน (฿)" : "Daily Budget (฿)"}
                  </label>
                  <input 
                    type="number" 
                    value={budget} 
                    onChange={(e) => setBudget(parseFloat(e.target.value) || 0)} 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '12px', color: 'white' }} 
                  />
                </div>

                {/* 4. Monthly Budget */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "งบประมาณรายเดือน (฿)" : "Monthly Budget (฿)"}
                  </label>
                  <input 
                    type="number" 
                    value={monthlyBudget} 
                    onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)} 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '12px', color: 'white' }} 
                  />
                </div>

                {/* 5. Default Wallet */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "กระเป๋าเงินเริ่มต้น" : "Default Wallet"}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setDefaultWallet('bank')} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: defaultWallet === 'bank' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <CreditCard size={14} /> {t.bank}
                    </button>
                    <button onClick={() => setDefaultWallet('cash')} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: defaultWallet === 'cash' ? '#10b981' : 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Banknote size={14} /> {t.cash}
                    </button>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button 
                    onClick={() => { saveSettings(); setShowSettings(false); }} 
                    className="btn-primary" 
                    style={{ width: '100%' }}
                  >
                    {t.ok}
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmModal({
                        show: true,
                        title: lang === 'th' ? "ยืนยันการลบข้อมูลทั้งหมด?" : "Confirm clear all data?",
                        onConfirm: () => {
                          clearAppData();
                          setShowSettings(false);
                        }
                      });
                    }} 
                    style={{ 
                      color: 'var(--danger)', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                      padding: '0.75rem',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}
                  >
                    {t.clear_all}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="glass-card" 
            style={{ 
              marginBottom: "1.5rem", 
              padding: "1.5rem",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid var(--primary)",
              maxHeight: "400px",
              overflowY: "auto"
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} /> {t.how_to_use}
              </h3>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {t.faq.map((item, idx) => (
                <div key={idx} style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px', fontSize: '14px' }}>{item.q}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>{item.a}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className="glass-card" style={{ padding: '1.5rem', background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'left' }}>
            <span className="text-sm">{t.total_balance}</span>
            <div className="balance-amount" style={{ fontSize: '1.8rem' }}>฿{(balance.bank + balance.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <button onClick={exportToCSV} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}>
            <Download size={14} /> {t.export}
          </button>
        </div>

        <div className="balance-grid">
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
              <CreditCard size={16} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>{t.bank}</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>฿{balance.bank.toLocaleString()}</div>
            {activeWallet === 'bank' && <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>● {t.active_wallet}</div>}
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
              <Banknote size={16} /> <span style={{ fontSize: '13px', fontWeight: 600 }}>{t.cash}</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>฿{balance.cash.toLocaleString()}</div>
            {activeWallet === 'cash' && <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>● {t.active_wallet}</div>}
          </motion.div>
        </div>
        
        <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-sm">{lang === 'th' ? "งบวันนี้" : "Today's Budget"} ({Math.min(100, Math.round((transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) / budget) * 100))}%)</span>
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
            <Calendar size={16} /> <span className="text-sm">{lang === 'th' ? "วันนี้" : "Today"}</span>
          </div>
          <button onClick={() => setShowSummary(!showSummary)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <BarChart3 size={18} /> <span className="text-sm">{lang === 'th' ? "ดูรายงาน" : "View Report"}</span>
          </button>
        </div>

        <AnimatePresence>
            {showSummary && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                      <button onClick={() => setViewMode('daily')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'daily' ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 600 }}>{lang === 'th' ? 'รายวัน' : 'Daily'}</button>
                      <button onClick={() => setViewMode('monthly')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'monthly' ? 'var(--primary)' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 600 }}>{lang === 'th' ? 'รายเดือน' : 'Monthly'}</button>
                    </div>

                    <p className="text-sm" style={{ fontWeight: 600, marginBottom: '1rem' }}>
                      {viewMode === 'daily' ? (lang === 'th' ? 'สรุปค่าใช้จ่ายประจําวัน' : 'Daily Expense Summary') : (lang === 'th' ? 'แนวโน้มการใช้จ่าย 7 วันล่าสุด' : 'Spending Trend (Last 7 Days)')}
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
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>Nong Remi AI Analysis</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); updateAIInsight(); }} 
                                    disabled={isAnalyzing}
                                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    {isAnalyzing ? <Loader2 size={10} className="animate-spin" /> : <TrendingUp size={10} />}
                                    {isAnalyzing ? (lang === 'th' ? 'กำลังวิเคราะห์...' : 'Analyzing...') : (lang === 'th' ? 'รีเฟรช' : 'Refresh')}
                                </button>
                            </div>
                            <p className="text-sm" style={{ lineHeight: '1.4', fontStyle: 'italic', color: 'var(--text-main)' }}>
                                {isAnalyzing ? "กำลังประมวลผลข้อมูลการเงินของคุณ..." : (aiInsight || getAIInsight())}
                            </p>
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
                                    <span className="text-sm">{t.categories[cat] || cat}</span>
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
                        <p className="text-sm" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>{lang === 'th' ? "ยังไม่มีข้อมูลในระบบ" : "No data available"}</p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>{t.no_transactions}</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {transactions.map((txn) => (
              <motion.div key={txn._id || txn.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="transaction-item">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ padding: "10px", borderRadius: "12px", background: txn.type === "income" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: txn.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {txn.type === "income" ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: "600" }}>{txn.description}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                       <span className="text-sm">{formatDate(txn.date)}</span>
                       <span style={{ 
                         fontSize: '10px', 
                         background: `${CATEGORY_COLORS[txn.category] || '#64748b'}20`, 
                         color: CATEGORY_COLORS[txn.category] || '#64748b',
                         padding: '2px 10px', 
                         borderRadius: '12px',
                         fontWeight: '600',
                         border: `1px solid ${CATEGORY_COLORS[txn.category] || '#64748b'}40`
                       }}>{t.categories[txn.category] || txn.category}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ fontWeight: "700", color: txn.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {txn.type === "income" ? "+" : "-"} {txn.amount.toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={() => openEdit(txn)} style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", opacity: 0.8, padding: '4px' }}><Edit2 size={18} /></button>
                    <button onClick={() => deleteTransaction(txn._id || txn.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", opacity: 0.8, padding: '4px' }}><Trash2 size={18} /></button>
                  </div>
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
                    <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>
                      {editingTransaction ? (lang === 'th' ? 'แก้ไขรายการ' : 'Edit Transaction') : t.add_manual}
                    </div>
                    <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => setManualType('expense')} className="btn-primary" style={{ flex: 1, background: manualType === 'expense' ? 'var(--danger)' : 'var(--glass)' }}>{t.expense}</button>
                            <button type="button" onClick={() => setManualType('income')} className="btn-primary" style={{ flex: 1, background: manualType === 'income' ? 'var(--success)' : 'var(--glass)' }}>{t.income}</button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                            <button type="button" onClick={() => setActiveWallet('bank')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: activeWallet === 'bank' ? '#3b82f6' : 'transparent', color: 'white', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <CreditCard size={12} /> {t.bank}
                            </button>
                            <button type="button" onClick={() => setActiveWallet('cash')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: activeWallet === 'cash' ? '#10b981' : 'transparent', color: 'white', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <Banknote size={12} /> {t.cash}
                            </button>
                        </div>
                        <input type="number" placeholder={lang === 'th' ? "บาท" : "Amount (฿)"} value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} required />
                        <input type="text" placeholder={t.description} value={manualDesc} onChange={e => setManualDesc(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} />
                        <button type="submit" className="btn-primary">{editingTransaction ? t.save : t.save}</button>
                        <button type="button" onClick={() => { setShowManualEntry(false); setEditingTransaction(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>{t.cancel}</button>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>

      <div className="mic-button-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <AnimatePresence>
          {/* Show interim (partial) transcript while speaking */}
          {interimTranscript && isListening && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-card"
              style={{ 
                padding: '0.5rem 1rem', 
                maxWidth: '300px', 
                borderRadius: '16px', 
                fontSize: '12px', 
                textAlign: 'center', 
                border: '1px solid rgba(139, 92, 246, 0.4)',
                background: 'rgba(139, 92, 246, 0.1)',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '5px'
              }}
            >
              🎤 {interimTranscript}...
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {aiMessage && (isListening || (aiMessage !== translations.th.ai_greeting && aiMessage !== translations.en.ai_greeting)) && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="glass-card"
              style={{ 
                padding: '0.75rem 1.25rem', 
                maxWidth: '280px', 
                borderRadius: '20px', 
                fontSize: '13px', 
                textAlign: 'center', 
                border: '1px solid rgba(59, 130, 246, 0.3)', 
                marginBottom: '5px',
                position: 'relative' // Added for the close button
              }}
            >
              <button 
                onClick={() => setAiMessage("")}
                style={{ 
                  position: 'absolute', 
                  top: '-8px', 
                  right: '-8px', 
                  background: 'var(--danger)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '50%', 
                  width: '22px', 
                  height: '22px', 
                  fontSize: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}
              >
                ✕
              </button>
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
              {/* Continuous mode indicator */}
              {isListening && (
                <div style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '9px',
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                  animation: 'pulse 1.5s infinite'
                }}>
                  {lang === 'th' ? '● ฟังอยู่...' : '● Listening...'}
                </div>
              )}
          </div>
          <button onClick={() => setShowSummary(!showSummary)} className="btn-outline" style={{ borderRadius: '50%', width: '56px', height: '56px' }}>
            <BarChart3 size={24} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="modal-overlay"
            style={{ zIndex: 2100 }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content"
              style={{ textAlign: 'center' }}
            >
              <div style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>
                <Trash2 size={48} style={{ margin: '0 auto' }} />
              </div>
              <h3 style={{ marginBottom: '1rem' }}>{confirmModal.title}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                {lang === 'th' ? "การกระทำนี้ไม่สามารถย้อนกลับได้" : "This action cannot be undone."}
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {!confirmModal.isAlert && (
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, show: false })} 
                    className="btn-outline" 
                    style={{ flex: 1 }}
                  >
                    {t.cancel}
                  </button>
                )}
                <button 
                  onClick={() => {
                    confirmModal.onConfirm?.();
                    setConfirmModal({ ...confirmModal, show: false });
                  }} 
                  className="btn-primary" 
                  style={{ flex: 1, background: confirmModal.isAlert ? 'var(--primary)' : 'var(--danger)' }}
                >
                  {t.ok}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
