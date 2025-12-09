import React, { useState } from "react";
import { db } from "../firebase/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Navbar from "../components/Navbar";

function AdminAddUser() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [message, setMessage] = useState("");

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!email) {
      setMessage("Please enter an email.");
      return;
    }

    const emailLower = email.toLowerCase();
    const userRef = doc(db, "allowedUsers", emailLower);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      setMessage("This user is already in the allowlist.");
      return;
    }

    try {
      await setDoc(userRef, {
        allowed: true,
        role: role.trim(),
      });
      setMessage(`User ${emailLower} added successfully as ${role}.`);
      setEmail("");
      setRole("viewer");
    } catch (error) {
      console.error(error);
      setMessage("Error adding user. Check console.");
    }
  };

  return (
    <>
      <Navbar />

      <div className="max-w-md mx-auto mt-16 p-6 bg-softwhite border border-brown/20 rounded-xl shadow-sm">
        <h2 className="text-2xl font-semibold text-center text-brown mb-6">
          Add New User
        </h2>

        <form className="flex flex-col gap-5" onSubmit={handleAddUser}>
          {/* Email */}
          <label className="flex flex-col gap-1 font-medium text-brown">
            Email:
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@gmail.com"
              required
              className="px-3 py-2 bg-cream border border-brown/30 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-olive/50 text-brown"
            />
          </label>

          {/* Role */}
          <label className="flex flex-col gap-1 font-medium text-brown">
            Role:
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 bg-cream border border-brown/30 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-olive/50 text-brown"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="bg-olive text-softwhite py-2 rounded-lg font-semibold 
                       hover:bg-brown transition-colors"
          >
            Add User
          </button>
        </form>

        {/* Message */}
        {message && (
          <p className="mt-5 p-3 bg-cream border border-brown/20 rounded-lg text-brown shadow-sm">
            {message}
          </p>
        )}
      </div>
    </>
  );
}

export default AdminAddUser;
