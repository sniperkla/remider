import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import UserProfile from "@/models/UserProfile";

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

    // Get Recent Transactions (limit to 50 for performance)
    const transactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(50);

    return NextResponse.json({
      balance: profile.balance,
      budget: profile.budget,
      transactions: transactions
    });
  } catch (error) {
    console.error("Database Error Detail:", error.message);
    if (error.message.includes("not authorized") || error.message.includes("Authentication failed")) {
      return NextResponse.json({ error: "DB_PERMISSION_ERROR", message: "Check MongoDB User Permissions" }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update Budget or Balance directly
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = session.user.email;
    const { budget, balance } = await request.json();

    const updateData = {};
    if (budget !== undefined) updateData.budget = budget;
    if (balance !== undefined) updateData.balance = balance;

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
