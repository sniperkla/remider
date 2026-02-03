import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import Groq from "groq-sdk";
import dbConnect from "@/lib/mongodb";
import SystemSetting from "@/models/SystemSetting";

async function getGroqClient() {
  await dbConnect();
  let setting = await SystemSetting.findOne({ key: "global_config" });
  
  if (!setting || !setting.groqKeys || setting.groqKeys.length === 0) {
    const envKey = process.env.GROQ_API_KEY?.trim();
    if (!envKey) return null;
    
    if (!setting) {
      setting = await SystemSetting.create({ key: "global_config", groqKeys: [envKey] });
    } else {
      setting.groqKeys = [envKey];
      await setting.save();
    }
  }

  const keys = setting.groqKeys;
  let attempts = 0;
  
  // Check if we need to reset key index (new day = recycle to key 0)
  const now = new Date();
  const lastRotation = setting.lastKeyRotation ? new Date(setting.lastKeyRotation) : new Date(0);
  const isNewDay = now.toDateString() !== lastRotation.toDateString();
  
  if (isNewDay) {
    setting.activeKeyIndex = 0;
    setting.lastKeyRotation = now;
    await setting.save();
    console.log(`[Groq Analyze] New day detected, recycling to key index 0`);
  }
  
  return {
    async createCompletion(params) {
      let lastError;
      const startIndex = setting.activeKeyIndex || 0;
      
      while (attempts < keys.length) {
        const index = (startIndex + attempts) % keys.length;
        const currentKey = keys[index];
        const groq = new Groq({ apiKey: currentKey });
        try {
          const completion = await groq.chat.completions.create(params);
          
          // Always rotate to next key for next request (round-robin)
          const nextIndex = (index + 1) % keys.length;
          setting.activeKeyIndex = nextIndex;
          setting.lastKeyRotation = new Date();
          await setting.save();
          
          console.log(`[Groq Analyze] Success with key ${index}, next request will use key ${nextIndex}`);
          return completion;
        } catch (err) {
          console.error(`[Groq Analyze] Key ${index} failed:`, err.message);
          lastError = err;
          attempts++;
          
          if (attempts < keys.length) {
            console.log(`[Groq Analyze] Trying next key...`);
          }
        }
      }
      
      // All keys failed, reset to 0 for next attempt
      setting.activeKeyIndex = 0;
      await setting.save();
      console.error(`[Groq Analyze] All ${keys.length} keys failed, resetting to index 0`);
      
      throw lastError || new Error("All Groq keys failed");
    }
  };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transactions, budget, monthlyBudget, balance, lang = "th", aiModel = "llama-3.3-70b-versatile" } = await request.json();
    const isEn = lang === "en";
    
    // Check for Groq API Key Pool
    const groqClient = await getGroqClient();
    if (!groqClient) {
      return NextResponse.json({ 
        insight: isEn 
          ? "I can't generate the report yet! Please make sure to add GROQ_API_KEY to .env.local for me 🎀✨"
          : "น้องเรมี่ทำรายงานไม่ได้ค่ะ พี่เจ้าของเครื่องอย่าลืมเพิ่ม GROQ_API_KEY ให้เรมี่หน่อยนะคะ 🎀✨" 
      });
    }

    const prompt = isEn ? `
      You are a cute, friendly, and smart personal financial assistant named "Nong Remi".
      Current Data:
      - Daily Budget: ฿${budget}
      - Monthly Budget: ฿${monthlyBudget}
      - Current Balance: Bank ฿${balance.bank}, Cash ฿${balance.cash}
      - Today's Transactions: ${JSON.stringify(transactions)}

      Mission (give MORE detail but still short):
      1. Summarize today's spending: total spent, total income, and net.
      2. Highlight top 2-3 categories by spending amount.
      3. Tell how much daily budget remains (or exceeded).
      4. Predict end-of-month balance if this pace continues.
      5. Give 1–2 specific actionable tips based on categories.
      6. Respond in English with a polite and charming tone.
      7. Use cute Emojis in every sentence (e.g., 🎀, ✨, 💖, 🍭, 💸).
      8. Keep it concise, 5–7 sentences max.
    ` : `
      คุณเป็นผู้ช่วยวิเคราะห์การเงินส่วนบุคคลชื่อ "น้องเรมี่" (Nong Remi) ที่มีความน่ารัก เป็นกันเอง และชาญฉลาดมาก
      ข้อมูลปัจจุบัน:
      - งบประมาณรายวัน: ฿${budget}
      - งบประมาณรายเดือน: ฿${monthlyBudget}
      - ยอดเงินคงเหลือ: ธนาคาร ฿${balance.bank}, เงินสด ฿${balance.cash}
      - รายการธุรกรรมวันนี้: ${JSON.stringify(transactions)}

      ภารกิจ (ขอรายละเอียดมากขึ้นแต่ยังอ่านง่าย):
      1. สรุปการใช้จ่ายวันนี้: ยอดใช้จ่ายรวม รายรับรวม และยอดสุทธิ
      2. บอกหมวดที่ใช้จ่ายสูงสุด 2–3 อันดับ
      3. บอกงบรายวันที่เหลือ (หรือเกินงบเท่าไหร่)
      4. คาดการณ์ยอดเงินสิ้นเดือนถ้าใช้จ่ายแบบนี้ต่อเนื่อง
      5. ให้คำแนะนำที่ทำได้จริง 1–2 ข้อจากหมวดที่ใช้จ่ายสูง
      6. ตอบเป็นภาษาไทยสุภาพน่ารัก (ลงท้าย "ค่ะ/นะคะ" และแทนตัวเองว่า "เรมี่" หรือ "หนู")
      7. ใส่ Emoji น่ารักทุกประโยค (เช่น 🎀✨💖🍭💸)
      8. กระชับแต่รายละเอียดชัดเจน ไม่เกิน 5–7 ประโยค
    `;

    try {
      console.log(`🚀 Captain AI switching to Groq (LLaMA 3) [Lang: ${lang}]...`);
      const completion = await groqClient.createCompletion({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: aiModel, // Using selected model
        temperature: 0.3,
        max_tokens: 300,
      });

      const text = completion.choices[0]?.message?.content || "";
      console.log(`✅ Groq Success!`);
      return NextResponse.json({ insight: text });

    } catch (err) {
      console.error("Groq API Error:", err);
      
      // Local Fallback if Groq fails
      const todayTotal = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      let localInsight = "";
      
      if (isEn) {
        if (todayTotal === 0) localInsight = "No expenses today! Remi is so impressed! 🎀✨";
        else if (todayTotal > budget) localInsight = `You've spent ฿${(todayTotal - budget).toLocaleString()} over budget today! 💸😅`;
        else localInsight = `You've spent ฿${todayTotal.toLocaleString()} and are still within budget! Great job! 🌟💖`;
        
        return NextResponse.json({ 
          insight: `${localInsight} (Note: Using backup brain due to issues with Groq API: ${err.message})` 
        });
      }

      if (todayTotal === 0) localInsight = "วันนี้ยังไม่มีค่าใช้จ่ายเลยค่ะ เรมี่ประทับใจมากเลย! 🎀✨";
      else if (todayTotal > budget) localInsight = `วันนี้ใช้เกินงบไป ฿${(todayTotal - budget).toLocaleString()} แล้วนะคะ! 💸😅`;
      else localInsight = `วันนี้ใช้ไป ฿${todayTotal.toLocaleString()} ยังอยู่ในงบค่ะ ทำได้ดีมากเลย! 🌟💖`;
      
      return NextResponse.json({ 
        insight: `${localInsight} (หมายเหตุ: ระบบกำลังใช้สมองกลสำรอง เนื่องจาก Groq API ติดปัญหา: ${err.message})` 
      });
    }
  } catch (error) {
    console.error("General AI Error:", error);
    return NextResponse.json({ error: "AI Analysis failed" }, { status: 500 });
  }
}
