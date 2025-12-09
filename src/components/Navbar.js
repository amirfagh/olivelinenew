import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <nav className="bg-olive text-softwhite px-6 py-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">

        {/* Brand */}
        <Link to="/" className="text-xl font-bold tracking-wide hover:opacity-85">
          OL OliveLine
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6 items-center">

          {role === "admin" && (
            <Link
              to="/dashboard"
              className={`hover:text-cream transition ${
                location.pathname === "/dashboard" ? "underline" : ""
              }`}
            >
              Dashboard
            </Link>
          )}

          {role === "admin" && (
            <Link
              to="/admin-add-user"
              className={`hover:text-cream transition ${
                location.pathname === "/admin-add-user" ? "underline" : ""
              }`}
            >
              Add User
            </Link>
          )}
{role === "admin" && (
              <Link to="/orders" className="hover:text-olive">Orders</Link>
            )}
          <Link
            to="/catalog"
            className={`hover:text-cream transition ${
              location.pathname === "/catalog" ? "underline" : ""
            }`}
          >
            Catalog
          </Link>

          <button
            onClick={handleLogout}
            className="bg-softwhite text-olive px-4 py-1 rounded-md hover:bg-cream shadow transition"
          >
            Logout
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden text-softwhite"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden mt-3 flex flex-col gap-3 bg-cream text-brown p-4 rounded-lg shadow">

          {role === "admin" && (
            <Link to="/dashboard" className="hover:text-olive">
              Dashboard
            </Link>
          )}

          {role === "admin" && (
            <Link to="/admin-add-user" className="hover:text-olive">
              Add User
            </Link>
          )}
            {role === "admin" && (
              <Link to="/orders" className="hover:text-olive">Orders</Link>
            )}

          <Link to="/catalog" className="hover:text-olive">
            Catalog
          </Link>

          <button
            onClick={handleLogout}
            className="bg-softwhite text-olive px-4 py-1 rounded-md hover:bg-brown hover:text-softwhite transition"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
