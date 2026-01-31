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

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const newData = await request.json();

    await dbConnect();
    const userId = session.user.email;

    // 1. Get Old Transaction for balance reversal
    const oldTxn = await Transaction.findOne({ _id: id, userId });
    if (!oldTxn) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 2. Reverse Old Balance
    const oldWalletField = `balance.${oldTxn.wallet || 'bank'}`;
    const oldRefund = oldTxn.type === 'income' ? -oldTxn.amount : oldTxn.amount;
    
    // 3. Apply New Balance
    const newWalletField = `balance.${newData.wallet || 'bank'}`;
    const newChange = newData.type === 'income' ? newData.amount : -newData.amount;

    // 3. Update Profile Balance
    // If it was the same wallet, we add the changes together.
    if (oldWalletField === newWalletField) {
      await UserProfile.findOneAndUpdate(
        { userId },
        { $inc: { [newWalletField]: oldRefund + newChange } }
      );
    } else {
      await UserProfile.findOneAndUpdate(
        { userId },
        { $inc: { [oldWalletField]: oldRefund, [newWalletField]: newChange } }
      );
    }

    // 4. Update Transaction
    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId },
      { $set: newData },
      { new: true }
    );

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
