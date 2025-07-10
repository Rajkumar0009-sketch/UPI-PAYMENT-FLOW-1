const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const OTP = require('../models/OTP');
const FraudLog = require('../models/FraudLog');
const User = require('../models/User');
const crypto = require('crypto');

// Helper function to simulate fraud check
const fraudCheck = (transaction) => {
  // Simple fraud check: flag if amount > 10000 or random failure
  if (transaction.amount > 10000) {
    return { passed: false, reason: 'Amount exceeds limit' };
  }
  // Add more rules as needed
  return { passed: true };
};

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route   POST /api/payment/initiate
// @desc    Initiate payment, perform fraud check, generate OTP
// @access  Private
router.post('/initiate', auth, async (req, res) => {
  const { amount, paymentMethod } = req.body;
  try {
    const user = req.user;

    // Create transaction with status Pending
    let transaction = new Transaction({
      user: user._id,
      amount,
      paymentMethod,
      status: 'Pending',
    });

    // Perform fraud check
    const fraudResult = fraudCheck(transaction);
    if (!fraudResult.passed) {
      transaction.status = 'Fraud';
      transaction.fraudCheckPassed = false;
      await transaction.save();

      // Log fraud
      const fraudLog = new FraudLog({
        transaction: transaction._id,
        reason: fraudResult.reason,
      });
      await fraudLog.save();

      return res.status(403).json({ message: 'Transaction flagged as fraud', reason: fraudResult.reason });
    }

    await transaction.save();

    // Generate OTP and save
    const otpCode = generateOTP();
    const otp = new OTP({
      user: user._id,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
    });
    await otp.save();

    // Simulate sending OTP (in real app, send via SMS/Email)
    console.log("OTP for user " + user.email + ": " + otpCode);

    res.json({ message: 'OTP sent to registered contact', transactionId: transaction._id });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/payment/verify-otp
// @desc    Verify OTP and complete transaction
// @access  Private
router.post('/verify-otp', auth, async (req, res) => {
  const { transactionId, otpCode } = req.body;
  try {
    const user = req.user;

    const otp = await OTP.findOne({ user: user._id, otp: otpCode, verified: false });
    if (!otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (otp.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Mark OTP as verified
    otp.verified = true;
    await otp.save();

    // Update transaction status to Completed
    const transaction = await Transaction.findOne({ _id: transactionId, user: user._id });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    transaction.status = 'Completed';
    transaction.updatedAt = new Date();
    await transaction.save();

    res.json({ message: 'Transaction completed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
