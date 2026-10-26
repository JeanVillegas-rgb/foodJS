import { useState } from "react";

const EMPTY_COUPON = {
  code: "",
  discount: "",
  discountType: "percentage",
  minOrderAmount: "",
  maxUses: "",
  expiryDate: "",
};

export default function CouponManagement({ coupons, onAddCoupon, onUpdateCoupon, onDeleteCoupon }) {
  const [form, setForm] = useState(EMPTY_COUPON);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState("");

  const reset = () => {
    setForm(EMPTY_COUPON);
    setEditId(null);
    setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const discount = Number(form.discount);
    const minOrderAmount = Number(form.minOrderAmount || 0);
    const maxUses = form.maxUses === "" ? -1 : Number(form.maxUses);

    if (!form.code.trim() || !Number.isFinite(discount) || discount <= 0) {
      setFormError("Enter a coupon code and a discount greater than zero.");
      return;
    }

    if (form.discountType === "percentage" && discount > 100) {
      setFormError("Percentage discounts cannot be greater than 100.");
      return;
    }

    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      setFormError("Minimum order amount cannot be negative.");
      return;
    }

    if (!Number.isInteger(maxUses) || maxUses < -1) {
      setFormError("Maximum uses must be -1 or a whole number of zero or more.");
      return;
    }

    const payload = {
      code: form.code.toUpperCase(),
      discount,
      discountType: form.discountType,
      minOrderAmount,
      maxUses,
      expiryDate: form.expiryDate || undefined,
      description: `${form.discountType === "percentage" ? discount + "%" : "₹" + discount} off`,
    };

    if (editId) {
      onUpdateCoupon(editId, payload);
    } else {
      onAddCoupon(payload);
    }
    reset();
  };

  const handleEdit = (coupon) => {
    setEditId(coupon.id);
    setForm({
      code: coupon.code,
      discount: coupon.discount,
      discountType: coupon.discountType,
      minOrderAmount: coupon.minOrderAmount,
      maxUses: coupon.maxUses,
      expiryDate: coupon.expiryDate || "",
    });
    setFormError("");
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2>Coupon Management</h2>
      </div>

      <form className="admin-form-grid" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Code (e.g., SAVE10)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          maxLength="20"
        />

        <input
          type="number"
          placeholder="Discount amount"
          value={form.discount}
          onChange={(e) => setForm({ ...form, discount: e.target.value })}
          min="0"
        />

        <select
          value={form.discountType}
          onChange={(e) => setForm({ ...form, discountType: e.target.value })}
        >
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed (₹)</option>
        </select>

        <input
          type="number"
          placeholder="Min order amount"
          value={form.minOrderAmount}
          onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
          min="0"
        />

        <input
          type="number"
          placeholder="Max uses (-1 for unlimited)"
          value={form.maxUses}
          onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
          min="-1"
        />

        <label className="admin-form-field">
          <span>Expiry date (optional)</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
          />
        </label>

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary">
            {editId ? "Update Coupon" : "Add Coupon"}
          </button>
          {editId && (
            <button type="button" className="admin-btn admin-btn-light" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {formError && <p className="admin-form-error">{formError}</p>}

      <ul className="admin-category-list">
        {coupons.map((coupon) => (
          <li key={coupon.id}>
            <div>
              <h3>{coupon.code}</h3>
              <p>{coupon.description}</p>
              <span>Min: ₹{coupon.minOrderAmount} | Uses: {coupon.maxUses === -1 ? "∞" : coupon.usedCount + "/" + coupon.maxUses}</span>
            </div>
            <div className="admin-item-actions">
              <button
                type="button"
                className="admin-btn admin-btn-light"
                onClick={() => handleEdit(coupon)}
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => onDeleteCoupon(coupon.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
