import React from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100vh", backgroundColor: "#EDE6D6"
    }}>
      <h1 style={{ color: "#708238" }}>OL OliveLine</h1>
      <p style={{ color: "#4E342E" }}>Holy Land Olive Wood Souvenirs</p>
      <button
        onClick={handleLogin}
        style={{
          backgroundColor: "#708238",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer"
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}

export default Login;
