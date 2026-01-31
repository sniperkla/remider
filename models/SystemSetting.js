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
  }
}, { timestamps: true });

export default mongoose.models.SystemSetting || mongoose.model('SystemSetting', SystemSettingSchema);
