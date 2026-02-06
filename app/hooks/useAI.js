
"use client";
import { useState } from 'react';

export default function useAI({
  session,
  lang,
  t,
  nickname,
  // Data State
  transactions,
  accounts,
  balance,
  budget,
  debts,
  reminders,
  // Data Setters
  setTransactions,
  setAccounts,
  setBalance,
  setDebts,
  setBudget,
  setMonthlyBudget,
  setActiveWallet,
  setActiveBankAccountId,
  // Data Methods
  addTransaction,
  addReminder,
  addDebt,
  // Refs
  accountsRef,
  transactionsRef,
  balanceRef,
  aiModelRef,
  onboardingTasksRef,
  showOnboardingRef,
  bankScrollRef,
  // UI Setters
  setAiMessage,
  setTranscript,
  setInterimTranscript,
  setShowSummary,
  setActiveTab,
  setFilteredAccountId,
  setFilteredWalletType,
  setShowBankReport,
  setShowToast,
  completeOnboardingTask,
  activeWallet,
  activeBankAccountId: currentBankId
}) {
  const [isAILoading, setIsAILoading] = useState(false);

  const findAccountId = (bankName, providedId) => {
    // If it looks like a real ID, use it
    if (providedId && providedId.length > 10 && !providedId.includes('<')) return providedId;
    
    // Try to match by name
    if (!bankName && (!providedId || providedId.includes('<'))) return null;
    const lowerName = (bankName || "").toLowerCase();
    const match = accountsRef.current.find(a => 
      a.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(a.name.toLowerCase()) ||
      (a.bankCode && lowerName.includes(a.bankCode.toLowerCase()))
    );
    return match ? match.id : (providedId && !providedId.includes('<') ? providedId : null);
  };

  const processAICommand = async (text, detectedLang = null, imageUrl = null, forceModel = null, source = "voice", ocrRawText = "") => {
    setTranscript("");
    setInterimTranscript("");
    setAiMessage(lang === 'th' ? "กำลังคิด... 🧠" : "Thinking... 🧠");
    setIsAILoading(true);
    try {
      // Use forced model (for scan operations) or user's selected model
      const modelToUse = forceModel || aiModelRef.current;
      const userName = nickname || session?.user?.name?.split(' ')[0] || "";
      const fullName = session?.user?.name || "";
      const emailAlias = session?.user?.email ? session.user.email.split('@')[0] : "";
      
      // Build comprehensive alias list including individual name parts
      const allNameParts = [userName, fullName, emailAlias]
        .filter(Boolean)
        .flatMap(name => name.split(/\s+/))
        .map(part => part.toLowerCase().trim())
        .filter(part => part.length > 2);
      
      const userAliases = [...new Set(allNameParts)];
      
      const requestSource = source || "voice";
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          lang, 
          balance, 
          budget,
          activeWallet, 
          activeBankAccountId: currentBankId,
          accounts, 
          aiModel: modelToUse,
          source: requestSource,
          userName,
          userAliases,
          detectedLang,
          recentTransactions: transactions.slice(0, 15),
          recentDebts: debts.filter(d => d.status !== 'paid').slice(0, 10),
          reminders: reminders.slice(0, 10)
        })
      });
      const data = await res.json();
      setIsAILoading(false);
      
      if (!res.ok) throw new Error(data.message || "AI Error");
      
      const normalizedAmount = typeof data.amount === "string"
        ? parseFloat(data.amount.replace(/,/g, ""))
        : data.amount;
      const hasValidAmount = Number.isFinite(normalizedAmount) && normalizedAmount > 0;

      if (requestSource === "ocr") {
        const ocrTextLower = (ocrRawText || text).toLowerCase();
        const senderKeywords = ["from", "sender", "ผู้โอน", "ผู้สั่งโอน", "โอนจาก", "ผู้ส่ง"];
        const receiverKeywords = ["to", "receiver", "beneficiary", "ผู้รับ", "ผู้รับเงิน", "โอนให้", "ถึง"];
        const foundAlias = userAliases.find(alias => alias && ocrTextLower.includes(alias));
        
        if (foundAlias) {
          const aliasIndex = ocrTextLower.indexOf(foundAlias);
          const textBeforeAlias = ocrTextLower.substring(0, aliasIndex);
          const textAfterAlias = ocrTextLower.substring(aliasIndex + foundAlias.length);
          const hasSenderBefore = senderKeywords.some(k => textBeforeAlias.includes(k));
          const hasReceiverAfter = receiverKeywords.some(k => textAfterAlias.includes(k));
          
          if (hasSenderBefore || hasReceiverAfter) {
            data.type = "expense";
          } else if (receiverKeywords.some(k => textBeforeAlias.includes(k))) {
            data.type = "income";
          } else if (ocrTextLower.includes("transfer to") || ocrTextLower.includes("โอนให้")) {
            data.type = "expense";
          }
        }
      }

      // Only force ADD_TRANSACTION if it's NOT already a debt action
      if (requestSource === "ocr" && data.action !== "ADD_TRANSACTION" && data.action !== "BORROW" && data.action !== "LEND") {
        if (hasValidAmount) {
          data.action = "ADD_TRANSACTION";
          data.amount = normalizedAmount;
          data.type = data.type || "expense";
          data.category = data.category || (lang === 'th' ? "อื่นๆ" : "Other");
          data.description = data.description || (lang === 'th' ? "สแกนใบเสร็จ" : "Receipt scan");
        } else {
          setAiMessage(lang === 'th'
            ? "สแกนสำเร็จแต่ไม่พบยอดชัดเจน กรุณาลองใหม่อีกครั้งค่ะ"
            : "Scan completed but I couldn't find a clear total. Please try again.");
          return;
        }
      }

      const voiceTextLower = text.toLowerCase();
      const questionPatterns = ["ได้ไหม", "พอไหม", "หรือเปล่า", "เหรอ", "ไหม", "มั้ย", "?", "ได้บ้าง", "กี่บาท", "เท่าไหร่", "ยังไง", "อะไร", "ควรจะ", "น่าจะ", "แนะนำ", "ช่วย", "วางแผน"];
      const isQuestion = questionPatterns.some(q => voiceTextLower.includes(q));
      
      if (requestSource !== "ocr" && isQuestion && data.action !== "PLANNING" && data.action !== "SHOW_SUMMARY" && data.action !== "SHOW_DEBTS") {
        data.action = "PLANNING";
        if (!data.message) {
          data.message = lang === 'th' 
            ? "นี่เป็นคำถามใช่ไหมคะ? เดี๋ยวเรมี่ช่วยวางแผนการใช้เงินให้นะคะ ✨" 
            : "This sounds like a question! Let me help you with some financial planning. ✨";
        }
      }
      
      if (data.thought) {
        console.log("AI Thought:", data.thought);
      }

      if (data.action === "ADD_TRANSACTION") {
         let { amount, type, category, description, wallet, bank, bankAccountId, icon } = data;
         const actualId = findAccountId(bank, bankAccountId);
         bankAccountId = actualId;
         const finalAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : amount;
         if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
           setAiMessage(lang === 'th' ? "ไม่พบยอดที่ชัดเจนจากข้อมูลนี้ กรุณาลองใหม่อีกครั้งค่ะ" : "I couldn't find a clear amount from this. Please try again.");
           return;
         }
         
         if (bankAccountId && wallet === 'bank') {
           const targetAccount = accounts.find(a => a.id === bankAccountId);
           if (targetAccount) {
             setActiveWallet('bank');
             setActiveBankAccountId(bankAccountId);
             const bankAccounts = accounts.filter(a => a.type === 'bank');
             const otherAccounts = accounts.filter(a => a.type !== 'bank');
             const filtered = bankAccounts.filter(a => a.id !== bankAccountId);
             const updatedAccounts = [targetAccount, ...filtered, ...otherAccounts];
             setAccounts(updatedAccounts);
             accountsRef.current = updatedAccounts;
             if (bankScrollRef.current) bankScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
             fetch('/api/data', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ activeBankAccountId: bankAccountId, defaultWallet: 'bank', accounts: updatedAccounts })
             });
           }
         }
         
         const finalWallet = wallet || activeWallet;
         const isTutorialMode = !onboardingTasksRef.current.completed && showOnboardingRef.current;
         addTransaction(finalAmount, type || "expense", description, category, finalWallet, bank, icon, requestSource === "ocr", imageUrl, isTutorialMode, bankAccountId);
         
         const accountName = bankAccountId ? accounts.find(a => a.id === bankAccountId)?.name : null;
         const walletLabel = finalWallet === 'cash' ? (lang === 'th' ? 'เงินสด' : 'Cash') : (accountName || (lang === 'th' ? 'ธนาคาร' : 'Bank'));
         setAiMessage(data.message || (lang === 'th' ? `✅ บันทึกแล้ว: ${description} ฿${finalAmount} (${walletLabel})` : `✅ Saved: ${description} ฿${finalAmount} (${walletLabel})`));
         
         if (requestSource === "ocr") completeOnboardingTask('scan');
         else completeOnboardingTask('voice');
      } 

      else if (data.action === "SWITCH_PRIMARY") {
          let { wallet, bank, bankAccountId } = data;
          if (wallet === 'cash') {
            setActiveWallet('cash');
            fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultWallet: 'cash' }) });
            setShowToast({ show: true, title: lang === 'th' ? 'เปลี่ยนบัญชีหลัก' : 'Primary Changed', message: lang === 'th' ? '💵 ตั้งเงินสดเป็นบัญชีหลักแล้ว' : '💵 Cash set as primary', type: 'success' });
            setAiMessage(data.message || (lang === 'th' ? '💵 เปลี่ยนเป็นเงินสดแล้วค่ะ' : '💵 Switched to cash'));
          } else if (wallet === 'bank') {
            const healedId = findAccountId(bank, bankAccountId);
            const targetAccount = accounts.find(a => a.id === healedId);
            if (targetAccount) {
              const targetId = targetAccount.id;
              setActiveWallet('bank');
              setActiveBankAccountId(targetId);
              const bankAccounts = accounts.filter(a => a.type === 'bank');
              const otherAccounts = accounts.filter(a => a.type !== 'bank');
              const filtered = bankAccounts.filter(a => a.id !== targetId);
              const updatedAccounts = [targetAccount, ...filtered, ...otherAccounts];
              setAccounts(updatedAccounts);
              accountsRef.current = updatedAccounts;
              fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultWallet: 'bank', activeBankAccountId: targetId, accounts: updatedAccounts }) });
              setShowToast({ show: true, title: lang === 'th' ? 'เปลี่ยนบัญชีหลัก' : 'Primary Changed', message: lang === 'th' ? `🏦 ตั้ง ${targetAccount.name} เป็นบัญชีหลักแล้ว` : `🏦 ${targetAccount.name} set as primary`, type: 'success' });
              if (bankScrollRef.current) bankScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
              setAiMessage(data.message || (lang === 'th' ? `🏦 เปลี่ยนเป็น ${targetAccount.name} แล้วค่ะ` : `🏦 Switched to ${targetAccount.name}`));
            }
          }
       }
      else if (data.action === "FILTER_BANK") {
          const { bankAccountId } = data;
          if (bankAccountId) {
            setFilteredAccountId(bankAccountId);
            setFilteredWalletType(null);
            setAiMessage(data.message || (lang === 'th' ? `กรองรายการของ ${accounts.find(a => a.id === bankAccountId)?.name || 'ธนาคาร'} ให้แล้วค่ะ` : `Filtered transactions for ${accounts.find(a => a.id === bankAccountId)?.name || 'Bank'}`));
            const txnList = document.getElementById('transaction-list-top');
            if (txnList) txnList.scrollIntoView({ behavior: 'smooth' });
          }
       }
       else if (data.action === "FILTER_WALLET") {
          const { wallet } = data;
          if (wallet) {
            setFilteredWalletType(wallet);
            setFilteredAccountId(null);
            setAiMessage(data.message || (lang === 'th' ? `กรองรายการของ ${wallet === 'cash' ? t.cash : 'ธนาคารรวม'} ให้แล้วค่ะ` : `Filtered transactions for ${wallet === 'cash' ? t.cash : 'All Banks'}`));
            const txnList = document.getElementById('transaction-list-top');
            if (txnList) txnList.scrollIntoView({ behavior: 'smooth' });
          }
       }
       else if (data.action === "REPORT_WALLET") {
          const { wallet } = data;
          if (wallet) {
            const now = new Date();
            const todayStr = now.toDateString();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            const spentToday = (transactions || []).filter(t => t.type === 'expense' && t.wallet === wallet && new Date(t.date).toDateString() === todayStr).reduce((sum, t) => sum + t.amount, 0);
            const spentMonth = (transactions || []).filter(t => { const d = new Date(t.date); return t.type === 'expense' && t.wallet === wallet && d.getMonth() === thisMonth && d.getFullYear() === thisYear; }).reduce((sum, t) => sum + t.amount, 0);
            setShowBankReport({ id: `wallet-${wallet}`, name: wallet === 'cash' ? t.cash : (lang === 'th' ? 'ธนาคารรวม' : 'All Banks'), color: wallet === 'cash' ? '#10b981' : '#3b82f6', spentToday, spentMonth });
            setAiMessage(data.message || (lang === 'th' ? `นี่คือสรุปยอดใช้จ่ายของ${wallet === 'cash' ? t.cash : 'ธนาคาร'}ค่ะ` : `Here is the spending report for ${wallet}`));
          }
       }
      else if (data.action === "REPORT_BANK") {
          const { bankAccountId } = data;
          if (bankAccountId) {
            const acc = accounts.find(a => a.id === bankAccountId);
            if (acc) {
              const now = new Date();
              const todayStr = now.toDateString();
              const thisMonth = now.getMonth();
              const thisYear = now.getFullYear();
              const spentToday = (transactions || []).filter(t => t.type === 'expense' && t.accountId === bankAccountId && new Date(t.date).toDateString() === todayStr).reduce((sum, t) => sum + t.amount, 0);
              const spentMonth = (transactions || []).filter(t => { const d = new Date(t.date); return t.type === 'expense' && t.accountId === bankAccountId && d.getMonth() === thisMonth && d.getFullYear() === thisYear; }).reduce((sum, t) => sum + t.amount, 0);
              setShowBankReport({ id: bankAccountId, name: acc.name, color: acc.color, spentToday, spentMonth });
              setAiMessage(data.message || (lang === 'th' ? `นี่คือสรุปยอดใช้จ่ายของ ${acc.name} ค่ะ` : `Here is the spending report for ${acc.name}`));
            }
          }
      }
      else if (data.action === "TRANSFER") {
         let { amount, from_bank, to_bank, fromBankAccountId, toBankAccountId, from_wallet, to_wallet, icon } = data;
         const sourceWallet = from_wallet || "bank";
         const destWallet = to_wallet || "bank";
         const actualFromId = findAccountId(from_bank, fromBankAccountId);
         const actualToId = findAccountId(to_bank, toBankAccountId);
         const currentAccounts = [...accountsRef.current];
         const updatedAccounts = currentAccounts.map(acc => {
           if (acc.id === actualFromId) return { ...acc, balance: acc.balance - amount };
           if (acc.id === actualToId) return { ...acc, balance: acc.balance + amount };
           return acc;
         });
         setAccounts(updatedAccounts);
         accountsRef.current = updatedAccounts;
         const fromDesc = lang === 'th' ? `โอนเงินไป ${to_bank}` : `Transfer to ${to_bank}`;
         const toDesc = lang === 'th' ? `รับโอนจาก ${from_bank}` : `Transfer from ${from_bank}`;
         const expenseData = { amount, type: "expense", description: fromDesc, category: "เงินโอน", wallet: sourceWallet, bank: from_bank, accountId: actualFromId, icon: icon || "ArrowRightLeft", date: new Date().toISOString() };
         const incomeData = { amount, type: "income", description: toDesc, category: "เงินโอน", wallet: destWallet, bank: to_bank, accountId: actualToId, icon: icon || "ArrowRightLeft", date: new Date().toISOString() };
         const tempId1 = Date.now();
         const tempId2 = Date.now() + 1;
         setTransactions(prev => [{ ...incomeData, id: tempId2, _id: tempId2 }, { ...expenseData, id: tempId1, _id: tempId1 }, ...prev]);
         fetch('/api/transactions/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, from_wallet: sourceWallet, to_wallet: destWallet, from_bank, to_bank, fromBankAccountId: actualFromId, toBankAccountId: actualToId, icon, lang })
         }).then(async (res) => {
            if (res.ok) {
               const data = await res.json();
               if (data.updatedProfile) {
                 setAccounts(data.updatedProfile.accounts);
                 accountsRef.current = data.updatedProfile.accounts;
                 setBalance(data.updatedProfile.balance);
                 balanceRef.current = data.updatedProfile.balance;
               }
            }
         });
         setAiMessage(data.message || (lang === 'th' ? `✅ บันทึกการโอน ฿${amount.toLocaleString()} เรียบร้อยแล้วค่ะ` : `✅ Recorded transfer of ฿${amount.toLocaleString()}`));
      }
      else if (data.action === "SET_BUDGET") {
        if (data.period === "monthly") {
           setMonthlyBudget(data.amount);
           fetch('/api/data', { method: 'POST', body: JSON.stringify({ monthlyBudget: data.amount }) });
           setAiMessage(data.message || (lang === 'th' ? `ตั้งงบรายเดือนเป็น ฿${data.amount.toLocaleString()} แล้วค่ะ` : `Monthly budget set to ฿${data.amount.toLocaleString()}`));
        } else {
           setBudget(data.amount);
           fetch('/api/data', { method: 'POST', body: JSON.stringify({ budget: data.amount }) });
           setAiMessage(data.message || (lang === 'th' ? `ตั้งงบรายวันเป็น ฿${data.amount.toLocaleString()} แล้วค่ะ` : `Daily budget set to ฿${data.amount.toLocaleString()}`));
        }
      }
      else if (data.action === "SET_BALANCE") {
         const { wallet, bank, bankAccountId, amount } = data;
         const updates = {};
         if (wallet === 'cash') updates.cash = amount;
         if (wallet === 'bank') updates.bank = amount;
         const newBal = { ...balance, ...updates };
         setBalance(newBal);
         if (balanceRef) balanceRef.current = newBal;
         let updatedAccounts = accounts;
         if (wallet === 'bank') {
            const healedId = findAccountId(bank, bankAccountId);
            if (healedId) {
              updatedAccounts = accounts.map(acc => acc.id === healedId ? { ...acc, balance: amount } : acc);
              setAccounts(updatedAccounts);
              accountsRef.current = updatedAccounts;
            }
         }
         fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: newBal, accounts: updatedAccounts }) });
         setAiMessage(data.message || (lang === 'th' ? `ปรับยอดเงิน${wallet}เป็น ฿${amount.toLocaleString()}` : `Updated ${wallet} balance to ฿${amount.toLocaleString()}`));
      }
      else if (data.action === "BORROW" || data.action === "LEND") {
        const { amount, person, type, wallet, note, category, bank, bankAccountId } = data;
        const debtType = data.action === "BORROW" ? "borrow" : "lend";
        
        // Resolve account ID if bank mentioned
        const actualBankId = findAccountId(bank, bankAccountId);
        
        // Fallback for Person: Use Tag (category) if Person is missing, otherwise default
        let finalPerson = person;
        if (!finalPerson || finalPerson === 'name') {
           if (category && category !== 'การเงิน' && category !== 'Other' && category !== 'Borrow' && category !== 'Lend' && category !== 'ยืม' && category !== 'ให้ยืม') {
             finalPerson = category;
           } else {
             finalPerson = lang === 'th' ? 'ไม่ระบุ' : 'Unknown';
           }
        }

        const finalNote = category && category !== finalPerson && category !== 'การเงิน' && category !== 'Other'
          ? (note ? `[${category}] ${note}` : `[${category}]`)
          : note;

        try {
          await addDebt(amount, finalPerson, debtType, finalNote, wallet, actualBankId);
          setAiMessage(data.message || (lang === 'th' ? `บันทึกรายการ${debtType === 'borrow' ? 'ยืม' : 'ให้ยืม'} ฿${amount} (${finalPerson}) แล้วค่ะ` : `Recorded ${debtType} of ฿${amount} (${finalPerson})`));
          setActiveTab("debts");
        } catch (err) {
          console.error("Debt Error:", err);
          setAiMessage(lang === 'th' ? "เกิดข้อผิดพลาดในการบันทึกหนี้สินค่ะ" : "Error saving debt record");
        }
      }
      else if (data.action === "SHOW_SUMMARY") {
        setShowSummary(true);
        setActiveTab("transactions");
        setAiMessage(data.message || (lang === 'th' ? "สรุปยอดให้แล้วค่ะ!" : "Here is your summary!"));
      }
      else if (data.action === "SHOW_DEBTS") {
        setActiveTab("debts");
        setAiMessage(data.message || (lang === 'th' ? "นี่คือรายการยืม/คืนเงินทั้งหมดค่ะ" : "Here are your borrow/lend records."));
      }
      else if (data.action === "REMIND") {
        const { description, amount, date, wallet } = data;
        addReminder(description, amount, date, wallet);
        setActiveTab("reminders");
        setAiMessage(data.message || (lang === 'th' ? `ตั้งเตือนความจำ: ${description} ฿${amount} วันที่ ${new Date(date).toLocaleDateString('th-TH')} แล้วค่ะ 🎀` : `Set reminder for ${description} ฿${amount} on ${new Date(date).toLocaleDateString()}! 🎀`));
      }
      else if (data.action === "PLANNING") {
        setAiMessage(data.message);
      }
      else setAiMessage(data.message || (lang === 'th' ? "ไม่แน่ใจค่ะ ขออีกทีได้ไหมคะ? 😅" : "I didn't quite catch that! 😅"));
    } catch (err) {
      console.error(err);
      setIsAILoading(false);
      setAiMessage(lang === 'th' ? "สมอง AI มีปัญหา แงง 😭" : "My AI brain hurts! 😭");
    }
  };

  return {
    processAICommand,
    isAILoading,
    setIsAILoading
  };
}
