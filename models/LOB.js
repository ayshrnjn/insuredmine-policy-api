const mongoose = require('mongoose');

const lobSchema = new mongoose.Schema(
  { categoryName: { type: String, required: true, unique: true, trim: true } },
  { timestamps: true },
);

module.exports = mongoose.model('LOB', lobSchema);
