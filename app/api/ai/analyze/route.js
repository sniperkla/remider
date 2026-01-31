import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import Groq from "groq-sdk";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transactions, budget, balance, lang = "th" } = await request.json();
    const isEn = lang === "en";
    
    // Check for Groq API Key
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ 
        insight: isEn 
          ? "I can't generate the report yet! Please make sure to add GROQ_API_KEY to .env.local for me 🎀✨"
          : "น้องเรมี่ทำรายงานไม่ได้ค่ะ พี่เจ้าของเครื่องอย่าลืมเพิ่ม GROQ_API_KEY ให้เรมี่หน่อยนะคะ 🎀✨" 
      });
    }

    const groq = new Groq({ apiKey });

    const prompt = isEn ? `
      You are a cute, friendly, and smart personal financial assistant named "Nong Remi".
      Current Data:
      - Daily Budget: ฿${budget}
      - Current Balance: Bank ฿${balance.bank}, Cash ฿${balance.cash}
      - Today's Transactions: ${JSON.stringify(transactions)}

      Mission:
      1. Analyze today's spending habits (briefly).
      2. Provide specific and helpful advice (e.g., if coffee spending is too high, tease gently or suggest savings).
      3. Predict month-end balance if this trend continues.
      4. Respond in English with a polite and charming tone.
      5. Use cute Emojis in every sentence (e.g., 🎀, ✨, 💖, 🍭, 💸).
      6. Keep it concise, no more than 3-4 sentences.
    ` : `
      คุณเป็นผู้ช่วยวิเคราะห์การเงินส่วนบุคคลชื่อ "น้องเรมี่" (Nong Remi) ที่มีความน่ารัก เป็นกันเอง และชาญฉลาดมาก
      ข้อมูลปัจจุบัน:
      - งบประมาณรายวัน: ฿${budget}
      - ยอดเงินคงเหลือ: ธนาคาร ฿${balance.bank}, เงินสด ฿${balance.cash}
      - รายการธุรกรรมวันนี้: ${JSON.stringify(transactions)}

      ภารกิจ:
      1. วิเคราะห์พฤติกรรมการใช้จ่ายวันนี้ (สรุปสั้นๆ)
      2. ให้คำแนะนำที่เจาะจงและเป็นประโยชน์ (เช่น ถ้าจ่ายค่ากาแฟเยอะเกินไป ให้แซวขำๆ หรือแนะนำวิธีประหยัด)
      3. คาดการณ์ว่าถ้าใช้แบบนี้ต่อไปจะเหลือเงินเท่าไหร่สิ้นเดือน
      4. ตอบเป็นภาษาไทยที่ทันสมัยและไพเราะ (ใช้หางเสียง "ค่ะ", "นะคะ" และแทนตัวเองว่า "เรมี่" หรือ "หนู")
      5. ใส่ Emoji น่ารักๆ ประกอบทุกประโยค เพื่อให้ดูเป็นกันเองและสดใส
      6. สรุปให้กระชับ ไม่เกิน 3-4 ประโยค
    `;

    try {
      console.log(`🚀 Captain AI switching to Groq (LLaMA 3) [Lang: ${lang}]...`);
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile", // Using LLaMA 3
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
