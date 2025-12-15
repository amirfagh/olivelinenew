// AdminCreateCustomer.js
import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { auth, db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

export default function AdminCreateCustomer() {
  const [role, setRole] = useState(null);
  const [message, setMessage] = useState("");

  const [customer, setCustomer] = useState({
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

  // --- check admin role ---
  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setRole(snap.data().role);
      }
    };
    checkRole();
  }, []);

  const handleChange = (field, value) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // Required fields
    const required = [
      "companyName",
      "registrationNumber",
      "address",
      "city",
      "phone",
      "contactName",
      "contactPhone",
    ];

    for (const field of required) {
      if (!customer[field]) {
        setMessage("Please fill all required fields.");
        return;
      }
    }

    try {
      await addDoc(collection(db, "customers"), {
        ...customer,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: auth.currentUser.uid,
      });

      setMessage("Customer created successfully.");

      setCustomer({
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
    } catch (err) {
      console.error(err);
      setMessage("Error creating customer.");
    }
  };

  if (role && role !== "admin") {
    return (
      <>
        <Navbar />
        <div className="max-w-xl mx-auto mt-20 text-center text-[#4E342E]">
          <h1 className="text-xl font-bold">Admin Access Only</h1>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="max-w-4xl mx-auto p-8 mt-10 bg-[#FAF9F6] rounded-xl shadow">
        <h1 className="text-3xl font-bold text-[#4E342E] mb-6">
          Create Customer Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Company */}
          <Section title="Company Information">
            <Input label="Company Name *" value={customer.companyName} onChange={(v) => handleChange("companyName", v)} />
            <Input label='Registration Number (ח"פ / ע"מ) *' value={customer.registrationNumber} onChange={(v) => handleChange("registrationNumber", v)} />
            <Input label="Address *" value={customer.address} onChange={(v) => handleChange("address", v)} />
            <Input label="City *" value={customer.city} onChange={(v) => handleChange("city", v)} />
            <Input label="Company Phone *" value={customer.phone} onChange={(v) => handleChange("phone", v)} />
          </Section>

          {/* Contact */}
          <Section title="Main Contact Person">
            <Input label="Full Name *" value={customer.contactName} onChange={(v) => handleChange("contactName", v)} />
            <Input label="Position" value={customer.contactPosition} onChange={(v) => handleChange("contactPosition", v)} />
            <Input label="Phone *" value={customer.contactPhone} onChange={(v) => handleChange("contactPhone", v)} />
            <Input label="Email" value={customer.contactEmail} onChange={(v) => handleChange("contactEmail", v)} />
          </Section>

          {/* Accounting */}
          <Section title="Accounting Department (Optional)">
            <Input label="Name" value={customer.accountantName} onChange={(v) => handleChange("accountantName", v)} />
            <Input label="Position" value={customer.accountantPosition} onChange={(v) => handleChange("accountantPosition", v)} />
            <Input label="Phone" value={customer.accountantPhone} onChange={(v) => handleChange("accountantPhone", v)} />
          </Section>

          <button
            type="submit"
            className="w-full py-3 rounded-lg text-white font-semibold text-lg"
            style={{ backgroundColor: OLIVE }}
          >
            Create Customer
          </button>

          {message && (
            <p className="text-center mt-4 font-medium text-[#4E342E]">
              {message}
            </p>
          )}
        </form>
      </div>
    </>
  );
}

/* ---------- Small reusable components ---------- */

function Section({ title, children }) {
  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-[#708238] mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="p-3 border rounded"
    />
  );
}
