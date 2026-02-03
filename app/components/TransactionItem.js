
"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowUpCircle, ArrowDownCircle, 
  Banknote, CreditCard, Tags,
  Edit2, Trash2, Scan, Image
} from 'lucide-react';
import { BANK_DATA } from '@/lib/bankUtils';
import { CATEGORY_COLORS, CATEGORY_ICONS, DYNAMIC_ICONS } from '@/app/constants';

export default function TransactionItem({
  txn,
  isHighlighted,
  expandedTransactionId,
  setExpandedTransactionId,
  lang,
  t,
  isMobile,
  accounts,
  onEdit,
  onDelete,
  onViewImage
}) {
  return (
    <motion.div 
      key={txn._id || txn.id}
      data-txn-id={txn._id || txn.id}
      layout 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isHighlighted ? [1, 1.02, 1] : 1,
        boxShadow: isHighlighted ? '0 0 20px rgba(168, 85, 247, 0.5)' : 'none'
      }} 
      transition={isHighlighted ? { scale: { repeat: Infinity, duration: 1 } } : {}}
      exit={{ opacity: 0, x: 20 }} 
      className="transaction-item" 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        gap: "0.5rem",
        ...(isHighlighted ? {
          border: '2px solid #a855f7',
          background: 'rgba(168, 85, 247, 0.15)',
          borderRadius: '16px',
          position: 'relative',
          zIndex: 100
        } : {})
      }}
    >
      {/* Tutorial highlight badge */}
      {isHighlighted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '10px',
            whiteSpace: 'nowrap',
            zIndex: 101
          }}
        >
          ✨ {lang === 'th' ? 'ผลลัพธ์ Tutorial' : 'Tutorial Result'} ✨
        </motion.div>
      )}

      {/* Left Icon */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0 }}>
        <div style={{ padding: "10px", borderRadius: "12px", background: txn.type === "income" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: txn.type === "income" ? "var(--success)" : "var(--danger)", flexShrink: 0 }}>
          {txn.type === "income" ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Description */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', marginBottom: '4px', minWidth: 0 }}>
            <button
              onClick={() => setExpandedTransactionId(expandedTransactionId === (txn._id || txn.id) ? null : (txn._id || txn.id))}
              style={{
                fontWeight: "600", 
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                minWidth: 0,
                maxWidth: expandedTransactionId === (txn._id || txn.id) ? '100%' : 'auto',
                whiteSpace: expandedTransactionId === (txn._id || txn.id) ? 'normal' : 'nowrap',
                overflow: 'hidden',
                textOverflow: expandedTransactionId === (txn._id || txn.id) ? 'clip' : 'ellipsis',
                wordBreak: expandedTransactionId === (txn._id || txn.id) ? 'break-word' : 'normal'
              }}
            >
              {txn.description}
            </button>
            {txn.description.length > 35 && expandedTransactionId !== (txn._id || txn.id) && (
              <span style={{ fontSize: '12px', color: 'var(--accent-blue)', flexShrink: 0 }}>▶</span>
            )}
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>-</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {new Date(txn.date).toLocaleString(lang === 'th' ? "th-TH" : "en-US", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
             {/* Category Badge */}
             <span style={{ 
               fontSize: '9px', 
               background: `${CATEGORY_COLORS[txn.category] || '#64748b'}20`, 
               color: CATEGORY_COLORS[txn.category] || '#64748b',
               padding: '2px 6px', 
               borderRadius: '6px',
               fontWeight: '600',
               border: `1px solid ${CATEGORY_COLORS[txn.category] || '#64748b'}30`,
               display: 'flex',
               alignItems: 'center',
               gap: '3px',
               flexShrink: 0
             }}>
                {(txn.icon && DYNAMIC_ICONS[txn.icon]) ? React.createElement(DYNAMIC_ICONS[txn.icon], { size: 10 }) : (CATEGORY_ICONS[txn.category] || <Tags size={10} />)}
                {!isMobile && (t.categories[txn.category] || txn.category)}
             </span>
             
             {/* Payment Method Tag */}
             <span style={{ 
               fontSize: '9px', 
               background: txn.wallet === 'cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
               color: txn.wallet === 'cash' ? '#10b981' : '#3b82f6',
               padding: '2px 6px', 
               borderRadius: '6px',
               fontWeight: '700',
               border: `1px solid ${txn.wallet === 'cash' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
               display: 'flex',
               alignItems: 'center',
               gap: '3px',
               flexShrink: 0
             }}>
               {txn.wallet === 'cash' ? <Banknote size={10} /> : <CreditCard size={10} />}
               {txn.wallet === 'cash' 
                 ? (lang === 'th' ? 'เงินสด' : 'Cash') 
                 : (
                   (() => {
                     // Bank Logo Logic
                     const acc = accounts.find(a => String(a.id) === String(txn.accountId));
                     const bankCode = acc?.bankCode || txn.bankCode;
                     const bankMeta = bankCode && BANK_DATA[bankCode.toLowerCase()];
                     const logoUrl = bankMeta?.logo;
                     const displayName = acc 
                       ? ((acc.bankCode && acc.bankCode !== 'other') ? acc.bankCode.toUpperCase() : acc.name)
                       : (txn.bank || (lang === 'th' ? 'ธนาคาร' : 'Bank'));
                     
                     return (
                       <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                         {logoUrl ? <img src={logoUrl} alt={displayName} style={{ width: '12px', height: '12px', objectFit: 'contain', borderRadius: '50%' }} /> : <span>💳</span>}
                         {displayName}
                       </span>
                     );
                   })()
                 )
               }
             </span>

             {/* Scanned Badge */}
             {txn.isScanned && (
               <span style={{ 
                 fontSize: '10px', 
                 background: 'rgba(139, 92, 246, 0.15)', 
                 color: '#8b5cf6', 
                 padding: isMobile ? '2px 6px' : '2px 8px', 
                 borderRadius: '6px',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '3px',
                 border: '1px solid rgba(139, 92, 246, 0.3)',
                 flexShrink: 0
               }}>
                 📄 OCR
               </span>
             )}
             {txn.imageUrl && (
               <button
                 onClick={() => onViewImage(txn.imageUrl)}
                 style={{
                   fontSize: '10px',
                   background: 'none',
                   color: '#60a5fa',
                   padding: isMobile ? '2px 6px' : '2px 8px',
                   borderRadius: '6px',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '3px',
                   border: '1px solid rgba(59, 130, 246, 0.2)',
                   cursor: 'pointer',
                   textDecoration: 'none',
                   flexShrink: 0
                 }}
               >
                 <Image size={10} /> {lang === 'th' ? "ดูรูป" : "View image"}
               </button>
             )}
          </div>
        </div>
      </div>

       <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
         <div style={{ 
           fontWeight: "800", 
           fontSize: isMobile ? '0.95rem' : '1.1rem',
           color: txn.type === "income" ? "var(--success)" : "var(--danger)",
           minWidth: isMobile ? '60px' : 'auto',
           textAlign: 'right',
           whiteSpace: 'nowrap'
         }}>
           {txn.type === "income" ? "+" : "-"} {txn.amount.toLocaleString()}
         </div>
         <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => onEdit(txn)} style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", opacity: 0.6, padding: '4px' }}><Edit2 size={16} /></button>
            <button onClick={() => onDelete(txn._id || txn.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", opacity: 0.6, padding: '4px' }}><Trash2 size={16} /></button>
         </div>
       </div>

    </motion.div>
  );
}
