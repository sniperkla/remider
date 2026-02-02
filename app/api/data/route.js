import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Debt from "@/models/Debt";
import UserProfile from "@/models/UserProfile";
import SystemSetting from "@/models/SystemSetting";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.email;

    // Get Profile (Balance/Budget)
    let profile = await UserProfile.findOne({ userId });
    if (!profile) {
      profile = await UserProfile.create({ userId });
    }

    // Get System Settings (Groq Keys Pool)
    let systemSetting = await SystemSetting.findOne({ key: "global_config" });
    if (!systemSetting) {
      const envKey = process.env.GROQ_API_KEY?.trim();
      systemSetting = await SystemSetting.create({ 
        key: "global_config", 
        groqKeys: envKey ? [envKey] : [] 
      });
    }

    // Get Recent Transactions (limit to 50 for performance)
    const transactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(50);

    return NextResponse.json({
      balance: profile.balance,
      budget: profile.budget,
      monthlyBudget: profile.monthlyBudget,
      defaultWallet: profile.defaultWallet,
      nickname: profile.nickname,
      preventDelete: profile.preventDelete,
      language: profile.language,
      ocrProvider: profile.ocrProvider,
      aiModel: profile.aiModel,
      onboardingCompleted: profile.onboardingCompleted,
      tutorialCompleted: profile.tutorialCompleted,
      useSmartAI: profile.useSmartAI,
      hasSeenFAQ: profile.hasSeenFAQ,
      onboardingTasks: profile.onboardingTasks,
      lastAutoScan: profile.lastAutoScan,
      groqKeys: systemSetting.groqKeys,
      transactions: transactions
    });
  } catch (error) {
    console.error("Database Error Detail:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update Budget, Balance or System Keys
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.email;
    const body = await request.json();
    const { budget, balance, monthlyBudget, defaultWallet, nickname, groqKeys, preventDelete, clearAll, language, ocrProvider, aiModel, onboardingCompleted, tutorialCompleted, useSmartAI, hasSeenFAQ, onboardingTasks, lastAutoScan } = body;

    // 0. Handle Clear All Data
    if (clearAll) {
      await Transaction.deleteMany({ userId });
      await Debt.deleteMany({ userId });
      // Reset balance in profile as well is handled in the next step
    }

    // 1. Update Profile
    const updateData = {};
    if (budget !== undefined) updateData.budget = budget;
    if (balance !== undefined) updateData.balance = balance;
    if (monthlyBudget !== undefined) updateData.monthlyBudget = monthlyBudget;
    if (defaultWallet !== undefined) updateData.defaultWallet = defaultWallet;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (preventDelete !== undefined) updateData.preventDelete = preventDelete;
    if (language !== undefined) updateData.language = language;
    if (ocrProvider !== undefined) updateData.ocrProvider = ocrProvider;
    if (aiModel !== undefined) updateData.aiModel = aiModel;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;
    if (tutorialCompleted !== undefined) updateData.tutorialCompleted = tutorialCompleted;
    if (useSmartAI !== undefined) updateData.useSmartAI = useSmartAI;
    if (hasSeenFAQ !== undefined) updateData.hasSeenFAQ = hasSeenFAQ;
    if (onboardingTasks !== undefined) updateData.onboardingTasks = onboardingTasks;
    if (lastAutoScan !== undefined) updateData.lastAutoScan = lastAutoScan;

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // 2. Update System Keys if provided
    if (groqKeys !== undefined) {
      await SystemSetting.findOneAndUpdate(
        { key: "global_config" },
        { $set: { groqKeys: groqKeys } },
        { upsert: true }
      );
    }

    return NextResponse.json({ ...profile._doc, groqKeys });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
