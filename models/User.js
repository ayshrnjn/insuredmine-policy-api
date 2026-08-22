const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, index: true },
    dob: { type: Date },
    address: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    gender: { type: String, trim: true },
    userType: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
