// Login.js
import React from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user?.email) {
        await signOut(auth);
        alert("Login failed. No email found.");
        return;
      }

      const email = user.email.toLowerCase();

      // 1️⃣ Check allowlist
      const allowRef = doc(db, "allowedUsers", email);
      const allowSnap = await getDoc(allowRef);

      if (!allowSnap.exists()) {
        await signOut(auth);
        alert("Your account is not authorized. Please contact OliveLine.");
        return;
      }

      const { role, customerId = null } = allowSnap.data();

      // 2️⃣ Create / update user doc
      const userRef = doc(db, "users", user.uid);

      await setDoc(
        userRef,
        {
          name: user.displayName || "",
          email: user.email,
          role,
          customerId, // ✅ may be null for admins
          lastLoginAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        },
        { merge: true }
      );

      // 3️⃣ Redirect
      if (role === "admin") {
        navigate("/catalog");
      } else {
        navigate("/catalog");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed. Please try again.");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        backgroundColor: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1 style={{ color: OLIVE, fontSize: 32, fontWeight: "bold" }}>
        OliveLine
      </h1>
      <p style={{ color: BROWN, marginBottom: 20 }}>
        Holy Land Olive Wood Souvenirs
      </p>

      <button
        onClick={handleLogin}
        style={{
          backgroundColor: OLIVE,
          color: "white",
          padding: "12px 28px",
          borderRadius: 8,
          border: "none",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}
