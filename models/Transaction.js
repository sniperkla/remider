import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: 'อื่นๆ',
  },
  wallet: {
    type: String,
    enum: ['bank', 'cash'],
    default: 'bank',
  },
  bank: {
    type: String, // Store bank name (e.g., "SCB", "KBANK -> SCB")
    required: false,
  },
  icon: {
    type: String, // Store lucide icon name (e.g. "Coffee", "Bus")
    required: false,
  },
  imageUrl: {
    type: String, // Cloudinary image URL for receipt/slip
    required: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
