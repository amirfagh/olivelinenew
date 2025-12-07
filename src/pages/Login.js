import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";

function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check allowlist
    const email = user.email.toLowerCase();
    const allowRef = doc(db, "allowedUsers", email);
    const allowSnap = await getDoc(allowRef);

    // If NOT allowed → block login
    if (!allowSnap.exists()) {
      alert("Your account is not authorized. Please contact the administrator.");
      await auth.signOut();
      return;
    }

    // Get the role from the allowlist
    const { role } = allowSnap.data();

    // Create or update user doc
    const userRef = doc(db, "users", user.uid);

    await setDoc(userRef, {
      name: user.displayName,
      email: user.email,
      role: role,      // Assign role from allowlist
      createdAt: new Date()
    }, { merge: true });

    navigate("/catalog");

  } catch (error) {
    console.error("Login error:", error);
  }
};


  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#EDE6D6",
      }}
    >
      <h1 style={{ color: "#708238" }}>OL OliveLine</h1>
      <p style={{ color: "#4E342E" }}>Holy Land Olive Wood Souvenirs</p>

      <button
        onClick={handleLogin}
        style={{
          backgroundColor: "#708238",
          color: "white",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          cursor: "pointer",
          marginTop: "10px",
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}

export default Login;
