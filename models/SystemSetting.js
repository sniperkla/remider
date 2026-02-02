import mongoose from 'mongoose';

const SystemSettingSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    default: "global_config" 
  },
  groqKeys: {
    type: [String],
    default: []
  },
  activeKeyIndex: {
    type: Number,
    default: 0
  },
  lastKeyRotation: {
    type: Date,
    default: Date.now
  },
  tokenUsage: {
    prompt_used: { type: Number, default: 0 },
    completion_used: { type: Number, default: 0 },
    total_used: { type: Number, default: 0 },
    month: { type: Number, default: () => new Date().getMonth() },
    year: { type: Number, default: () => new Date().getFullYear() },
    last_reset: { type: Date, default: Date.now }
  }
}, { timestamps: true });

export default mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema);
