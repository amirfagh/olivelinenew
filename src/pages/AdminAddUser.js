import React, { useState } from "react";
import { db } from "../firebase/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

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
        role: role.trim(), // remove spaces just in case
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
    <div style={{
      maxWidth: "400px",
      margin: "50px auto",
      padding: "20px",
      border: "1px solid #ccc",
      borderRadius: "8px",
      backgroundColor: "#f9f9f9",
    }}>
      <h2>Add New User</h2>

      <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@gmail.com"
            required
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </label>

        <label>
          Role:
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>

        <button type="submit" style={{
          backgroundColor: "#708238",
          color: "white",
          border: "none",
          padding: "10px",
          borderRadius: "6px",
          cursor: "pointer"
        }}>
          Add User
        </button>
      </form>

      {message && <p style={{ marginTop: "15px", color: "#333" }}>{message}</p>}
    </div>
  );
}

export default AdminAddUser;
