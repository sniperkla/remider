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
  },
  language: {
    type: String,
    enum: ['th', 'en'],
    default: 'th'
  },
  ocrProvider: {
    type: String,
    enum: ['tesseract', 'google'],
    default: 'google'
  },
  aiModel: {
    type: String,
    enum: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    default: 'llama-3.1-8b-instant'
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  tutorialCompleted: {
    type: Boolean,
    default: false
  },
  useSmartAI: {
    type: Boolean,
    default: true
  },
  hasSeenFAQ: {
    type: Boolean,
    default: false
  },
  onboardingTasks: {
    voice: { type: Boolean, default: false },
    scan: { type: Boolean, default: false },
    manual: { type: Boolean, default: false },
    completed: { type: Boolean, default: false }
  },
  lastAutoScan: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
