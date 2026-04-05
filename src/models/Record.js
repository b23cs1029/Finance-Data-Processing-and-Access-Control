const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'A record must have an amount']
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'A record must be either income or expense']
  },
  category: {
    type: String,
    required: [true, 'A record must have a category']
  },
  date: {
    type: Date,
    default: Date.now,
    required: [true, 'A record must have a date']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A record must belong to a user']
  }
}, {
  timestamps: true
});

// Index for faster queries/summaries
recordSchema.index({ date: -1 });
recordSchema.index({ type: 1, category: 1 });

const Record = mongoose.model('Record', recordSchema);
module.exports = Record;
