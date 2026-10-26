import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DeliveryMapPicker from "../components/DeliveryMapPicker";
import { getAuthSession, saveAuthSession } from "../lib/auth";
import { useNotification } from "../hooks/useNotification";

const emptyProfile = {
  firstName: "",
  lastName: "",
  email: "",
  mobileNumber: "",
  address: "",
  profileImage: "",
};

export default function Profile() {
  const navigate = useNavigate();
  const { success, error: errorNotif } = useNotification();
  const [profile, setProfile] = useState(emptyProfile);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(true);

  const initials = useMemo(() => {
    const first = profile.firstName?.trim()?.[0] || "";
    const last = profile.lastName?.trim()?.[0] || "";
    return `${first}${last}`.toUpperCase() || "?";
  }, [profile.firstName, profile.lastName]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const session = getAuthSession();
        const token = session?.token;

        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          errorNotif("Unable to load profile.");
          return;
        }

        const data = await response.json();
        setProfile({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          mobileNumber: data.mobileNumber || "",
          address: data.address || "",
          profileImage: data.profileImage || "",
        });
        setPreviewImage(data.profileImage || "");
        setSavedAddresses(Array.isArray(data.addressBook) ? data.addressBook : []);
      } catch (err) {
        console.error("Failed to load profile:", err);
        errorNotif("Unable to load profile right now.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, errorNotif]);

  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const response = await fetch("/api/coupons");
        if (!response.ok) {
          errorNotif("Unable to load available coupons.");
          return;
        }

        const data = await response.json();
        setCoupons(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load coupons:", err);
        errorNotif("Unable to load available coupons right now.");
      } finally {
        setCouponsLoading(false);
      }
    };

    loadCoupons();
  }, [errorNotif]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setPreviewImage(result);
      setProfile((prev) => ({
        ...prev,
        profileImage: result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setPreviewImage("");
    setProfile((prev) => ({
      ...prev,
      profileImage: "",
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const session = getAuthSession();
      const token = session?.token;

      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          mobileNumber: profile.mobileNumber,
          address: profile.address,
          profileImage: profile.profileImage,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        errorNotif(payload?.message || "Unable to save profile.");
        return;
      }

      saveAuthSession({ token, user: payload });
      setSavedAddresses(Array.isArray(payload.addressBook) ? payload.addressBook : []);
      success("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to save profile:", err);
      errorNotif("Unable to save profile right now.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  return (
    <div className="client-page profile-page">
      <div className="client-shell">
        <header className="page-topbar">
          <div>
            <h1>My Profile</h1>
            <p>Manage your contact details and delivery defaults.</p>
          </div>
          <div className="page-actions">
            <button type="button" className="client-btn ghost" onClick={() => navigate("/menu")}>
              Back to Menu
            </button>
          </div>
        </header>

        <div className="profile-grid">
          <section className="panel-card profile-card">
            <div className="profile-card-header">
              <div className="profile-avatar">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div>
                <h2>{`${profile.firstName} ${profile.lastName}`.trim() || "Customer"}</h2>
                <p>{profile.email}</p>
              </div>
            </div>

            <div className="profile-upload">
              <label className="client-btn ghost">
                Upload Photo
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              {previewImage && (
                <button type="button" className="client-btn ghost" onClick={handleRemoveImage}>
                  Remove
                </button>
              )}
            </div>

            <div className="profile-form">
              <div className="profile-row">
                <label>
                  <span>First Name</span>
                  <input
                    type="text"
                    name="firstName"
                    value={profile.firstName}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  <span>Last Name</span>
                  <input
                    type="text"
                    name="lastName"
                    value={profile.lastName}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <label>
                <span>Email</span>
                <input type="email" value={profile.email} readOnly />
              </label>

              <label>
                <span>Mobile Number</span>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={profile.mobileNumber}
                  onChange={handleInputChange}
                  placeholder="09XXXXXXXXX"
                />
              </label>

              <label>
                <span>Default Address</span>
                <textarea
                  name="address"
                  value={profile.address}
                  onChange={handleInputChange}
                  placeholder="Add your default delivery address"
                />
              </label>

              <div className="profile-map-card">
                <div className="checkout-map-header">
                  <strong>Delivery Map</strong>
                  <span>Pin it</span>
                </div>
                <DeliveryMapPicker
                  value={profile.address}
                  onChange={(address) =>
                    setProfile((prev) => ({
                      ...prev,
                      address,
                    }))
                  }
                />
              </div>

              <button
                type="button"
                className="client-btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </section>

          <aside className="panel-card profile-card profile-aside">
            <h3>Saved Addresses</h3>
            <p className="muted-text">
              Addresses used in orders are stored here. Your default stays in the profile.
            </p>
            {savedAddresses.length === 0 ? (
              <p className="muted-text">No extra addresses yet.</p>
            ) : (
              <ul className="profile-address-list">
                {savedAddresses.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ul>
            )}

            <div className="profile-coupons">
            <div>
              <h3>Available Coupons</h3>
              <p className="muted-text">Save on your next order with these offers.</p>
            </div>
            {couponsLoading ? (
              <p className="muted-text">Loading coupons...</p>
            ) : coupons.filter((coupon) => {
              const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
              const isExhausted =
                coupon.maxUses !== -1 &&
                coupon.maxUses !== undefined &&
                coupon.usedCount >= coupon.maxUses;
              return !isExpired && !isExhausted;
            }).length === 0 ? (
              <p className="muted-text">No coupons are available right now.</p>
            ) : (
              <ul className="profile-coupon-list">
                {coupons
                  .filter((coupon) => {
                    const isExpired =
                      coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
                    const isExhausted =
                      coupon.maxUses !== -1 &&
                      coupon.maxUses !== undefined &&
                      coupon.usedCount >= coupon.maxUses;
                    return !isExpired && !isExhausted;
                  })
                  .map((coupon) => (
                    <li key={coupon.id} className="profile-coupon-item">
                      <div className="profile-coupon-code">{coupon.code}</div>
                      <strong>
                        {coupon.discountType === "percentage"
                          ? `${coupon.discount}% off`
                          : `₹${coupon.discount} off`}
                      </strong>
                      <p>{coupon.description}</p>
                      <span>
                        Min. order: ₹{coupon.minOrderAmount || 0}
                        {coupon.expiryDate
                          ? ` · Expires ${new Date(coupon.expiryDate).toLocaleDateString()}`
                          : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
