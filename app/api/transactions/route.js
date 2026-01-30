import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
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

    // 1. Create Transaction
    const transaction = await Transaction.create({
      userId,
      ...data
    });

    // 2. Update Balance in Profile
    const balanceField = `balance.${data.wallet || 'bank'}`;
    const amountChange = data.type === 'income' ? data.amount : -data.amount;

    await UserProfile.findOneAndUpdate(
      { userId },
      { $inc: { [balanceField]: amountChange } },
      { upsert: true }
    );

    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await dbConnect();
    const userId = session.user.email;

    // Find transaction to know how much to refund
    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Reverse the balance change
    const balanceField = `balance.${transaction.wallet || 'bank'}`;
    const refundAmount = transaction.type === 'income' ? -transaction.amount : transaction.amount;

    await UserProfile.findOneAndUpdate(
      { userId },
      { $inc: { [balanceField]: refundAmount } }
    );

    await Transaction.deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
