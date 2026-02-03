
"use client";
import { useState, useRef, useEffect, useCallback } from 'react';

export default function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [balance, setBalance] = useState({ bank: 0, cash: 0 });
  const [budget, setBudget] = useState(1000);
  const [monthlyBudget, setMonthlyBudget] = useState(30000);
  const [debts, setDebts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [groqKeys, setGroqKeys] = useState([]);
  
  const [activeBankAccountId, setActiveBankAccountId] = useState("");
  const [activeWallet, setActiveWallet] = useState("bank");

  const transactionsRef = useRef([]);
  const accountsRef = useRef([]);
  const balanceRef = useRef({ bank: 0, cash: 0 });

  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const addTransaction = async (amount, type, description, category = "อื่นๆ", wallet = "bank", bank = null, icon = null, isScanned = false, imageUrl = null, isTutorial = false, forcedAccountId = null) => {
    const data = {
      amount,
      type,
      description,
      category,
      wallet,
      bank,
      // Use forcedAccountId if provided, otherwise activeBankAccountId, otherwise first bank account
      accountId: wallet === 'bank' ? (forcedAccountId || activeBankAccountId || (accounts.find(a => a.type === 'bank')?.id) || null) : null,
      icon,
      isScanned,
      imageUrl,
      date: new Date().toISOString(),
      isTutorial, // Mark as tutorial transaction
    };

    // Update UI Optimistically using Refs to avoid stale closure
    const tempId = Date.now();
    setTransactions((prev) => [{ ...data, id: tempId, _id: tempId }, ...prev]);
    
    // Update Balance
    const nextBalance = { ...balanceRef.current };
    if (type === "income") nextBalance[wallet] = (nextBalance[wallet] || 0) + amount;
    else nextBalance[wallet] = (nextBalance[wallet] || 0) - amount;
    balanceRef.current = nextBalance;
    setBalance(nextBalance);

    // Update Specific Bank Account
    const targetId = forcedAccountId || activeBankAccountId;
    let nextAccounts = [...accountsRef.current];
    if (wallet === "bank" && targetId) {
      nextAccounts = nextAccounts.map(acc => {
        if (acc.id === targetId) {
          const newBal = type === "income" ? acc.balance + amount : acc.balance - amount;
          return {
            ...acc,
            balance: newBal
          };
        }
        return acc;
      });
      accountsRef.current = nextAccounts;
      setAccounts(nextAccounts);
    }

    // Skip MongoDB save for tutorial transactions
    if (isTutorial) {
      return;
    }

    // Save to MongoDB
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          accounts: nextAccounts
        }),
      });
      
      // Sync profile state with latest calculated values
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          balance: nextBalance,
          accounts: nextAccounts
        }),
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

    // Sync specific bank accounts
    setAccounts(prevAccounts => {
      let updated = [...prevAccounts];
      
      // Reverse old transaction impact
      if (oldTxn.wallet === "bank" && oldTxn.accountId) {
         updated = updated.map(acc => {
           if (acc.id === oldTxn.accountId) {
             return { ...acc, balance: oldTxn.type === "income" ? acc.balance - oldTxn.amount : acc.balance + oldTxn.amount };
           }
           return acc;
         });
      }
      
      // Apply new transaction impact
      const targetAccountId = updatedData.accountId || (updatedData.wallet === 'bank' ? activeBankAccountId : null);
      if (updatedData.wallet === "bank" && targetAccountId) {
         updated = updated.map(acc => {
           if (acc.id === targetAccountId) {
             return { ...acc, balance: updatedData.type === "income" ? acc.balance + updatedData.amount : acc.balance - updatedData.amount };
           }
           return acc;
         });
      }
      
      // Save updated accounts to DB
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: updated })
      });
      
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

      // Sync specific bank accounts
      if (transaction.wallet === "bank" && transaction.accountId) {
        setAccounts(prevAccounts => {
          const updated = prevAccounts.map(acc => {
            if (acc.id === transaction.accountId) {
              return { 
                ...acc, 
                balance: transaction.type === "income" ? acc.balance - transaction.amount : acc.balance + transaction.amount 
              };
            }
            return acc;
          });
          
          // Save updated accounts to DB
          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accounts: updated })
          });
          
          return updated;
        });
      }

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

  return {
    transactions, setTransactions,
    accounts, setAccounts,
    balance, setBalance,
    budget, setBudget,
    monthlyBudget, setMonthlyBudget,
    debts, setDebts,
    reminders, setReminders,
    groqKeys, setGroqKeys,
    activeBankAccountId, setActiveBankAccountId,
    activeWallet, setActiveWallet,
    transactionsRef, accountsRef, balanceRef,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
