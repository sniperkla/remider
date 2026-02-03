
import React from 'react';
import {
  Utensils, Car, ShoppingBag, Gamepad2, Home as HomeIcon, 
  HeartPulse, Tags, ArrowRightLeft, CreditCard, TrendingUp,
  DollarSign, Zap, Fuel, Shirt, Smartphone
} from "lucide-react";

export const CATEGORY_COLORS = {
  "อาหาร": "#f59e0b",
  "เดินทาง": "#3b82f6",
  "ของใช้": "#ec4899",
  "บันเทิง": "#8b5cf6",
  "ที่พัก": "#6366f1",
  "การเงิน": "#10b981",
  "สุขภาพ": "#ef4444",
  "รายได้": "#06b6d4",
  "เงินโอน": "#6366f1",
  "อื่นๆ": "#64748b"
};

export const CATEGORY_ICONS = {
  "อาหาร": <Utensils size={14} />,
  "เดินทาง": <Car size={14} />,
  "ของใช้": <ShoppingBag size={14} />,
  "บันเทิง": <Gamepad2 size={14} />,
  "ที่พัก": <HomeIcon size={14} />,
  "การเงิน": <CreditCard size={14} />,
  "สุขภาพ": <HeartPulse size={14} />,
  "รายได้": <TrendingUp size={14} />,
  "เงินโอน": <ArrowRightLeft size={14} />,
  "อื่นๆ": <Tags size={14} />
};

export const DYNAMIC_ICONS = {
  Utensils, Car, ShoppingBag, Gamepad2, HomeIcon, 
  HeartPulse, Tags, ArrowRightLeft, CreditCard, TrendingUp,
  DollarSign, Zap, Fuel, Shirt, Smartphone,
};
