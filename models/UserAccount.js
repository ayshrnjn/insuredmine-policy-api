const mongoose = require('mongoose');

const userAccountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

userAccountSchema.index({ accountName: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserAccount', userAccountSchema);
