"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import useMobileDetect from "./hooks/useMobileDetect";
import useTransactions from "./hooks/useTransactions";
import useAI from "./hooks/useAI";
import useOCR from "./hooks/useOCR";
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, Reorder } from "framer-motion";
import FilterPanel from "./components/FilterPanel";
import TransactionItem from "./components/TransactionItem";
import DebtItem from "./components/DebtItem";
import ReminderItem from "./components/ReminderItem";
import { CATEGORY_COLORS, CATEGORY_ICONS, DYNAMIC_ICONS } from "./constants";
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
  X,
  Utensils,
  Car,
  ShoppingBag,
  Gamepad2,
  Home as HomeIcon,
  HeartPulse,
  Tags,
  ArrowRightLeft,
  DollarSign,
  Zap,
  Fuel,
  Shirt,
  Smartphone,
  Edit3,
  Edit2,
  Scan,
  Bell,
  Clock,
  Download,
  Languages,
  CreditCard,
  Banknote,
  History,
  MessageCircle,
  Image,
  PlusCircle,
  BellPlus,
  Plus,
  Filter,
  Tag,
  Briefcase,
  Users,
  Heart,
  Star,
  Coffee,
  Check
} from "lucide-react";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { translations } from "@/lib/translations";
import { detectBank, BANK_DATA } from "@/lib/bankUtils";
import { detectCategory, parseThaiNumber, detectLangFromText, extractDataFromOCRText, getLocalAIInsight } from "@/lib/ai-utils";
import { dbPromise, storeHandle, getHandle } from "@/lib/idb-utils";

import WebcamModal from "./components/WebcamModal";

// --- Logic Functions (Hoisted) ---
// Helper Component for Debt Items extracted to components/DebtItem


function HomeContent() {
  const { data: session, status } = useSession();
  
  const {
      transactions, setTransactions, transactionsRef,
      accounts, setAccounts, accountsRef,
      balance, setBalance, balanceRef,
      budget, setBudget,
      monthlyBudget, setMonthlyBudget,
      debts, setDebts,
      reminders, setReminders,
      groqKeys, setGroqKeys,
      activeBankAccountId, setActiveBankAccountId,
      activeWallet, setActiveWallet,
      addTransaction,
      updateTransaction,
      deleteTransaction: deleteTransactionApi
  } = useTransactions();

  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const [editingAccount, setEditingAccount] = useState(null);
  const [defaultWallet, setDefaultWallet] = useState("bank");
  const [nickname, setNickname] = useState("");
  const [showWebcam, setShowWebcam] = useState(false);
  const [preventDelete, setPreventDelete] = useState(false);
  const [viewMode, setViewMode] = useState("daily"); // daily or monthly
  const [visibleCount, setVisibleCount] = useState(20);
  const [filteredAccountId, setFilteredAccountId] = useState(null);
  const [filteredWalletType, setFilteredWalletType] = useState(null); // 'cash' or 'bank'
  const [filteredTimeRange, setFilteredTimeRange] = useState("all"); // 1d, 2d, 7d, 1m, all, custom
  const [filteredCustomRange, setFilteredCustomRange] = useState({ start: '', end: '' });
  const [showBankReport, setShowBankReport] = useState(null); // { id, name, spentToday, spentMonth }
  const [debtFilterTag, setDebtFilterTag] = useState("");
  const [txnFilterTag, setTxnFilterTag] = useState("");
  const [debtFilterTimeRange, setDebtFilterTimeRange] = useState("all"); // all, today, 7d, 30d

  const truncateText = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 3)) + "...";
  };
  const [activeTab, setActiveTab] = useState("transactions"); // transactions or debts
  
  const bankScrollRef = useRef(null);
  const processedFilesRef = useRef(new Set()); // Prevent double-processing
  
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState(""); // For showing partial speech
  const interimTranscriptRef = useRef("");
  useEffect(() => { interimTranscriptRef.current = interimTranscript; }, [interimTranscript]);

  const [showHelp, setShowHelp] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState("transaction"); // transaction, debt, reminder
  const [showSettings, setShowSettings] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [lang, setLang] = useState("th"); // UI language
  const [aiLang, setAiLang] = useState("th"); // AI language, auto-detected per voice
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [editingDebt, setEditingDebt] = useState(null);
  const [editDebtPerson, setEditDebtPerson] = useState("");
  const [editDebtAmount, setEditDebtAmount] = useState("");
  const [editDebtNote, setEditDebtNote] = useState("");
  const [manualDebtPerson, setManualDebtPerson] = useState("");
  const [manualDebtType, setManualDebtType] = useState("lend"); // lend, borrow
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", onConfirm: null });
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualType, setManualType] = useState("expense");
  const [manualReminderDate, setManualReminderDate] = useState("");

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [aiMessage, setAiMessage] = useState(translations.th.ai_greeting);

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const isVoiceActiveRef = useRef(false);
  const silenceTimeoutRef = useRef(null);
  const isListeningRef = useRef(false);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  const aiMessageRef = useRef("");
  useEffect(() => { aiMessageRef.current = aiMessage; }, [aiMessage]);

  // Sync AI Message greeting when language changes
  useEffect(() => {
    // Only update if it's currently the greeting message (to avoid overwriting real AI responses)
    if (aiMessage === translations.th.ai_greeting || aiMessage === translations.en.ai_greeting) {
       setAiMessage(translations[lang].ai_greeting);
    }
  }, [lang]);

  const { recognize, scanProgress, setScanProgress, uploadImageToCloudinary } = useOCR();
  const isMobile = useMobileDetect();
  const isMobileRef = useRef(false);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
  const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
  const lastProcessedTextRef = useRef("");
  const lastProcessTimeRef = useRef(0);
  const restartCountRef = useRef(0);
  
  const [folderHandle, setFolderHandle] = useState(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [lastAutoScan, setLastAutoScan] = useState(0); // Timestamp
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);

  // Onboarding Tutorial System
  const [onboardingTasks, setOnboardingTasks] = useState({
    voice: false,      // Try voice command
    scan: false,       // Try scanning receipt
    manual: false,     // Try manual entry
    completed: false   // All tasks done
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const showOnboardingRef = useRef(false);
  useEffect(() => { showOnboardingRef.current = showOnboarding; }, [showOnboarding]);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showBalanceSetup, setShowBalanceSetup] = useState(false);
  const [balanceBankInput, setBalanceBankInput] = useState("");
  const [balanceCashInput, setBalanceCashInput] = useState("");
  const [budgetDailyInput, setBudgetDailyInput] = useState("");
  const [budgetMonthlyInput, setBudgetMonthlyInput] = useState("");
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(null); // 'voice' | 'scan' | 'manual' | null
  const [tutorialHighlight, setTutorialHighlight] = useState(null); // { top, left, width, height }
  const [highlightedTxnId, setHighlightedTxnId] = useState(null); // For highlighting tutorial result
  const onboardingTasksRef = useRef({ voice: false, scan: false, manual: false, completed: false });
  useEffect(() => { onboardingTasksRef.current = onboardingTasks; }, [onboardingTasks]);
  
  // Refs for tutorial button positions
  const micButtonRef = useRef(null);
  const cameraButtonRef = useRef(null);
  const manualButtonRef = useRef(null);

  // -- AI Configuration (Hoisted) --
  const [useSmartAI, setUseSmartAI] = useState(true);
  const [ocrProvider, setOcrProvider] = useState("google");
  const [aiModel, setAiModel] = useState("llama-3.3-70b-versatile");
  const aiModelRef = useRef("llama-3.3-70b-versatile");
  useEffect(() => { aiModelRef.current = aiModel; }, [aiModel]);
  const [isAIToggleBlink, setIsAIToggleBlink] = useState(false);
  const aiToggleRef = useRef(null);
  const [showToast, setShowToast] = useState({ show: false, title: "", message: "", type: "info", icon: null, color: null });
  const [languageReady, setLanguageReady] = useState(false);
  const languageReadyRef = useRef(false);
  useEffect(() => { languageReadyRef.current = languageReady; }, [languageReady]);

  const t = translations[lang];

  // -- Logic Functions (Hoisted) --
  const advanceToNextTutorialStep = (tasks = onboardingTasks) => {
    if (tasks.completed) {
      setTutorialStep(null);
      setTutorialHighlight(null);
      return;
    }
    let nextStep = null;
    let buttonRef = null;
    if (!tasks.voice) {
      nextStep = 'voice';
      buttonRef = micButtonRef;
    } else if (!tasks.scan) {
      nextStep = 'scan';
      buttonRef = cameraButtonRef;
    } else if (!tasks.manual) {
      nextStep = 'manual';
      buttonRef = manualButtonRef;
    }
    if (nextStep && buttonRef?.current) {
      buttonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setTimeout(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setTutorialStep(nextStep);
        setTutorialHighlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }, 1000);
    } else {
      setTutorialStep(nextStep);
    }
  };

  const completeOnboardingTask = (taskName) => {
    if (!session?.user?.email) return;
    if (onboardingTasksRef.current.completed || !showOnboardingRef.current) return;
    setTutorialStep(null);
    setTutorialHighlight(null);
    const stepName = taskName === 'voice' 
      ? (lang === 'th' ? '🎤 คำสั่งเสียง' : '🎤 Voice Command')
      : taskName === 'scan'
      ? (lang === 'th' ? '📸 สแกนใบเสร็จ' : '📸 Scan Receipt')
      : (lang === 'th' ? '✍️ จดรายการเอง' : '✍️ Manual Entry');
    setAiMessage(lang === 'th' 
      ? `✅ เยี่ยม! ${stepName} สำเร็จ!\n👇 ดูผลลัพธ์ในตารางด้านล่าง`
      : `✅ Great! ${stepName} completed!\n👇 See the result below`
    );
    setTimeout(() => {
      if (!onboardingTasksRef.current.completed && showOnboardingRef.current) {
        const latestTxn = transactionsRef.current[0];
        if (latestTxn) {
          setHighlightedTxnId(latestTxn._id || latestTxn.id);
          setTimeout(() => {
            const txnElement = document.querySelector(`[data-txn-id="${latestTxn._id || latestTxn.id}"]`);
            if (txnElement) txnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
        }
      }
    }, 500);
    setOnboardingTasks(prev => {
      const updated = { ...prev, [taskName]: true };
      const allDone = updated.voice && updated.scan && updated.manual;
      setTimeout(() => {
        setHighlightedTxnId(null);
        setAiMessage("");
        if (allDone) {
          setOnboardingTasks(u => ({ ...u, completed: true }));
          setShowOnboarding(false);
          setAiMessage("");
          setShowCongrats(true);
        } else {
          advanceToNextTutorialStep(updated);
        }
      }, 3000);
      if (session?.user?.email) {
        fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboardingTasks: updated })
        }).catch(err => console.error('Failed to save onboardingTasks to DB:', err));
      }
      return updated;
    });
  };

  const startTutorial = () => {
    setShowOnboarding(true);
    setTimeout(() => {
      advanceToNextTutorialStep();
    }, 300);
  };

  const handleCongratsConfirm = () => {
    if (!session?.user?.email) return;
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tutorialCompleted: true,
        onboardingTasks: { voice: true, scan: true, manual: true, completed: true }
      })
    }).catch(err => console.error('Failed to save tutorialCompleted to DB:', err));
    const tutorialTxns = transactionsRef.current.filter(t => t.isTutorial);
    const realTxns = transactionsRef.current.filter(t => !t.isTutorial);
    let balanceAdjust = { bank: 0, cash: 0 };
    tutorialTxns.forEach(txn => {
      if (txn.type === 'income') balanceAdjust[txn.wallet] -= txn.amount;
      else balanceAdjust[txn.wallet] += txn.amount;
    });
    setBalance(prev => ({ bank: prev.bank + balanceAdjust.bank, cash: prev.cash + balanceAdjust.cash }));
    setTransactions(realTxns);
    setOnboardingTasks({ voice: true, scan: true, manual: true, completed: true });
    setShowCongrats(false);
    setShowOnboarding(false);
    setTutorialStep(null);
    setTutorialHighlight(null);
    setAiMessage(lang === 'th' ? t.ai_greeting : t.ai_greeting);
    setInterimTranscript("");
    setManualAmount("");
    setManualDesc("");
    setShowManualEntry(false);
    setEditingTransaction(null);
    setBalance({ bank: 0, cash: 0 });
    openBalanceSetup();
  };

  const openBalanceSetup = () => {
    setBalanceBankInput("0");
    setBalanceCashInput("0");
    setBudgetDailyInput((budget ?? 0).toString());
    setBudgetMonthlyInput((monthlyBudget ?? 0).toString());
    setShowBalanceSetup(true);
  };

  const handleBalanceSetupSave = async () => {
    if (isSavingBalance) return;
    const bank = Math.max(0, parseFloat(balanceBankInput || "0"));
    const cash = Math.max(0, parseFloat(balanceCashInput || "0"));
    const daily = Math.max(0, parseFloat(budgetDailyInput || "0"));
    const monthly = Math.max(0, parseFloat(budgetMonthlyInput || "0"));
    setIsSavingBalance(true);
    try {
      const newBal = { bank, cash };
      setBalance(newBal);
      setBudget(daily);
      setMonthlyBudget(monthly);
      setTransactions([]);
      setDebts([]);
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true, balance: newBal, budget: daily, monthlyBudget: monthly })
      });
      setShowBalanceSetup(false);
    } catch (error) {
      console.warn("Failed to save balance", error);
      setShowBalanceSetup(false);
    } finally {
      setIsSavingBalance(false);
    }
  };

  const addReminder = async (desc, amount, date, wallet = "bank", category = "อื่นๆ") => {
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, amount, date, wallet, category })
      });
      const data = await res.json();
      setReminders(prev => [data, ...prev].sort((a, b) => new Date(a.date) - new Date(b.date)));
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_REMINDER',
          reminder: data
        });
      }
    } catch (error) {
       console.error("Failed to add reminder");
    }
  };
  const addDebt = async (amount, person, type, note = "", wallet = null, bankAccountId = null) => {
    try {
      // 1. Auto-add transaction first to get ID
      const txnType = type === "borrow" ? "income" : "expense";
      const txnDesc = type === "borrow" 
        ? (lang === 'th' ? `ยืมจาก ${person}` : `Borrowed from ${person}`)
        : (lang === 'th' ? `ให้ ${person} ยืม` : `Lent to ${person}`);
      
      const finalWallet = wallet || activeWallet;
      const txn = await addTransaction(amount, txnType, txnDesc, "การเงิน", finalWallet, null, "ArrowRightLeft", false, null, false, bankAccountId);
      const transactionIds = txn ? [txn._id || txn.id] : [];

      // 2. Add debt with linked transaction
      const res = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, person, type, note, transactionIds, wallet: finalWallet, bankAccountId })
      });
      const data = await res.json();
      setDebts(prev => [data, ...prev]);
    } catch (error) {
      console.error("Failed to add debt");
    }
  };

  const toggleDebtStatus = async (id) => {
    const debt = debts.find(d => (d._id || d.id) === id);
    if (!debt) return;
    const newStatus = debt.status === 'active' ? 'paid' : 'active';
    
    let updatedIds = [...(debt.transactionIds || [])];
    
    if (newStatus === 'paid') {
      const txnType = debt.type === 'borrow' ? 'expense' : 'income';
      const txnDesc = debt.type === 'borrow'
        ? (lang === 'th' ? `คืน ${debt.person}` : `Paid back to ${debt.person}`)
        : (lang === 'th' ? `รับคืนจาก ${debt.person}` : `Received back from ${debt.person}`);
      const txn = await addTransaction(debt.amount, txnType, txnDesc, 'การเงิน', debt.wallet || activeWallet, null, 'ArrowRightLeft', false, null, false, null, id);
      if (txn) updatedIds.push(txn._id || txn.id);
    } else if (newStatus === 'active') {
      // Try to remove the last payment transaction instead of adding an "Undo"
      const lastTxnId = updatedIds.length > 1 ? updatedIds.pop() : null;
      if (lastTxnId) {
        await deleteTransactionApi(lastTxnId);
      } else {
        // Fallback: If only original txn exists or legacy, add a reversal
        const txnType = debt.type === 'borrow' ? 'income' : 'expense';
        const txnDesc = debt.type === 'borrow'
          ? (lang === 'th' ? `ยกเลิกคืน ${debt.person}` : `Undo paid back to ${debt.person}`)
          : (lang === 'th' ? `ยกเลิกรับคืนจาก ${debt.person}` : `Undo received back from ${debt.person}`);
        const txn = await addTransaction(debt.amount, txnType, txnDesc, 'การเงิน', debt.wallet || activeWallet, null, 'ArrowRightLeft', false, null, false, null, id);
        if (txn) updatedIds.push(txn._id || txn.id);
      }
    }

    // Optimistic update
    setDebts(prev => prev.map(d => (d._id || d.id) === id ? { ...d, status: newStatus, transactionIds: updatedIds } : d));
    
    try {
      await fetch(`/api/debts?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, transactionIds: updatedIds })
      });
    } catch (error) {
      console.warn("Failed to update debt status");
    }
  };

  const deleteDebt = async (id) => {
    const debt = debts.find(d => (d._id || d.id) === id);
    if (!debt) return;

    // 1. Delete all associated transactions
    if (debt.transactionIds && debt.transactionIds.length > 0) {
      for (const txnId of debt.transactionIds) {
        await deleteTransactionApi(txnId);
      }
    } 
    
    // Always run heuristic search as fallback/safety to ensure clean state
    const loanDesc = debt.type === "borrow" 
      ? (lang === 'th' ? `ยืมจาก ${debt.person}` : `Borrowed from ${debt.person}`)
      : (lang === 'th' ? `ให้ ${debt.person} ยืม` : `Lent to ${debt.person}`);
    
    const payDesc = debt.type === "borrow"
      ? (lang === 'th' ? `คืน ${debt.person}` : `Paid back to ${debt.person}`)
      : (lang === 'th' ? `รับคืนจาก ${debt.person}` : `Received back from ${debt.person}`);

    const relatedTxns = transactions.filter(t => 
      (t.debtId === (debt._id || debt.id)) ||
      (t.amount === debt.amount && (t.description === loanDesc || t.description === payDesc || t.description.includes(debt.person)))
    );
    
    for (const txn of relatedTxns) {
      // Avoid double deleting if already handled by transactionIds
      if (!debt.transactionIds?.includes(txn._id || txn.id)) {
        await deleteTransactionApi(txn._id || txn.id);
      }
    }

    setDebts(prev => prev.filter(d => (d._id || d.id) !== id));
    try {
      await fetch(`/api/debts?id=${id}`, { method: 'DELETE' });
    } catch (error) {
      console.warn("Failed to delete debt");
    }
  };

  const { processAICommand, isAILoading } = useAI({
    session, lang, t, nickname,
    transactions, accounts, balance, budget, debts, reminders,
    setTransactions, setAccounts, setBalance, setDebts, setBudget, setMonthlyBudget,
    setActiveWallet, setActiveBankAccountId,
    addTransaction, addReminder, addDebt,
    accountsRef, transactionsRef, balanceRef, aiModelRef, onboardingTasksRef, showOnboardingRef, bankScrollRef,
    setAiMessage, setTranscript, setInterimTranscript, setShowSummary, setActiveTab,
    setFilteredAccountId, setFilteredWalletType, setShowBankReport, setShowToast,
    completeOnboardingTask, activeWallet, activeBankAccountId: activeBankAccountId
  });

  // Update highlight position when tutorialStep changes
  useEffect(() => {
    if (!tutorialStep) {
      setTutorialHighlight(null);
      return;
    }
    const updateHighlight = () => {
      let buttonRef = null;
      if (tutorialStep === 'voice') buttonRef = micButtonRef;
      else if (tutorialStep === 'scan') buttonRef = cameraButtonRef;
      else if (tutorialStep === 'manual') buttonRef = manualButtonRef;
      if (buttonRef?.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setTutorialHighlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }
    };
    updateHighlight();
    const timer = setTimeout(updateHighlight, 100);
    return () => clearTimeout(timer);
  }, [tutorialStep]);

  // Prevent scrolling when tutorial is active
  useEffect(() => {
    if (tutorialStep && showOnboarding && !onboardingTasks.completed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [tutorialStep, showOnboarding, onboardingTasks.completed]);

  // Refs for background scanning to avoid stale closures
  const folderHandleRef = useRef(null);
  const lastAutoScanRef = useRef(0);
  const isAutoScanningRef = useRef(false);

  useEffect(() => { folderHandleRef.current = folderHandle; }, [folderHandle]);
  useEffect(() => { lastAutoScanRef.current = lastAutoScan; }, [lastAutoScan]);
  useEffect(() => { isAutoScanningRef.current = isAutoScanning; }, [isAutoScanning]);

  useEffect(() => {
    if (!aiMessage) return;
    const timer = setTimeout(() => {
      setAiMessage("");
    }, 2500);
    return () => clearTimeout(timer);
  }, [aiMessage]);


  useEffect(() => {
    // Update the greeting if it's still the default greeting
    if (aiMessage === translations.th.ai_greeting || aiMessage === translations.en.ai_greeting) {
      setAiMessage(t.ai_greeting);
    }
  }, [lang]);

  // Load Auto-Billing Folder from IDB (lastAutoScan loaded from DB in loadInitialData)
  useEffect(() => {
    const loadFolder = async () => {
      const handle = await getHandle("billingFolder");
      if (handle) {
        setFolderHandle(handle);
      }
    };
    loadFolder();
  }, []);

  const connectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      setFolderHandle(handle);
      await storeHandle("billingFolder", handle);
      // Look back 1 hour on first link so we don't miss recent transfers
      const startFrom = Date.now() - (60 * 60 * 1000); 
      setLastAutoScan(startFrom);
      // Save to DB
      if (session?.user?.email) {
        fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastAutoScan: startFrom })
        }).catch(err => console.error('Failed to save lastAutoScan to DB:', err));
      }
      scanFolderTransactions(handle, startFrom);
    } catch (err) {
      console.warn("Folder access denied or cancelled", err);
    }
  };

  const disconnectFolder = async () => {
    setFolderHandle(null);
    await storeHandle("billingFolder", null);
  };



  const scanFolderTransactions = async (handle = folderHandleRef.current, since = lastAutoScanRef.current, forceAll = false) => {
    if (!handle || isAutoScanningRef.current) return;
    
    setIsAutoScanning(true);
    let newItemsCount = 0;
    try {
      const options = { mode: 'read' };
      const currentPerm = await handle.queryPermission(options);
      
      if (currentPerm !== 'granted') {
        console.log("📂 Folder scan paused: Permission required.");
        // Only request on manual "force" or "scan now", not on background interval
        if (typeof window !== 'undefined' && (forceAll || since === 0)) {
           if ((await handle.requestPermission(options)) !== 'granted') {
             setIsAutoScanning(false);
             return;
           }
        } else {
          setIsAutoScanning(false);
          return;
        }
      }

      console.log(`📡 Scan starting: Checking files since ${new Date(since).toLocaleTimeString()}`);

      for await (const entry of handle.values()) {
        if (entry.kind !== 'file') continue;
        const isImage = /\.(jpg|jpeg|png|webp|bmp)$/i.test(entry.name);
        if (!isImage) continue;
        
        const file = await entry.getFile();
        const fileKey = `${entry.name}-${file.lastModified}-${file.size}`;

        // SAFETY: Only process if lastModified is NEWER than our last scan
        if (forceAll || (file.lastModified >= since && !processedFilesRef.current.has(fileKey))) {
          console.log(`🎯 New file detected: ${entry.name}`);
          if (!forceAll) processedFilesRef.current.add(fileKey);
          
          await new Promise(r => setTimeout(r, forceAll ? 10 : 1500));

          try {
            const { text: ocrText, imageUrl } = await recognize(file, ocrProvider);
            
            if (ocrText && ocrText.trim()) {
              console.log(`✅ OCR Success for ${entry.name}`);
              processOcrText(ocrText, imageUrl, { mode: 'normal' });
              newItemsCount++;
            }
          } catch (ocrErr) {
            console.error("❌ OCR Error:", entry.name, ocrErr);
          }
        }
      }
      
      // SAFETY: Move marker forward to NOW, but subtract 30s buffer to catch overlapping writes
      const nextScanTime = Date.now() - 30000;
      setLastAutoScan(nextScanTime);
      // Save to DB
      if (session?.user?.email) {
        fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastAutoScan: nextScanTime })
        }).catch(err => console.error('Failed to save lastAutoScan to DB:', err));
      }
      
      if (newItemsCount > 0) {
        setAiMessage(t.scanned_new_files(newItemsCount));
      } else {
        console.log("📂 Scan completed: No new bills found.");
      }
    } catch (err) {
      console.error("❌ Folder scan failed:", err);
    }
    setIsAutoScanning(false);
  };

  // REAL-TIME AUTO-SCAN LOGIC
  useEffect(() => {
    if (!folderHandle) return;

    // 1. Scan on window focus (e.g., coming back from banking app)
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log("App focused, checking for new bills...");
        scanFolderTransactions();
      }
    };
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    // 2. Poll every 10 seconds for truly "real-time" feel
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        scanFolderTransactions();
      }
    }, 10000);

    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [folderHandle, t]);

  // Auto-clear noise/silence messages so they don't block the screen forever
  useEffect(() => {
    if (aiMessage && (aiMessage.includes("Noise") || aiMessage.includes("ไม่ได้ยินเสียง"))) {
      const timer = setTimeout(() => {
        setAiMessage("");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [aiMessage]);
  const [aiInsight, setAiInsight] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [pendingInstallPrompt, setPendingInstallPrompt] = useState(false);
  const [pendingTutorialStart, setPendingTutorialStart] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [scanMode, setScanMode] = useState("normal"); // normal, borrow, lend
  const [scanTag, setScanTag] = useState("");
  // Tag Presets State
  const [presetTags, setPresetTags] = useState([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#8b5cf6");
  const [newTagIcon, setNewTagIcon] = useState("Tag");

  // DEBUG: Track presetTags changes
  useEffect(() => {
    console.log(`[DEBUG] presetTags state changed: ${presetTags.length} items`, presetTags);
  }, [presetTags]);

  // Fallback: Load tags from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && session?.user?.email) {
      const localKey = `preset_tags_${session.user.email.toLowerCase()}`;
      try {
        const localData = localStorage.getItem(localKey);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0 && presetTags.length === 0) {
            console.log("[DEBUG] Loading tags from fallback localStorage", parsed);
            setPresetTags(parsed);
          }
        }
      } catch (err) {
        console.error("Local storage error:", err);
      }
    }
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showScanOptions) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showScanOptions]);

  // Initial state - show language modal until DB loads (for fresh users)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "loading") return;
    
    // For non-logged-in users, show language modal if language is not already ready
    if (!session && !languageReady) {
      setShowLanguageModal(true);
      setShowInstallModal(false);
      setShowOnboarding(false);
      setTutorialStep(null);
      setTutorialHighlight(null);
    }
  }, [session, status, languageReady]);

  // Save language to database whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user?.email) return;
    
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang })
    }).catch(err => console.error('Failed to save language to DB:', err));
  }, [lang, session]);

  // Save OCR provider to database whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user?.email) return;
    
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrProvider })
    }).catch(err => console.error('Failed to save OCR provider to DB:', err));
  }, [ocrProvider, session]);

  // Save Smart AI toggle to database whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user?.email) return;
    
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useSmartAI })
    }).catch(err => console.error('Failed to save useSmartAI to DB:', err));
  }, [useSmartAI, session]);

  // Save AI Model to database whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.user?.email) return;
    
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiModel })
    }).catch(err => console.error('Failed to save AI model to DB:', err));
  }, [aiModel, session]);


  
  // PWA & Service Worker Logic
  useEffect(() => {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered:', registration.scope);
            // Register periodic background sync (check reminders every 15 minutes)
            if ('periodicSync' in registration) {
              registration.periodicSync.register('check-reminders', {
                minInterval: 15 * 60 * 1000 // 15 minutes
              }).catch(err => console.log('Periodic sync registration failed:', err));
            }
            
            // Also set up a manual check every 5 minutes when app is open
            setInterval(() => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'CHECK_REMINDERS'
                });
              }
            }, 5 * 60 * 1000); // 5 minutes
            
            // Send all current reminders to service worker for scheduling
            if (navigator.serviceWorker.controller) {
              setTimeout(() => {
                fetch('/api/reminders')
                  .then(res => res.json())
                  .then(reminders => {
                    reminders.forEach(reminder => {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'SCHEDULE_REMINDER',
                        reminder
                      });
                    });
                  })
                  .catch(e => console.log('Could not fetch reminders for scheduling'));
              }, 2000); // Wait 2 seconds after SW registration
            }
          },
          (err) => console.log('SW registration failed:', err)
        );
      });
    }

    // Keep service worker alive with periodic "pings" using a hidden iframe trick
    const keepAliveInterval = setInterval(() => {
      if (navigator.serviceWorker.controller) {
        // Send ping to keep SW awake
        navigator.serviceWorker.controller.postMessage({ type: 'PING' });
        
        // Also make a lightweight fetch to wake it up
        fetch('/manifest.json', { cache: 'no-store' }).catch(() => {});
      }
    }, 25 * 1000); // Every 25 seconds while app is open
    
    // Wake service worker when user returns to the app
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.serviceWorker.controller) {
        console.log('App became visible, checking reminders...');
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK_REMINDERS' });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // 2. Request Notification Permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    // 3. Listen for Install Prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Automatically show the overlay if we have a prompt and aren't installed
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        if (!languageReadyRef.current) {
          setPendingInstallPrompt(true);
          return;
        }
        setShowInstallModal(true);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsAppInstalled(true);
      console.log('App successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };



  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Check for Shared Content (from LINE/Other Apps) via Web Share Target
    const sharedText = searchParams.get('text');
    const sharedTitle = searchParams.get('title');
    
    if (sharedText || sharedTitle) {
      const content = (sharedText || sharedTitle || "").trim();
      if (content) {
        console.log("Received shared content:", content);
        // Delay slightly to ensure data is loaded
        setTimeout(() => {
          if (processVoiceRef.current) {
            setAiMessage(lang === 'th' ? `กำลังบันทึกจาก LINE: "${content}"` : `Processing shared text: "${content}"`);
            processVoiceRef.current(content);
            // Clear URL params to avoid re-processing on reload (optional, requires router.replace)
          }
        }, 1000);
      }
    }
    }, [searchParams, lang]);

  /* -------------------
   * Bank Logic
   * ------------------- */
  async function handleAddAccount() {
    if (!newAccountName) return;

    // AI Detection
    const bankInfo = detectBank(newAccountName);
    const balanceVal = parseFloat(newAccountBalance) || 0;

    let updatedAccounts;

    if (editingAccount) {
      // Update existing
      updatedAccounts = accounts.map(a => a.id === editingAccount.id ? {
        ...a,
        name: newAccountName,
        balance: balanceVal,
        bankCode: bankInfo.code !== 'other' ? bankInfo.code : a.bankCode,
        color: bankInfo.code !== 'other' ? bankInfo.color : a.color 
      } : a);
    } else {
      // Create new
      const newAcc = {
        id: Date.now().toString(),
        name: newAccountName,
        type: 'bank',
        balance: balanceVal,
        bankCode: bankInfo.code,
        color: bankInfo.color
      };
      updatedAccounts = [...accounts, newAcc];
    }

    setAccounts(updatedAccounts);

    // If no active bank account is set, or we just created the first one, set it
    let newActiveId = activeBankAccountId;
    if (!activeBankAccountId || (updatedAccounts.length === 1 && !editingAccount)) {
      newActiveId = updatedAccounts[0].id;
      setActiveBankAccountId(newActiveId);
    }

    // Update total Bank Balance for summary
    const newBankTotal = updatedAccounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + a.balance, 0);
    setBalance(prev => ({ ...prev, bank: newBankTotal }));

    // API Save
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accounts: updatedAccounts, 
          balance: { ...balance, bank: newBankTotal },
          activeBankAccountId: newActiveId
        })
      });
    } catch (e) { 
      console.error("Failed to save account", e); 
    }

    setShowAddAccountModal(false);
    setEditingAccount(null);
    setNewAccountName("");
    setNewAccountBalance("");
  }

  const reorderTimeoutRef = useRef(null);
  const handleReorderAccounts = (reorderedBanks) => {
    // Merge back with non-bank accounts (if any)
    const otherAccounts = accounts.filter(a => a.type !== 'bank');
    const updatedAccounts = [...reorderedBanks, ...otherAccounts];
    
    // Update state locally for immediate feedback
    setAccounts(updatedAccounts);

    // Debounce API Save to avoid spamming during drag
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(() => {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: updatedAccounts })
      });
    }, 1000);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      if (session?.user?.email) {
        setIsLoading(true);
        try {
          const res = await fetch('/api/data', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data.balance) setBalance(data.balance);
            if (data.accounts && data.accounts.length > 0) {
              setAccounts(data.accounts);
            } else if (data.balance && data.balance.bank > 0) {
               setAccounts([{
                 id: 'default_main_bank',
                 name: 'Main Bank',
                 type: 'bank',
                 balance: data.balance.bank,
                 bankCode: 'other',
                 color: '#64748b'
               }]);
            }
            if (data.budget) setBudget(data.budget);
            if (data.monthlyBudget) setMonthlyBudget(data.monthlyBudget);
            if (data.defaultWallet) {
              setDefaultWallet(data.defaultWallet);
              setActiveWallet(data.defaultWallet);
            }
            if (data.activeBankAccountId) {
              setActiveBankAccountId(data.activeBankAccountId);
            } else if (data.accounts && data.accounts.length > 0) {
              setActiveBankAccountId(data.accounts[0].id);
            } else if (data.balance && data.balance.bank > 0) {
              setActiveBankAccountId('default_main_bank');
            }
            if (data.nickname) setNickname(data.nickname);
            if (data.groqKeys) setGroqKeys(data.groqKeys);
            if (data.preventDelete !== undefined) setPreventDelete(data.preventDelete);
            if (data.ocrProvider) setOcrProvider(data.ocrProvider);
            if (data.language) {
              setLang(data.language);
              setLanguageReady(true);
              // Explicitly close modal if we found a saved language
              setShowLanguageModal(false);
            }
            if (data.onboardingCompleted) {
              setLanguageReady(true);
              setShowLanguageModal(false); // Ensure it's closed
            }
            if (data.aiModel) setAiModel(data.aiModel);
            if (data.useSmartAI !== undefined) setUseSmartAI(data.useSmartAI);
            if (data.lastAutoScan) setLastAutoScan(data.lastAutoScan);
            if (data.transactions) setTransactions(data.transactions);
            if (data.debts) setDebts(data.debts);
            
            // Fetch reminders
            const reminderRes = await fetch('/api/reminders');
            if (reminderRes.ok) {
              const reminderData = await reminderRes.json();
              setReminders(reminderData);
            }

            // Show FAQ on first login (from DB)
            if (!data.hasSeenFAQ) {
              setTimeout(() => {
                setShowHelp(true);
                // Mark as seen in DB
                fetch('/api/data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ hasSeenFAQ: true })
                }).catch(err => console.error('Failed to save hasSeenFAQ to DB:', err));
              }, 1500);
            }
            
            // Intelligent Tag Loading (Self-Healing)
            if (data.presetTags && Array.isArray(data.presetTags) && data.presetTags.length > 0) {
                // Server has tags, trust the server
                setPresetTags(data.presetTags);
                console.log("Profile data loaded, presetTags:", data.presetTags);
                
                // Sync to local backup
                if (typeof window !== "undefined" && session?.user?.email) {
                  localStorage.setItem(`preset_tags_${session.user.email.toLowerCase()}`, JSON.stringify(data.presetTags));
                }
            } else {
                // Server returned empty/null tags. Check if we have a local backup to restore.
                if (typeof window !== "undefined" && session?.user?.email) {
                    const localKey = `preset_tags_${session.user.email.toLowerCase()}`;
                    const localData = localStorage.getItem(localKey);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log("Server missing tags, restoring from local backup:", parsed);
                                setPresetTags(parsed);
                                
                                // Silent Self-Heal: Push backup back to server
                                fetch('/api/data', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ presetTags: parsed })
                                }).then(() => console.log("Self-healing: Synced backup tags to server"))
                                  .catch(err => console.error("Self-healing failed:", err));
                            } else {
                                // Local is also empty, so truly empty
                                setPresetTags([]);
                            }
                        } catch (e) {
                             setPresetTags([]);
                        }
                    }
                }
            }
            
            // Load onboarding tasks progress from DB
            const hasCompletedTutorial = data.tutorialCompleted === true;
            if (hasCompletedTutorial) {
              setOnboardingTasks({ voice: true, scan: true, manual: true, completed: true });
            } else if (data.onboardingTasks && (data.onboardingTasks.voice || data.onboardingTasks.scan || data.onboardingTasks.manual)) {
              // Resume from saved progress
              setOnboardingTasks(data.onboardingTasks);
              if (!data.onboardingTasks.completed) {
                setTimeout(() => {
                  if (!data.onboardingCompleted) {
                    setPendingTutorialStart(true);
                    return;
                  }
                  // Start tutorial (works in browser or installed)
                  setShowOnboarding(true);
                  advanceToNextTutorialStep(data.onboardingTasks);
                }, 2000);
              }
            } else {
              // First time user - wait for language selection then start tutorial
              setTimeout(() => {
                if (!data.onboardingCompleted) {
                  setPendingTutorialStart(true);
                  return;
                }
                // Start tutorial for fresh user
                startTutorial();
              }, 2000);
            }
          }
        } catch (error) {
          console.error("Failed to load data from MongoDB:", error);
        }
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [session]);

  // Check for due reminders on mount/load
  useEffect(() => {
    if (reminders.length > 0 && !isLoading) {
      const today = reminders.filter(r => new Date(r.date).toDateString() === new Date().toDateString());
      if (today.length > 0) {
        setTimeout(() => {
          // Show inside-app toast
          setShowToast({
            show: true,
            title: lang === 'th' ? "มีรายการค้างชำระวันนี้ค่ะ! 🔔" : "You have payments due today!",
            message: today.map(r => `• ${r.description} (฿${r.amount})`).join("\n"),
            type: "urgent"
          });
          
          // Send web notification (works outside app + on all devices)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Reminder.me - การแจ้งเตือน', {
              body: today.map(r => `${r.description} ฿${r.amount}`).join(', '),
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'reminder-alert',
              requireInteraction: true
            });
          }
          
          // Play a gentle sound if possible
          try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, context.currentTime);
            gain.gain.setValueAtTime(0, context.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
            osc.start();
            osc.stop(context.currentTime + 0.5);
          } catch(e) {}
        }, 2000);
      }
    }
  }, [reminders, isLoading, lang]);


  // Fix Closure Bug for Voice Recognition:
  // Using a Ref ensures the voice handler always sees the LATEST state/balances
  const processVoiceRef = useRef();
  useEffect(() => {
    processVoiceRef.current = processVoiceCommand;
  }, [balance, accounts, activeWallet, activeBankAccountId, session, transactions, budget, lang]);

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      // Allow continuous speech to capture longer sentences with pauses
      recognitionRef.current.continuous = true; 
      recognitionRef.current.interimResults = true; // Show partial results
      recognitionRef.current.lang = lang === 'th' ? "th-TH" : "en-US";
      recognitionRef.current.maxAlternatives = 1;

      // Track processed results to prevent duplicates on mobile
      const lastSessionIndexRef = { current: -1 };

      // Function to reset silence timer
      const resetSilenceTimer = () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        // Allow longer pauses between words - more time to speak
        // Mobile: 6 seconds | Desktop: 8 seconds
        const timeoutDuration = isMobileRef.current ? 6000 : 8000;
        
        silenceTimeoutRef.current = setTimeout(() => {
          // Check if we are actually still hearing speech
          if (isListeningRef.current && interimTranscriptRef.current) {
            resetSilenceTimer(); // Extend if there is current active text
            return;
          }
          
          console.log("Silence detected - restarting listening for continuous input");
          // Don't stop, just restart to keep listening
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
              // Restart immediately for continuous listening
              setTimeout(() => {
                try {
                  if (isVoiceActiveRef.current && !isRecognitionRunningRef.current) {
                    recognitionRef.current.start();
                  }
                } catch (e) {
                  console.log('Could not restart recognition:', e);
                }
              }, 150);
            } catch (e) {
              console.log('Error in silence handler:', e);
            }
          }
          
          // Don't show silence message - keep user listening silently
          // const timeoutMsg = lang === 'th' 
          //   ? "ไม่ได้ยินเสียงพูดเลยปิดก่อนนะคะ (Noise/Silence) 🎀" 
          //   : "Didn't hear anything, stopping to save power! 🎀";
        }, timeoutDuration);
      };

      // Track recognition running state to prevent double-start errors
      let isRecognitionRunningRef = { current: false };
      
      // Watchdog timer to detect frozen state
      let watchdogRef = { current: null };
      let lastActivityRef = { current: Date.now() };
      
      const startWatchdog = () => {
        if (watchdogRef.current) clearInterval(watchdogRef.current);
        lastActivityRef.current = Date.now();
        
        watchdogRef.current = setInterval(() => {
          const timeSinceActivity = Date.now() - lastActivityRef.current;
          // If no activity for 12 seconds while listening, restart
          if (timeSinceActivity > 12000 && isVoiceActiveRef.current) {
            console.log('Watchdog: Recognition seems frozen, restarting...');
            isRecognitionRunningRef.current = false; // Force reset the flag
            try {
              recognitionRef.current.abort(); // Use abort() instead of stop() for immediate termination
            } catch (e) {
              console.log('Watchdog abort error:', e);
            }
            // Wait longer before restart to ensure clean state
            setTimeout(() => {
              if (isVoiceActiveRef.current && !isRecognitionRunningRef.current) {
                try {
                  recognitionRef.current.start();
                  lastActivityRef.current = Date.now();
                } catch (e) {
                  console.log('Watchdog restart failed:', e);
                  // If still fails, create new recognition instance
                  if (e.message?.includes('already started')) {
                    console.log('Creating new recognition instance...');
                    recognitionRef.current.abort();
                    setTimeout(() => {
                      try {
                        recognitionRef.current.start();
                      } catch (e2) {
                        setIsListening(false);
                        isVoiceActiveRef.current = false;
                      }
                    }, 300);
                  } else {
                    setIsListening(false);
                    isVoiceActiveRef.current = false;
                  }
                }
              }
            }, 300);
          }
        }, 5000); // Check every 5 seconds
      };
      
      const stopWatchdog = () => {
        if (watchdogRef.current) {
          clearInterval(watchdogRef.current);
          watchdogRef.current = null;
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('Recognition started');
        isRecognitionRunningRef.current = true;
        setIsListening(true);
        isVoiceActiveRef.current = true;
        lastSessionIndexRef.current = -1;
        lastActivityRef.current = Date.now();
        resetSilenceTimer();
        startWatchdog();
      };
      
      recognitionRef.current.onend = () => {
        console.log('Recognition ended');
        isRecognitionRunningRef.current = false;
        stopWatchdog();
        
        // Auto-restart if user hasn't manually stopped
        if (isVoiceActiveRef.current) {
          console.log('Auto-restarting recognition...');
          setTimeout(() => {
            if (!isRecognitionRunningRef.current && isVoiceActiveRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log('Auto-restart failed:', e);
                setIsListening(false);
                isVoiceActiveRef.current = false;
                setInterimTranscript("");
              }
            }
          }, 150);
        } else {
          setIsListening(false);
          setInterimTranscript("");
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        }
      };

      recognitionRef.current.onspeechstart = () => {
        console.log("Speech started detection");
        lastActivityRef.current = Date.now();
        resetSilenceTimer();
      };

      recognitionRef.current.onspeechend = () => {
        console.log("Speech ended detection");
        // Don't stop here, let onresult or silence handle it
      };
      
      // Accumulate all text until user is truly done
      let accumulatedTextRef = { current: "" };
      let processTimeoutRef = { current: null };
      let lastFinalTextRef = { current: "" };
      
      recognitionRef.current.onresult = (event) => {
        // Update activity tracker
        lastActivityRef.current = Date.now();
        
        let currentText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          
          // Always append text for display, so user sees what's happening
          if (text) currentText += text;

          if (result.isFinal) {
            const trimmedText = text.trim();
            // Prevent duplicate - only add if different from last final text
            if (trimmedText && trimmedText !== lastFinalTextRef.current) {
              lastFinalTextRef.current = trimmedText;
              accumulatedTextRef.current = trimmedText; // Replace instead of append
              console.log("Final text:", accumulatedTextRef.current);
              
              // Clear any pending process timeout
              if (processTimeoutRef.current) {
                clearTimeout(processTimeoutRef.current);
              }
              
              // Wait 1.5 seconds of silence after last speech to process
              // This gives time for user to think and continue but is fast enough to feel responsive
              processTimeoutRef.current = setTimeout(() => {
                if (accumulatedTextRef.current) {
                  console.log("Processing text after pause:", accumulatedTextRef.current);
                  setTranscript(accumulatedTextRef.current);
                  if (processVoiceRef.current) {
                    processVoiceRef.current(accumulatedTextRef.current);
                  }
                  accumulatedTextRef.current = ""; // Reset for next command
                  lastFinalTextRef.current = ""; // Reset duplicate check
                }
              }, 1500); // 1.5 seconds wait after last speech - faster response
            }
          }
        }
        
        // Only reset the timer if we actually heard SOME text (not just empty noise)
        if (currentText.trim().length > 0) {
          resetSilenceTimer();
        }
        
        // Update UI with current text being spoken
        if (currentText.trim()) {
          setInterimTranscript(currentText.trim());
        }
      };
      recognitionRef.current.onerror = (event) => {
        // Ignore aborted errors - these are intentional (from abort() calls)
        if (event.error === 'aborted') {
          // Silent ignore - this is expected when we stop/restart
          return;
        }
        
        console.error("Speech recognition error", event.error);
        
        // Clear any pending timeouts
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        
        if (event.error === 'no-speech') {
          setAiMessage(lang === 'th' ? 'ไม่ได้ยินเสียงค่ะ ลองพูดใหม่นะคะ 🎤' : 'No speech detected. Please try again 🎤');
          setIsListening(false);
          return;
        }
        
        if (event.error === 'audio-capture') {
          setAiMessage(lang === 'th' ? 'ไม่สามารถใช้งานไมค์ได้ กรุณาตรวจสอบการอนุญาต 🎤' : 'Cannot access microphone. Please check permissions 🎤');
          isVoiceActiveRef.current = false;
          setIsListening(false);
          return;
        }
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setAiMessage(lang === 'th' ? 'กรุณาอนุญาตการใช้งานไมค์ก่อนค่ะ 🎤' : 'Please allow microphone access 🎤');
          isVoiceActiveRef.current = false;
          setIsListening(false);
          return;
        }
        
        if (event.error === 'network') {
          setAiMessage(lang === 'th' ? 'เกิดปัญหาการเชื่อมต่อค่ะ ลองใหม่อีกครั้งนะคะ' : 'Network error. Please try again');
          setIsListening(false);
          return;
        }
        
        // Other errors
        console.log('Recognition error:', event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  // Update speech recognition language when app language changes
  // Dynamically set recognition language based on detected spoken language
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang === 'th' ? "th-TH" : "en-US";
    }
  }, [lang]);

  const toggleListening = () => {
    if (isListening) {
      isVoiceActiveRef.current = false; // Stop auto-restart
      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort(); // Use abort for immediate stop
        }
      } catch (e) {
        console.log('Stop recognition error:', e);
      }
      setIsListening(false);
      setInterimTranscript("");
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    } else {
      setTranscript("");
      setInterimTranscript("");
      isVoiceActiveRef.current = true;
      
      // Use abort to ensure clean state before starting
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
      
      // Small delay to ensure clean start
      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
          }
        } catch (e) {
          console.log('Start recognition error:', e);
          // If already started, just continue
          if (e.message && e.message.includes('already started')) {
            setIsListening(true);
          } else {
            setIsListening(false);
            setAiMessage(lang === 'th' ? 'ไม่สามารถเปิดไมค์ได้ กรุณาลองอีกครั้งค่ะ' : 'Cannot start microphone. Please try again.');
          }
        }
      }, 150); // Slightly longer delay after abort
    }
  };

  const lastProcessedRef = useRef({ text: "", time: 0 });





      

  const processVoiceCommand = (text) => {
    if (!text || !text.trim()) return;
    // Show processing state
    setIsProcessing(true);
    
    // Add a small delay to show processing UI
    setTimeout(() => {
      // Detect language from spoken text
      const detectedLang = detectLangFromText(text, lang);
      setAiLang(detectedLang);
      // Dynamically update recognition language for next utterance
      if (recognitionRef.current) {
        recognitionRef.current.lang = detectedLang === 'th' ? "th-TH" : "en-US";
      }
      // Stop mic immediately once we have a final command
      isVoiceActiveRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      // Immediate feedback: clear transcripts
      setTranscript("");
      setInterimTranscript("");
      const voiceTextLower = text.toLowerCase();
      const isNormalMode = !useSmartAI; // Flag for normal mode
      
      // AI AGENT MODE
      if (useSmartAI) {
        processAICommand(text, detectedLang);
        setIsProcessing(false);
        return;
      }
      
      // =====================================================
      // NORMAL MODE - Enhanced Processing Without AI
      // =====================================================
      
      // Clear any AI message first
      setAiMessage("");
      
      // Strengthen Duplicate prevention for Mobile:
      const nowTime = Date.now();
      const timeDiff = nowTime - lastProcessedRef.current.time;
      const lastText = lastProcessedRef.current.text;
      
      if (text === lastText && timeDiff < 3000) {
        console.log("Ignoring exact duplicate:", text);
        setIsProcessing(false);
        return;
      }
      
      if (lastText.includes(text) && text.length > 2 && timeDiff < 2500) {
        console.log("Ignoring cached / partial duplicate:", text);
        setIsProcessing(false);
        return;
      }

      lastProcessedRef.current = { text, time: nowTime };
      
      // ============ NORMAL MODE COMMAND DETECTION ============
      
      // 1. Check for Summary Commands (works in normal mode too)
      const summaryKeywords = ["สรุป", "รายงาน", "summary", "report", "total", "รวมทั้งหมด", "ใช้ไปเท่าไหร่", "ใช้ไปเท่าไร่"];
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
        const totalBalance = (balance.bank || 0) + (balance.cash || 0);

        const summaryMsg = lang === 'th' 
          ? `📊 สรุป${periodLabel}:\n💰 รายรับ ฿${income.toLocaleString()}\n💸 รายจ่าย ฿${expense.toLocaleString()}\n📈 สุทธิ ฿${net.toLocaleString()}\n\n💳 คงเหลือ:\n🏦 ธนาคาร ฿${(balance.bank || 0).toLocaleString()}\n💵 เงินสด ฿${(balance.cash || 0).toLocaleString()}\n📊 รวม ฿${totalBalance.toLocaleString()}`
          : `📊 ${periodLabel} Summary:\n💰 Income ฿${income.toLocaleString()}\n💸 Expense ฿${expense.toLocaleString()}\n📈 Net ฿${net.toLocaleString()}\n\n💳 Balance:\n🏦 Bank ฿${(balance.bank || 0).toLocaleString()}\n💵 Cash ฿${(balance.cash || 0).toLocaleString()}\n📊 Total ฿${totalBalance.toLocaleString()}`;

        setAiMessage(summaryMsg);
        setShowSummary(true);
        setIsProcessing(false);
        return;
      }

      // 2. Check for Balance Inquiry Commands
      const inquiryKeywords = ["เงินเหลือเท่าไหร่", "มีเงินเท่าไหร่", "ยอดเงิน", "เช็คยอด", "balance", "how much money", "my balance", "เหลือเท่าไหร่"];
      const isInquiry = inquiryKeywords.some(kw => voiceTextLower.includes(kw));

      if (isInquiry) {
        const bankStr = (balance.bank || 0).toLocaleString();
        const cashStr = (balance.cash || 0).toLocaleString();
        const totalStr = ((balance.bank || 0) + (balance.cash || 0)).toLocaleString();
        
        setAiMessage(lang === 'th' 
          ? `💳 เงินคงเหลือของคุณ:\n🏦 ธนาคาร ฿${bankStr}\n💵 เงินสด ฿${cashStr}\n📊 รวมทั้งหมด ฿${totalStr}`
          : `💳 Your Balance:\n🏦 Bank ฿${bankStr}\n💵 Cash ฿${cashStr}\n📊 Total ฿${totalStr}`
        );
        setIsProcessing(false);
        return;
      }
      
      // 3. Check for QUESTION patterns (should NOT record as transaction)
      const questionPatterns = [
        "ไหม", "มั้ย", "เหรอ", "หรือเปล่า", "ได้ไหม", "พอไหม", 
        "เท่าไหร่", "กี่บาท", "ยังไง", "อะไร", "?", "ได้บ้าง",
        "ควรจะ", "น่าจะ", "แนะนำ", "ช่วย", "วางแผน"
      ];
      const isQuestion = questionPatterns.some(kw => voiceTextLower.includes(kw));
      
      if (isQuestion) {
        setAiMessage(lang === 'th' 
          ? `❓ ดูเหมือนคุณถามคำถาม - เปิดโหมด AI เพื่อรับคำแนะนำได้นะคะ\n\nหรือพูดคำสั่งตรงๆ เช่น "ซื้อข้าว 50"` 
          : `❓ That looks like a question - enable AI mode for advice!\n\nOr say a direct command like "lunch 50"`
        );
        setIsProcessing(false);
        return;
      }

      // 4. Parse Amount from text
      const amount = parseThaiNumber(text);

      if (amount === 0) {
        setAiMessage(lang === 'th' 
          ? `ไม่เจอจำนวนเงินค่ะ ลองพูดใหม่ เช่น "ซื้อข้าว 50" หรือ "กินกาแฟ 80"` 
          : `No amount found. Try: "lunch 50" or "coffee 80"`
        );
        setIsProcessing(false);
        return;
      }

      // 5. Detect Payment Method (wallet) - Enhanced detection
      let wallet = activeWallet; // Default to user's primary
      
      // Cash indicators
      const cashKeywords = ["เงินสด", "สด", "จ่ายสด", "ด้วยเงินสด", "ใช้เงินสด", "ถอน", "ถอนเงิน", "cash", "แบงค์"];
      if (cashKeywords.some(kw => voiceTextLower.includes(kw))) {
        wallet = "cash";
      }
      
      // Bank/Transfer indicators
      const bankKeywords = ["โอน", "จากการโอน", "ผ่านแอป", "สแกน", "สแกนจ่าย", "qr", "คิวอาร์", "ธนาคาร", "บัตร", "เดบิต", "เครดิต", "transfer", "bank", "card", "app"];
      if (bankKeywords.some(kw => voiceTextLower.includes(kw))) {
        wallet = "bank";
      }

      // 6. Detect Transaction Type (income vs expense)
      const incomeKeywords = [
        "ได้", "ได้เงิน", "รับ", "รับเงิน", "เงินเข้า", "โอนเข้า", "เงินเดือน", "โบนัส", "ขาย", "คืนเงิน", "ยืมมา",
        "income", "receive", "salary", "bonus", "refund", "cashback", "got", "earned"
      ];
      const expenseKeywords = [
        "ซื้อ", "จ่าย", "เสีย", "ใช้", "ค่า", "หมด", "ออก", "โอนออก", "โอนให้", "เติม", "ชำระ", "กิน", "ทาน",
        "pay", "paid", "buy", "bought", "purchase", "spent", "expense", "bill", "fee", "ate", "drink"
      ];

      const hasIncomeKeyword = incomeKeywords.some(kw => voiceTextLower.includes(kw));
      const hasExpenseKeyword = expenseKeywords.some(kw => voiceTextLower.includes(kw));

      let type = "expense"; // Default to expense
      if (hasIncomeKeyword && !hasExpenseKeyword) {
        type = "income";
      }

      // 7. Detect Category
      let category = detectCategory(text);

      // 8. Extract Description - Clean up the text
      let description = text;
      
      // Remove amount patterns
      const amountPatterns = [
        /\d+(\.\d+)?/g,
        /[\d,]+/g
      ];
      amountPatterns.forEach(pattern => {
        description = description.replace(pattern, "");
      });
      
      // Remove common filler words
      const filterWords = [
        "บาท", "วันนี้", "เมื่อกี้", "เมื่อวาน", "baht", "today", "yesterday",
        "เงินสด", "ด้วยเงินสด", "จ่ายสด", "โอน", "จากการโอน", "ผ่านแอป", "สแกน",
        "ซื้อ", "จ่าย", "กิน", "ใช้", "ค่า", "ได้", "รับ",
        "cash", "bank", "transfer", "pay", "paid", "buy", "bought"
      ];
      filterWords.forEach(word => {
        description = description.replace(new RegExp(word, 'gi'), "");
      });
      
      description = description.replace(/\s+/g, " ").trim();
      
      // If description is empty, use a default
      if (!description || description.length < 2) {
        description = type === "income" 
          ? (lang === 'th' ? "รายรับ" : "Income") 
          : (lang === 'th' ? "รายจ่าย" : "Expense");
      }

      // 9. Add the transaction (mark as tutorial if onboarding not completed)
      const isTutorialMode = !onboardingTasksRef.current.completed && showOnboardingRef.current;
      addTransaction(amount, type, description, category, wallet, null, null, false, null, isTutorialMode);
      
      // Complete voice onboarding task (normal mode)
      completeOnboardingTask('voice');
      
      // 10. Show confirmation message
      const walletLabel = wallet === 'cash' 
        ? (lang === 'th' ? 'เงินสด' : 'Cash') 
        : (lang === 'th' ? 'ธนาคาร' : 'Bank');
      const typeLabel = type === 'income'
        ? (lang === 'th' ? '💰 รายรับ' : '💰 Income')
        : (lang === 'th' ? '💸 รายจ่าย' : '💸 Expense');
        
      setAiMessage(lang === 'th'
        ? `✅ บันทึกแล้ว!\n${typeLabel}: ${description}\n💵 จำนวน: ฿${amount.toLocaleString()}\n💳 จาก: ${walletLabel}`
        : `✅ Recorded!\n${typeLabel}: ${description}\n💵 Amount: ฿${amount.toLocaleString()}\n💳 From: ${walletLabel}`
      );
      
      setIsProcessing(false);
    }, 600); // 600ms delay for processing feedback
  };


  // Resume install prompt and tutorial after language is selected
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!languageReady) return;

    // Wait for language modal to close first
    if (showLanguageModal) return;

    // Show install modal first if available
    if (pendingInstallPrompt && deferredPrompt && !isAppInstalled) {
      setShowInstallModal(true);
      setPendingInstallPrompt(false);
      // Don't start tutorial yet - wait for install modal to be dismissed
      return;
    }

    // Only start tutorial if install modal is not showing
    if (pendingTutorialStart && session?.user?.email && !showInstallModal) {
      // tutorialCompleted is already loaded from DB into onboardingTasks state
      const hasCompletedTutorial = onboardingTasks.completed === true;

      if (!hasCompletedTutorial) {
        // Check if there's progress saved in state (loaded from DB)
        const hasProgress = onboardingTasks.voice || onboardingTasks.scan || onboardingTasks.manual;
        
        if (hasProgress && !onboardingTasks.completed) {
          setShowOnboarding(true);
          advanceToNextTutorialStep(onboardingTasks);
        } else if (!hasProgress) {
          startTutorial();
        }
      }

      setPendingTutorialStart(false);
    }
  }, [languageReady, pendingInstallPrompt, pendingTutorialStart, deferredPrompt, isAppInstalled, session, onboardingTasks, showInstallModal, showLanguageModal]);

  // Get tutorial content for current step
  const getTutorialContent = () => {
    if (tutorialStep === 'voice') return {
      title: lang === 'th' ? "🎤 ขั้นตอนที่ 1: ลองพูดคำสั่ง" : "🎤 Step 1: Try Voice Command",
      instruction: lang === 'th' 
        ? "กดปุ่มไมค์แล้วพูดตามตัวอย่าง" 
        : "Tap the mic button and speak the example below",
      example: lang === 'th' ? 'ซื้อกาแฟ 50 บาท' : 'coffee 50 baht',
      prompt: lang === 'th' 
        ? 'ลองพูด: "ซื้อกาแฟ 50 บาท" หรือ "ส่งเงินให้ปิยะพันธ์ 2000 บาท"' 
        : 'Try saying: "coffee 50 baht" or "transfer to john 1000 baht"',
      buttonLabel: lang === 'th' ? "กดที่ปุ่มไมค์ ↓" : "Tap the mic button ↓"
    };
    if (tutorialStep === 'scan') return {
      title: lang === 'th' ? "📸 ขั้นตอนที่ 2: สแกนใบเสร็จ" : "📸 Step 2: Scan Receipt",
      instruction: lang === 'th' 
        ? "กดปุ่มกล้องแล้วเลือกรูปสลิป/ใบเสร็จ" 
        : "Tap the camera button and select a receipt image",
      example: lang === 'th' ? "เลือกรูปสลิปโอนเงิน หรือ ใบเสร็จ" : "Select a transfer slip or receipt image",
      prompt: lang === 'th'
        ? 'AI จะอ่านข้อมูลจากรูปและบันทึกอัตโนมัติ'
        : 'AI will read the image and record automatically',
      buttonLabel: lang === 'th' ? "กดที่ปุ่มกล้อง ↓" : "Tap the camera button ↓"
    };
    if (tutorialStep === 'manual') return {
      title: lang === 'th' ? "✍️ ขั้นตอนที่ 3: จดรายการเอง" : "✍️ Step 3: Manual Entry",
      instruction: lang === 'th' 
        ? "กดปุ่มด้านบนเพื่อเปิดฟอร์มจดรายการ" 
        : "Tap the button above to open entry form",
      example: lang === 'th' ? "กรอก: 100 บาท + กาแฟ" : "Enter: 100 baht + coffee",
      prompt: lang === 'th'
        ? '💡 กรอกจำนวนเงิน เลือกหมวดหมู่ แล้วกดบันทึก'
        : '💡 Enter amount, select category, then save',
      buttonLabel: lang === 'th' ? "กดที่ปุ่ม 'จดเอง' ↑" : "Tap 'Manual Entry' ↑"
    };
    return null;
  };

  // Get current uncompleted onboarding task (for panel view)
  const getNextOnboardingTask = () => {
    if (!onboardingTasks.voice) return {
      id: 'voice',
      title: lang === 'th' ? "🎤 ลองพูดคำสั่งแรก" : "🎤 Try Your First Voice Command",
      description: lang === 'th' 
        ? "กดปุ่มไมค์แล้วลองพูด:" 
        : "Tap the mic button and say:",
      example: lang === 'th' ? "ซื้อกาแฟ 50 บาท" : "coffee 50 baht",
      hint: lang === 'th' 
        ? "💡 พูดตามธรรมชาติได้เลย AI จะเข้าใจเอง" 
        : "💡 Speak naturally, AI will understand"
    };
    if (!onboardingTasks.scan) return {
      id: 'scan',
      title: lang === 'th' ? "📸 ลองสแกนใบเสร็จ" : "📸 Try Scanning a Receipt",
      description: lang === 'th' 
        ? "กดปุ่มกล้องแล้วเลือกรูปสลิป/ใบเสร็จ" 
        : "Tap the camera button and select a receipt image",
      example: lang === 'th' ? "เลือกรูปสลิปโอนเงินหรือใบเสร็จ" : "Select a transfer slip or receipt",
      hint: lang === 'th' 
        ? "💡 AI จะอ่านข้อมูลจากรูปและบันทึกให้อัตโนมัติ" 
        : "💡 AI will read the data and record automatically"
    };
    if (!onboardingTasks.manual) return {
      id: 'manual',
      title: lang === 'th' ? "✍️ ลองจดเอง" : "✍️ Try Manual Entry",
      description: lang === 'th' 
        ? "กดปุ่ม 'จดเอง' เพื่อบันทึกรายการด้วยตัวเอง" 
        : "Tap 'Manual Entry' to record manually",
      example: lang === 'th' ? "ใส่จำนวนเงินและรายละเอียด" : "Enter amount and description",
      hint: lang === 'th' 
        ? "💡 เหมาะสำหรับบันทึกรายการย้อนหลัง" 
        : "💡 Great for backdated entries"
    };
    return null;
  };


  const openEdit = (txn) => {
    setEditingTransaction(txn);
    setManualAmount(txn.amount.toString());
    setManualDesc(txn.description);
    setManualType(txn.type);
    setActiveWallet(txn.wallet || "bank");
    if (txn.wallet === "bank" && txn.accountId) {
      setActiveBankAccountId(txn.accountId);
    }
    setShowManualEntry(true);
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
      accountId: activeWallet === 'bank' ? (activeBankAccountId || (accounts.find(a => a.type === 'bank')?.id) || null) : null,
      // Keep category if editing, or detect if new
      category: editingTransaction ? editingTransaction.category : (manualType === "income" ? (lang === 'th' ? "รายได้" : "Income") : (lang === 'th' ? "อื่นๆ" : "Other"))
    };

    if (editingTransaction) {
      updateTransaction(editingTransaction._id || editingTransaction.id, data);
    } else if (editingReminder) {
      updateReminder(editingReminder._id || editingReminder.id, {
        description: data.description,
        amount: data.amount,
        wallet: data.wallet,
        date: manualReminderDate ? new Date(manualReminderDate).toISOString() : editingReminder.date
      });
    } else if (manualEntryMode === 'debt') {
      const tagPart = scanTag ? `[${scanTag}]` : "";
      const finalNote = tagPart ? (manualDesc ? `${tagPart} ${manualDesc}` : tagPart) : manualDesc;
      addDebt(data.amount, manualDebtPerson, manualDebtType, finalNote);
      setScanTag("");
    } else if (manualEntryMode === 'reminder') {
      addReminder(data.description, data.amount, manualReminderDate, data.wallet);
    } else {
      // Mark as tutorial if onboarding not completed (use refs to avoid stale closure)
      const isTutorialMode = !onboardingTasksRef.current.completed && showOnboardingRef.current;
      addTransaction(data.amount, data.type, data.description, data.category, data.wallet, null, null, false, null, isTutorialMode);
      // Complete manual entry onboarding task
      completeOnboardingTask('manual');
    }

    setManualAmount("");
    setManualDesc("");
    setManualType("expense");
    setManualDebtPerson("");
    setManualReminderDate("");
    setEditingTransaction(null);
    setEditingReminder(null);
    setShowManualEntry(false);
  };

  const handleImageUpload = async (e) => {
    if (!useSmartAI) {
      setAiMessage(lang === 'th' ? 'กรุณาเปิดโหมด AI ก่อนใช้งานการสแกนค่ะ 🤖' : 'Please enable AI mode first to use scan 🤖');
      // Navigate to AI toggle and blink
      if (aiToggleRef.current) {
        aiToggleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setIsAIToggleBlink(true);
        setTimeout(() => setIsAIToggleBlink(false), 3000);
      }
      return;
    }
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsProcessingImage(true);
    setBatchProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      setScanProgress(0);
      
      try {
        const { text, imageUrl } = await recognize(files[i], ocrProvider);
        console.log(`OCR Result (File ${i + 1}):`, text);
        processOcrText(text, imageUrl);
      } catch (error) {
        console.error(`OCR Error (File ${i + 1}):`, error);
      }
    }

    setIsProcessingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    // Reset scan mode after processing
    if (useSmartAI) {
       setScanMode('normal');
       setScanTag('');
    }
  };

  const processOcrText = (text, imageUrl = null, options = {}) => {
    // Determine mode and tag: options override state (important for background scans)
    const currentMode = options.mode || scanMode;
    const currentTag = options.tag || scanTag;

    // AI AGENT MODE FOR IMAGES
    if (useSmartAI) {
        let compactText = text.replace(/\s+/g, " ").trim();

        // Inject Context if scan mode is active at the END to allow AI to parse bill naturally first
        if (currentMode === 'borrow' || currentMode === 'lend') {
             compactText = `${compactText}\n\n[Action: ${currentMode.toUpperCase()}]\n[Tag: ${currentTag || (lang === 'th' ? (currentMode === 'borrow' ? "ยืม" : "ให้ยืม") : currentMode)}]`;
        }
        
        console.log("Processing OCR with Context:", { mode: currentMode, tag: currentTag });

        processAICommand(
          lang === 'th' ? `ช่วยดูข้อมูลจากสลิป/ใบเสร็จนี้หน่อย: ${compactText}` : `Scan this receipt/slip text: ${compactText}`,
          null,
          imageUrl,
          "llama-3.3-70b-versatile",
          "ocr",
          text
        );
        return;
    }

    const { amount: finalAmount, found } = extractDataFromOCRText(text);

    if (found) {
      const type = text.includes("เงินเข้า") || text.includes("รับเงิน") ? "income" : "expense";
      const category = detectCategory(text);
      const detectedBank = detectBank(text);
      let wallet = "cash";
      const hasBank = text.includes("กสิกร") || text.includes("ไทยพาณิชย์") || text.includes("กรุงไทย") || text.includes("โอน");
      if (detectedBank) wallet = "bank";
      else if (hasBank) wallet = "bank";

      const finalDescription = detectedBank 
        ? (lang === 'th' ? `สแกนจากสลิป ${detectedBank}` : `Scanned from ${detectedBank} slip`)
        : t.ocr_description;

      addTransaction(finalAmount, type, finalDescription, category, wallet, detectedBank, null, true, imageUrl);
    } else {
      setConfirmModal({
        show: true,
        title: t.ocr_failed,
        isAlert: true
      });
    }
  };












  const getAIInsight = (customTransactions = transactions) => getLocalAIInsight(customTransactions, balance, budget, lang, t);

  const updateAIInsight = async (options = {}) => {
    if (!useSmartAI) return "";
    setIsAnalyzing(true);
    let insightText = "";
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, budget, monthlyBudget, balance, lang, aiModel })
      });
      const data = await res.json();
      insightText = data.insight || getAIInsight();
    } catch (error) {
      insightText = getAIInsight();
    }

    setAiInsight(insightText);
    if (options.setMessage) {
      setAiMessage(insightText);
    }
    setIsAnalyzing(false);
    return insightText;
  };

  useEffect(() => {
    if (useSmartAI && showSummary && !aiInsight) {
      updateAIInsight();
    }
  }, [showSummary, useSmartAI]);

  const deleteTransaction = async (id, force = false) => {
    if (preventDelete && !force) {
      setConfirmModal({
        show: true,
        title: t.confirm_delete_title,
        onConfirm: () => deleteTransaction(id, true)
      });
      return;
    }
    await deleteTransactionApi(id);
  };


  const openEditDebt = (debt) => {
    setEditingDebt(debt);
    setEditDebtPerson(debt.person);
    setEditDebtAmount(debt.amount);
    setEditDebtNote(debt.note || "");
    setShowManualEntry(true);
  };

  const handleSaveDebt = async () => {
    if (!editDebtPerson || !editDebtAmount) return;
    
    try {
      const debtId = editingDebt._id || editingDebt.id;
      const res = await fetch(`/api/debts?id=${debtId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: editDebtPerson,
          amount: parseFloat(editDebtAmount),
          note: editDebtNote
        })
      });
      
      if (res.ok) {
        const updated = await res.json();
        setDebts(prev => prev.map(d => 
          (d._id || d.id) === debtId ? updated : d
        ));
        setEditingDebt(null);
        setEditDebtPerson("");
        setEditDebtAmount("");
        setEditDebtNote("");
        setShowManualEntry(false);
      }
    } catch (error) {
      console.error("Failed to update debt:", error);
    }
  };

   const saveSettings = async () => {
    try {
      // Save to DB only
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, monthlyBudget, defaultWallet, nickname, groqKeys, preventDelete, ocrProvider, language: lang, useSmartAI, aiModel })
      });
    } catch (error) {
      console.error("Failed to save settings");
    }
  };


  const deleteReminder = async (id) => {
    setReminders(prev => prev.filter(r => (r._id || r.id) !== id));
    try {
       await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' });
    } catch (error) {
       console.warn("Failed to delete reminder");
    }
  };

  const markReminderAsPaid = async (reminder) => {
    const id = reminder._id || reminder.id;
    // 1. Optimistic remove
    setReminders(prev => prev.filter(r => (r._id || r.id) !== id));
    
    // 2. Add as transaction
    await addTransaction(reminder.amount, "expense", reminder.description, reminder.category, reminder.wallet);
    
    // 3. Mark as paid in DB
    try {
      await fetch(`/api/reminders?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      });
    } catch (error) {
       console.warn("Failed to mark reminder as paid");
    }
  };

  const updateReminder = async (id, updatedData) => {
    try {
      const res = await fetch(`/api/reminders?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(prev => prev.map(r => (r._id || r.id) === id ? data : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditReminder = (reminder) => {
    setEditingReminder(reminder);
    setManualAmount(reminder.amount.toString());
    setManualDesc(reminder.description);
    setManualType('expense');
    setActiveWallet(reminder.wallet);
    // Format date to datetime-local format in Thai timezone (YYYY-MM-DDTHH:mm)
    const reminderDate = new Date(reminder.date);
    // Convert to Thai timezone (UTC+7)
    const thaiDate = new Date(reminderDate.getTime() + (7 * 60 * 60 * 1000));
    const localDate = thaiDate.toISOString().slice(0, 16);
    setManualReminderDate(localDate);
    setShowManualEntry(true);
  };

  const clearAppData = () => {
    setBalance({ bank: 0, cash: 0 });
    setTransactions([]);
    setDebts([]);
    
    // Also sync to DB
    fetch('/api/data', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        clearAll: true,
        balance: { bank: 0, cash: 0 } 
      })
    });
  };

  const testBrowserNotification = async () => {
    // 1. Diagnostic Alert (Tell user the state)
    const permission = Notification.permission;
    console.log("Current Notification Permission:", permission);

    if (permission === "denied") {
      alert(lang === 'th' 
        ? "⚠️ การแจ้งเตือนถูกปิดกั้น (Denied) อยู่ค่ะ\n\nวิธีแก้: คลิกรูปแม่กุญแจ 🔒 ที่แถบที่อยู่ด้านบน แล้วเปลี่ยน 'การแจ้งเตือน' เป็น 'อนุญาต' (Allow) นะคะ" 
        : "⚠️ Notifications are Denied.\n\nFix: Click the Lock icon 🔒 in the URL bar and set 'Notifications' to 'Allow'.");
      return;
    }

    if (permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
    }

    // 2. Show In-App Feedback
    setShowToast({
      show: true,
      title: lang === 'th' ? "เตรียมส่งการแจ้งเตือน... 🎀" : "Preparing Banner... 🎀",
      message: lang === 'th' ? "พับหน้าต่างนี้ลง แล้วรอดูบันเนอร์บนขวานะคะ (ใน 5 วินาที)" : "Minimize this or switch apps to see the banner! (In 5 seconds)",
      type: "info"
    });

    // 3. Trigger via Service Worker (Most reliable for PWAs/Mac)
    setTimeout(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("Nong Remi Reminder 🎀", {
          body: lang === 'th' ? "วู้ววว! การแจ้งเตือนทำงานได้แล้วค่ะ! 💸✨" : "Woohoo! Your notifications are now working! 💸✨",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "remi-final-test",
          vibrate: [100, 50, 100],
          requireInteraction: true // Keeps the notification on screen longer
        });
        console.log("Service Worker Notification Sent Successfully");
      } catch (err) {
        console.error("SW Notification Error:", err);
        // Fallback to legacy if SW fails
        new Notification("Nong Remi Reminder 🎀", {
          body: "Fallback: Notification Triggered!",
          icon: "/icon-192.png"
        });
      }
    }, 5000);
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

  const handleSavePresetTag = async () => {
    if (!newTagName.trim()) return;
    
    const newTag = { 
        name: newTagName.trim(), 
        color: newTagColor, 
        icon: newTagIcon 
    };

    const updatedTags = [...presetTags, newTag];

    // Provide immediate visual feedback and local backup
    setPresetTags(updatedTags);
    if (typeof window !== "undefined" && session?.user?.email) {
      localStorage.setItem(`preset_tags_${session.user.email.toLowerCase()}`, JSON.stringify(updatedTags));
    }
    setNewTagName("");
    setIsCreatingTag(false);
    
    try {
        console.log("Saving preset tags to DB:", updatedTags);
        const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetTags: updatedTags })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server responded with ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        console.log("Successfully saved tags, server returned:", data.presetTags);
        
        // Sync state with what server actually has (just in case of parallel updates)
        if (data.presetTags) {
            setPresetTags(data.presetTags);
        }
    } catch (err) {
        console.error("Failed to save preset tag:", err);
        // Revert UI state on failure
        setPresetTags(presetTags); 
        setShowToast({ 
            show: true, 
            title: lang === 'th' ? 'บันทึกไม่สำเร็จ' : 'Save Failed', 
            message: lang === 'th' ? 'เกิดข้อผิดพลาดในการบันทึกแท็ก กรุณาลองใหม่ค่ะ' : 'Could not save tag. Please try again.', 
            type: 'error' 
        });
    }
  };

  const handleDeletePresetTag = async (tagToDelete) => {
    const updatedTags = presetTags.filter(t => t.name !== tagToDelete.name);
    
    // Immediate UI feedback and local backup
    setPresetTags(updatedTags);
    if (typeof window !== "undefined" && session?.user?.email) {
      localStorage.setItem(`preset_tags_${session.user.email.toLowerCase()}`, JSON.stringify(updatedTags));
    }
    if (scanTag === tagToDelete.name) setScanTag("");
    
    try {
        console.log("Deleting tag, new set:", updatedTags);
        const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetTags: updatedTags })
        });
        
        if (!res.ok) throw new Error("Delete failed on server");
        
        const data = await res.json();
        if (data.presetTags) setPresetTags(data.presetTags);
    } catch (err) {
        console.error("Failed to delete preset tag:", err);
        // Revert on error
        setPresetTags(presetTags);
    }
  };

  const getIconComponent = (iconName, size=16, color="white") => {
      // Map string names to actual Lucide components
      const iconMap = {
          'Tag': Tag,
          'Briefcase': Briefcase,
          'Home': HomeIcon,
          'Users': Users,
          'Heart': Heart,
          'Star': Star,
          'Coffee': Coffee,
          'Utensils': Utensils,
          'ShoppingBag': ShoppingBag,
          'Car': Car
      };
      const Icon = iconMap[iconName] || Tag;
      return <Icon size={size} color={color} />;
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
    <div 
      className="app-container" 
      onClick={() => isDeleteMode && setIsDeleteMode(false)}
    >
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
          {/* Smart AI Toggle with Glow */}
          <motion.button
            ref={aiToggleRef}
            whileTap={{ scale: 0.9 }}
            animate={isAIToggleBlink ? {
              scale: [1, 1.1, 1, 1.1, 1],
              boxShadow: [
                "0 0 20px rgba(139, 92, 246, 0.8)",
                "0 0 40px rgba(139, 92, 246, 1)",
                "0 0 20px rgba(139, 92, 246, 0.8)",
                "0 0 40px rgba(139, 92, 246, 1)",
                "0 0 20px rgba(139, 92, 246, 0.8)"
              ]
            } : useSmartAI ? {
              boxShadow: [
                "0 0 0px rgba(139, 92, 246, 0)",
                "0 0 15px rgba(139, 92, 246, 0.6)",
                "0 0 0px rgba(139, 92, 246, 0)"
              ]
            } : {}}
            transition={isAIToggleBlink ? { duration: 1.5 } : { repeat: Infinity, duration: 2 }}
            onClick={() => setUseSmartAI(!useSmartAI)}
            style={{ 
              background: useSmartAI ? "linear-gradient(135deg, #8b5cf6, #d946ef)" : "rgba(255, 255, 255, 0.05)", 
              border: useSmartAI ? "none" : "1px solid var(--glass-border)", 
              color: "white", 
              padding: "8px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: 'relative'
            }}
            title={useSmartAI ? "Disable Smart AI" : "Enable Smart AI"}
          >
            <Sparkles size={20} fill={useSmartAI ? "white" : "none"} style={{ opacity: useSmartAI ? 1 : 0.6 }} />
            {useSmartAI && (
              <motion.div 
                layoutId="ai-glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ 
                  position: 'absolute', 
                  inset: '-2px', 
                  borderRadius: '14px', 
                  border: '2px solid #8b5cf6',
                  filter: 'blur(4px)'
                }} 
              />
            )}
          </motion.button>

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
                   <X size={24} />
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

                {/* 5. Prevent Delete Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t.prevent_delete}
                  </label>
                  <div 
                    onClick={() => setPreventDelete(!preventDelete)}
                    style={{ 
                      width: '44px', 
                      height: '24px', 
                      background: preventDelete ? 'var(--primary)' : 'rgba(255,255,255,0.1)', 
                      borderRadius: '12px', 
                      position: 'relative', 
                      cursor: 'pointer',
                      transition: 'background 0.3s ease'
                    }}
                  >
                    <motion.div 
                      animate={{ x: preventDelete ? 22 : 2 }}
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        background: 'white', 
                        borderRadius: '10px', 
                        position: 'absolute', 
                        top: '2px'
                      }} 
                    />
                  </div>
                </div>

                {/* 6. Default Wallet */}
                {/* <div>
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
                </div> */}

                {/* 7. OCR Provider Selection */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "เครื่องมือสแกนภาพ (OCR)" : "OCR Provider"}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setOcrProvider('tesseract')} 
                      style={{ 
                        flex: 1, 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        background: ocrProvider === 'tesseract' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        fontSize: '13px',
                        fontWeight: 600 
                      }}
                    >
                      Tesseract
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {lang === 'th' ? 'ฟรี' : 'Free'}
                      </div>
                    </button>
                    <button 
                      onClick={() => setOcrProvider('google')} 
                      style={{ 
                        flex: 1, 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        background: ocrProvider === 'google' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        fontSize: '13px',
                        fontWeight: 600 
                      }}
                    >
                      Google Vision
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {lang === 'th' ? 'แม่นยำกว่า' : 'More Accurate'}
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* 7. AI Model Selection */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? "โมเดล AI" : "AI Model"}
                    <div style={{ fontSize: '0.75rem', marginTop: '2px', opacity: 0.7 }}>
                      {lang === 'th' ? "(เลือกแบบเก่าเพื่อประหยัด Token)" : "(Choose 8B for lower token usage)"}
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.6, color: '#fbbf24' }}>
                      {lang === 'th' ? "📸 สแกนใบเสร็จใช้ 70B ทุกครั้ง (แม่นยำสูง)" : "📸 Receipt scans always use 70B (best accuracy)"}
                    </div>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setAiModel('llama-3.3-70b-versatile')} 
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        background: aiModel === 'llama-3.3-70b-versatile' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      LLaMA 3.3-70B (Default)
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {lang === 'th' ? '🎯 ทำงานได้ดีเยี่ยม | Token: สูง' : '🎯 Best quality | Tokens: High'}
                      </div>
                    </button>
                    <button 
                      onClick={() => setAiModel('llama-3.1-8b-instant')} 
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        background: aiModel === 'llama-3.1-8b-instant' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      LLaMA 3.1-8B (Fast)
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {lang === 'th' ? '⚡ เร็ว | Token: น้อย (ประหยัด 60%)' : '⚡ Faster | Tokens: 60% lower'}
                      </div>
                    </button>
                    <button 
                      onClick={() => setAiModel('mixtral-8x7b-32768')} 
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        borderRadius: '12px', 
                        border: 'none', 
                        background: aiModel === 'mixtral-8x7b-32768' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                        color: 'white', 
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      Mixtral 8x7B (Balanced)
                      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                        {lang === 'th' ? '⚖️ สมดุล | Token: ปานกลาง' : '⚖️ Balanced | Tokens: Medium'}
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* 8. Auto-Billing Folder Link */}
            

                {!isAppInstalled && deferredPrompt && (
                  <button 
                    onClick={handleInstallClick}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      border: '2px solid var(--primary)', 
                      background: 'rgba(139, 92, 246, 0.1)', 
                      color: 'white', 
                      fontSize: '14px', 
                      fontWeight: 700, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={16} /> {t.install_app}
                  </button>
                )}

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
        {showLanguageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10680,
              background: 'rgba(7, 10, 19, 0.92)',
              backdropFilter: 'blur(18px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              style={{
                maxWidth: '420px',
                width: '100%',
                background: 'rgba(15, 23, 42, 0.98)',
                borderRadius: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '2rem',
                boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.6)'
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '0.5rem' }}>🌐</div>
              <h2 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1.4rem' }}>
                เลือกภาษา / Choose Language
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '13px' }}>
                เลือกภาษาก่อนเริ่มใช้งาน เพื่อให้การติดตั้งและ Tutorial แสดงถูกต้อง
              </p>

              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  onClick={() => {
                    setLang('th');
                    setAiLang('th');
                    setShowLanguageModal(false);
                    setLanguageReady(true);
                    // Trigger tutorial for fresh user
                    setPendingTutorialStart(true);
                    // Save to database
                    if (session?.user?.email) {
                      fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ language: 'th', onboardingCompleted: true })
                      }).catch(err => console.error('Failed to save onboarding to DB:', err));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ภาษาไทย
                </button>
                <button
                  onClick={() => {
                    setLang('en');
                    setAiLang('en');
                    setShowLanguageModal(false);
                    setLanguageReady(true);
                    // Trigger tutorial for fresh user
                    setPendingTutorialStart(true);
                    // Save to database
                    if (session?.user?.email) {
                      fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ language: 'en', onboardingCompleted: true })
                      }).catch(err => console.error('Failed to save onboarding to DB:', err));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  English
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallModal && !isAppInstalled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10500,
              background: 'rgba(7, 10, 19, 0.98)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ maxWidth: '400px' }}
            >
              <div style={{ 
                width: '120px', 
                height: '120px', 
                margin: '0 auto 2rem',
                position: 'relative' 
              }}>
                <motion.div 
                   animate={{ scale: [1, 1.1, 1] }} 
                   transition={{ repeat: Infinity, duration: 2 }}
                   style={{ 
                     background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', 
                     borderRadius: '32px', 
                     width: '100%', 
                     height: '100%',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     boxShadow: '0 20px 40px rgba(139, 92, 246, 0.4)'
                   }}
                >
                  <img src="/icon-192.png" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '18px' }} />
                </motion.div>
                <div style={{ position: 'absolute', top: -10, right: -10, background: '#ef4444', color: 'white', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 800 }}>
                  NEW
                </div>
              </div>

              <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'white', marginBottom: '1rem', letterSpacing: '-1px' }}>
                {lang === 'th' ? "ติดตั้ง RemiderMe" : "Install RemiderMe"}
              </h1>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '2.5rem' }}>
                {lang === 'th' 
                  ? "ติดตั้งเพื่อรับการแจ้งเตือนค่าไฟและค่าน้ำแบบทันทีบนหน้าจอ และใช้งานแอปได้รวดเร็วขึ้นถึง 2 เท่า! 🎀✨" 
                  : "Install to get instant bill reminders on your screen and use the app 2x faster! 🎀✨"}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button 
                  onClick={() => {
                    handleInstallClick();
                    setShowInstallModal(false);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '1.25rem', 
                    borderRadius: '20px', 
                    border: 'none', 
                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', 
                    color: 'white', 
                    fontSize: '16px', 
                    fontWeight: 800, 
                    cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(139, 92, 246, 0.5)'
                  }}
                >
                  {lang === 'th' ? "ติดตั้งเลยตอนนี้ 🚀" : "Install Now 🚀"}
                </button>
                <button 
                  onClick={() => {
                    setShowInstallModal(false);
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer' }}
                >
                  {lang === 'th' ? "ไว้ทีหลัง" : "Maybe Later"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%", scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              zIndex: 9999,
              width: '90%',
              maxWidth: '400px'
            }}
          >
            <div className="glass-card" style={{ 
              padding: '1.25rem', 
              border: `2px solid ${showToast.color || '#8b5cf6'}`, 
              background: 'rgba(15, 23, 42, 0.95)',
              boxShadow: `0 10px 25px -5px ${showToast.color ? showToast.color + '80' : 'rgba(139, 92, 246, 0.5)'}`,
              display: 'flex',
              gap: '15px',
              position: 'relative',
              borderRadius: '24px'
            }}>
              <div style={{ 
                background: showToast.color || 'linear-gradient(135deg, #8b5cf6, #d946ef)', 
                width: '45px', 
                height: '45px', 
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 10px ${showToast.color ? showToast.color + '60' : 'rgba(139, 92, 246, 0.4)'}`,
                flexShrink: 0,
                overflow: 'hidden'
              }}>
                {showToast.icon ? (
                  typeof showToast.icon === 'string' ? (
                    <img src={showToast.icon} alt="" style={{ width: '85%', height: '85%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                  ) : (
                    React.cloneElement(showToast.icon, { color: 'white', size: 24 })
                  )
                ) : (
                  <Bell color="white" size={24} className="animate-bounce" />
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: 'white', fontSize: '15px', marginBottom: '2px' }}>{showToast.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', whiteSpace: 'pre-line' }}>{showToast.message}</div>
              </div>
              <button 
                onClick={() => setShowToast({ ...showToast, show: false })}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', alignSelf: 'flex-start' }}
              >
                <X size={18} />
              </button>
              {/* Timeout Progress Bar */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{ duration: 6, ease: "linear" }}
                onAnimationComplete={() => setShowToast({ ...showToast, show: false })}
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  height: '3px', 
                  background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                  borderRadius: '0 0 12px 12px'
                }} 
              />
            </div>
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

      {/* Onboarding Tutorial Banner - Shows only when not in spotlight mode */}
      <AnimatePresence>
        {showOnboarding && !tutorialStep && !onboardingTasks.completed && getNextOnboardingTask() && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(217, 70, 239, 0.15))',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '16px',
              padding: '1rem 1.25rem',
              marginBottom: '1rem',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowOnboarding(false)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              ✕
            </button>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
              {['voice', 'scan', 'manual'].map((task) => (
                <div
                  key={task}
                  style={{
                    width: onboardingTasks[task] ? '20px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: onboardingTasks[task] ? '#22c55e' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s'
                  }}
                />
              ))}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                {['voice', 'scan', 'manual'].filter(t => onboardingTasks[t]).length}/3 {lang === 'th' ? 'เสร็จแล้ว' : 'completed'}
              </span>
            </div>

            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
              🎓 {lang === 'th' ? 'Tutorial: เรียนรู้การใช้งาน' : 'Tutorial: Learn How to Use'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {lang === 'th' 
                ? 'มี 3 ขั้นตอนง่ายๆ ให้ลองทำตาม เพื่อเรียนรู้การใช้งานแอป' 
                : '3 simple steps to learn how to use the app'}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  advanceToNextTutorialStep();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                }}
              >
                {lang === 'th' ? '🚀 เริ่มเลย!' : '🚀 Start Now!'}
              </motion.button>
              
              <button
                onClick={() => {
                  const all = { voice: true, scan: true, manual: true, completed: true };
                  setOnboardingTasks(all);
                  setShowOnboarding(false);
                  setTutorialStep(null);
                  // Save to DB
                  if (session?.user?.email) {
                    fetch('/api/data', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tutorialCompleted: true, onboardingTasks: all })
                    }).catch(err => console.error('Failed to save skip tutorial to DB:', err));
                  }
                }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {lang === 'th' ? 'ข้าม' : 'Skip'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className="glass-card" style={{ padding: '1.5rem', background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))" }}>
        {/* Main Balance Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{t.total_balance}</span>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '6px 12px', 
                fontSize: '11px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 500,
                backdropFilter: 'blur(4px)'
              }}
            >
              <Download size={13} /> {t.export}
            </motion.button>
          </div>
          <div className="balance-amount" style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>
            ฿{(balance.bank + balance.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>

          {/* Today's Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.1)', 
              padding: '1rem', 
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'th' ? 'ยอดต้นวัน' : 'Started With'}
                </span>
              </div>
              <div style={{ fontSize: '1.3rem', color: '#10b981', fontWeight: 800 }}>
                ฿{(() => {
                  const todayExpense = transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((sum, t) => sum + t.amount, 0);
                  const todayIncome = transactions.filter(t => t.type === 'income' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((sum, t) => sum + t.amount, 0);
                  const startingBalance = (balance.bank + balance.cash) + todayExpense - todayIncome;
                  return startingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });
                })()}
              </div>
            </div>

            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              padding: '1rem', 
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'th' ? 'ใช้ไปแล้ว' : 'Spent'}
                </span>
              </div>
              <div style={{ fontSize: '1.3rem', color: '#ef4444', fontWeight: 800 }}>
                ฿{transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Wallet Selection */}
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {lang === 'th' ? '💳 เลือกบัญชีหลัก (Primary)' : '💳 Select Primary Account'}
          </span>
        </div>
        {/* Bank Accounts Section - Horizontal Scroll */}
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '4px', paddingRight: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <CreditCard size={14} style={{ color: '#94a3b8' }} />
                   <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>{t.bank}</span>
                </div>
                <motion.button
                   whileTap={{ scale: 0.9 }}
                   onClick={() => {
                         setEditingAccount(null);
                         setNewAccountName("");
                         setNewAccountBalance("");
                         setShowAddAccountModal(true);
                    }}
                    style={{
                       background: 'rgba(59, 130, 246, 0.15)',
                       border: '1px solid rgba(59, 130, 246, 0.3)',
                       borderRadius: '50%',
                       width: '28px',
                       height: '28px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       cursor: 'pointer',
                       color: '#60a5fa'
                    }}
                 >
                     <Plus size={16} />
                 </motion.button>
             </div>
             
             <div 
               ref={bankScrollRef}
               style={{ 
                display: 'flex', 
                gap: '12px', 
                overflowX: 'auto', 
                paddingBottom: '22px', // Space for shadows and larger active card
                paddingTop: '30px', // Space for top glow
                paddingLeft: '45px',
                paddingRight: '45px',
                marginLeft: '-25px',
                marginRight: '-25px',
                width: 'calc(100% + 50px)',
                msOverflowStyle: 'none',  // IE and Edge
                scrollbarWidth: 'none',  // Firefox
             }} className="no-scrollbar">
                <style jsx>{`
                  .no-scrollbar::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>

                <Reorder.Group 
                   axis="x" 
                   values={accounts.filter(a => a.type === 'bank')} 
                   onReorder={handleReorderAccounts}
                   style={{ display: 'flex', gap: '16px', alignItems: 'center' }}
                >
                {accounts.filter(a => a.type === 'bank').map(acc => {
                   const commonProps = {
                      key: acc.id,
                      style: {
                        minWidth: activeBankAccountId === acc.id ? '240px' : '200px',
                        background: acc.color,
                        padding: activeBankAccountId === acc.id ? '1.5rem' : '1.1rem',
                        borderRadius: '24px',
                        position: 'relative',
                        boxShadow: activeWallet === 'bank' && activeBankAccountId === acc.id 
                          ? 'none' // Handled by animate
                          : '0 4px 15px rgba(0,0,0,0.2)',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: activeBankAccountId === acc.id ? '145px' : '110px',
                        border: activeWallet === 'bank' && activeBankAccountId === acc.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'grab',
                        // REMOVED 'transition: all' to prevent conflict with Framer Motion
                        touchAction: 'pan-x',
                        userSelect: 'none'
                      },
                      whileTap: { scale: 0.98 },
                      animate: { 
                        scale: activeBankAccountId === acc.id ? 1 : 0.9,
                        opacity: activeBankAccountId === acc.id ? 1 : 0.7,
                        rotate: isDeleteMode ? [-1, 1.5, -1.5, 1, -1] : 0, 
                        boxShadow: activeWallet === 'bank' && activeBankAccountId === acc.id 
                          ? [`0 0 0 2px rgba(255,255,255,1), 0 10px 30px ${acc.color}50`, `0 0 0 2px rgba(255,255,255,1), 0 10px 50px ${acc.color}80`]
                          : "0 4px 15px rgba(0,0,0,0.2)"
                      },
                      transition: {
                        rotate: { duration: 0.3, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                        boxShadow: { duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
                        default: { type: "spring", stiffness: 300, damping: 20 }
                      },
                      onPointerDown: () => {
                          const timer = setTimeout(() => {
                              setIsDeleteMode(true);
                              if (navigator.vibrate) navigator.vibrate(50);
                          }, 600);
                          setLongPressTimer(timer);
                      },
                      onPointerUp: () => {
                          if (longPressTimer) clearTimeout(longPressTimer);
                      },
                      onPointerLeave: () => {
                          if (longPressTimer) clearTimeout(longPressTimer);
                      },
                      onClick: () => {
                          if (isDeleteMode) return; // Prevent selection if in delete mode

                          setActiveWallet('bank');
                          setDefaultWallet('bank');
                          setActiveBankAccountId(acc.id);
                          
                          // Auto rearrange: move selected to first
                          const bankAccounts = accounts.filter(a => a.type === 'bank');
                          const otherAccounts = accounts.filter(a => a.type !== 'bank');
                          const filtered = bankAccounts.filter(a => a.id !== acc.id);
                          const updatedAccounts = [acc, ...filtered, ...otherAccounts];
                          setAccounts(updatedAccounts);

                          // Navigate back to main (start of scroll)
                          if (bankScrollRef.current) {
                            // Use 'auto' (instant) instead of 'smooth' to avoid fighting with DOM reorder
                            bankScrollRef.current.scrollTo({ left: 0, behavior: 'auto' });
                          }

                          fetch('/api/data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              activeBankAccountId: acc.id, 
                              defaultWallet: 'bank',
                              accounts: updatedAccounts 
                            })
                          });

                          const bMeta = acc.bankCode && BANK_DATA[acc.bankCode.toLowerCase()];
                          setShowToast({
                            show: true,
                            title: lang === 'th' ? "เปลี่ยนบัญชีแล้ว" : "Account Changed",
                            message: lang === 'th' ? `เลือกเป็น ${acc.name} และเลื่อนเป็นลำดับแรกแล้วค่ะ` : `Selected ${acc.name} and moved to first`,
                            type: "success",
                            icon: bMeta?.logo,
                            color: acc.color
                          });
                      }
                   };

                   const content = (
                       <>
                       {/* Delete Badge w/ Animation */}
                       <AnimatePresence>
                        {isDeleteMode && (
                            <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                        show: true,
                                        title: lang === 'th' ? `ลบบัญชี ${acc.name}?` : `Delete ${acc.name}?`,
                                        onConfirm: () => {
                                            const updated = accounts.filter(a => a.id !== acc.id);
                                            setAccounts(updated);
                                            fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: updated }) });
                                            if (updated.length > 0 && activeBankAccountId === acc.id) setActiveBankAccountId(updated.find(a => a.type === 'bank')?.id);
                                        }
                                    });
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    left: '-8px',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                    border: '2px solid white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    zIndex: 20,
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={16} strokeWidth={3} />
                            </motion.button>
                        )}
                       </AnimatePresence>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ 
                            fontSize: activeBankAccountId === acc.id ? '1rem' : '0.85rem', 
                            fontWeight: 700, 
                            opacity: activeBankAccountId === acc.id ? 1 : 0.8 
                          }}>
                            {acc.name}
                          </span>
                            {(() => {
                               // 1. Try direct lookup by bankCode
                               let bankMeta = acc.bankCode && BANK_DATA[acc.bankCode.toLowerCase()];
                               
                               // 2. Fallback: Detect from name if bankCode is 'other' or missing
                               if ((!bankMeta || acc.bankCode === 'other') && acc.name) {
                                  const detected = detectBank(acc.name);
                                  if (detected.code !== 'other') {
                                    bankMeta = detected;
                                  }
                               }

                               const size = activeBankAccountId === acc.id ? '32px' : '26px';
                               
                               if (bankMeta?.logo) {
                                 return (
                                   <div style={{
                                     width: size, height: size, borderRadius: '50%',
                                     background: 'white', padding: '4px', display: 'flex',
                                     alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                     boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                   }}>
                                     <img src={bankMeta.logo} alt={acc.bankCode} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                   </div>
                                 );
                               }

                               return (
                                 <div style={{
                                     width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                                     display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                     fontWeight: 'bold', fontSize: activeBankAccountId === acc.id ? '10px' : '8px',
                                     textTransform: 'uppercase'
                                 }}>
                                     {acc.bankCode === 'other' ? 'BK' : acc.bankCode}
                                 </div>
                               );
                            })()}
                       </div>
                       
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                           <div style={{ 
                             fontSize: activeBankAccountId === acc.id ? '1.8rem' : '1.4rem', 
                             fontWeight: 800,
                             letterSpacing: '-0.5px'
                           }}>
                               ฿{acc.balance.toLocaleString()}
                              {(() => {
                                const todaySpent = (transactions || [])
                                  .filter(t => t.type === 'expense' && String(t.accountId) === String(acc.id) && new Date(t.date).toDateString() === new Date().toDateString())
                                  .reduce((sum, t) => sum + t.amount, 0);
                                if (todaySpent > 0) {
                                  return (
                                    <div style={{ fontSize: '10px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', background: 'rgba(0,0,0,0.15)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ff4444' }}></div>
                                      {lang === 'th' ? `วันนี้ใช้ไป: ฿${todaySpent.toLocaleString()}` : `Spent today: ฿${todaySpent.toLocaleString()}`}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                           </div>
                           <div 
                             onClick={(e) => {
                                e.stopPropagation();
                                setEditingAccount(acc);
                                setNewAccountName(acc.name);
                                setNewAccountBalance(acc.balance);
                                setShowAddAccountModal(true);
                             }}
                             style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                          >
                             <Edit3 size={14} color="white" />
                          </div>
                       </div>
                       
                        {activeWallet === 'bank' && activeBankAccountId === acc.id && !isDeleteMode && (
                          <motion.div
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                            style={{ 
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              fontSize: '10px',
                              padding: '6px 12px',
                              background: `linear-gradient(135deg, ${acc.color} 0%, white 200%)`,
                              color: 'white',
                              borderBottomLeftRadius: '24px',
                              borderTopRightRadius: '24px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              boxShadow: `0 4px 15px ${acc.color}60`,
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                          }}>
                            <Sparkles size={10} fill="white" />
                            {lang === 'th' ? 'บัญชีหลัก' : 'PRIMARY'}
                          </motion.div>
                        )}
                       </>
                   );

                   // Extract key from commonProps
                   const { key: itemKey, ...propsWithoutKey } = commonProps;

                   if (isMobile) {
                      return (
                        <motion.div key={itemKey} {...propsWithoutKey}>
                           {content}
                        </motion.div>
                      );
                   }

                   return (
                      <Reorder.Item value={acc} drag={isDeleteMode ? false : true} key={itemKey} {...propsWithoutKey}>
                         {content}
                      </Reorder.Item>
                   );
                })}
                </Reorder.Group>
                
                {/* Add Bank Button Card */}

             </div>

            {/* Cash Card - Full Width */}
            <motion.div 
                whileTap={{ scale: 0.98 }}
                animate={{
                  borderColor: activeWallet === 'cash' ? '#10b981' : 'rgba(255,255,255,0.08)',
                  boxShadow: activeWallet === 'cash' 
                    ? ["0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 0 0 1px #10b981", "0 10px 40px -5px rgba(16, 185, 129, 0.7), 0 0 0 1px #10b981"]
                    : "0 0 0 0 rgba(0,0,0,0)"
                }}
                transition={{
                  boxShadow: { duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
                }}
                onClick={() => {
                  setActiveWallet('cash');
                  setDefaultWallet('cash');
                  fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ defaultWallet: 'cash' })
                  });
                   setShowToast({
                    show: true,
                    title: lang === 'th' ? 'เปลี่ยนบัญชีหลัก' : 'Primary Changed',
                    message: lang === 'th' ? '💵 ตั้งเงินสดเป็นบัญชีหลักแล้ว' : '💵 Cash set as primary',
                    type: 'success',
                    icon: <Banknote />,
                    color: '#10b981'
                  });
                }}
                style={{ 
                  background: activeWallet === 'cash' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)', 
                  padding: '1.25rem', 
                  borderRadius: '20px', 
                  border: `2px solid ${activeWallet === 'cash' ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                 {activeWallet === 'cash' && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    style={{ 
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      fontSize: '10px',
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                      color: 'white',
                      borderBottomLeftRadius: '24px',
                      borderTopRightRadius: '24px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                  }}>
                    <Sparkles size={10} fill="white" />
                    {lang === 'th' ? 'บัญชีหลัก' : 'PRIMARY'}
                  </motion.div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                     <Banknote size={20} style={{ color: '#10b981' }} />
                  </div>
                  <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>{t.cash}</div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Available</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>
                  ฿{balance.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </motion.div>
          </div>
        
        {/* Budget Progress */}
        <div style={{ 
          background: 'rgba(139, 92, 246, 0.1)', 
          padding: '1rem', 
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'th' ? "งบประมาณวันนี้" : "Today's Budget"}
              </span>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {Math.min(100, Math.round((transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) / budget) * 100))}% {lang === 'th' ? 'ใช้ไปแล้ว' : 'used'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) > budget ? '#ef4444' : '#a78bfa' }}>
                ฿{transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                / ฿{budget.toLocaleString()}
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${Math.min(100, (transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) / budget) * 100)}%` }} 
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ 
                height: '100%', 
                background: transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) > budget 
                  ? 'linear-gradient(to right, #ef4444, #dc2626)' 
                  : 'linear-gradient(to right, #8b5cf6, #a78bfa)',
                boxShadow: transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0) > budget 
                  ? '0 0 10px rgba(239, 68, 68, 0.5)' 
                  : '0 0 10px rgba(139, 92, 246, 0.5)'
              }} 
            />
          </div>
        </div>
      </motion.div>

      {/* Tabs for switching between Transactions and Debts */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', marginBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('transactions')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            borderRadius: '16px', 
            border: 'none', 
            background: activeTab === 'transactions' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
            color: 'white', 
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <History size={16} /> {lang === 'th' ? "รายการ" : "Transactions"}
        </button>
        <button 
          onClick={() => setActiveTab('debts')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            borderRadius: '16px', 
            border: 'none', 
            background: activeTab === 'debts' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
            color: 'white', 
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ArrowRightLeft size={16} /> {t.debts}
        </button>
        <button 
          onClick={() => setActiveTab('reminders')}
          style={{ 
            flex: 1, 
            padding: '10px', 
            borderRadius: '16px', 
            border: 'none', 
            background: activeTab === 'reminders' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
            color: 'white', 
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Bell size={16} /> {t.reminders}
          {reminders.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length > 0 && (
             <span style={{ 
               width: '8px', 
               height: '8px', 
               background: '#ef4444', 
               borderRadius: '50%', 
               marginLeft: '-4px' 
             }}></span>
          )}
        </button>
      </div>

      <div className="transaction-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {activeTab === 'transactions' ? <Calendar size={16} /> : (activeTab === 'debts' ? <ArrowRightLeft size={16} /> : <Bell size={16} />)}
            <span className="text-sm">
              {activeTab === 'transactions' ? (lang === 'th' ? "รายการล่าสุด" : "Recent") : (activeTab === 'debts' ? t.debts : t.reminders)}
            </span>
          </div>
          {activeTab === 'transactions' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  if (filteredAccountId || filteredTimeRange !== "all") {
                    setFilteredAccountId(null);
                    setFilteredTimeRange("all");
                  } else {
                    // Just show the UI by setting a default non-null state if needed, 
                    // or just set a range. Let's set 'all' but we'll need to adjust 
                    // the conditional rendering to show if explicitly requested.
                    // Actually, let's just toggle '1d' to make it show up.
                    setFilteredTimeRange("1d");
                  }
                }} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: (filteredAccountId || filteredTimeRange !== "all") 
                    ? (filteredAccountId ? (accounts.find(a => a.id === filteredAccountId)?.color || '#3b82f6') : (filteredWalletType === 'cash' ? '#10b981' : '#3b82f6')) 
                    : 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '5px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Filter size={18} /> 
                <span className="text-sm">{lang === 'th' ? "กรอง" : "Filter"}</span>
              </button>
              <button onClick={() => setShowSummary(!showSummary)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <BarChart3 size={18} /> <span className="text-sm">{lang === 'th' ? "ดูรายงาน" : "View Report"}</span>
              </button>
              <button 
                ref={manualButtonRef}
                onClick={() => {
                  setManualEntryMode('transaction');
                  setEditingTransaction(null);
                  setManualAmount("");
                  setManualDesc("");
                  setActiveWallet(defaultWallet);
                  setShowManualEntry(true);
                }} 
                style={{ 
                  background: tutorialStep === 'manual' ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.05)", 
                  border: tutorialStep === 'manual' ? "2px solid #a855f7" : "1px solid var(--glass-border)", 
                  color: "white", 
                  padding: "6px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  zIndex: (tutorialStep === 'manual' || showOnboarding) ? 111000 : 'auto',
                  position: 'relative',
                  pointerEvents: 'auto',
                  boxShadow: tutorialStep === 'manual' ? '0 0 20px rgba(168, 85, 247, 0.5)' : 'none'
                }}
              >
                <Edit3 size={14} /> {t.add_manual}
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'transactions' ? (
            <motion.div key="list-transactions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
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
                    {useSmartAI && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          padding: '1.25rem', 
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))', 
                          borderRadius: '16px', 
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          marginBottom: '1.5rem',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Decorative background pattern */}
                        <div style={{ 
                          position: 'absolute', 
                          top: 0, 
                          right: 0, 
                          width: '120px', 
                          height: '120px',
                          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
                          pointerEvents: 'none'
                        }}></div>
                        
                        <div style={{ position: 'relative', zIndex: 1 }}>
                          {/* Header Section - Compact */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', 
                                padding: '8px', 
                                borderRadius: '10px',
                                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                              }}>
                                <Sparkles size={16} color="white" />
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <h3 style={{ 
                                    fontSize: '13px', 
                                    fontWeight: 700, 
                                    background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    margin: 0
                                  }}>
                                    Nong Remi AI
                                  </h3>
                                  <div style={{
                                    fontSize: '8px',
                                    padding: '2px 6px',
                                    background: 'rgba(139, 92, 246, 0.2)',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    borderRadius: '4px',
                                    color: '#a78bfa',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px'
                                  }}>
                                    AI
                                  </div>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateAIInsight(); }} 
                              disabled={isAnalyzing}
                              style={{ 
                                background: isAnalyzing ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.2)', 
                                border: '1px solid rgba(139, 92, 246, 0.3)', 
                                color: '#a78bfa', 
                                fontSize: '10px', 
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: isAnalyzing ? 'wait' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                flexShrink: 0
                              }}
                            >
                              {isAnalyzing ? <Loader2 size={11} className="animate-spin" /> : <TrendingUp size={11} />}
                              {isAnalyzing ? (lang === 'th' ? 'วิเคราะห์' : 'Analyzing') : (lang === 'th' ? 'รีเฟรช' : 'Refresh')}
                            </button>
                          </div>

                          {/* Content Section */}
                          <div style={{ 
                            background: 'rgba(15, 23, 42, 0.6)', 
                            padding: '0',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            overflow: 'hidden'
                          }}>
                            {isAnalyzing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem' }}>
                                <Loader2 size={16} className="animate-spin" style={{ color: '#8b5cf6' }} />
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                                  {lang === 'th' ? 'กำลังประมวลผลข้อมูลการเงินของคุณ...' : 'Analyzing your financial data...'}
                                </p>
                              </div>
                            ) : (
                              <div>
                                {(aiInsight || getAIInsight()).split('\n').filter(line => line.trim()).map((line, idx) => {
                                  // Extract emoji from start of line
                                  const emojiMatch = line.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+)/u);
                                  const emoji = emojiMatch ? emojiMatch[0] : '';
                                  const textWithoutEmoji = emoji ? line.substring(emoji.length).trim() : line.trim();
                                  
                                  // Highlight numbers/amounts (฿ followed by numbers)
                                  const parts = textWithoutEmoji.split(/(฿[\d,.-]+)/g);
                                  
                                  // Determine background color based on emoji or content
                                  let bgColor = 'rgba(255, 255, 255, 0.02)';
                                  let borderColor = 'rgba(255, 255, 255, 0.05)';
                                  let accentColor = '#a78bfa';
                                  
                                  if (emoji.includes('⚠️') || emoji.includes('🔴') || textWithoutEmoji.includes('เกิน') || textWithoutEmoji.includes('exceed')) {
                                    bgColor = 'rgba(239, 68, 68, 0.08)';
                                    borderColor = 'rgba(239, 68, 68, 0.2)';
                                    accentColor = '#ef4444';
                                  } else if (emoji.includes('✨') || emoji.includes('💡') || emoji.includes('👍')) {
                                    bgColor = 'rgba(16, 185, 129, 0.08)';
                                    borderColor = 'rgba(16, 185, 129, 0.2)';
                                    accentColor = '#10b981';
                                  } else if (emoji.includes('💰') || emoji.includes('📊') || emoji.includes('📈')) {
                                    bgColor = 'rgba(59, 130, 246, 0.08)';
                                    borderColor = 'rgba(59, 130, 246, 0.2)';
                                    accentColor = '#3b82f6';
                                  }
                                  
                                  return (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        padding: '12px 14px',
                                        background: bgColor,
                                        borderLeft: `3px solid ${accentColor}`,
                                        borderBottom: idx < (aiInsight || getAIInsight()).split('\n').filter(l => l.trim()).length - 1 ? `1px solid ${borderColor}` : 'none',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        transition: 'background 0.2s ease'
                                      }}
                                    >
                                      {emoji && (
                                        <span style={{ 
                                          fontSize: '18px', 
                                          minWidth: '24px',
                                          display: 'inline-block',
                                          flexShrink: 0
                                        }}>
                                          {emoji}
                                        </span>
                                      )}
                                      <span style={{ 
                                        flex: 1,
                                        fontSize: '13px',
                                        lineHeight: '1.6',
                                        color: 'var(--text-main)',
                                        fontWeight: 400
                                      }}>
                                        {parts.map((part, i) => {
                                          if (part.match(/^฿[\d,.-]+$/)) {
                                            return (
                                              <span 
                                                key={i} 
                                                style={{ 
                                                  color: accentColor,
                                                  fontWeight: 700,
                                                  fontSize: '14px',
                                                  background: `${accentColor}15`,
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  margin: '0 2px'
                                                }}
                                              >
                                                {part}
                                              </span>
                                            );
                                          }
                                          return <span key={i}>{part}</span>;
                                        })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{lang === 'th' ? 'รวมทั้งหมด' : 'Total'}</span>
                          <span className="text-sm" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            ฿{transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === new Date().toDateString()).reduce((acc, t) => acc + t.amount, 0).toLocaleString()}
                          </span>
                        </div>
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

        <div id="transaction-list-top" />
        
        <div id="transaction-list-top" />
        
        {(filteredAccountId || filteredWalletType || filteredTimeRange !== "all") && (
          <FilterPanel
            filteredAccountId={filteredAccountId}
            setFilteredAccountId={setFilteredAccountId}
            filteredWalletType={filteredWalletType}
            setFilteredWalletType={setFilteredWalletType}
            filteredTimeRange={filteredTimeRange}
            setFilteredTimeRange={setFilteredTimeRange}
            filteredCustomRange={filteredCustomRange}
            setFilteredCustomRange={setFilteredCustomRange}
            accounts={accounts}
            transactions={transactions}
            lang={lang}
            t={t}
            showBankReport={showBankReport}
            setShowBankReport={setShowBankReport}
            presetTags={presetTags}
            filterTag={txnFilterTag}
            setFilterTag={setTxnFilterTag}
            getIconComponent={getIconComponent}
          />
        )}

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>{t.no_transactions}</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {transactions
              .filter(t => {
                const matchesAccount = !filteredAccountId || String(t.accountId) === String(filteredAccountId);
                if (!matchesAccount) return false;

                const matchesTag = !txnFilterTag || t.category === txnFilterTag;
                if (!matchesTag) return false;
                
                if (filteredTimeRange === "all") return true;
                const now = new Date();
                const txnDate = new Date(t.date);
                const diffTime = Math.max(0, now - txnDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                
                if (filteredTimeRange === "1d") return diffDays <= 1;
                if (filteredTimeRange === "2d") return diffDays <= 2;
                if (filteredTimeRange === "7d") return diffDays <= 7;
                if (filteredTimeRange === "1m") return diffDays <= 30;
                
                if (filteredTimeRange === "custom") {
                  if (!filteredCustomRange.start && !filteredCustomRange.end) return true;
                  const start = filteredCustomRange.start ? new Date(filteredCustomRange.start) : new Date(0);
                  const end = filteredCustomRange.end ? new Date(filteredCustomRange.end) : new Date();
                  start.setHours(0, 0, 0, 0);
                  end.setHours(23, 59, 59, 999);
                  return txnDate >= start && txnDate <= end;
                }
                return true;
              })
              .slice(0, visibleCount).map((txn) => {
                const isHighlighted = highlightedTxnId === (txn._id || txn.id);
                return (
                  <TransactionItem
                    key={txn._id || txn.id}
                    txn={txn}
                    isHighlighted={isHighlighted}
                    expandedTransactionId={expandedTransactionId}
                    setExpandedTransactionId={setExpandedTransactionId}
                    lang={lang}
                    t={t}
                    isMobile={isMobile}
                    accounts={accounts}
                    onEdit={openEdit}
                    onDelete={deleteTransaction}
                    onViewImage={(url) => {
                      setSelectedImage(url);
                      setShowImageModal(true);
                    }}
                  />
                );
              })}
          </AnimatePresence>
        )}

        {transactions.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button 
              onClick={() => setVisibleCount(prev => prev + 10)}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid var(--glass-border)', 
                color: 'white', 
                padding: '8px 24px', 
                borderRadius: '12px', 
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {lang === 'th' ? "ดูเพิ่มเติม" : "Show More"}
            </button>
          </div>
        )}
      </motion.div>
    ) : activeTab === 'debts' ? (
    <motion.div key="list-debts" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
      {(() => {
        const totalLend = debts.filter(d => d.type === 'lend' && d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0);
        const totalBorrow = debts.filter(d => d.type === 'borrow' && d.status !== 'paid').reduce((sum, d) => sum + d.amount, 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '4px', fontWeight: 600 }}>
                  {lang === 'th' ? 'คนอื่นค้างเรา' : 'Others Owe Me'}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>฿{totalLend.toLocaleString()}</div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>{debts.filter(d => d.type === 'lend' && d.status !== 'paid').length} {lang === 'th' ? 'รายการ' : 'items'}</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px', fontWeight: 600 }}>
                  {lang === 'th' ? 'เราค้างเขา' : 'I Owe Others'}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>฿{totalBorrow.toLocaleString()}</div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>{debts.filter(d => d.type === 'borrow' && d.status !== 'paid').length} {lang === 'th' ? 'รายการ' : 'items'}</div>
              </div>
            </div>

            <button 
              onClick={() => {
                setManualEntryMode('debt');
                setEditingDebt(null);
                setManualAmount("");
                setManualDesc("");
                setShowManualEntry(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px dashed var(--glass-border)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <PlusCircle size={18} color="var(--primary)" />
              {lang === 'th' ? 'เพิ่มรายการยืม/คืน' : 'Add Borrow/Lend'}
            </button>

            {debts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                     <Filter size={12} /> {lang === 'th' ? 'ตัวกรอง' : 'Filters'}
                   </div>
                   {(debtFilterTag || debtFilterTimeRange !== 'all') && (
                     <button 
                       onClick={() => { setDebtFilterTag(""); setDebtFilterTimeRange("all"); }}
                       style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                     >
                       {lang === 'th' ? 'ล้างทั้งหมด' : 'Clear All'}
                     </button>
                   )}
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {/* Time Range Filter */}
                   <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }} className="no-scrollbar">
                     {['all', 'today', '7d', '30d'].map(range => (
                       <button
                         key={range}
                         onClick={() => setDebtFilterTimeRange(range)}
                         style={{
                           flexShrink: 0,
                           padding: '6px 14px',
                           borderRadius: '12px',
                           fontSize: '11px',
                           fontWeight: 600,
                           border: '1px solid',
                           borderColor: debtFilterTimeRange === range ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                           background: debtFilterTimeRange === range ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                           color: debtFilterTimeRange === range ? 'white' : 'var(--text-muted)',
                         }}
                       >
                         {range === 'all' ? (lang === 'th' ? 'ทั้งหมด' : 'All') :
                          range === 'today' ? (lang === 'th' ? 'วันนี้' : 'Today') :
                          range === '7d' ? (lang === 'th' ? '7 วันที่แล้ว' : '7 Days') :
                          (lang === 'th' ? '30 วันที่แล้ว' : '30 Days')}
                       </button>
                     ))}
                   </div>

                   {/* Tag Filter */}
                   {presetTags.length > 0 && (
                     <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }} className="no-scrollbar">
                       {presetTags.map(tag => (
                         <button
                           key={tag.name}
                           onClick={() => setDebtFilterTag(debtFilterTag === tag.name ? "" : tag.name)}
                           style={{
                             flexShrink: 0,
                             padding: '6px 14px',
                             borderRadius: '20px',
                             fontSize: '11px',
                             fontWeight: 600,
                             border: '1px solid',
                             borderColor: debtFilterTag === tag.name ? tag.color : 'rgba(255,255,255,0.05)',
                             background: debtFilterTag === tag.name ? `${tag.color}40` : 'rgba(255,255,255,0.05)',
                             color: 'white',
                             display: 'flex',
                             alignItems: 'center',
                             gap: '6px',
                           }}
                         >
                           {getIconComponent(tag.icon, 12, debtFilterTag === tag.name ? 'white' : tag.color)}
                           {tag.name}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            )}

            {debts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)", background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
                <ArrowRightLeft size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>{t.no_debts}</p>
              </div>
            ) : (
              (() => {
                const filteredDebts = debts.filter(d => {
                  // Time filter
                  if (debtFilterTimeRange !== 'all') {
                    const now = new Date();
                    const dDate = new Date(d.date);
                    const diffTime = Math.max(0, now - dDate);
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    
                    if (debtFilterTimeRange === 'today') {
                      if (dDate.toDateString() !== now.toDateString()) return false;
                    } else if (debtFilterTimeRange === '7d') {
                      if (diffDays > 7) return false;
                    } else if (debtFilterTimeRange === '30d') {
                      if (diffDays > 30) return false;
                    }
                  }
                  
                  // Tag filter
                  if (debtFilterTag) {
                    const tagId = `[${debtFilterTag}]`;
                    if (!d.note || !d.note.includes(tagId)) return false;
                  }
                  
                  return true;
                });

                const activeLends = filteredDebts.filter(d => d.type === 'lend' && d.status !== 'paid');
                const activeBorrows = filteredDebts.filter(d => d.type === 'borrow' && d.status !== 'paid');
                const historyDebts = filteredDebts.filter(d => d.status === 'paid');

                if (filteredDebts.length === 0 && debts.length > 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)", background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
                      <Filter size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>{lang === 'th' ? 'ไม่พบรายการที่ตรงกับตัวกรองค่ะ' : 'No items match your filters.'}</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Active Lends (People owe me) */}
                    {activeLends.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ArrowUpCircle size={14} color="#10b981" /> {lang === 'th' ? 'คนอื่นติดเงินเรา' : 'Who Owes Me'}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeLends.map(debt => (
                            <DebtItem key={debt._id || debt.id} debt={debt} onToggle={() => toggleDebtStatus(debt._id || debt.id)} onDelete={() => deleteDebt(debt._id || debt.id)} onEdit={() => openEditDebt(debt)} lang={lang} t={t} presetTags={presetTags} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Borrows (I owe others) */}
                    {activeBorrows.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ArrowDownCircle size={14} color="#ef4444" /> {lang === 'th' ? 'เราติดเงินคนอื่น' : 'Who I Owe'}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeBorrows.map(debt => (
                            <DebtItem key={debt._id || debt.id} debt={debt} onToggle={() => toggleDebtStatus(debt._id || debt.id)} onDelete={() => deleteDebt(debt._id || debt.id)} onEdit={() => openEditDebt(debt)} lang={lang} t={t} presetTags={presetTags} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* History */}
                    {historyDebts.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.7 }}>
                          <History size={14} /> {lang === 'th' ? 'ประวัติ (เคลียร์แล้ว)' : 'History (Completed)'}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.6 }}>
                          {historyDebts.map(debt => (
                             <DebtItem 
                               key={debt._id || debt.id} 
                               debt={debt} 
                               lang={lang}
                               t={t}
                               presetTags={presetTags}
                               onToggle={() => toggleDebtStatus(debt._id || debt.id)}
                               onDelete={() => deleteDebt(debt._id || debt.id)}
                               onEdit={() => openEditDebt(debt)}
                             />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })())}
            </div>
          );
        })()}
    </motion.div>
    ) : (
      <motion.div key="list-reminders" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
        <button 
          onClick={() => {
            setManualEntryMode('reminder');
            setEditingReminder(null);
            setManualAmount("");
            setManualDesc("");
            setManualReminderDate("");
            setShowManualEntry(true);
          }}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px dashed var(--glass-border)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '1.25rem'
          }}
        >
          <BellPlus size={18} color="#3b82f6" />
          {lang === 'th' ? 'เพิ่มการแจ้งเตือน' : 'Add Reminder'}
        </button>
        {reminders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)", background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
             <Bell size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
             <p>{t.no_reminders}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reminders.map((reminder) => (
              <ReminderItem
                key={reminder._id || reminder.id}
                reminder={reminder}
                onMarkAsPaid={markReminderAsPaid}
                onEdit={openEditReminder}
                onDelete={deleteReminder}
                lang={lang}
                t={t}
              />
            ))}
          </div>
        )}
      </motion.div>
    )}
</AnimatePresence>
      </div>

      <div style={{ height: '100px' }}></div>

        <AnimatePresence>
            {showManualEntry && (
                <motion.div 
                  initial={{ y: '100%' }} 
                  animate={{ y: 0 }} 
                  exit={{ y: '100%' }} 
                  className="glass-card" 
                  style={{ 
                    position: 'fixed', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    zIndex: (showManualEntry || tutorialStep === 'manual') ? 130000 : 110, 
                    borderRadius: '32px 32px 0 0' 
                  }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>
                      {editingDebt ? (lang === 'th' ? 'แก้ไขการยืม/ให้ยืม' : 'Edit Borrow/Lend') : 
                       (editingTransaction ? (lang === 'th' ? 'แก้ไขรายการ' : 'Edit Transaction') : 
                       (editingReminder ? (lang === 'th' ? 'แก้ไขการแจ้งเตือน' : 'Edit Reminder') : (
                         manualEntryMode === 'transaction' ? t.add_manual :
                         (manualEntryMode === 'debt' ? (lang === 'th' ? 'เพิ่มรายการยืม/คืน' : 'Add Borrow/Lend') :
                         (lang === 'th' ? 'เพิ่มการแจ้งเตือน' : 'Add Reminder'))
                       )))}
                    </div>

                    {/* Mode Switcher - Only show when NOT editing */}
                    {!editingDebt && !editingTransaction && !editingReminder && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px' }}>
                        {[
                          { id: 'transaction', label: lang === 'th' ? 'รายรับ-จ่าย' : 'Transaction', icon: <ArrowUpCircle size={14} /> },
                          { id: 'debt', label: lang === 'th' ? 'ยืม-คืน' : 'Debt', icon: <ArrowRightLeft size={14} /> },
                          { id: 'reminder', label: lang === 'th' ? 'เตือน' : 'Reminder', icon: <Bell size={14} /> }
                        ].map(mode => (
                          <button
                            key={mode.id}
                            onClick={() => setManualEntryMode(mode.id)}
                            style={{
                              flex: 1,
                              padding: '8px 4px',
                              borderRadius: '10px',
                              border: 'none',
                              background: manualEntryMode === mode.id ? 'var(--primary)' : 'transparent',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {mode.icon}
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {editingDebt ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleSaveDebt(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input 
                          type="text" 
                          placeholder={lang === 'th' ? "ชื่อคน (เช่น ส้ม, แม่)" : "Person's name (e.g. Mom, Friend)"} 
                          value={editDebtPerson} 
                          onChange={e => setEditDebtPerson(e.target.value)} 
                          style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} 
                          required 
                        />
                        <input 
                          type="number" 
                          placeholder={lang === 'th' ? "จำนวนเงิน (บาท)" : "Amount (฿)"} 
                          value={editDebtAmount} 
                          onChange={e => setEditDebtAmount(e.target.value)} 
                          style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} 
                          required 
                        />
                        <input 
                          type="text" 
                          placeholder={lang === 'th' ? "บันทึก (ถ้ามี)" : "Note (optional)"} 
                          value={editDebtNote} 
                          onChange={e => setEditDebtNote(e.target.value)} 
                          style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} 
                        />
                        <button type="submit" className="btn-primary">{t.save}</button>
                        <button type="button" onClick={() => { setShowManualEntry(false); setEditingDebt(null); setEditDebtPerson(""); setEditDebtAmount(""); setEditDebtNote(""); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>{t.cancel}</button>
                      </form>
                    ) : (
                    <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {manualEntryMode === 'debt' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => setManualDebtType('lend')} className="btn-primary" style={{ flex: 1, background: manualDebtType === 'lend' ? '#10b981' : 'var(--glass)' }}>{lang === 'th' ? 'ให้ยืม' : 'Lend'}</button>
                            <button type="button" onClick={() => setManualDebtType('borrow')} className="btn-primary" style={{ flex: 1, background: manualDebtType === 'borrow' ? '#ef4444' : 'var(--glass)' }}>{lang === 'th' ? 'ยืม' : 'Borrow'}</button>
                          </div>
                        )}
                        {manualEntryMode === 'transaction' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button type="button" onClick={() => setManualType('expense')} className="btn-primary" style={{ flex: 1, background: manualType === 'expense' ? 'var(--danger)' : 'var(--glass)' }}>{t.expense}</button>
                              <button type="button" onClick={() => setManualType('income')} className="btn-primary" style={{ flex: 1, background: manualType === 'income' ? 'var(--success)' : 'var(--glass)' }}>{t.income}</button>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
                            <button type="button" onClick={() => setActiveWallet('bank')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: activeWallet === 'bank' ? '#3b82f6' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                              <CreditCard size={14} /> 
                              {activeWallet === 'bank' 
                                ? (accounts.find(a => a.id === activeBankAccountId)?.name || (lang === 'th' ? "เลือกธนาคาร" : "Select Bank")) 
                                : t.bank}
                            </button>
                            <button type="button" onClick={() => setActiveWallet('cash')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: activeWallet === 'cash' ? '#10b981' : 'transparent', color: 'white', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                              <Banknote size={14} /> {t.cash}
                            </button>
                        </div>

                        {activeWallet === 'bank' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            {accounts.filter(a => a.type === 'bank').length > 0 ? (
                              <>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{lang === 'th' ? 'เลือกบัญชีที่ใช้:' : 'Select Account:'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '4px 0' }} className="no-scrollbar">
                                  {accounts.filter(a => a.type === 'bank').map(acc => {
                                    const bankMeta = acc.bankCode && BANK_DATA[acc.bankCode.toLowerCase()];
                                    const isActive = activeBankAccountId === acc.id;
                                    return (
                                      <button 
                                        key={acc.id}
                                        type="button"
                                        onClick={() => setActiveBankAccountId(acc.id)}
                                        style={{
                                          padding: '8px 14px',
                                          borderRadius: '16px',
                                          border: `1px solid ${isActive ? 'transparent' : 'var(--glass-border)'}`,
                                          background: isActive ? (acc.color || '#3b82f6') : 'rgba(255,255,255,0.05)',
                                          color: 'white',
                                          fontSize: '12px',
                                          fontWeight: isActive ? 700 : 500,
                                          whiteSpace: 'nowrap',
                                          transition: 'all 0.2s',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          boxShadow: isActive ? `0 4px 15px ${acc.color}40` : 'none',
                                          opacity: isActive ? 1 : 0.7,
                                          transform: isActive ? 'scale(1.05)' : 'scale(1)'
                                        }}
                                      >
                                        {bankMeta?.logo && (
                                          <img src={bankMeta.logo} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', padding: '1px' }} />
                                        )}
                                        {acc.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <div style={{ 
                                padding: '10px', 
                                borderRadius: '12px', 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px dashed rgba(255,255,255,0.1)',
                                textAlign: 'center',
                                fontSize: '11px',
                                color: 'var(--text-muted)'
                              }}>
                                {lang === 'th' ? 'บันทึกลงยอดธนาคารรวม (ไม่ได้ระบุบัญชี)' : 'Saving to Main Bank Total'}
                              </div>
                            )}
                          </div>
                        )}
                        {manualEntryMode === 'debt' && (
                          <>
                            <input 
                              type="text" 
                              placeholder={lang === 'th' ? "ชื่อคน (เช่น ส้ม, แม่)" : "Person's name"} 
                              value={manualDebtPerson} 
                              onChange={e => setManualDebtPerson(e.target.value)} 
                              style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} 
                              required 
                            />
                            {presetTags.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{lang === 'th' ? 'แท็ก:' : 'TAG:'}</label>
                                 <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
                                   {presetTags.map(tag => (
                                     <button
                                       key={tag.name}
                                       type="button"
                                       onClick={() => setScanTag(scanTag === tag.name ? "" : tag.name)}
                                       style={{
                                         flexShrink: 0,
                                         padding: '8px 14px',
                                         borderRadius: '16px',
                                         fontSize: '11px',
                                         fontWeight: 700,
                                         border: '1px solid',
                                         borderColor: scanTag === tag.name ? tag.color : 'rgba(255,255,255,0.05)',
                                         background: scanTag === tag.name ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                                         color: 'white',
                                         display: 'flex',
                                         alignItems: 'center',
                                         gap: '6px',
                                         transition: 'all 0.2s'
                                       }}
                                     >
                                       {getIconComponent(tag.icon, 12, scanTag === tag.name ? 'white' : tag.color)}
                                       {tag.name}
                                     </button>
                                   ))}
                                 </div>
                              </div>
                            )}
                          </>
                        )}
                        <input type="number" placeholder={lang === 'th' ? "จำนวนเงิน (บาท)" : "Amount (฿)"} value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} required />
                        <input type="text" placeholder={manualEntryMode === 'debt' ? (lang === 'th' ? "บันทึก (ถ้ามี)" : "Note") : t.description} value={manualDesc} onChange={e => setManualDesc(e.target.value)} style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white' }} />
                        {(editingReminder || manualEntryMode === 'reminder') && (
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {lang === 'th' ? 'เวลาแจ้งเตือน (UTC+7)' : 'Reminder Time (UTC+7)'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input 
                                type="datetime-local" 
                                value={manualReminderDate} 
                                onChange={e => setManualReminderDate(e.target.value)} 
                                style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'white', flex: 1 }} 
                              />
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>+7</span>
                            </div>
                          </div>
                        )}
                        <button type="submit" className="btn-primary">{editingTransaction ? t.save : (editingReminder ? t.save : t.save)}</button>
                        <button type="button" onClick={() => { setShowManualEntry(false); setEditingTransaction(null); setEditingReminder(null); setManualReminderDate(""); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>{t.cancel}</button>
                    </form>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

      <div 
        className="mic-button-container flex flex-col items-center justify-center gap-4  sticky bottom-[120px] bg-transparent py-4 px-6 mt-auto mx-auto"
        style={{
          zIndex: (showLanguageModal || showInstallModal) ? 1 : ((tutorialStep === 'voice' || tutorialStep === 'scan' || tutorialStep === 'manual' || showScanOptions) ? 120000 : 100)
        }}
      >
        {/* AI Mode Badge */}
        <div  style={{ 
          position: 'absolute',
          top: '-45px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: useSmartAI ? 'linear-gradient(135deg, #8b5cf6, #d946ef)' : 'rgba(255,255,255,0.1)',
          padding: '4px 8px',
          borderRadius: '20px',
          fontSize: '10px',
          fontWeight: 600,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: useSmartAI ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
          border: useSmartAI ? 'none' : '1px solid rgba(255,255,255,0.1)',
          transition: 'all 0.3s ease'
        }}>
          {useSmartAI ? (
            <>
              <Sparkles size={12} fill="white" />
              <span>{lang === 'th' ? "AI อัจฉริยะ" : "Smart AI Agent"}</span>
            </>
          ) : (
            <span style={{ opacity: 0.7 }}>{lang === 'th' ? "โหมดปกติ" : "Normal Mode"}</span>
          )}
        </div>
        <AnimatePresence>
          {/* Show interim (partial) transcript while speaking - Bubble Style */}
          {interimTranscript && isListening && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ 
                width: '100%',
                zIndex: tutorialStep === 'voice' ? 120000 : 1200,
                position: 'fixed',
                bottom: isMobile ? '180px' : '200px',
                left: 0,
                right: 0,
                pointerEvents: 'none',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 16px'
              }}
            >
              {/* Chat Bubble */}
              <div style={{ 
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                padding: isMobile ? '14px 18px' : '12px 16px',
                borderRadius: '20px',
                fontSize: isMobile ? '16px' : '15px',
                fontWeight: 500,
                color: 'white',
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.5)',
                position: 'relative',
                lineHeight: 1.5,
                textAlign: 'center',
                wordBreak: 'break-word',
                maxWidth: isMobile ? '320px' : '380px'
              }}>
                {/* Text content */}
                <span>{interimTranscript}</span>
                
                {/* Typing cursor */}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ 
                    marginLeft: '2px',
                    fontWeight: 700
                  }}
                >
                  |
                </motion.span>
              </div>
              
              {/* "Speaking" label - centered */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '8px'
              }}>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Mic size={14} style={{ color: '#a78bfa' }} />
                </motion.div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#a78bfa',
                  fontWeight: 600
                }}>
                  {lang === 'th' ? 'กำลังพูด...' : 'Speaking...'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        
        <AnimatePresence>
          {aiMessage && !(tutorialStep && (aiMessage === translations.th.ai_greeting || aiMessage === translations.en.ai_greeting)) && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              style={{ 
                width: '100%',
                position: 'fixed',
                bottom: isMobile ? '180px' : '200px',
                left: 0,
                right: 0,
                zIndex: tutorialStep ? 120000 : 1200, 
                pointerEvents: 'none',
                padding: '0 12px',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <div style={{ 
                width: '100%',
                maxWidth: isMobile ? '340px' : '480px',
                pointerEvents: 'auto',
                position: 'relative'
              }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAiMessage("");
                }}
                style={{ 
                  position: 'absolute', 
                  top: '-10px', 
                  right: '-6px', 
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                  color: 'white', 
                  border: '2px solid rgba(255,255,255,0.3)', 
                  borderRadius: '50%', 
                  width: isMobile ? '32px' : '28px', 
                  height: isMobile ? '32px' : '28px', 
                  fontSize: isMobile ? '14px' : '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)',
                  zIndex: 20,
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.15)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                ✕
              </button>

              <div className="glass-card" style={{
                padding: isMobile ? '1rem 1.25rem' : '0.9rem 1.5rem', 
                borderRadius: '20px', 
                fontSize: isMobile ? '15px' : '14px', 
                lineHeight: '1.5',
                textAlign: 'center', 
                border: '1px solid rgba(139, 92, 246, 0.5)', 
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(139, 92, 246, 0.2)',
                overflow: 'hidden',
                maxHeight: isMobile ? '300px' : '350px',
                overflowY: 'auto',
                position: 'relative',
                wordBreak: 'break-word'
              }}>
                {/* Shimmer effect for thinking state */}
                {isAILoading && (
                  <motion.div 
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%', height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.15), transparent)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {isAILoading && <Loader2 size={18} className="animate-spin" style={{ color: '#a855f7' }} />}
                  <span style={{ color: '#f8fafc', fontWeight: 500 }}>{aiMessage}</span>
                </div>
              </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <input 
            id="scan-file-input"
            type="file" 
            accept="image/*" 
            multiple
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            onClick={(e) => e.target.value = null}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }} 
          />
          <input 
            id="scan-camera-input"
            type="file" 
            accept="image/*" 
            capture="environment"
            ref={cameraInputRef} 
            onChange={handleImageUpload}
            onClick={(e) => e.target.value = null}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }} 
          />
          
          <div style={{ position: 'relative' }}>
             {/* Scan Options Menu */}
            <AnimatePresence>
            {showScanOptions && (
                <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -20, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    style={{
                        position: 'absolute',
                        bottom: '100%', 
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        zIndex: 100,
                        padding: '16px',
                        borderRadius: '24px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        backdropFilter: 'blur(20px)',
                        marginBottom: '10px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6)',
                        width: '240px'
                    }}
                >
                    {/* Mode Selection */}
                    <div style={{ display: 'flex', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
                        {['normal', 'borrow', 'lend'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => { setScanMode(mode); if(mode==='normal') setScanTag(""); }}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    background: scanMode === mode ? (mode === 'normal' ? 'var(--primary)' : (mode === 'borrow' ? '#ef4444' : '#10b981')) : 'transparent',
                                    color: scanMode === mode ? 'white' : 'var(--text-muted)',
                                    borderRadius: '8px',
                                    padding: '6px 0',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {mode === 'normal' ? (lang === 'th' ? 'ปกติ' : 'Normal') : (mode === 'borrow' ? (lang === 'th' ? 'ยืม' : 'Borrow') : (lang === 'th' ? 'ให้ยืม' : 'Lend'))}
                            </button>
                        ))}
                    </div>

                    {/* Tag Presets & Selection */}
                    {(scanMode !== 'normal') && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                           {!isCreatingTag ? (
                             <>
                               {/* Preset List */}
                               <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
                                  {presetTags.map((tag, idx) => (
                                    <motion.button
                                      key={idx}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => setScanTag(tag.name)}
                                      style={{
                                        flexShrink: 0,
                                        background: scanTag === tag.name ? tag.color : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${tag.color}`,
                                        borderRadius: '20px',
                                        padding: '6px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        position: 'relative'
                                      }}
                                    >
                                      {getIconComponent(tag.icon, 14, scanTag === tag.name ? 'white' : tag.color)}
                                      <span style={{ fontSize: '11px', color: 'white', fontWeight: 600 }}>{tag.name}</span>
                                      {/* Small Delete X for long press or hover? simpler to just require long press logic later, for now just rendering */}
                                    </motion.button>
                                  ))}
                                  
                                  {/* Add New Button */}
                                  <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => { setIsCreatingTag(true); setNewTagName(""); }}
                                    style={{
                                      flexShrink: 0,
                                      background: 'rgba(255,255,255,0.1)',
                                      borderRadius: '50%',
                                      width: '32px', height: '32px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      border: '1px dashed rgba(255,255,255,0.3)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Plus size={16} color="white" />
                                  </motion.button>
                               </div>
                               
                               {/* Fallback Manual Input (if user doesn't want to save preset) */}
                               <div style={{ position: 'relative' }}>
                                 <input 
                                     type="text" 
                                     value={scanTag}
                                     onChange={(e) => setScanTag(e.target.value)}
                                     placeholder={lang === 'th' ? "หรือพิมพ์ชื่อแท็ก..." : "Or type tag name..."}
                                     style={{
                                         width: '100%',
                                         background: 'rgba(0,0,0,0.3)',
                                         border: '1px solid rgba(255,255,255,0.1)',
                                         color: 'white',
                                         padding: '8px 12px',
                                         borderRadius: '12px',
                                         fontSize: '12px'
                                     }}
                                 />
                                 {scanTag && presetTags.find(t => t.name === scanTag) && (
                                    <button 
                                      onClick={() => handleDeletePresetTag(presetTags.find(t => t.name === scanTag))}
                                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ef4444', fontSize: '10px' }}
                                    >
                                      {lang === 'th' ? 'ลบแท็ก' : 'Delete'}
                                    </button>
                                 )}
                               </div>
                             </>
                           ) : (
                             /* Create New Tag Mode */
                             <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lang === 'th' ? 'สร้างแท็กใหม่' : 'Create New Tag'}</span>
                                  <button onClick={() => setIsCreatingTag(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={14} /></button>
                                </div>
                                
                                {/* Name Input */}
                                <input 
                                  autoFocus
                                  value={newTagName}
                                  onChange={(e) => setNewTagName(e.target.value)}
                                  placeholder={lang === 'th' ? "ชื่อแท็ก (เช่น ที่ทำงาน)" : "Tag Name (e.g. Work)"}
                                  style={{
                                    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', padding: '8px', color: 'white', fontSize: '12px'
                                  }}
                                />
                                
                                {/* Color Picker */}
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  {['#ef4444', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899'].map(c => (
                                    <div 
                                      key={c}
                                      onClick={() => setNewTagColor(c)}
                                      style={{ 
                                        width: '20px', height: '20px', borderRadius: '50%', background: c,
                                        border: newTagColor === c ? '2px solid white' : 'none', cursor: 'pointer'
                                      }} 
                                    />
                                  ))}
                                </div>
                                
                                {/* Icon Picker */}
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
                                  {['Tag', 'Briefcase', 'Home', 'Users', 'Heart', 'Star', 'Coffee', 'Car'].map(icon => (
                                    <div 
                                      key={icon}
                                      onClick={() => setNewTagIcon(icon)}
                                      style={{ 
                                        padding: '6px', borderRadius: '8px', 
                                        background: newTagIcon === icon ? 'rgba(255,255,255,0.2)' : 'transparent',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {getIconComponent(icon, 16, newTagColor)}
                                    </div>
                                  ))}
                                </div>
                                
                                <button
                                  onClick={handleSavePresetTag}
                                  disabled={!newTagName}
                                  style={{
                                    width: '100%', background: newTagName ? newTagColor : 'rgba(255,255,255,0.1)',
                                    color: newTagName ? 'white' : 'rgba(255,255,255,0.3)',
                                    border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600
                                  }}
                                >
                                  {lang === 'th' ? 'บันทึก' : 'Save'}
                                </button>
                             </div>
                           )}
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', paddingTop: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <label
                                htmlFor="scan-camera-input"
                                onClick={(e) => {
                                    setShowScanOptions(false);
                                    if (!isMobile) {
                                      e.preventDefault();
                                      setShowWebcam(true);
                                    }
                                }}
                                style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #a855f7, #9333ea)', 
                                    border: 'none',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)', cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }}
                            >
                                <Camera size={22} />
                            </label>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{lang === 'th' ? 'กล้อง' : 'Camera'}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <label
                                htmlFor="scan-file-input"
                                onClick={() => setShowScanOptions(false)}
                                style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.1)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                }}
                            >
                                <Image size={22} />
                            </label>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{lang === 'th' ? 'อัลบั้ม' : 'Gallery'}</span>
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            <button 
              ref={cameraButtonRef}
              onClick={() => setShowScanOptions(!showScanOptions)} 
              className="btn-outline" 
              style={{ 
                borderRadius: '50%', 
                width: '56px', 
                height: '56px',
                zIndex: tutorialStep === 'scan' ? 10705 : (showScanOptions ? 101 : 'auto'),
                position: 'relative',
                pointerEvents: 'auto',
                background: showScanOptions ? 'rgba(255,255,255,0.1)' : 'transparent'
              }}
              disabled={isProcessingImage}
              title={lang === 'th' ? 'สแกนสลิป' : 'Scan receipt'}
            >
              {isProcessingImage ? <Loader2 className="animate-spin" size={24} /> : (showScanOptions ? <X size={24} /> : <Scan size={24} />)}
            </button>
            {isProcessingImage && (
              <div style={{
                position: 'absolute',
                top: '-65px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.95)',
                padding: '8px 12px',
                borderRadius: '12px',
                border: '1px solid var(--primary)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                zIndex: tutorialStep === 'scan' ? 10710 : 100,
                minWidth: '120px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                  {batchProgress.current}/{batchProgress.total}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                  {scanProgress}%
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7, color: 'white', marginTop: '2px' }}>
                  {ocrProvider === 'google' ? 'Google Vision' : 'Tesseract'}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button 
                ref={micButtonRef}
                className={`mic-button ${isListening ? 'active' : ''}`} 
                onClick={toggleListening}
                style={{
                  zIndex: tutorialStep === 'voice' ? 10705 : 'auto',
                  position: 'relative',
                  pointerEvents: 'auto',
                  boxShadow: tutorialStep === 'voice' ? '0 0 30px rgba(168, 85, 247, 0.6)' : undefined
                }}
              >
                  {isListening ? <Mic size={32} /> : <Mic size={32} style={{ opacity: 0.5 }} />}
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
              
              {/* Processing indicator */}
              {isProcessing && (
                <div style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '9px',
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: 'pulse 0.6s infinite'
                  }} />
                  {lang === 'th' ? 'กำลังประมวลผล...' : 'Processing...'}
                </div>
              )}
          </div>
          <button onClick={() => setShowSummary(!showSummary)} className="btn-outline" style={{ borderRadius: '50%', width: '56px', height: '56px' }}>
            <BarChart3 size={24} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {showBalanceSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10650,
              background: 'rgba(7, 10, 19, 0.92)',
              backdropFilter: 'blur(18px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              style={{
                maxWidth: '420px',
                width: '100%',
                background: 'rgba(15, 23, 42, 0.98)',
                borderRadius: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '2rem',
                boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.6)'
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '0.75rem' }}>🏦</div>
              <h2 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                {lang === 'th' ? 'ตั้งค่ายอดเงินเริ่มต้น' : 'Set Starting Balance'}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '14px' }}>
                {lang === 'th'
                  ? 'กรอกยอดเงิน ธนาคาร และ เงินสด เพื่อเริ่มใช้งานจริง'
                  : 'Enter your Bank and Cash balances to start'}
              </p>

              <div style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '1.25rem',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>
                  {lang === 'th' ? '🎤 ตั้งยอดเงินด้วยเสียงได้' : '🎤 You can set balance by voice'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lang === 'th'
                    ? 'ตัวอย่าง: “ตั้งยอดเงินธนาคาร 15000”, “ตั้งเงินสด 500”, “ตั้งงบรายวัน 300”, “ตั้งงบรายเดือน 9000”'
                    : 'Examples: “set bank balance 15000”, “set cash 500”, “set daily budget 300”, “set monthly budget 9000”'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? '🏦 ธนาคาร' : '🏦 Bank'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={balanceBankInput}
                    onChange={(e) => setBalanceBankInput(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น 15000' : 'e.g. 15000'}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white'
                    }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? '💵 เงินสด' : '💵 Cash'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={balanceCashInput}
                    onChange={(e) => setBalanceCashInput(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น 500' : 'e.g. 500'}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white'
                    }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? '📅 งบประมาณรายวัน' : '📅 Daily Budget'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={budgetDailyInput}
                    onChange={(e) => setBudgetDailyInput(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น 300' : 'e.g. 300'}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white'
                    }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {lang === 'th' ? '🗓️ งบประมาณรายเดือน' : '🗓️ Monthly Budget'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={budgetMonthlyInput}
                    onChange={(e) => setBudgetMonthlyInput(e.target.value)}
                    placeholder={lang === 'th' ? 'เช่น 9000' : 'e.g. 9000'}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleBalanceSetupSave}
                className="btn-primary"
                disabled={isSavingBalance}
                style={{
                  width: '100%',
                  fontWeight: 700,
                  padding: '14px',
                  fontSize: '16px',
                  opacity: isSavingBalance ? 0.7 : 1,
                  background: 'linear-gradient(135deg, #8b5cf6, #d946ef)'
                }}
              >
                {isSavingBalance ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึกยอดเงิน' : 'Save Balance')}
              </button>
            </motion.div>
          </motion.div>
        )}

        {showCongrats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10600,
              background: 'rgba(7, 10, 19, 0.92)',
              backdropFilter: 'blur(18px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              style={{
                maxWidth: '420px',
                width: '100%',
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '2rem',
                boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.6)'
              }}
            >
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ fontSize: '64px', marginBottom: '1rem' }}
              >
                🎉
              </motion.div>
              <h2 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                {lang === 'th' ? 'ยินดีด้วย! 🎊' : 'Congratulations! 🎊'}
              </h2>
              <p style={{ color: '#a855f7', fontWeight: 600, marginBottom: '1rem' }}>
                {lang === 'th' ? 'คุณทำ Tutorial ครบทั้ง 3 ขั้นตอนแล้ว!' : 'You completed all 3 tutorial steps!'}
              </p>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '8px', 
                marginBottom: '1.5rem' 
              }}>
                <span style={{ fontSize: '24px' }}>🎤✅</span>
                <span style={{ fontSize: '24px' }}>📸✅</span>
                <span style={{ fontSize: '24px' }}>✍️✅</span>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '14px' }}>
                {lang === 'th'
                  ? 'กดปุ่มด้านล่างเพื่อเริ่มใช้งานจริง\nระบบจะล้างข้อมูลทดสอบให้อัตโนมัติ'
                  : 'Tap below to start using the app.\nDemo data will be cleared automatically.'}
              </p>
              <button
                onClick={handleCongratsConfirm}
                className="btn-primary"
                style={{ 
                  width: '100%', 
                  fontWeight: 700,
                  padding: '14px',
                  fontSize: '16px',
                  background: 'linear-gradient(135deg, #8b5cf6, #d946ef)'
                }}
              >
                {lang === 'th' ? '🚀 เริ่มใช้งานจริง' : '🚀 Start Using App'}
              </button>
            </motion.div>
          </motion.div>
        )}

        {confirmModal.show && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="modal-overlay"
            style={{ zIndex: 10001 }}
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

        {showImageModal && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2200,
              padding: '1rem'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: isMobile ? '90vw' : '80vw',
                maxHeight: '90vh',
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: '16px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                overflow: 'auto',
                boxShadow: '0 20px 60px -10px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: isMobile ? '1rem' : '1.25rem' }}>
                  {lang === 'th' ? 'ดูรูปภาพ' : 'View Receipt'}
                </h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '24px',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: isMobile ? '300px' : '500px' }}>
                <img
                  src={selectedImage}
                  alt="Receipt"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              </div>
              <div style={{ padding: '1rem', borderTop: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <a
                  href={selectedImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  {lang === 'th' ? 'เปิดแบบเต็มหน้า' : 'Open Full Size'}
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial Spotlight Overlay - Modern Redesign */}
      <AnimatePresence>
        {tutorialStep && showOnboarding && !onboardingTasks.completed && !showLanguageModal && !showInstallModal && (
          <>
            {/* Dark backdrop - blocks clicks on non-tutorial areas */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: tutorialStep === 'manual' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.75)',
                zIndex: 110000,
                pointerEvents: 'auto'
              }}
            />

            {/* Progress bar at top */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                position: 'fixed',
                top: '20px',
                left: 0,
                right: 0,
                zIndex: 112000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(0,0,0,0.8)',
                padding: '10px 20px',
                borderRadius: '50px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                pointerEvents: 'auto'
              }}>
              {['voice', 'scan', 'manual'].map((step, idx) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: onboardingTasks[step] 
                      ? '#22c55e' 
                      : tutorialStep === step 
                        ? 'linear-gradient(135deg, #8b5cf6, #d946ef)'
                        : 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'white',
                    boxShadow: tutorialStep === step ? '0 0 20px rgba(139, 92, 246, 0.5)' : 'none'
                  }}>
                    {onboardingTasks[step] ? '✓' : idx + 1}
                  </div>
                  {idx < 2 && (
                    <div style={{
                      width: '24px',
                      height: '2px',
                      background: onboardingTasks[step] ? '#22c55e' : 'rgba(255,255,255,0.2)'
                    }} />
                  )}
                </div>
              ))}
              </div>
            </motion.div>

            {/* Compact tooltip near button - DRAGGABLE */}
            {tutorialHighlight && (
              <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.1}
                whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  position: 'fixed',
                  ...(tutorialStep === 'manual' ? {
                    top: '100px', // Move instructions to top during form entry
                    left: Math.max(20, Math.min(tutorialHighlight.left + tutorialHighlight.width / 2 - 140, window.innerWidth - 300))
                  } : {
                    bottom: window.innerHeight - tutorialHighlight.top + 20,
                    left: Math.max(20, Math.min(tutorialHighlight.left + tutorialHighlight.width / 2 - 140, window.innerWidth - 300))
                  }),
                  width: '280px',
                  zIndex: 113000,
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95))',
                  padding: '16px',
                  borderRadius: '16px',
                  textAlign: 'center',
                  boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  pointerEvents: 'auto',
                  cursor: 'grab'
                }}
              >
                {(() => {
                  const content = getTutorialContent();
                  if (!content) return null;
                  return (
                    <>
                      {/* Drag handle indicator with hint */}
                      <motion.div 
                        animate={{ x: [-3, 3, -3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '4px 12px',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }} />
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }} />
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }} />
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                          👆 {lang === 'th' ? 'ลากย้ายได้' : 'drag me'}
                        </div>
                      </motion.div>

                      {/* Arrow pointing to button */}
                      <div style={{
                        position: 'absolute',
                        ...(tutorialStep === 'manual' ? {
                          top: '-8px',
                          left: '50%',
                          transform: 'translateX(-50%) rotate(45deg)'
                        } : {
                          bottom: '-8px',
                          left: '50%',
                          transform: 'translateX(-50%) rotate(45deg)'
                        }),
                        width: '16px',
                        height: '16px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95))',
                        borderRadius: '2px'
                      }} />

                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '4px', marginTop: '20px' }}>
                        {tutorialStep === 'voice' ? (lang === 'th' ? 'ขั้นตอนที่ 1/3' : 'Step 1 of 3') :
                         tutorialStep === 'scan' ? (lang === 'th' ? 'ขั้นตอนที่ 2/3' : 'Step 2 of 3') :
                         (lang === 'th' ? 'ขั้นตอนที่ 3/3 (สุดท้าย!)' : 'Step 3 of 3 (Last!)')}
                      </div>

                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'white', marginBottom: '10px', lineHeight: 1.4 }}>
                        {tutorialStep === 'voice' ? '🎤' : tutorialStep === 'scan' ? '📸' : '✍️'}{' '}
                        {content.instruction}
                      </div>

                      <motion.div
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#fef08a',
                          padding: '10px 14px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: '10px',
                          marginBottom: '8px'
                        }}
                      >
                        {content.example}
                      </motion.div>

                      {/* Extra hint for manual step */}
                      {tutorialStep === 'manual' && (
                        <div style={{ 
                          fontSize: '11px', 
                          color: 'rgba(255,255,255,0.7)', 
                          marginBottom: '8px',
                          padding: '6px 10px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '6px'
                        }}>
                          {content.prompt}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            const current = onboardingTasksRef.current;
                            const updated = { ...current };
                            if (tutorialStep) {
                              updated[tutorialStep] = true;
                            }
                            updated.completed = updated.voice && updated.scan && updated.manual;
                            setOnboardingTasks(updated);
                            // Save to DB
                            if (session?.user?.email) {
                              fetch('/api/data', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ onboardingTasks: updated, tutorialCompleted: updated.completed })
                              }).catch(err => console.error('Failed to save skip step to DB:', err));
                            }
                            if (updated.completed) {
                              setShowOnboarding(false);
                              setTutorialStep(null);
                              setTutorialHighlight(null);
                              setShowCongrats(true);
                            } else {
                              setTimeout(() => {
                                advanceToNextTutorialStep(updated);
                              }, 200);
                            }
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '12px',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            zIndex: 1,
                            pointerEvents: 'auto'
                          }}
                        >
                          {lang === 'th' ? 'ข้าม Tutorial' : 'Skip Tutorial'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* Animated spotlight ring */}
            {tutorialHighlight && !showManualEntry && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                style={{
                  position: 'fixed',
                  top: tutorialHighlight.top - 12,
                  left: tutorialHighlight.left - 12,
                  width: tutorialHighlight.width + 24,
                  height: tutorialHighlight.height + 24,
                  borderRadius: tutorialStep === 'manual' ? '16px' : '50%',
                  border: '3px solid #a855f7',
                  boxShadow: '0 0 0 6px rgba(168, 85, 247, 0.2), 0 0 40px rgba(168, 85, 247, 0.4), inset 0 0 20px rgba(168, 85, 247, 0.1)',
                  zIndex: 111100,
                  pointerEvents: 'none'
                }}
              >
                {/* Pulsing animation ring */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{
                    position: 'absolute',
                    inset: '-6px',
                    borderRadius: tutorialStep === 'manual' ? '20px' : '50%',
                    border: '2px solid #a855f7'
                  }}
                />
              </motion.div>
            )}

            {/* Bouncing arrow indicator */}
            {tutorialHighlight && !showManualEntry && (
              <motion.div
                animate={{ y: tutorialStep === 'manual' ? [0, -8, 0] : [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                style={{
                  position: 'fixed',
                  ...(tutorialStep === 'manual' ? {
                    top: tutorialHighlight.top - 36,
                    left: tutorialHighlight.left + tutorialHighlight.width / 2 - 12
                  } : {
                    top: tutorialHighlight.top + tutorialHighlight.height + 12,
                    left: tutorialHighlight.left + tutorialHighlight.width / 2 - 12
                  }),
                  zIndex: 113100,
                  fontSize: '24px',
                  pointerEvents: 'none'
                }}
              >
                {tutorialStep === 'manual' ? '👇' : '👆'}
              </motion.div>
            )}
          </>
        )}
        {/* Add Account Modal */}
        {showAddAccountModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowAddAccountModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1e293b', borderRadius: '24px', padding: '1.5rem',
                width: '90%', maxWidth: '360px', border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
            >
               <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem' }}>
                  {editingAccount ? (lang === 'th' ? 'แก้ไขบัญชี' : 'Edit Account') : (lang === 'th' ? 'เพิ่มบัญชีธนาคาร' : 'Add Bank Account')}
               </h3>
               
               <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                     {lang === 'th' ? 'ชื่อธนาคาร (เช่น กสิกร, SCB)' : 'Bank Name (e.g. KBank, SCB)'}
                  </label>
                  <input 
                    autoFocus
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder={lang === 'th' ? 'พิมพ์ชื่อธนาคาร...' : 'Type bank name...'}
                    style={{
                       width: '100%', padding: '12px', borderRadius: '12px',
                       background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                       color: 'white', fontSize: '1rem'
                    }}
                  />
                  {/* Bank Suggestions */}
                  {newAccountName.length > 0 && (
                    <div style={{ 
                      marginTop: '10px', 
                      display: 'flex', 
                      gap: '8px', 
                      overflowX: 'auto',
                      padding: '4px 0',
                    }} className="no-scrollbar">
                      {Object.values(BANK_DATA)
                        .filter(bank => 
                          bank.keywords.some(kw => kw.toLowerCase().includes(newAccountName.toLowerCase())) ||
                          bank.name.toLowerCase().includes(newAccountName.toLowerCase())
                        )
                        .map(bank => (
                          <motion.button
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={bank.code}
                            onClick={() => setNewAccountName(bank.name)}
                            style={{
                              flexShrink: 0,
                              background: 'rgba(255,255,255,0.05)',
                              border: `1px solid ${bank.color}40`,
                              padding: '6px 10px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ 
                              width: '16px', height: '16px', borderRadius: '50%', background: 'white', 
                              padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                            }}>
                              <img src={bank.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'white', fontWeight: 600 }}>{bank.name}</span>
                          </motion.button>
                        ))}
                    </div>
                  )}

                  {/* Preview detected bank */}
                  {newAccountName && (
                     <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Detected:</span>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: `1px solid ${detectBank(newAccountName).color}40`
                        }}>
                          {detectBank(newAccountName).logo && (
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', padding: '1px' }}>
                              <img src={detectBank(newAccountName).logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                          )}
                          <span style={{ color: detectBank(newAccountName).color, fontWeight: '800' }}>
                            {detectBank(newAccountName).name}
                          </span>
                        </div>
                     </div>
                  )}
               </div>
               
               <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                     {lang === 'th' ? 'ยอดเงินคงเหลือ' : 'Current Balance'}
                  </label>
                  <input 
                    type="number"
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(e.target.value)}
                    placeholder="0.00"
                    style={{
                       width: '100%', padding: '12px', borderRadius: '12px',
                       background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                       color: 'white', fontSize: '1.2rem', fontWeight: 700
                    }}
                  />
               </div>
               
               {editingAccount && (
                   <div style={{ marginBottom: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                      <button
                        onClick={() => {
                           setConfirmModal({
                              show: true,
                              title: lang === 'th' ? `ยืนยันลบบัญชี ${editingAccount.name}?` : `Delete ${editingAccount.name}?`,
                              onConfirm: () => {
                                 const updated = accounts.filter(a => a.id !== editingAccount.id);
                                 
                                 // Calculate new total bank balance
                                 const newBankTotal = updated.filter(a => a.type === 'bank').reduce((sum, a) => sum + a.balance, 0);
                                 
                                 setAccounts(updated);
                                 setBalance(prev => ({ ...prev, bank: newBankTotal }));
                                 
                                 // Update Active ID if needed
                                 let newActiveId = activeBankAccountId;
                                 if (updated.length > 0 && activeBankAccountId === editingAccount.id) {
                                    newActiveId = updated.find(a => a.type === 'bank')?.id;
                                    setActiveBankAccountId(newActiveId);
                                 }

                                 // Save to DB (Accounts + Balance)
                                 fetch('/api/data', { 
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' }, 
                                    body: JSON.stringify({ 
                                       accounts: updated,
                                       balance: { ...balance, bank: newBankTotal },
                                       activeBankAccountId: newActiveId
                                    }) 
                                 });

                                 setShowAddAccountModal(false);
                                 setEditingAccount(null);
                              }
                           });
                        }}
                        style={{
                           width: '100%', padding: '10px', borderRadius: '12px',
                           background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                           border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem', fontWeight: 600,
                           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                      >
                         <Trash2 size={16} />
                         {lang === 'th' ? 'ลบบัญชีนี้' : 'Delete Account'}
                      </button>
                   </div>
                )}
                
               <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                       setShowAddAccountModal(false);
                       setEditingAccount(null);
                    }}
                    style={{
                       flex: 1, padding: '12px', borderRadius: '12px',
                       background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none'
                    }}
                  >
                     {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                   <button
                    onClick={handleAddAccount}
                    disabled={!newAccountName}
                    style={{
                       flex: 1, padding: '12px', borderRadius: '12px',
                       background: newAccountName ? '#3b82f6' : '#1e293b', 
                       color: newAccountName ? 'white' : 'rgba(255,255,255,0.3)', 
                       border: 'none', fontWeight: 600
                    }}
                  >
                     {lang === 'th' ? 'บันทึก' : 'Save'}
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Scan Backdrop */}
      <AnimatePresence>
        {showScanOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowScanOptions(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 110500 // Just below the mic-button-container (111000)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBankReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 140000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: 'rgba(10, 15, 26, 0.8)',
              backdropFilter: 'blur(12px)'
            }}
            onClick={() => setShowBankReport(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '400px',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
                borderRadius: '32px',
                border: `1px solid ${showBankReport.color}40`,
                boxShadow: `0 20px 60px -12px ${showBankReport.color}20`,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div style={{ padding: '24px', background: `${showBankReport.color}15`, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '12px', 
                    background: showBankReport.color, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${showBankReport.color}40`
                  }}>
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'white' }}>
                      {showBankReport.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {lang === 'th' ? 'สรุปยอดใช้จ่าย' : 'Spending Summary'}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                    {lang === 'th' ? 'วันนี้' : 'Today'}
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444' }}>
                    ฿{showBankReport.spentToday.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                    {lang === 'th' ? 'เดือนนี้' : 'This Month'}
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444' }}>
                    ฿{showBankReport.spentMonth.toLocaleString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button 
                    onClick={() => {
                      setFilteredAccountId(showBankReport.id);
                      setShowBankReport(null);
                      const txnList = document.getElementById('transaction-list-top');
                      if (txnList) txnList.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{ 
                      flex: 1, 
                      padding: '14px', 
                      borderRadius: '16px', 
                      background: showBankReport.color, 
                      color: 'white', 
                      border: 'none', 
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: `0 8px 20px ${showBankReport.color}40`
                    }}
                  >
                    {lang === 'th' ? 'ดูรายการทั้งหมด' : 'View Transactions'}
                  </button>
                  <button 
                    onClick={() => setShowBankReport(null)}
                    style={{ 
                      padding: '14px 20px', 
                      borderRadius: '16px', 
                      background: 'rgba(255,255,255,0.05)', 
                      color: 'rgba(255,255,255,0.6)', 
                      border: 'none', 
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    {lang === 'th' ? 'ปิด' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showWebcam && (
        <WebcamModal 
          onClose={() => setShowWebcam(false)}
          onCapture={(file) => {
            setShowWebcam(false);
            handleImageUpload({ target: { files: [file] } });
          }}
        />
      )}
    </div>
  );
}

// Wrap in Suspense for useSearchParams compatibility with Next.js static generation
export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0f1a'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '3px solid rgba(139, 92, 246, 0.3)', 
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
  