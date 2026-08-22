const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    policyNumber: { type: String, required: true, unique: true, trim: true },
    policyStartDate: { type: Date, required: true },
    policyEndDate: { type: Date, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LOB', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrier', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Policy', policySchema);
