import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#708238",
      color: "white",
      padding: "10px 20px"
    }}>
      <h2>OL OliveLine</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <Link to="/dashboard" style={{ color: "white", textDecoration: "none" }}>Dashboard</Link>
        <Link to="/catalog" style={{ color: "white", textDecoration: "none" }}>Catalog</Link>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: "white",
            color: "#708238",
            border: "none",
            borderRadius: "6px",
            padding: "5px 10px",
            cursor: "pointer"
          }}>
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
