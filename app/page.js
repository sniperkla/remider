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
import { Download, CreditCard, Banknote, History, Languages } from "lucide-react";
import { translations } from "@/lib/translations";

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
  const [lang, setLang] = useState("th"); // 'th' or 'en'
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
  const [interimTranscript, setInterimTranscript] = useState(""); // For showing partial speech

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
      recognitionRef.current.continuous = true; // Keep listening continuously
      recognitionRef.current.interimResults = true; // Show partial results
      recognitionRef.current.lang = lang === 'th' ? "th-TH" : "en-US";
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        isVoiceActiveRef.current = true;
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        // Auto-restart if voice is still meant to be active (e.g., didn't manually turn off)
        if (isVoiceActiveRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Already started, ignore
          }
        }
      };
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        let interimText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
        
        // Show interim results for feedback
        if (interimText) {
          setInterimTranscript(interimText);
        }
        
        // Process final result
        if (finalTranscript) {
          setTranscript(finalTranscript);
          setInterimTranscript("");
          if (processVoiceRef.current) processVoiceRef.current(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        // Don't stop on 'no-speech' error, just keep listening
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // These are normal, just continue
          return;
        }
        // Only turn off for serious errors
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isVoiceActiveRef.current = false;
          setIsListening(false);
        }
      };
    }
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
      isVoiceActiveRef.current = true; // Enable auto-restart
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    }
  };

  function processVoiceCommand(text) {
    if (!text) return;
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

      setAiMessage(t.voice_summary(periodLabel, income.toLocaleString(), expense.toLocaleString()));
      return;
    }

    // 2. Check for Balance Inquiry Commands - No amount needed
    const inquiryKeywords = ["เงินเหลือเท่าไหร่", "มีเงินเท่าไหร่", "ยอดเงิน", "เช็คยอด", "balance info", "how much money", "my balance", "how much i have"];
    const isInquiry = inquiryKeywords.some(kw => voiceTextLower.includes(kw));

    if (isInquiry) {
      setAiMessage(t.voice_balance((balance.bank || 0).toLocaleString(), (balance.cash || 0).toLocaleString(), ((balance.bank || 0) + (balance.cash || 0)).toLocaleString()));
      return;
    }

    // 3. Identify Amount (Smarter extraction with Thai word support)
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
      // If no numbers were found and it wasn't a non-numeric command (summary/inquiry), we can't record a transaction
      return; 
    }

    if (amount === 0) return;
    
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
        const parseThaiAmount = (segment) => {
          // Thai digit words mapping
          const thaiDigits = {
            "หนึ่ง": 1, "เอ็ด": 1,
            "สอง": 2, "ยี่": 2,
            "สาม": 3,
            "สี่": 4,
            "ห้า": 5,
            "หก": 6,
            "เจ็ด": 7,
            "แปด": 8,
            "เก้า": 9,
            "สิบ": 10
          };
          
          const thaiMults = {
            "ล้าน": 1000000, 
            "แสน": 100000, 
            "หมื่น": 10000, 
            "พัน": 1000, 
            "ร้อย": 100
          };
          
          // First try to find numeric amount (5000, 7000, etc.)
          const numMatch = segment.match(/(\d+[\d,.]*)/);
          if (numMatch) {
            let amt = parseFloat(numMatch[1].replace(/,/g, ""));
            // Only multiply if the multiplier word appears IMMEDIATELY after the number
            const afterNum = segment.substring(segment.indexOf(numMatch[1]) + numMatch[1].length);
            for (const [word, mult] of Object.entries(thaiMults)) {
              // Check if multiplier is within 3 characters after the number
              const multPos = afterNum.indexOf(word);
              if (multPos !== -1 && multPos <= 3) {
                amt = amt * mult;
                break;
              }
            }
            // If amt is still small (1-10) and doesn't have a multiplier near it,
            // this might be a standalone digit word that shouldn't be used as amount
            if (amt >= 100 || (amt < 100 && segment.match(/(\d+[\d,.]*)\s*(บาท|baht)/i))) {
              return amt;
            }
          }
          
          // Parse Thai word numbers (e.g., "ห้าพัน" = 5000, "เจ็ดพัน" = 7000)
          // Pattern: Look for digit word + multiplier combinations
          let total = 0;
          
          // Try each multiplier from largest to smallest
          for (const [multWord, multValue] of Object.entries(thaiMults)) {
            const multIdx = segment.indexOf(multWord);
            if (multIdx !== -1) {
              // Look for a Thai digit word immediately before the multiplier
              const beforeMult = segment.substring(Math.max(0, multIdx - 10), multIdx);
              let digitValue = 1; // Default to 1 if no digit found (e.g., "พัน" alone = 1000)
              
              // Check each Thai digit word - find the one closest to the multiplier
              let closestDigitPos = -1;
              for (const [digitWord, digitVal] of Object.entries(thaiDigits)) {
                const digitPos = beforeMult.lastIndexOf(digitWord);
                if (digitPos !== -1 && digitPos > closestDigitPos) {
                  closestDigitPos = digitPos;
                  digitValue = digitVal;
                }
              }
              
              total += digitValue * multValue;
            }
          }
          
          // If still no amount found, check for standalone digit words (rare case)
          if (total === 0) {
            for (const [digitWord, digitVal] of Object.entries(thaiDigits)) {
              if (segment.includes(digitWord)) {
                return digitVal;
              }
            }
          }
          
          return total > 0 ? total : 0;
        };
        
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
    const connectorPattern = /\s*(?:และ|และก็|กับ|,|and)\s*/gi;
    const segments = text.split(connectorPattern).filter(s => s.trim());
    
    console.log("=== MULTI-TRANSACTION CHECK ===");
    console.log("Segments:", segments);
    
    // Helper function to parse Thai numbers
    const parseThaiNumber = (str) => {
      const thaiDigits = {
        "หนึ่ง": 1, "เอ็ด": 1, "สอง": 2, "ยี่": 2, "สาม": 3,
        "สี่": 4, "ห้า": 5, "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10
      };
      const thaiMults = { "ล้าน": 1000000, "แสน": 100000, "หมื่น": 10000, "พัน": 1000, "ร้อย": 100 };
      
      // First check for numeric amount
      const numMatch = str.match(/(\d+[\d,.]*)/);
      if (numMatch) {
        let amt = parseFloat(numMatch[1].replace(/,/g, ""));
        // Check for Thai multiplier right after the number
        const afterNum = str.substring(str.indexOf(numMatch[1]) + numMatch[1].length);
        for (const [word, mult] of Object.entries(thaiMults)) {
          if (afterNum.substring(0, 5).includes(word)) {
            amt *= mult;
            break;
          }
        }
        return amt;
      }
      
      // Try Thai word numbers
      let total = 0;
      for (const [multWord, multValue] of Object.entries(thaiMults)) {
        const multIdx = str.indexOf(multWord);
        if (multIdx !== -1) {
          const beforeMult = str.substring(Math.max(0, multIdx - 10), multIdx);
          let digitValue = 1;
          for (const [digitWord, digitVal] of Object.entries(thaiDigits)) {
            if (beforeMult.includes(digitWord)) {
              digitValue = digitVal;
              break;
            }
          }
          total += digitValue * multValue;
        }
      }
      return total;
    };
    
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
    const detectSegmentCategory = (segText) => {
      const segLower = segText.toLowerCase();
      const catMap = {
        "อาหาร": ["กิน", "ข้าว", "น้ำ", "กาแฟ", "ขนม", "อาหาร", "ชา", "eat", "food", "coffee", "drink", "meal"],
        "เดินทาง": ["รถ", "น้ำมัน", "แท็กซี่", "วิน", "grab", "bolt", "gas", "taxi", "fare"],
        "ของใช้": ["ซื้อ", "ของ", "ปรับผ้า", "ผงซักฟอก", "แชมพู", "สบู่", "buy", "shop", "item"],
        "สุขภาพ": ["ยา", "หมอ", "doctor", "medicine"],
        "บันเทิง": ["เกม", "หนัง", "game", "movie", "netflix"]
      };
      
      for (const [cat, keywords] of Object.entries(catMap)) {
        if (keywords.some(kw => segLower.includes(kw))) return cat;
      }
      return "อื่นๆ";
    };
    
    // Parse amounts for each segment
    const parsedSegments = segments.map(seg => ({
      text: seg.trim(),
      amount: parseThaiNumber(seg),
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

    // 6. Identify Category (Detailed mapping for both languages)
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

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(t.invalid_amount);
      return;
    }
    let category = manualType === "income" ? (lang === 'th' ? "รายได้" : "Income") : (lang === 'th' ? "อื่นๆ" : "Other");
    addTransaction(amount, manualType, manualDesc || (manualType === "income" ? t.income : t.expense), category, activeWallet);
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

      addTransaction(finalAmount, type, t.ocr_description, category);
    } else {
      alert(t.ocr_failed);
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
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={session.user.image} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
          <div>
            <h1 style={{ fontSize: "1.2rem" }}>{t.greeting}, {session.user.name.split(' ')[0]}</h1>
            <p className="text-sm">{new Date().toLocaleDateString(lang === 'th' ? "th-TH" : "en-US", { weekday: "long", day: "numeric" })}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
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
                       <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>{t.categories[txn.category] || txn.category}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ fontWeight: "700", color: txn.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {txn.type === "income" ? "+" : "-"} {txn.amount.toLocaleString()}
                  </div>
                  <button onClick={() => deleteTransaction(txn._id || txn.id)} style={{ background: "none", border: "none", color: "var(--glass-border)", cursor: "pointer" }}><Trash2 size={16} /></button>
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
                        <button type="submit" className="btn-primary">{t.save}</button>
                        <button type="button" onClick={() => setShowManualEntry(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>{t.cancel}</button>
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
    </div>
  );
}
