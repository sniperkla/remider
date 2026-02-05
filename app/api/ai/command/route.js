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
  
  // Check if we need to reset key index (new day = recycle to key 0)
  const now = new Date();
  const lastRotation = setting.lastKeyRotation ? new Date(setting.lastKeyRotation) : new Date(0);
  const isNewDay = now.toDateString() !== lastRotation.toDateString();
  
  if (isNewDay) {
    setting.activeKeyIndex = 0;
    setting.lastKeyRotation = now;
    await setting.save();
    console.log(`[Groq] New day detected, recycling to key index 0`);
  }
  
  // We'll return a function that performs the completion and handles rotation internally
  return {
    async createCompletion(params) {
      let lastError;
      const startIndex = setting.activeKeyIndex || 0;
      
      while (attempts < keys.length) {
        // Try keys starting from activeKeyIndex, wrapping around
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
          
          console.log(`[Groq] Success with key ${index}, next request will use key ${nextIndex}`);
          return completion;
        } catch (err) {
          console.error(`[Groq] Key ${index} failed:`, err.message);
          lastError = err;
          attempts++;
          
          // If current key failed, try next key
          if (attempts < keys.length) {
            console.log(`[Groq] Trying next key...`);
          }
        }
      }
      
      // All keys failed, reset to 0 for next attempt
      setting.activeKeyIndex = 0;
      await setting.save();
      console.error(`[Groq] All ${keys.length} keys failed, resetting to index 0`);
      
      throw lastError || new Error("All Groq keys failed");
    }
  };
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { 
      text, 
      lang = "th", 
      balance, 
      budget, 
      activeWallet = "bank", 
      activeBankAccountId = null,
      accounts = [],
      aiModel = "llama-3.3-70b-versatile", 
      source = "voice", 
      userName = "", 
      userAliases = [], 
      detectedLang = null,
      recentTransactions = [],
      recentDebts = [],
      reminders = []
    } = await request.json();
    
    // 1. Get Rotatable Groq Client
    const groqClient = await getGroqClient();
    if (!groqClient) {
      return NextResponse.json({ error: "No API Keys Configured" }, { status: 500 });
    }

    // 2. Build user accounts context
    const bankAccounts = accounts.filter(a => a.type === 'bank').map(a => ({
      name: a.name,
      id: a.id,
      balance: a.balance
    }));
    const activeBankAccount = accounts.find(a => a.id === activeBankAccountId);
    
    const systemPrompt = `You are Remi (เรมี่), a Thai financial AI. Parse user commands into JSON actions.

CONTEXT:
- Bank: ฿${balance?.bank || 0}, Cash: ฿${balance?.cash || 0}, Budget: ฿${budget || 0}
- Primary: ${activeWallet}, Active Bank: ${activeBankAccount?.name || 'None'}
- Banks: ${bankAccounts.map(b => `${b.name}(${b.id})`).join(', ') || 'None'}
- User: ${userName}
- Lang: ${lang}, Source: ${source}

ACTIONS (return JSON only):

1. ADD_TRANSACTION - Record expense/income
{"action":"ADD_TRANSACTION","amount":50,"type":"expense"|"income","category":"อาหาร","description":"กาแฟ","wallet":"cash"|"bank","bankAccountId":"<ID>","bank":"SCB","icon":"Coffee","thought":"...","message":"..."}

2. TRANSFER - Between accounts (when TWO banks mentioned!)
{"action":"TRANSFER","amount":1000,"from_wallet":"bank","to_wallet":"bank","from_bank":"TrueMoney","to_bank":"SCB","fromBankAccountId":"<from_ID>","toBankAccountId":"<to_ID>","icon":"ArrowRightLeft","thought":"...","message":"..."}
{"action":"TRANSFER","amount":1000,"from_wallet":"bank","to_wallet":"bank","from_bank":"TrueMoney","to_bank":"SCB","fromBankAccountId":"<from_ID>","toBankAccountId":"<to_ID>","icon":"ArrowRightLeft","thought":"...","message":"..."}
CRITICAL: "โอนจาก X เข้า Y", "โอนเงินกับ X เข้า Y" = TRANSFER, not ADD_TRANSACTION!

Rules for Overrides:
- If text starts with "[Action: BORROW]", Output MUST be "BORROW".
- If text starts with "[Action: LEND]", Output MUST be "LEND".
- Ignore receipt content implying otherwise (e.g. "Total" or "Purchase") if Action is explicit.

3. SWITCH_PRIMARY - Change primary wallet
{"action":"SWITCH_PRIMARY","wallet":"cash"|"bank","bankAccountId":"<ID>","thought":"...","message":"..."}
Triggers: "เปลี่ยน", "ใช้", "switch to"

4. SET_BUDGET
{"action":"SET_BUDGET","amount":500,"period":"daily"|"monthly","thought":"...","message":"..."}

5. SET_BALANCE
{"action":"SET_BALANCE","wallet":"bank"|"cash","amount":2000,"thought":"...","message":"..."}

6. BORROW/LEND - Debt direction:
- LEND (they owe you): "[Name] ยืมเงิน", "ให้ [Name] ยืม", "[Name] ติดเงินเรา", "คนอื่นติดเงินเรา", "เราให้ [Name] ยืม"
- BORROW (you owe them): "ยืมเงิน [Name]", "ไปยืม [Name]", "เราติดเงิน [Name]", "ยืม [Name] มา"
CRITICAL: "ติดเงินเรา" always means LEND. "ยืมเงิน [Name]" usually means BORROW from them.
{"action":"BORROW"|"LEND","person":"name","amount":100,"category":"tag_name","thought":"...","message":"..."}

7. SHOW_SUMMARY
{"action":"SHOW_SUMMARY","period":"today"|"week"|"month","thought":"...","message":"..."}

8. SHOW_DEBTS
{"action":"SHOW_DEBTS","thought":"...","message":"..."}

9. PLANNING - Questions/advice
{"action":"PLANNING","query":"...","message":"helpful advice","thought":"..."}

10. REMIND - Create payment reminders
{"action":"REMIND","description":"ค่าไฟ","amount":500,"date":"2026-02-05T10:00:00","wallet":"bank","thought":"...","message":"ตั้งแจ้งเตือนค่าไฟ 500 บาทแล้วค่ะ"}
Triggers: "แจ้งเตือน", "เตือน", "remind", "เพิ่มการแจ้งเตือน", "ตั้งเตือน", "นัด"
- Current datetime (UTC+7): ${new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19)}
- "อีก 10 นาที" → add 10 min to current time
- "พรุ่งนี้" → next day 09:00
- "วันที่ 5" → day 5 of current month 09:00
- "พรุ่งนี้ 2 ทุ่ม" → next day 20:00
Example: "แจ้งเตือนค่าไฟ 500 บาท พรุ่งนี้" → REMIND with calculated date

11. UNKNOWN
{"action":"UNKNOWN","thought":"...","message":"polite refusal"}

12. FILTER_BANK - Filter transactions by bank
{"action":"FILTER_BANK","bankAccountId":"<ID>","thought":"...","message":"กรองรายการของ X ให้แล้วค่ะ"}
Triggers: "กรอง", "ดูรายการ", "ดูของ", "filter", "show transactions for"
Example: "กรอง truemoney", "ดูรายการ SCB" → match bank name to ID from context

13. FILTER_WALLET - Filter by wallet type
{"action":"FILTER_WALLET","wallet":"cash"|"bank","thought":"...","message":"..."}
Example: "ดูเงินสด", "กรองเงินสด" → wallet: "cash"

RULES:
- Match bank names LOOSELY (กสิกร=KBank, SCB=ไทยพาณิชย์, ทรู/ทรูมันนี่=TrueMoney)
- Wallet: "เงินสด/สด/cash"=cash, "โอน/แอป/QR/บัตร"=bank
- Type: "ซื้อ/จ่าย/ถอน"=expense, "ได้/รับ/เงินเดือน/ฝาก"=income
- Categories: อาหาร,เดินทาง,ของใช้,บันเทิง,ที่พัก,การเงิน,สุขภาพ,รายได้,อื่นๆ
- Icons: Utensils,Coffee,Car,Fuel,ShoppingBag,Gamepad2,Home,HeartPulse,CreditCard,Wallet,ArrowRightLeft,DollarSign
- Keep description in user's spoken language
- For OCR: find "รวมเงิน/TOTAL", verify with CASH-CHANGE if available
- Return ONLY valid JSON, no markdown. ALL property names MUST be double-quoted (e.g. "action", not action).
- Message should ALWAYS be in the language: ${lang === 'th' ? 'Thai' : 'English'}
- EXPLICIT OVERRIDES: If text has "[Action: X]", force action X. If "[Tag: Y]", use Y as 'category'.`;

    // 3. Inference
    const completion = await groqClient.createCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      model: aiModel,
      temperature: 0.1, // Low temp for precision
      max_tokens: 300,
    });

    const resultText = completion.choices[0]?.message?.content || "{}";
    
    // 4. Parse JSON (Handle potential markdown wrapping or conversational noise)
    let jsonStr = resultText.trim();
    
    // Robustly extract JSON object from the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const actionData = (() => {
      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn("Initial JSON parse failed, attempting repair:", jsonStr);
        // Attempt to fix unquoted keys (common AI error: { action: "..." } -> { "action": "..." })
        const repaired = jsonStr.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
        try {
          return JSON.parse(repaired);
        } catch (repairError) {
          console.error("JSON Repair failed:", repaired);
          throw parseError; // Throw original error to be caught by outer block
        }
      }
    })();

    return NextResponse.json(actionData);

  } catch (error) {
    console.error("AI Agent Error:", error);
    return NextResponse.json({ error: "AI Processing Failed" }, { status: 500 });
  }
}
