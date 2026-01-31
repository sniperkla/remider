import mongoose from 'mongoose';

const ReminderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
  },
  wallet: {
    type: String,
    default: 'bank',
  },
  category: {
    type: String,
    default: 'อื่นๆ',
  }
}, { timestamps: true });

export default mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
