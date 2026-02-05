  
"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, Edit2, Trash2, Tag, Briefcase, Home, Users, Heart, Star, Coffee, Utensils, ShoppingBag, Car } from 'lucide-react';

export default function DebtItem({ debt, onToggle, onDelete, onEdit, lang, t, presetTags = [] }) {
  // Parse Tag from Note: "[Work] Lunch" -> tag: "Work", note: "Lunch"
  let displayNote = debt.note || (lang === 'th' ? 'ไม่มีบันทึก' : 'No note');
  let tag = null;
  const tagMatch = displayNote.match(/^\[(.*?)\]/);
  
  if (tagMatch) {
    const tagName = tagMatch[1];
    tag = presetTags.find(t => t.name === tagName);
    // If not found in presets but exists in brackets, treat as temp tag
    if (!tag) tag = { name: tagName, color: '#64748b', icon: 'Tag' };
    
    // Remove tag from note display
    displayNote = displayNote.replace(tagMatch[0], '').trim();
    // If note became empty, keep it empty. logic below handles display.
  }
  
  const getIcon = (iconName, size, color) => {
      const iconMap = { 'Tag': Tag, 'Briefcase': Briefcase, 'Home': Home, 'Users': Users, 'Heart': Heart, 'Star': Star, 'Coffee': Coffee, 'Utensils': Utensils, 'ShoppingBag': ShoppingBag, 'Car': Car };
      const Icon = iconMap[iconName] || Tag;
      return <Icon size={size} color={color} />;
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '12px', 
          background: debt.type === 'borrow' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)',
          flexShrink: 0
        }}>
          {debt.type === 'borrow' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'white', wordBreak: 'break-word', fontSize: '14px' }}>{debt.person}</span>
            <span style={{ 
              fontSize: '10px', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              background: debt.status === 'paid' ? 'rgba(255,255,255,0.1)' : (debt.type === 'borrow' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'), 
              color: debt.status === 'paid' ? 'white' : (debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)'),
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {debt.status === 'paid' ? t.status_paid : (debt.type === 'borrow' ? t.borrow : t.lend)}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
             <span style={{ flexShrink: 0 }}>{new Date(debt.date).toLocaleDateString(lang === 'th' ? "th-TH" : "en-US", { day: 'numeric', month: 'short' })}</span>
             <span style={{ opacity: 0.5 }}>•</span>
             {tag && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `${tag.color}20`, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${tag.color}40`, maxWidth: '100%' }}>
                 {getIcon(tag.icon, 10, tag.color)}
                 <span style={{ color: tag.color, fontWeight: 600, fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
               </div>
             )}
             {!tag && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayNote}</span>}
             {tag && displayNote !== tag.name && <span style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayNote}</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '8px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, color: debt.status === 'paid' ? 'white' : (debt.type === 'borrow' ? 'var(--danger)' : 'var(--success)'), fontSize: '15px' }}>฿{debt.amount.toLocaleString()}</div>
          <button 
            onClick={onToggle}
            style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
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
