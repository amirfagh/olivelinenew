import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

function Navbar() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);

  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setRole(snap.data().role);
      }
    };

    fetchRole();
  }, []);

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
      padding: "10px 20px",
    }}>
      <h2>OL OliveLine</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* Only show Dashboard if user is ADMIN */}
        {role === "admin" && (
          <Link to="/dashboard" style={{ color: "white", textDecoration: "none" }}>
            Dashboard
          </Link>
        )}
{role === "admin" && (
  <Link to="/admin-add-user" style={{ color: "white", textDecoration: "none" }}>
    Add User
  </Link>
)}

        <Link to="/catalog" style={{ color: "white", textDecoration: "none" }}>
          Catalog
        </Link>

        <button
          onClick={handleLogout}
          style={{
            backgroundColor: "white",
            color: "#708238",
            border: "none",
            borderRadius: "6px",
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
