import mongoose from 'mongoose';

const DebtSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  person: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['borrow', 'lend'], // 'borrow' = I owe them, 'lend' = they owe me
    required: true,
  },
  note: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ['active', 'paid'],
    default: 'active',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
  }
}, { timestamps: true });

export default mongoose.models.Debt || mongoose.model('Debt', DebtSchema);
