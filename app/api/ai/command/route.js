import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import Groq from "groq-sdk";
import dbConnect from "@/lib/mongodb";
import SystemSetting from "@/models/SystemSetting";

async function getGroqClient() {
  await dbConnect();
  let setting = await SystemSetting.findOne({ key: "global_config" });
  
  // Initialize with env key if empty
  if (!setting || !setting.groqKeys || setting.groqKeys.length === 0) {
    const envKey = process.env.GROQ_API_KEY?.trim();
    if (!envKey) return null;
    
    if (!setting) {
      setting = await SystemSetting.create({ 
        key: "global_config", 
        groqKeys: [envKey] 
      });
    } else {
      setting.groqKeys = [envKey];
      await setting.save();
    }
  }

  const keys = setting.groqKeys;
  let attempts = 0;
  
  // We'll return a function that performs the completion and handles rotation internally
  return {
    async createCompletion(params) {
      let lastError;
      
      while (attempts < keys.length) {
        const index = (setting.activeKeyIndex + attempts) % keys.length;
        const currentKey = keys[index];
        const groq = new Groq({ apiKey: currentKey });
        
        try {
          const completion = await groq.chat.completions.create(params);
          
          // If successful and we had to switch keys, update the active index for next time
          if (attempts > 0) {
            setting.activeKeyIndex = index;
            await setting.save();
          }
          
          return completion;
        } catch (err) {
          console.error(`Groq Key Error (Key Index ${index}):`, err.message);
          lastError = err;
          attempts++;
        }
      }
      throw lastError || new Error("All Groq keys failed");
    }
  };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, lang = "th", balance, budget } = await request.json();
    
    // 1. Get Rotatable Groq Client
    const groqClient = await getGroqClient();
    if (!groqClient) {
      return NextResponse.json({ error: "No API Keys Configured" }, { status: 500 });
    }

    // 2. Prompt Engineering
    const systemPrompt = `
      You are Remi, an intelligent financial assistant Agent.
      Your goal is to understand the user's natural language command and convert it into a STRUCTURED JSON ACTION.
      
      Current Context:
      - Balance: Bank ${balance?.bank || 0}, Cash ${balance?.cash || 0}
      - Daily Budget: ${budget || 0}
      - Language: ${lang}

      Supported Actions (return strictly JSON):
      1. ADD_TRANSACTION
         - "Spent 50 on coffee" -> { "action": "ADD_TRANSACTION", "amount": 50, "type": "expense", "category": "อาหาร", "description": "Coffee", "wallet": "cash", "bank": "...", "icon": "Coffee", "thought": "..." }
         
      2. TRANSFER
         - "Transfer 1000 from SCB to KTB" -> { "action": "TRANSFER", "amount": 1000, "from_bank": "SCB", "to_bank": "KTB", "icon": "ArrowRightLeft", "thought": "..." }

      3. SET_BUDGET
         - "Set daily budget to 500" -> { "action": "SET_BUDGET", "amount": 500, "period": "daily", "thought": "..." }
         - "Set monthly budget to 20000" -> { "action": "SET_BUDGET", "amount": 20000, "period": "monthly", "thought": "..." }
      
      4. RESET_BALANCE
         - "Correct my bank balance to 2000" -> { "action": "SET_BALANCE", "wallet": "bank", "amount": 2000, "thought": "..." }
      
      5. BORROW / LEND (Debt tracking)
         - "Lent 100 to Somchai", "ให้ส้มยืม 100" -> { "action": "LEND", "person": "ส้ม", "amount": 100, "wallet": "cash", "note": "...", "thought": "..." }
         - "Borrowed 500 from Mom", "ยืมเงินแม่ 500", "ยืมเงินพี่ 200" -> { "action": "BORROW", "person": "พี่", "amount": 200, "wallet": "bank", "note": "...", "thought": "..." }

      6. SHOW_SUMMARY / REPORT
         - "Show my summary", "สรุป", "ขอดูรายงาน", "สรุปยอดให้หน่อย" -> { "action": "SHOW_SUMMARY", "thought": "..." }
         
      7. SHOW_DEBTS / BORROW_LIST
         - "Show who owes me money", "ดูรายการยืมเงิน", "ยืมคืน" -> { "action": "SHOW_DEBTS", "thought": "..." }

      8. PLANNING / ADVICE
         - "How can I save more money?" or "ช่วยวางแผนเก็บเงินหน่อย" -> { "action": "PLANNING", "message": "...", "thought": "..." }
         - "Goal: Save 5000 in 2 months" -> { "action": "PLANNING", "message": "...", "thought": "..." }

      9. REMIND (Scheduled tasks/bills)
         - "Remind me to pay electric bill 500 tomorrow", "เตือนจ่ายค่าไฟ 500 พรุ่งนี้" -> { "action": "REMIND", "description": "ค่าไฟ", "amount": 500, "date": "YYYY-MM-DD", "wallet": "bank", "thought": "..." }
         - "Remind me to pay rent 5000 on 5th Feb" -> { "action": "REMIND", "description": "Rent", "amount": 5000, "date": "2026-02-05", "wallet": "bank", "thought": "..." }

      10. UNKNOWN
          - If intent is unclear -> { "action": "UNKNOWN", "thought": "...", "message": "..." }

      Rules:
      - Current Date: ${new Date().toISOString().split('T')[0]} (Use this for relative dates like "tomorrow" or "next week").
      - ONLY discuss money, budgets, spending, savings, and financial planning. 
      - Distinguish between COMMANDS and QUESTIONS.
        - COMMAND: "Bought milk 20", "Spent 100" -> ADD_TRANSACTION.
        - QUESTION: "Can I buy milk with 20?", "Is 20 enough?", "Shall I buy this?", "Budget 500 what can I buy?" -> PLANNING.
        - CRITICAL THAI RULE: If the user uses "ไหม", "ได้ไหม", "พอไหม", "เหรอ", "มั้ย", "ได้บ้าง", "กี่บาท", "เท่าไหร่", "ยังไง" or any question mark, it is a QUESTION (PLANNING).
        - BUDGET SENSITIVITY: If the user mentions "งบ" (budget) followed by a question like "ซื้ออะไรได้บ้าง" or "พอไหม", it is ALWAYS a PLANNING request. NEVER record it as a transaction or expense. Even if they mention a big amount like "งบ 10000", if it ends with "ได้บ้าง" it is a question about what they CAN do, not what they DID.
      - If the user asks about unrelated topics (e.g., weather, jokes, general chat), politely refuse and refocus on their finances in the "message" field of an UNKNOWN action.
      - Include a "message" field with a natural, polite confirmation or response in the USER'S LANGUAGE.
      - Wallet Detection:
        - If user mentions "เงินสด", "สด", "cash", "จ่ายสด", "แบงค์", "เหรียญ" -> wallet: "cash"
        - If user mentions "โอน", "ธนาคาร", "app", "แอป", "บัญชี", "สลิป" or a bank name (SCB, KBank, etc.) -> wallet: "bank"
        - If unclear, defaults to "bank" but prioritize mentions.
      - Select a valid Lucide React icon name for the "icon" field that best matches the description (e.g. Coffee, Utensils, Car, ShoppingBag, Gamepad2, Home, HeartPulse, DollarSign, Shirt, Smartphone, Zap, Fuel).
      - Always try to extract the bank name from slips/text. Common Thai icons/text to look for: SCB (ไทยพาณิชย์), K-Bank (กสิกร), KTB (กรุงไทย), BBL (กรุงเทพ), GSV (ออมสิน), Krungsri (กรุงศรี), TTB (ทีทีบี), TrueMoney (ทรูมันนี่).
      - For transfers, include both "from_bank" and "to_bank".
      - Step 1: Analyze the user's request carefully.
      - Step 2: Determine if it's a command (action) or a question (planning).
      - Step 3: Populate the "thought" field with your analysis (e.g., "User spent 100 on food. I will categorize this under 'อาหาร' and deduct from bank.").
      - Step 4: Populate the "message" field with the final friendly response.
      - ALWAYS include both "thought" and "message" fields in the USER'S LANGUAGE.
      - Return ONLY raw JSON.
    `;

    // 3. Inference
    const completion = await groqClient.createCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Low temp for precision
      max_tokens: 200,
    });

    const resultText = completion.choices[0]?.message?.content || "{}";
    
    // 4. Parse JSON (Handle potential markdown wrapping)
    let jsonStr = resultText.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "");
    }
    
    const actionData = JSON.parse(jsonStr);

    return NextResponse.json(actionData);

  } catch (error) {
    console.error("AI Agent Error:", error);
    return NextResponse.json({ error: "AI Processing Failed" }, { status: 500 });
  }
}
