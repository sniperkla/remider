import mongoose from 'mongoose';

const UserProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  balance: {
    bank: { type: Number, default: 0 },
    cash: { type: Number, default: 0 }
  },
  budget: {
    type: Number,
    default: 1000,
  },
  monthlyBudget: {
    type: Number,
    default: 30000,
  },
  defaultWallet: {
    type: String,
    enum: ['bank', 'cash'],
    default: 'bank'
  },
  nickname: {
    type: String,
    default: ""
  },
  preventDelete: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
