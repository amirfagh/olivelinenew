// src/pages/Login.js
import React, { useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, Timestamp, addDoc, collection } from "firebase/firestore";

import logo from "../assets/oliveline-logo2.png";

// put 3–6 product images here
import p1 from "../assets/oliveline-logo.png";
import p2 from "../assets/oliveline-logo2.png";
import p3 from "../assets/oliveline-logo4.png";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

export default function Login() {
  const navigate = useNavigate();

  // ----- simple carousel
  const images = useMemo(() => [p1, p2, p3], []);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((x) => (x + 1) % images.length), 2800);
    return () => clearInterval(t);
  }, [images.length]);

  // ----- lead / signup form
  const [lead, setLead] = useState({
    name: "",
    shopName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [leadSent, setLeadSent] = useState(false);
  const [sending, setSending] = useState(false);

  const whatsappLink = useMemo(() => {
    const phone = "972525454174"; // international format, no +
    const text = encodeURIComponent("Hi OliveLine, I'm interested in wholesale olive wood souvenirs.");
    return `https://wa.me/${phone}?text=${text}`;
  }, []);

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

      // 1) Check allowlist
      const allowRef = doc(db, "allowedUsers", email);
      const allowSnap = await getDoc(allowRef);

      if (!allowSnap.exists()) {
        await signOut(auth);
        alert("Your account is not authorized yet. Please request access below.");
        return;
      }

      const { role, customerId = null } = allowSnap.data();

      // 2) Create / update user doc
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          name: user.displayName || "",
          email: user.email,
          role,
          customerId,
          lastLoginAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        },
        { merge: true }
      );

      navigate("/catalog");
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed. Please try again.");
    }
  };

  const submitLead = async () => {
    if (!lead.name || !lead.email) {
      alert("Please enter at least your name and email.");
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, "leads"), {
        ...lead,
        createdAt: Timestamp.now(),
        source: "login-page",
        status: "new",
      });
      setLeadSent(true);
      setLead({ name: "", shopName: "", email: "", phone: "", message: "" });
    } catch (e) {
      console.error("Lead submit error:", e);
      alert("Could not send. Please try WhatsApp instead.");
    } finally {
      setSending(false);
    }
  };

  const badges = useMemo(
    () => [
      "Direct from manufacturers",
      "Tiered pricing",
      "Fast quotations",
      "Fast delivery",
      "High quality olive wood souvenirs",
    ],
    []
  );

  return (
    <div
      className="
      relative
        min-h-screen w-full
        flex flex-col lg:flex-row
        lg:h-screen lg:overflow-hidden
      "
      style={{ backgroundImage: `linear-gradient(180deg, ${CREAM}, ${SOFTWHITE})` }}
    >
      {/* RIGHT (LOGIN) — FIRST ON MOBILE */}
      <div
        className="
          order-1 lg:order-2
          w-full lg:w-[460px]
          px-4 sm:px-8 lg:px-10
          py-5 sm:py-8 lg:py-10
          flex items-start lg:items-center justify-center
          border-b lg:border-b-0 lg:border-l
          bg-white/60 backdrop-blur-md
        "
        style={{ borderColor: "rgba(78,52,46,0.12)" }}
      >
        <div
          className="
            w-full
            max-w-[560px] lg:max-w-none
            bg-white
            rounded-3xl
            border
            shadow-[0_12px_34px_rgba(0,0,0,0.08)]
            overflow-hidden
          "
          style={{ borderColor: "rgba(78,52,46,0.12)" }}
        >
          {/* Card header */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] sm:text-[22px] font-extrabold" style={{ color: BROWN }}>
                  Sign in
                </h2>
                <p className="mt-1 text-[12.5px] sm:text-[13px]" style={{ color: BROWN, opacity: 0.78 }}>
                  Authorized customers and admins can sign in with Google.
                </p>
              </div>

              {/* Small pill */}
              <div
                className="shrink-0 hidden sm:inline-flex items-center rounded-full px-3 py-1 text-[12px] font-extrabold border bg-white"
                style={{ color: BROWN, borderColor: "rgba(78,52,46,0.14)" }}
              >
                B2B Access
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="
                mt-4 w-full
                rounded-2xl
                px-4 py-3.5
                text-[14px]
                font-extrabold
                text-white
                shadow-[0_10px_24px_rgba(0,0,0,0.12)]
                hover:opacity-95 active:opacity-90
                transition
              "
              style={{ backgroundColor: OLIVE }}
            >
              Continue with Google
            </button>

            <div className="mt-4 h-px" style={{ backgroundColor: "rgba(78,52,46,0.10)" }} />
          </div>

          {/* Lead section */}
          <div className="px-5 sm:px-6 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-black" style={{ color: BROWN }}>
                  New shop?
                </h3>
                <p className="mt-1 text-[13px]" style={{ color: BROWN, opacity: 0.8 }}>
                  Request access and we’ll contact you.
                </p>
              </div>
              <div className="hidden md:block text-right text-[12px]" style={{ color: BROWN, opacity: 0.65 }}>
                Reply within<br />1 business day
              </div>
            </div>

            {leadSent ? (
              <div
                className="mt-4 rounded-2xl px-4 py-3 text-[13px] font-extrabold border"
                style={{
                  backgroundColor: "#E9F6EA",
                  borderColor: "rgba(112,130,56,0.35)",
                  color: BROWN,
                }}
              >
                ✅ Thanks! We received your request. We’ll contact you soon.
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-2.5">
                  <Input
                    placeholder="Your name *"
                    value={lead.name}
                    onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  />
                  <Input
                    placeholder="Shop name"
                    value={lead.shopName}
                    onChange={(e) => setLead({ ...lead, shopName: e.target.value })}
                  />
                  <Input
                    placeholder="Email *"
                    value={lead.email}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                  />
                  <Input
                    placeholder="Phone / WhatsApp"
                    value={lead.phone}
                    onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                  />

                  <textarea
                    placeholder="Message (what products / quantities?)"
                    value={lead.message}
                    onChange={(e) => setLead({ ...lead, message: e.target.value })}
                    className="
                      w-full
                      rounded-2xl
                      border
                      px-3.5 py-3
                      text-[14px]
                      outline-none
                      focus:ring-2 focus:ring-offset-0
                      min-h-[92px]
                      resize-none
                      bg-white
                    "
                    style={{
                      borderColor: "rgba(78,52,46,0.18)",
                      color: BROWN,
                      boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                    }}
                  />
                </div>

                <button
                  onClick={submitLead}
                  disabled={sending}
                  className="
                    mt-3.5 w-full
                    rounded-2xl
                    px-4 py-3.5
                    text-[14px]
                    font-black
                    text-white
                    hover:opacity-95
                    disabled:opacity-70
                    disabled:cursor-not-allowed
                    transition
                  "
                  style={{ backgroundColor: BROWN }}
                >
                  {sending ? "Sending..." : "Request Access"}
                </button>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="
                    mt-2.5 block w-full
                    rounded-2xl
                    px-4 py-3.5
                    text-center
                    font-black
                    border
                    hover:bg-black/5
                    transition
                  "
                  style={{
                    borderColor: "rgba(78,52,46,0.2)",
                    color: BROWN,
                    textDecoration: "none",
                  }}
                >
                  Message us on WhatsApp
                </a>

                <div className="mt-2 text-[12px] md:hidden" style={{ color: BROWN, opacity: 0.65 }}>
                  We usually reply within 1 business day.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LEFT (MARKETING) — SECOND ON MOBILE */}
      <div className=" lg:order-1 flex-1 px-4 sm:px-8 lg:px-10 py-6 lg:py-10 flex flex-col gap-4 min-w-0">
        {/* logo */}
        <img src={logo} alt="OliveLine" className="h-[88px] sm:h-[110px] lg:h-[140px] w-auto object-contain" />

        <div className="max-w-2xl">
          <h1
            className="text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold tracking-[-0.4px] leading-tight"
            style={{ color: BROWN }}
          >
            Wholesale Olive Wood Souvenirs
          </h1>
          <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed" style={{ color: BROWN, opacity: 0.85 }}>
            OliveLine connects souvenir shops directly with trusted olive wood manufacturers. Transparent quotations,
            tiered pricing, and tracked delivery — built for B2B.
          </p>

          {/* badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((t) => (
              <div
                key={t}
                className="bg-white rounded-2xl px-3 py-2 text-[12px] sm:text-[13px] font-extrabold border"
                style={{ color: BROWN, borderColor: "rgba(78,52,46,0.15)" }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Square carousel - desktop only */}
        <div
          className="
            mt-2
            w-full max-w-[520px]
            rounded-3xl overflow-hidden
            border
            shadow-[0_12px_34px_rgba(0,0,0,0.08)]
            bg-white
            aspect-square
            hidden lg:block
          "
          style={{ borderColor: "rgba(78,52,46,0.12)" }}
        >
          <img src={images[idx]} alt="Olive wood products" className="w-full h-full object-cover block" />
        </div>
     

        
        
      </div>
      {/* Global footer (always bottom) */}
<div
  className="
    w-full
    px-4 sm:px-8 lg:px-10
    py-3
    text-center
    text-[12px]
    border-t
    bg-white/30
    lg:absolute lg:bottom-0 lg:left-0
  "
  style={{ color: BROWN, borderColor: "rgba(78,52,46,0.12)" }}
>
  <div style={{ opacity: 0.8 }}>
    By continuing, you agree to OliveLine’s quotation and ordering terms.
  </div>
  <div className="mt-1" style={{ opacity: 0.75 }}>
    © {new Date().getFullYear()} OliveLine. Created by Amir Ghareeb.
  </div>
</div>

    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="
        w-full
        rounded-2xl
        border
        px-3.5 py-3
        text-[14px]
        outline-none
        focus:ring-2 focus:ring-offset-0
        bg-white
      "
      style={{
        borderColor: "rgba(78,52,46,0.18)",
        color: BROWN,
      }}
    />
  );
}
