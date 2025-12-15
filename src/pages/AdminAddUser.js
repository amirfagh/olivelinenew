// AdminAddUser.js
import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase/firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

export default function AdminAddUser() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [message, setMessage] = useState("");

  // Load customers (admin-only list)
  useEffect(() => {
    const loadCustomers = async () => {
      const snap = await getDocs(collection(db, "customers"));
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadCustomers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email) {
      setMessage("Please enter an email.");
      return;
    }

    if (role !== "admin" && !customerId) {
      setMessage("Please select a customer for this user.");
      return;
    }

    const emailLower = email.toLowerCase();
    const ref = doc(db, "allowedUsers", emailLower);

    const snap = await getDoc(ref);
    if (snap.exists()) {
      setMessage("This user already exists in the allowlist.");
      return;
    }

    try {
      await setDoc(ref, {
        allowed: true,
        role,
        customerId: role === "admin" ? null : customerId,
        createdAt: Timestamp.now(),
      });

      setMessage(`User ${emailLower} added successfully.`);
      setEmail("");
      setRole("viewer");
      setCustomerId("");
    } catch (err) {
      console.error(err);
      setMessage("Error adding user. See console.");
    }
  };

  return (
    <>
      <Navbar />

      <div
        className="max-w-md mx-auto mt-16 p-6 rounded-xl shadow-sm"
        style={{ backgroundColor: SOFTWHITE, border: `1px solid ${BROWN}33` }}
      >
        <h2
          className="text-2xl font-semibold text-center mb-6"
          style={{ color: BROWN }}
        >
          Add New User
        </h2>

        <form className="flex flex-col gap-5" onSubmit={handleAddUser}>
          {/* Email */}
          <label className="font-medium" style={{ color: BROWN }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: CREAM,
                borderColor: `${BROWN}55`,
              }}
              required
            />
          </label>

          {/* Role */}
          <label className="font-medium" style={{ color: BROWN }}>
            Role
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value === "admin") {
                  setCustomerId("");
                }
              }}
              className="mt-1 w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: CREAM,
                borderColor: `${BROWN}55`,
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {/* Customer selector (only for non-admins) */}
          {role !== "admin" && (
            <label className="font-medium" style={{ color: BROWN }}>
              Customer
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: CREAM,
                  borderColor: `${BROWN}55`,
                }}
                required
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="py-2 rounded-lg font-semibold text-white transition"
            style={{
              backgroundColor: OLIVE,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = BROWN)}
            onMouseOut={(e) => (e.currentTarget.style.background = OLIVE)}
          >
            Add User
          </button>
        </form>

        {/* Message */}
        {message && (
          <div
            className="mt-5 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: CREAM,
              border: `1px solid ${BROWN}33`,
              color: BROWN,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </>
  );
}
