const mongoose = require('mongoose');

const FraudLogSchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  detectedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('FraudLog', FraudLogSchema);
