
"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, Edit2, Trash2 } from 'lucide-react';

export default function DebtItem({ debt, onToggle, onDelete, onEdit, lang, t }) {
  return (
    <motion.div 
      layout 
      className="glass-card" 
      style={{ 
        padding: '1rem', 
        border: debt.status === 'paid' ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${debt.type === 'borrow' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
        opacity: debt.status === 'paid' ? 0.6 : 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '12px', 
          background: debt.type === 'borrow' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)'
        }}>
          {debt.type === 'borrow' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: 'white' }}>{debt.person}</span>
            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: debt.status === 'paid' ? 'rgba(255,255,255,0.1)' : (debt.type === 'borrow' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'), color: debt.status === 'paid' ? 'white' : (debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)') }}>
              {debt.status === 'paid' ? t.status_paid : (debt.type === 'borrow' ? t.borrow : t.lend)}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(debt.date).toLocaleDateString(lang === 'th' ? "th-TH" : "en-US", { day: 'numeric', month: 'short' })} • {debt.note || (lang === 'th' ? 'ไม่มีบันทึก' : 'No note')}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, color: debt.status === 'paid' ? 'white' : (debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)') }}>฿{debt.amount.toLocaleString()}</div>
          <button 
            onClick={onToggle}
            style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {debt.status === 'paid' ? (lang === 'th' ? 'คืนค่า' : 'Re-activate') : (lang === 'th' ? 'คืนแล้ว' : 'Mark as Paid')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', opacity: 0.6, cursor: 'pointer', padding: '4px' }}>
            <Edit2 size={16} />
          </button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--danger)', opacity: 0.5, cursor: 'pointer', padding: '4px' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
