
export const detectLangFromText = (text, fallbackLang = "th") => {
  if (!text) return fallbackLang;
  const en = /[a-zA-Z]/g;
  const th = /[ก-๙]/g;
  const enCount = (text.match(en) || []).length;
  const thCount = (text.match(th) || []).length;
  if (enCount > thCount) return "en";
  if (thCount > enCount) return "th";
  return fallbackLang;
};

export const detectCategory = (text) => {
  if (!text) return "อื่นๆ";
  const lowerText = text.toLowerCase();
  
  const categories = {
    "อาหาร": {
      keywords: ["กิน", "ข้าว", "น้ำ", "กาแฟ", "ขนม", "อาหาร", "มื้อ", "หิว", "สั่ง", "ชา", "ต้ม", "ผัด", "แกง", "ทอด", "ปิ้ง", "ย่าง", "บุฟเฟ่ต์", "หมูกระทะ", "ชาบู", "สุกี้", "ก๋วยเตี๋ยว", "มาม่า", "ส้มตำ", "สเต็ก", "ร้านอาหาร", "คาเฟ่", "เบเกอรี่", "เค้ก", "ไอติม", "นม", "food", "rice", "water", "coffee", "tea", "drink", "snack", "meal", "dinner", "lunch", "breakfast", "cafe", "buffet", "shabu", "suki", "noodle", "steak", "starbucks", "kfc", "mcdonald", "burger", "pizza", "swensen", "bonchon", "mk", "yayoi", "fuji", "zen", "barbq", "amazone", "tao bin", "grabfood", "lineman", "foodpanda"],
      weight: 2
    },
    "เดินทาง": {
      keywords: ["รถ", "น้ำมัน", "แท็กซี่", "วิน", "มา", "ไป", "โบลท์", "กรับ", "ค่ารถ", "เรือ", "เครื่องบิน", "ตั๋ว", "ทางด่วน", "มอเตอร์ไซค์", "เติมน้ำมัน", "จอดรถ", "ขนส่ง", "รถทัวร์", "รถตู้", "รถไฟฟ้า", "บีทีเอส", "เอ็มอาร์ที", "car", "gas", "petrol", "taxi", "motorcycle", "bike", "win", "bts", "mrt", "bus", "train", "flight", "ticket", "toll", "expressway", "parking", "transport", "grab", "bolt", "uber", "muve"],
      weight: 2
    },
    "ที่พัก": {
      keywords: ["ค่าเช่า", "ค่าน้ำ", "ค่าไฟ", "ค่าหอ", "คอนโด", "หอพัก", "บ้าน", "ห้อง", "เน็ต", "อินเทอร์เน็ต", "ส่วนกลาง", "ทำความสะอาด", "rent", "electricity", "water bill", "utility", "pea", "mea", "mwa", "pwa", "condo", "apartment", "dorm", "room", "house", "internet", "wifi", "broadband", "ais fibre", "true online", "3bb", "nt"],
      weight: 3
    },
    "ของใช้": {
      keywords: ["ซื้อ", "ของ", "ของใช้", "ห้าง", "เซเว่น", "ช้อป", "แอป", "ตลาด", "เสื้อผ้า", "ซุปเปอร์", "ไอโฟน", "มือถือ", "คอม", "โน้ตบุ๊ค", "ไอแพด", "อุปกรณ์", "เครื่องเขียน", "กระดาษ", "ทิชชู่", "สบู่", "แชมพู", "ยาสีฟัน", "buy", "shop", "shopping", "mall", "market", "7-11", "seven eleven", "supermarket", "lotus", "big c", "makro", "top", "villa", "watsons", "boots", "shopee", "lazada", "tiktok", "item", "stuff", "clothes", "gadget", "iphone", "samsung", "ipad"],
      weight: 1
    },
    "บันเทิง": {
      keywords: ["เกม", "หนัง", "เที่ยว", "เหล้า", "เบียร์", "ไวน์", "ปาร์ตี้", "คอนเสิร์ต", "ดูหนัง", "ฟังเพลง", "สตรีมมิ่ง", "ดิสนีย์พลัส", "เน็ตฟลิกซ์", "โรงแรม", "รีสอร์ท", "ตั๋วหนัง", "เติมเกม", "game", "movie", "cinema", "netflix", "disney", "youtube", "spotify", "music", "concert", "party", "alcohol", "beer", "wine", "bar", "pub", "club", "karaoke", "holiday", "vacation", "trip", "hotel", "resort", "ticket"],
      weight: 2
    },
    "การเงิน": {
      keywords: ["ภาษี", "ประกัน", "ค่าธรรมเนียม", "ดอกเบี้ย", "หุ้น", "ออมเงิน", "ลงทุน", "เงินกู้", "ผ่อน", "เทรด", "คริปโต", "บัตรเครดิต", "จองหุ้น", "กองทุน", "tax", "fee", "insurance", "invest", "stock", "crypto", "dividend", "interest", "loan", "savings", "debt", "credit card", "installments", "fund", "bonds"],
      weight: 3
    },
    "สุขภาพ": {
      keywords: ["ยา", "หมอ", "โรงพยาบาล", "คลินิก", "ฟิตเนส", "สปา", "นวด", "ตัดผม", "เสริมสวย", "ทำเล็บ", "หาหมอ", "ทำฟัน", "รากฟัน", "ขูดหินปูน", "แว่น", "hospital", "pharmacy", "drugstore", "doctor", "dentist", "medicine", "gym", "fitness", "workout", "spa", "massage", "salon", "haircut", "nail", "beauty", "clinic", "vitamin", "supplement"],
      weight: 3
    },
    "รายได้": {
      keywords: ["เงินเดือน", "โบนัส", "รับเงิน", "กำไร", "รายได้", "ปันผล", "ถูกหวย", "รางวัล", "ค่าจ้าง", "ค่าคอม", "salary", "wage", "bonus", "commission", "profit", "income", "revenue", "earnings", "refund", "cashback", "dividend", "earn", "paycheck", "lotto", "lottery"],
      weight: 4
    }
  };

  let bestCategory = "อื่นๆ";
  let maxScore = 0;

  for (const [cat, data] of Object.entries(categories)) {
    let score = 0;
    data.keywords.forEach(kw => {
      if (lowerText.includes(kw.toLowerCase())) {
        // Avoid false positive: "อย่าง" (kind/like) should not trigger "ย่าง" (grill)
        if (kw === "ย่าง" && lowerText.includes("อย่าง")) return;

        // Longer keywords gain more points to avoid accidental matches on short words (like "ชา")
        score += data.weight + (kw.length > 3 ? 1 : 0);
      }
    });
    
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
};

export const parseThaiNumber = (str) => {
  if (!str) return 0;
  let cleanStr = str.replace(/สามารถ|สัมผัส|สมมติ/g, " ");
  const healedStr = cleanStr.replace(/(\d)\s*,\s*(\d)/g, "$1$2");
  cleanStr = healedStr.replace(/,/g, "").trim();
  if (/^\d+(\.\d+)?$/.test(cleanStr)) return parseFloat(cleanStr);

  const thaiDigits = {
    "ศูนย์": 0, "หนึ่ง": 1, "เอ็ด": 1, "สอง": 2, "ยี่": 2, "สาม": 3,
    "สี่": 4, "ห้า": 5, "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10
  };
  const thaiMults = {
    "ล้าน": 1000000, "แสน": 100000, "หมื่น": 10000, "พัน": 1000, "ร้อย": 100, "สิบ": 10
  };

  let total = 0;
  let remaining = cleanStr;

  for (const [multWord, multValue] of Object.entries(thaiMults)) {
    const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${multWord}`, 'g');
    remaining = remaining.replace(regex, (match, num) => {
      total += parseFloat(num) * multValue;
      return " ";
    });
  }

  let startIdx = 10000;
  [...Object.keys(thaiDigits), ...Object.keys(thaiMults)].forEach(w => {
    const idx = cleanStr.indexOf(w);
    if (idx !== -1 && idx < startIdx) startIdx = idx;
  });
  const numMatch = cleanStr.match(/\d+/);
  if (numMatch && numMatch.index < startIdx) startIdx = numMatch.index;

  if (startIdx === 10000) return 0;

  for (const [multWord, multValue] of Object.entries(thaiMults)) {
    const idx = remaining.indexOf(multWord);
    if (idx !== -1) {
      const isBlocked = ["สามารถ", "สัมผัส", "สมมติ"].some(bw => remaining.includes(bw) && bw.includes(multWord));
      if (isBlocked && multWord === "สาม") continue; 

      const before = remaining.substring(Math.max(0, idx - 10), idx).trim();
      let digitValue = 1;
      let foundDigit = false;
      let lastMatchIdx = -1;
      let matchedWord = "";

      for (const [dw, dv] of Object.entries(thaiDigits)) {
        const dIdx = before.lastIndexOf(dw);
        if (dIdx !== -1 && dIdx > lastMatchIdx) {
          const surrounding = before.substring(Math.max(0, dIdx - 1), dIdx + dw.length + 1);
          if (dw === "สาม" && (surrounding.includes("สามารถ") || surrounding.includes("สม"))) continue;

          lastMatchIdx = dIdx;
          digitValue = dv;
          foundDigit = true;
          matchedWord = dw;
        }
      }

      total += digitValue * multValue;
      remaining = remaining.replace(multWord, " ");
      if (foundDigit) remaining = remaining.replace(matchedWord, " ");
    }
  }

  const leftoverNums = remaining.match(/\d+(\.\d+)?/g);
  if (leftoverNums) {
    leftoverNums.forEach(n => {
      total += parseFloat(n);
      remaining = remaining.replace(n, " ");
    });
  }

  for (const [dw, dv] of Object.entries(thaiDigits)) {
    if (remaining.includes(dw)) {
      const isPartofCan = dw === "สาม" && remaining.includes("สามารถ");
      if (!isPartofCan) {
        total += dv;
        remaining = remaining.replace(dw, " ");
      }
    }
  }

  return total;
};

export const extractDataFromOCRText = (text) => {
  let cleanedText = text.replace(/,/g, ""); 
  const signedMatches = [];
  const signedRegex = /[+\-]\s?(\d+\.\d{2})/g;
  let sMatch;
  while ((sMatch = signedRegex.exec(cleanedText)) !== null) {
    signedMatches.push({ val: parseFloat(sMatch[1]), pos: sMatch.index, priority: 3 });
  }

  cleanedText = cleanedText.replace(/[฿B]\s?(\d)/g, " TXT_AMT $1");
  const ocrTextLower = cleanedText.toLowerCase();

  cleanedText = cleanedText.replace(/\d{2}:\d{2}(:\d{2})?/g, " [TIME] ");
  cleanedText = cleanedText.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, " [DATE] ");
  cleanedText = cleanedText.replace(/\b\d{9,}\b/g, " [LONGNUMBER] ");

  const ignoreKeywords = [
    "ยอดเงินที่ใช้ได้", "available balance", "ยอดเงินคงเหลือ", "คงเหลือ", "เงินในบัญชี",
    "เงินทอน", "ทอนเงิน", "เงินรับ", "รับเงินสด", "change", "cash received", "tendered",
    "เงินทอน/เงินสด"
  ];
  cleanedText = cleanedText.replace(/อ่านแล้ว/g, ""); 
  cleanedText = cleanedText.replace(/Read by/g, "");
  
  const highPriorityKeywords = [
    "โอนเงินสำเร็จ", "เงินเข้า", "รับเงิน", "โอนให้", "ชำระเงินสำเร็จ", "รายการเงินเข้า", "รายการเงินออก",
    "รวมทั้งสิ้น", "ยอดรวมสุทธิ", "ยอดสุทธิ", "สุทธิ", "ยอดชำระ", "จ่ายแล้ว", "รวมเป็นเงิน", "หักบัญชี",
    "ยอดรวม", "บิล", "ใบเสร็จ", "ยอดสุทธิทั้งสิ้น",
    "grand total", "total due", "total amount", "net amount", "paid", "amount paid", "total"
  ];
  
  const secondaryKeywords = [
    "จำนวนเงิน", "ยอดโอน", "ยอดเงิน", "รวมเงิน", "เงินสด", "ชำระเงิน", "ราคา",
    "amount", "subtotal", "price", "cash"
  ];
  
  let candidates = [...signedMatches];
  const allKeywords = [...highPriorityKeywords, ...secondaryKeywords];
  
  allKeywords.forEach(kw => {
    let pos = ocrTextLower.indexOf(kw.toLowerCase());
    while (pos !== -1) {
      const isIgnored = ignoreKeywords.some(ik => ocrTextLower.substring(Math.max(0, pos - 20), pos + 20).includes(ik));
      if (!isIgnored) {
        const windowText = cleanedText.substring(pos, pos + 80);
        const matches = windowText.match(/\d+\.\d{2}\b/g) || windowText.match(/\d+\.\d+\b/g);
        if (matches) {
          const isHigh = highPriorityKeywords.includes(kw);
          matches.forEach(m => {
            candidates.push({ val: parseFloat(m), priority: isHigh ? 2 : 1, pos: pos });
          });
        }
      }
      pos = ocrTextLower.indexOf(kw.toLowerCase(), pos + 1);
    }
  });

  const skipYears = [2023, 2024, 2025, 2026, 2566, 2567, 2568, 2569];
  const validCandidates = candidates.filter(c => 
    c.val > 0 && c.val < 1000000 && !skipYears.includes(c.val) && c.val.toString().length < 9
  );

  let finalAmount = 0;
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.pos - b.pos;
    });
    finalAmount = validCandidates[0].val;
    return { amount: finalAmount, found: true };
  }

  // fallback: Only if no candidates were found at all
  // First, completely remove lines containing ignore keywords to avoid picking up balances
  let fallbackText = cleanedText;
  ignoreKeywords.forEach(ik => {
    const lines = fallbackText.split('\n');
    fallbackText = lines.filter(line => !line.toLowerCase().includes(ik.toLowerCase())).join('\n');
  });

  const allNumbers = fallbackText.match(/\d+(\.\d+)?/g);
  if (allNumbers) {
    const nums = allNumbers.map(n => parseFloat(n)).filter(n => n > 0 && n < 1000000 && !skipYears.includes(n));
    if (nums.length > 0) {
      // Pick the largest number from the remaining text
      return { amount: Math.max(...nums), found: true };
    }
  }

  return { amount: 0, found: false };
};

export const getLocalAIInsight = (transactions, balance, budget, lang, t) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTx = transactions.filter(t => new Date(t.date) >= today);
  const todayExpenses = todayTx.filter(t => t.type === 'expense');
  const todayIncome = todayTx.filter(t => t.type === 'income');

  const totalSpent = todayExpenses.reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = todayIncome.reduce((acc, t) => acc + t.amount, 0);
  const net = totalIncome - totalSpent;

  const categoryTotals = todayExpenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (totalSpent === 0 && totalIncome === 0) return t.local_insight_zero;

  const budgetLeft = budget - totalSpent;
  const budgetText = budgetLeft >= 0
    ? (lang === 'th' ? `งบวันนี้เหลือ ฿${budgetLeft.toLocaleString()} ค่ะ` : `Daily budget left: ฿${budgetLeft.toLocaleString()}`)
    : (lang === 'th' ? `เกินงบวันนี้ ฿${Math.abs(budgetLeft).toLocaleString()} ค่ะ` : `Over daily budget by ฿${Math.abs(budgetLeft).toLocaleString()}`);

  const topCatText = topCategories.length > 0
    ? (lang === 'th'
        ? `หมวดที่ใช้เยอะสุด: ${topCategories.map(([c, v]) => `${c} ฿${v.toLocaleString()}`).join(', ')}`
        : `Top spend categories: ${topCategories.map(([c, v]) => `${c} ฿${v.toLocaleString()}`).join(', ')}`)
    : (lang === 'th' ? 'วันนี้ยังไม่มีหมวดรายจ่ายเด่นค่ะ' : 'No top expense categories today');

  const totalText = lang === 'th'
    ? `วันนี้ใช้ไป ฿${totalSpent.toLocaleString()} รายรับ ฿${totalIncome.toLocaleString()} ยอดสุทธิ ฿${net.toLocaleString()} ค่ะ`
    : `Today: Spent ฿${totalSpent.toLocaleString()}, Income ฿${totalIncome.toLocaleString()}, Net ฿${net.toLocaleString()}`;

  const balanceText = lang === 'th'
    ? `เงินคงเหลือ: ธนาคาร ฿${(balance.bank || 0).toLocaleString()} เงินสด ฿${(balance.cash || 0).toLocaleString()} รวม ฿${((balance.bank || 0) + (balance.cash || 0)).toLocaleString()} ค่ะ`
    : `Balance: Bank ฿${(balance.bank || 0).toLocaleString()}, Cash ฿${(balance.cash || 0).toLocaleString()}, Total ฿${((balance.bank || 0) + (balance.cash || 0)).toLocaleString()}`;

  const tip = totalSpent > budget * 0.8
    ? (lang === 'th' ? 'แนะนำลดค่าใช้จ่ายในหมวดที่สูงสุดลงอีกนิดนะคะ 💖' : 'Try trimming the top category a bit today 💖')
    : (lang === 'th' ? 'วันนี้คุมงบได้ดีมากเลยค่ะ ✨' : 'Great job staying on budget today ✨');

  return `${totalText}\n${topCatText}\n${budgetText}\n${balanceText}\n${tip}`;
};
