import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import logo from "../assets/oliveline-logo3.png";
import logo2 from "../assets/oliveline-logo44.png";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close drawer when route changes (nice UX)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const linkClass =
    "block py-2 px-2 rounded hover:bg-[#EDE6D6] hover:text-[#708238] transition-colors";

  const desktopLinkClass = "hover:text-[#EDE6D6] transition-colors";

  // Build role-based links in one place
  const links = [];

  if (role === "admin") {
    links.push(
      { to: "/dashboard", label: "Dashboard" },
      { to: "/admin-customers", label: "Customers" },
      { to: "/orders", label: "Orders" },
      { to: "/admin-order-approval", label: "Approvals" },
      { to: "/catalog", label: "Catalog" },
      { to: "/ManufacturersReports", label: "Manufacturers Reports" }
    );
  }

  if (role === "viewer") {
    links.push(
      { to: "/catalog", label: "Catalog" },
      { to: "/my-orders", label: "My Orders" }
    );
  }

  if (role === "editor") {
    links.push(
      { to: "/catalog", label: "Catalog" },
      { to: "/orders", label: "Orders" }
    );
  }

  return (
    <>
      <nav className="bg-[#708238] text-[#FAF9F6] shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo / Brand */}
          <Link
            to="/catalog"
            className="flex items-center min-w-0 flex-shrink overflow-hidden"
          >
            <img
              src={logo}
              alt="OliveLine Logo"
              className="
                object-contain
                h-12
                xs:h-14
                sm:h-16
                md:h-20
              "
            />

            <img
              src={logo2}
              alt="OliveLine Logo"
              className="
                object-contain
                -ml-4
                h-10
                xs:h-12
                sm:h-14
                md:h-16
              "
            />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={desktopLinkClass}>
                {l.label}
              </Link>
            ))}

            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-1.5 rounded-md bg-[#FAF9F6] text-[#708238] text-sm font-semibold hover:bg-[#EDE6D6] transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-[#FAF9F6]/40 hover:bg-[#FAF9F6]/10 transition flex-shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute right-0 top-0 h-full w-72 bg-[#708238] text-[#FAF9F6] shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">Menu</div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-10 h-10 rounded-md border border-[#FAF9F6]/40 hover:bg-[#FAF9F6]/10 transition"
                aria-label="Close menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={linkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full px-3 py-2 rounded-md bg-[#FAF9F6] text-[#708238] text-sm font-semibold hover:bg-[#EDE6D6] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;