import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function CustomerProfile() {
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState({
    companyName: "",
    registrationNumber: "",
    address: "",
    city: "",
    phone: "",

    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",

    accountantName: "",
    accountantPosition: "",
    accountantPhone: "",
  });

  // Load profile if exists
  useEffect(() => {
    if (!uid) return;

    const loadProfile = async () => {
      const ref = doc(db, "customers", uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile({
          ...profile,
          ...snap.data(),
        });
      }
      setLoading(false);
    };

    loadProfile();
  }, [uid]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (
      !profile.companyName ||
      !profile.registrationNumber ||
      !profile.address ||
      !profile.city ||
      !profile.phone ||
      !profile.contactName ||
      !profile.contactPhone
    ) {
      setMessage("Please fill in all required fields.");
      return;
    }

    try {
      await setDoc(
        doc(db, "customers", uid),
        {
          ...profile,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setMessage("Profile saved successfully.");
    } catch (err) {
      console.error(err);
      setMessage("Error saving profile.");
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="text-center mt-10 text-lg text-[#4E342E]">
          Loading profile...
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="max-w-4xl mx-auto p-8 bg-[#FAF9F6] mt-10 rounded-xl shadow">

        <h1 className="text-3xl font-bold text-[#4E342E] mb-6">
          Customer Account Card
        </h1>

        <form className="space-y-8" onSubmit={handleSave}>
          {/* Company Info */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-[#708238] mb-4">
              Company Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Company Name *"
                value={profile.companyName}
                onChange={(e) =>
                  setProfile({ ...profile, companyName: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder='Registration Number (ח"פ / ע"מ) *'
                value={profile.registrationNumber}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    registrationNumber: e.target.value,
                  })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Address *"
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="City *"
                value={profile.city}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Company Phone *"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="p-3 border rounded"
              />
            </div>
          </section>

          {/* Main Contact */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-[#708238] mb-4">
              Main Contact Person
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Full Name *"
                value={profile.contactName}
                onChange={(e) =>
                  setProfile({ ...profile, contactName: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Position"
                value={profile.contactPosition}
                onChange={(e) =>
                  setProfile({ ...profile, contactPosition: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Phone *"
                value={profile.contactPhone}
                onChange={(e) =>
                  setProfile({ ...profile, contactPhone: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="email"
                placeholder="Email"
                value={profile.contactEmail}
                onChange={(e) =>
                  setProfile({ ...profile, contactEmail: e.target.value })
                }
                className="p-3 border rounded"
              />
            </div>
          </section>

          {/* Accounting */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-[#708238] mb-4">
              Accounting Department (Optional)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={profile.accountantName}
                onChange={(e) =>
                  setProfile({ ...profile, accountantName: e.target.value })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Position"
                value={profile.accountantPosition}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    accountantPosition: e.target.value,
                  })
                }
                className="p-3 border rounded"
              />

              <input
                type="text"
                placeholder="Phone"
                value={profile.accountantPhone}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    accountantPhone: e.target.value,
                  })
                }
                className="p-3 border rounded"
              />
            </div>
          </section>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full bg-[#708238] hover:bg-[#5e6c2c] text-white py-3 rounded-lg font-semibold text-lg"
          >
            Save Profile
          </button>

          {message && (
            <p className="text-center mt-4 text-[#4E342E] font-medium">
              {message}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
