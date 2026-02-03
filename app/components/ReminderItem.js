
"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Edit2, Trash2 } from 'lucide-react';

export default function ReminderItem({ 
  reminder, 
  onMarkAsPaid, 
  onEdit, 
  onDelete, 
  lang, 
  t 
}) {
  const now = new Date();
  const rDate = new Date(reminder.date);
  const isToday = rDate.toDateString() === now.toDateString();
  const isOverdue = rDate < now;
  
  return (
    <motion.div 
      layout 
      className="glass-card" 
      style={{ 
        padding: '1rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderLeft: isOverdue ? '4px solid #ef4444' : (isToday ? '4px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)')
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '12px', 
          background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : (isToday ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOverdue ? '#ef4444' : (isToday ? '#3b82f6' : 'var(--text-muted)')
        }}>
          <Clock size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: 'white' }}>{reminder.description}</span>
            {isToday && !isOverdue && <span style={{ fontSize: '10px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>{t.upcoming}</span>}
            {isOverdue && <span style={{ fontSize: '10px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>{t.overdue}</span>}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {rDate && !isNaN(rDate) ? `${rDate.toLocaleDateString(lang === 'th' ? "th-TH" : "en-US", { day: 'numeric', month: 'short' })}, ${rDate.toLocaleTimeString(lang === 'th' ? "th-TH" : "en-US", { hour: '2-digit', minute: '2-digit' })}` : '—'} • {reminder?.wallet === 'bank' ? t.bank : t.cash}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, color: 'white' }}>฿{(reminder?.amount || 0).toLocaleString()}</div>
          <button 
            onClick={() => onMarkAsPaid(reminder)}
            style={{ background: 'var(--success)', border: 'none', color: 'white', fontSize: '10px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            {t.paid_already}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button onClick={() => onEdit(reminder)} style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", opacity: 0.6, padding: '4px' }}><Edit2 size={16} /></button>
          <button onClick={() => onDelete(reminder._id || reminder.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", opacity: 0.6, padding: '4px' }}><Trash2 size={16} /></button>
        </div>
      </div>
    </motion.div>
  );
}
