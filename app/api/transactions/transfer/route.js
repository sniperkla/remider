
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import UserProfile from "@/models/UserProfile";

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const userId = session.user.email;
    const data = await request.json();
    
    const { 
      amount, 
      from_wallet = 'bank', 
      to_wallet = 'bank', 
      from_bank, 
      to_bank, 
      fromBankAccountId, 
      toBankAccountId, 
      icon, 
      date,
      lang = 'en'
    } = data;

    if (!amount || amount <= 0) {
       return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const txnDate = date || new Date().toISOString();

    // 1. Create OUTGOING Transaction (Expense from Source)
    const fromDesc = (lang === 'th') 
       ? `โอนเงินไป ${to_bank || (to_wallet === 'cash' ? 'เงินสด' : 'ธนาคาร')}` 
       : `Transfer to ${to_bank || (to_wallet === 'cash' ? 'Cash' : 'Bank')}`;
       
    const expenseTxn = await Transaction.create({
      userId,
      amount,
      type: "expense",
      description: fromDesc,
      category: "เงินโอน",
      wallet: from_wallet,
      bank: from_bank,
      accountId: fromBankAccountId,
      icon: icon || "ArrowRightLeft",
      date: txnDate
    });

    // 2. Create INCOMING Transaction (Income to Destination)
    const toDesc = (lang === 'th')
       ? `รับโอนจาก ${from_bank || (from_wallet === 'cash' ? 'เงินสด' : 'ธนาคาร')}` 
       : `Transfer from ${from_bank || (from_wallet === 'cash' ? 'Cash' : 'Bank')}`;

    const incomeTxn = await Transaction.create({
      userId,
      amount,
      type: "income",
      description: toDesc,
      category: "เงินโอน",
      wallet: to_wallet,
      bank: to_bank,
      accountId: toBankAccountId,
      icon: icon || "ArrowRightLeft",
      date: txnDate
    });

    // 3. Update UserProfile Balances (Atomic Update)
    const updateOps = { $inc: {} };
    const arrayFilters = [];

    // A. Global Wallet Balance (only if wallets differ)
    if (from_wallet !== to_wallet) {
       updateOps.$inc[`balance.${from_wallet}`] = -amount;
       updateOps.$inc[`balance.${to_wallet}`] = amount;
    } 
    // If same wallet (e.g. bank->bank), global bank balance remains same, but individual accounts change.

    // B. Specific Bank Account Updates (using ArrayFilters)
    // Deduct from Source
    if (from_wallet === 'bank' && fromBankAccountId) {
       updateOps.$inc["accounts.$[sourceElem].balance"] = -amount;
       arrayFilters.push({ "sourceElem.id": fromBankAccountId });
    }

    // Add to Destination
    if (to_wallet === 'bank' && toBankAccountId) {
       updateOps.$inc["accounts.$[destElem].balance"] = amount;
       arrayFilters.push({ "destElem.id": toBankAccountId });
    }

    // Only perform DB update if there are changes to make
    let updatedProfile;
    if (Object.keys(updateOps.$inc).length > 0) {
        const options = { new: true };
        if (arrayFilters.length > 0) {
            options.arrayFilters = arrayFilters;
        }

        updatedProfile = await UserProfile.findOneAndUpdate(
            { userId },
            updateOps,
            options
        );
    } else {
        // No balance changes (rare, maybe cash-to-cash transfer?), just fetch latest
        updatedProfile = await UserProfile.findOne({ userId });
    }

    return NextResponse.json({
       success: true,
       transactions: [expenseTxn, incomeTxn],
       updatedProfile
    });

  } catch (error) {
    console.error("Transfer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
