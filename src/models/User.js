const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please fill a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['Viewer', 'Analyst', 'Admin'],
    default: 'Viewer'
  },
  companyCode: {
    type: String,
    required: [true, 'A company code is required'],
    uppercase: true,
    trim: true,
    select: false,
    default: 'DEFAULT'
  },
  companyName: {
    type: String,
    required: [true, 'A company name is required'],
    trim: true,
    default: 'Default Company'
  },
  isActive: {
    type: Boolean,
    default: true,
    select: false
  }
}, { timestamps: true });

// Index for company-scoped queries
userSchema.index({ companyName: 1 });
userSchema.index({ companyName: 1, role: 1 });

// Hash the password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
