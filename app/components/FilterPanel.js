
"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Filter, Banknote, CreditCard, Calendar } from 'lucide-react';
import { BANK_DATA } from '@/lib/bankUtils';

export default function FilterPanel({
  filteredAccountId, setFilteredAccountId,
  filteredWalletType, setFilteredWalletType,
  filteredTimeRange, setFilteredTimeRange,
  filteredCustomRange, setFilteredCustomRange,
  accounts, transactions,
  lang, t,
  showBankReport, setShowBankReport, // Optional if needed
  presetTags = [], filterTag = "", setFilterTag, getIconComponent
}) {
  
  // Calculate Summary Data based on current filters
  const filtered = (transactions || []).filter(t => {
    const matchesAccount = !filteredAccountId || String(t.accountId) === String(filteredAccountId);
    if (!matchesAccount) return false;

    const matchesWallet = !filteredWalletType || t.wallet === filteredWalletType;
    if (!matchesWallet) return false;

    const matchesTag = !filterTag || t.category === filterTag;
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
  });

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpense;

  // Render Logic
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '12px',
        padding: '16px', 
        background: 'rgba(30, 41, 59, 0.7)', 
        borderRadius: '24px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        marginBottom: '1.5rem',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={14} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
            {filteredAccountId 
              ? `${lang === 'th' ? 'กำลังดู:' : 'Viewing:'} ${accounts.find(a => a.id === filteredAccountId)?.name || 'ธนาคาร'}`
              : filteredWalletType === 'cash'
                ? `${lang === 'th' ? 'กำลังดู:' : 'Viewing:'} ${t.cash}`
                : filterTag
                  ? `${lang === 'th' ? 'แท็ก:' : 'Tag:'} ${filterTag}`
                  : (lang === 'th' ? 'ตัวกรองรายการ' : 'Transaction Filter')}
          </span>
        </div>
        <button 
          onClick={() => { 
            setFilteredAccountId(null); 
            setFilteredWalletType(null); 
            setFilteredTimeRange("all"); 
            setFilterTag && setFilterTag("");
          }}
          style={{ 
            padding: '6px 12px', 
            borderRadius: '10px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#ef4444', 
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {lang === 'th' ? 'ล้างการกรอง' : 'Clear Filter'}
        </button>
      </div>

      {/* Wallet / Bank Selection */}
      {!filteredAccountId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setFilteredWalletType(filteredWalletType === 'cash' ? null : 'cash'); setFilteredAccountId(null); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: `1px solid ${filteredWalletType === 'cash' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                background: filteredWalletType === 'cash' ? '#10b981' : 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: filteredWalletType === 'cash' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              <Banknote size={14} /> {t.cash}
            </button>
            <button
              onClick={() => { setFilteredWalletType(filteredWalletType === 'bank' ? null : 'bank'); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                border: `1px solid ${filteredWalletType === 'bank' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                background: filteredWalletType === 'bank' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: filteredWalletType === 'bank' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
              }}
            >
              <CreditCard size={14} /> {lang === 'th' ? 'ธนาคารรวม' : 'All Banks'}
            </button>
          </div>
          
          {/* Individual Bank List (Shown when 'bank' is selected or active) */}
          {filteredWalletType === 'bank' && accounts.filter(a => a.type === 'bank').length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ 
                display: 'flex', 
                gap: '6px', 
                overflowX: 'auto', 
                padding: '4px 0',
                marginTop: '4px' 
              }} 
              className="no-scrollbar"
            >
              {accounts.filter(a => a.type === 'bank').map(acc => {
                const bankMeta = acc.bankCode && BANK_DATA[acc.bankCode.toLowerCase()];
                return (
                  <button
                    key={acc.id}
                    onClick={() => { setFilteredAccountId(acc.id); setFilteredWalletType(null); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {bankMeta?.logo && (
                      <img src={bankMeta.logo} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white' }} />
                    )}
                    {acc.name}
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>
      ) : (
        /* If a specific bank is already selected, show option to switch to other banks */
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
           <button
              onClick={() => { setFilteredAccountId(null); setFilteredWalletType('bank'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              ← {lang === 'th' ? 'ธนาคารอื่นๆ' : 'Other Banks'}
            </button>
            {accounts.filter(a => a.type === 'bank' && a.id !== filteredAccountId).map(acc => {
              const bankMeta = acc.bankCode && BANK_DATA[acc.bankCode.toLowerCase()];
              return (
                <button
                  key={acc.id}
                  onClick={() => setFilteredAccountId(acc.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {bankMeta?.logo && (
                    <img src={bankMeta.logo} alt="" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'white' }} />
                  )}
                  {acc.name}
                </button>
              );
            })}
        </div>
      )}

      {/* Tag Chips */}
      {presetTags && presetTags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
          {presetTags.map(tag => (
            <button
              key={tag.name}
              onClick={() => setFilterTag(filterTag === tag.name ? "" : tag.name)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: '12px',
                background: filterTag === tag.name ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                border: '1px solid',
                borderColor: filterTag === tag.name ? tag.color : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {getIconComponent && getIconComponent(tag.icon, 12, filterTag === tag.name ? 'white' : tag.color)}
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Time Range Buttons */}
      {(() => {
        const activeColor = filteredAccountId 
          ? (accounts.find(a => a.id === filteredAccountId)?.color || '#3b82f6')
          : filteredWalletType === 'cash' 
            ? '#10b981' 
            : '#3b82f6';

        return (
          <div 
            style={{ 
              display: 'flex', 
              gap: '4px', 
              overflowX: 'auto', 
              padding: '4px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }} 
            className="no-scrollbar"
          >
            {[
              { label: lang === 'th' ? 'ทั้งหมด' : 'All', value: 'all' },
              { label: lang === 'th' ? 'วันนี้' : 'Today', value: '1d' },
              { label: lang === 'th' ? '7 วัน' : '7 Days', value: '7d' },
              { label: lang === 'th' ? '30 วัน' : '30 Days', value: '1m' },
              { label: lang === 'th' ? 'ระบุวัน' : 'Custom', value: 'custom', icon: <Calendar size={12} /> }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setFilteredTimeRange(range.value)}
                style={{
                  flex: '1 0 auto',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: filteredTimeRange === range.value ? activeColor : 'transparent',
                  color: filteredTimeRange === range.value ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: filteredTimeRange === range.value ? `0 4px 20px ${activeColor}60` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {range.icon}
                {range.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Custom Range Picker */}
      {filteredTimeRange === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '4px',
            marginTop: '4px'
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="date" 
              value={filteredCustomRange.start}
              onChange={(e) => setFilteredCustomRange(prev => ({ ...prev, start: e.target.value }))}
              style={{ 
                width: '100%', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '10px', 
                color: 'white', 
                padding: '8px 10px', 
                fontSize: '12px',
                colorScheme: 'dark',
                textAlign: 'center'
              }} 
            />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>to</div>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="date" 
              value={filteredCustomRange.end}
              onChange={(e) => setFilteredCustomRange(prev => ({ ...prev, end: e.target.value }))}
              style={{ 
                width: '100%', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '10px', 
                color: 'white', 
                padding: '8px 10px', 
                fontSize: '12px',
                colorScheme: 'dark',
                textAlign: 'center'
              }} 
            />
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        background: 'rgba(255,255,255,0.02)', 
        padding: '14px', 
        borderRadius: '20px',
        border: `1px solid ${filteredAccountId ? (accounts.find(a => a.id === filteredAccountId)?.color + '40') : (filteredWalletType === 'cash' ? '#10b98140' : 'rgba(255,255,255,0.05)')}`,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            {filterTag && (filterTag.includes('ยืม') || filterTag.includes('คืน') || filterTag.toLowerCase().includes('borrow') || filterTag.toLowerCase().includes('lend')) 
              ? (lang === 'th' ? 'ได้รับ/รับคืน' : 'Received') 
              : t.income}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>฿{totalIncome.toLocaleString()}</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }}></div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            {filterTag && (filterTag.includes('ยืม') || filterTag.includes('คืน') || filterTag.toLowerCase().includes('borrow') || filterTag.toLowerCase().includes('lend'))
              ? (lang === 'th' ? 'ให้ไป/จ่ายคืน' : 'Given/Paid') 
              : t.expense}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>฿{totalExpense.toLocaleString()}</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }}></div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
             {filterTag && (filterTag.includes('ยืม') || filterTag.includes('คืน') || filterTag.toLowerCase().includes('borrow') || filterTag.toLowerCase().includes('lend'))
               ? (lang === 'th' ? 'ยอดสุทธิ' : 'Balance') 
               : (lang === 'th' ? 'คงเหลือ' : 'Net')}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: net >= 0 ? '#3b82f6' : '#f59e0b' }}>฿{net.toLocaleString()}</div>
        </div>
      </div>

    </motion.div>
  );
}
