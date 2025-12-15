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
        const r = (snap.data().role || "").trim();
        setRole(r);
      }
    };

    fetchRole();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <nav className="bg-[#708238] text-[#FAF9F6] shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link to="/catalog" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-[#FAF9F6]/60 flex items-center justify-center text-xs font-bold">
            OL
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-wide text-sm">
              OliveLine
            </span>
            <span className="text-[11px] text-[#FAF9F6]/80">
              B2B Olivewood Supply
            </span>
          </div>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-4 text-sm">
          {/* Admin links */}
          {role === "admin" && (
            <>
              <Link
                to="/dashboard"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Dashboard
              </Link>
                <Link to="/admin-customers" className="hover:text-[#EDE6D6] transition-colors">
      Customers
    </Link>
              <Link
                to="/orders"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Orders
              </Link>
              <Link
      to="/admin-order-approval"
      className="hover:text-[#EDE6D6] transition-colors"
    >
      Approvals
    </Link>
              <Link
                to="/admin-add-user"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Add User
              </Link>
              <Link
                to="/catalog"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Catalog
              </Link>
              <Link
                to="/Cusromer-add"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Customer Add
              </Link>
            </>
          )}

          {/* Viewer links */}
          {role === "viewer" && (
            <>
              <Link
                to="/catalog"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Catalog
              </Link>
                <Link to="/my-orders" className="hover:text-[#EDE6D6] transition-colors">
    My Orders
  </Link>
              
            </>
          )}

          {/* Editor (if you want something in between) */}
          {role === "editor" && (
            <>
              <Link
                to="/catalog"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Catalog
              </Link>
              <Link
                to="/orders"
                className="hover:text-[#EDE6D6] transition-colors"
              >
                Orders
              </Link>
            </>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1.5 rounded-md bg-[#FAF9F6] text-[#708238] text-sm font-semibold hover:bg-[#EDE6D6] transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
