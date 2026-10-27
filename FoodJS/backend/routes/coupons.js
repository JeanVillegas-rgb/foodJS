const express = require('express');
const { readJsonFromData } = require('../lib/readJson');
const { writeJsonToData } = require('../lib/writeJson');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateCoupon, applyDiscount } = require('../lib/couponValidator');

const router = express.Router();

router.get('/', (_req, res) => {
  const data = readJsonFromData('coupons.json');
  res.json(data.coupons || []);
});

router.post('/validate', (req, res) => {
  const { code, orderAmount } = req.body;

  if (!code || orderAmount === undefined) {
    return res.status(400).json({ message: 'Code and orderAmount required' });
  }

  const couponsData = readJsonFromData('coupons.json');
  const result = validateCoupon(code, orderAmount, couponsData);

  res.json(result);
});

// POST - Create coupon para admin
router.post('/', verifyToken, requireAdmin, (req, res) => {
  const { code, discount, discountType, minOrderAmount, expiryDate, maxUses, description } = req.body;

  if (
    !code ||
    !Number.isFinite(Number(discount)) ||
    Number(discount) <= 0 ||
    !['percentage', 'fixed'].includes(discountType)
  ) {
    return res.status(400).json({ message: 'Code, discount, and discountType required' });
  }

  if (discountType === 'percentage' && Number(discount) > 100) {
    return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
  }

  if (minOrderAmount !== undefined && (!Number.isFinite(Number(minOrderAmount)) || Number(minOrderAmount) < 0)) {
    return res.status(400).json({ message: 'Minimum order amount must be zero or greater' });
  }

  if (maxUses !== undefined && (!Number.isInteger(Number(maxUses)) || Number(maxUses) < -1)) {
    return res.status(400).json({ message: 'Maximum uses must be -1 or a whole number of zero or more' });
  }

  const data = readJsonFromData('coupons.json');

  if (data.coupons.some(c => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ message: 'Coupon code already exists' });
  }

  const nextId = data.coupons.length > 0 
    ? Math.max(...data.coupons.map(c => parseInt(c.id.split('-')[1]))) + 1
    : 1001;

  const newCoupon = {
    id: `CP-${nextId}`,
    code: code.toUpperCase(),
    discount: discount,
    discountType: discountType,
    minOrderAmount: minOrderAmount || 0,
    expiryDate: expiryDate || '2026-12-31',
    maxUses: maxUses !== undefined ? maxUses : -1,
    usedCount: 0,
    description: description || '',
  };

  data.coupons.push(newCoupon);
  writeJsonToData('coupons.json', data);

  res.status(201).json(newCoupon);
});

// PUT - Update coupon para admin only
router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { code, discount, discountType, minOrderAmount, expiryDate, maxUses, description } = req.body;

  if (
    !code ||
    !Number.isFinite(Number(discount)) ||
    Number(discount) <= 0 ||
    !['percentage', 'fixed'].includes(discountType)
  ) {
    return res.status(400).json({ message: 'Code, discount, and discountType required' });
  }

  if (discountType === 'percentage' && Number(discount) > 100) {
    return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
  }

  if (minOrderAmount !== undefined && (!Number.isFinite(Number(minOrderAmount)) || Number(minOrderAmount) < 0)) {
    return res.status(400).json({ message: 'Minimum order amount must be zero or greater' });
  }

  if (maxUses !== undefined && (!Number.isInteger(Number(maxUses)) || Number(maxUses) < -1)) {
    return res.status(400).json({ message: 'Maximum uses must be -1 or a whole number of zero or more' });
  }

  const data = readJsonFromData('coupons.json');
  const couponIndex = data.coupons.findIndex(c => c.id === id);

  if (couponIndex === -1) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  if (data.coupons.some((coupon, index) =>
    index !== couponIndex && coupon.code.toUpperCase() === code.toUpperCase()
  )) {
    return res.status(400).json({ message: 'Coupon code already exists' });
  }

  data.coupons[couponIndex] = {
    ...data.coupons[couponIndex],
    code: code.toUpperCase(),
    discount: discount,
    discountType: discountType,
    minOrderAmount: minOrderAmount || 0,
    expiryDate: expiryDate || null,
    maxUses: maxUses !== undefined ? maxUses : -1,
    description: description || '',
  };

  writeJsonToData('coupons.json', data);
  res.json(data.coupons[couponIndex]);
});

// DELETE - Delete coupon para admin only
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const data = readJsonFromData('coupons.json');
  const index = data.coupons.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  data.coupons.splice(index, 1);
  writeJsonToData('coupons.json', data);

  res.json({ message: 'Coupon deleted' });
});

module.exports = router;
