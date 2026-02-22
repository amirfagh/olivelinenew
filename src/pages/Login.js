// src/pages/Login.js
import React, { useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, Timestamp, addDoc, collection } from "firebase/firestore";

import logo from "../assets/oliveline-logo2.png";

// Put 3–6 product images here (REAL product photos will look 10x better than logos)
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
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((x) => (x + 1) % images.length);
        setFade(true);
      }, 180);
    }, 3200);
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
      "High quality olive wood",
    ],
    []
  );

  const goTo = (i) => {
    setFade(false);
    setTimeout(() => {
      setIdx(i);
      setFade(true);
    }, 160);
  };

  return (
    <div
      className="lg:h-screen w-full flex flex-col items-center justify-center lg:overflow-hidden min-h-screen"
      style={{
        backgroundImage: `radial-gradient(900px 500px at 12% 18%, rgba(112,130,56,0.14), transparent 60%),
                          radial-gradient(800px 450px at 80% 32%, rgba(78,52,46,0.10), transparent 55%),
                          linear-gradient(180deg, ${CREAM}, ${SOFTWHITE})`,
      }}
    >
      {/* MOBILE TOP LOGO */}
<div className="lg:hidden w-full flex justify-center pt-6 pb-2">
  <img
    src={logo}
    alt="OliveLine"
    className="h-[70px] w-auto object-contain"
  />
</div>
      <div className="w-full max-w-[1400px] h-full flex flex-col lg:flex-row gap-8 lg:gap-12 px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        
        {/* LEFT (MARKETING) — SECOND ON MOBILE, FIRST ON DESKTOP */}
        <div className="order-2 lg:order-1 flex-1 flex flex-col min-h-0 h-full">
          {/* Logo row */}
          <div className="hidden lg:flex justify-start shrink-0 pb-6">  
            <img
              src={logo}
              alt="OliveLine"
              className="h-[60px] sm:h-[70px] lg:h-[190px] w-auto object-contain"
            />
          </div>

          <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 min-h-0">
            {/* Text Content */}
            <div className="flex-1 flex flex-col justify-center shrink-0">
              

              <h1
                className="mt-4 text-[32px] sm:text-[40px] lg:text-[44px] xl:text-[52px] font-extrabold tracking-[-0.6px] leading-[1.05]"
                style={{ color: BROWN }}
              >
                Wholesale Olive <br className="hidden lg:block" />
                Wood Souvenirs
              </h1>

              <p
                className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] leading-relaxed max-w-xl"
                style={{ color: BROWN, opacity: 0.82 }}
              >
                OliveLine connects souvenir shops directly with trusted olive wood manufacturers.
                Transparent quotations, tiered pricing, and tracked delivery — built for B2B.
              </p>

              {/* Badges */}
              <div className="mt-5 flex flex-wrap gap-2 max-w-xl">
                {badges.map((t) => (
                  <div
                    key={t}
                    className="rounded-xl px-3 py-2 text-[12px] sm:text-[13px] font-bold border bg-white/80 shadow-sm"
                    style={{ color: BROWN, borderColor: "rgba(78,52,46,0.14)" }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Image / Carousel (Dynamically sized to fit remaining space) */}
            <div className="flex-1 relative flex flex-col justify-center min-h-[250px] lg:min-h-0 mt-6 lg:mt-0">
              {/* soft glow */}
              <div
                className="absolute -inset-4 rounded-[32px] blur-2xl opacity-60 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(50% 50% at 50% 50%, rgba(112,130,56,0.22), transparent 70%)",
                }}
              />

              <div
                className="relative rounded-3xl overflow-hidden border bg-white shadow-[0_18px_55px_rgba(0,0,0,0.12)] w-full h-full max-h-[400px]"
                style={{ borderColor: "rgba(78,52,46,0.12)" }}
              >
                <img
                  src={images[idx]}
                  alt="Olive wood products"
                  className={`w-full h-full object-cover block transition-opacity duration-300 ${
                    fade ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Dots */}
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className="h-2 w-2 rounded-full border transition"
                      style={{
                        backgroundColor: i === idx ? BROWN : "rgba(255,255,255,0.85)",
                        borderColor: "rgba(78,52,46,0.18)",
                        opacity: i === idx ? 1 : 0.75,
                      }}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 shrink-0 text-center lg:text-left text-[11px]" style={{ color: BROWN, opacity: 0.65 }}>
            <div>By continuing, you agree to OliveLine’s quotation and ordering terms.</div>
            <div className="mt-0.5">© {new Date().getFullYear()} OliveLine. Created by Amir Ghareeb.</div>
          </div>
        </div>

        {/* RIGHT (LOGIN) — FIRST ON MOBILE, SECOND ON DESKTOP */}
        <div className="order-1 lg:order-2 w-full lg:w-[420px] shrink-0 flex flex-col justify-center h-full">
          <div
            className="bg-white/70 backdrop-blur-md border rounded-3xl shadow-[0_18px_50px_rgba(0,0,0,0.08)] flex flex-col max-h-full"
            style={{ borderColor: "rgba(78,52,46,0.12)" }}
          >
            {/* Scrollable inner content just in case the laptop screen is vertically very tiny */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-extrabold" style={{ color: BROWN }}>
                    Sign in
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: BROWN, opacity: 0.75 }}>
                    Authorized customers and admins can sign in with Google.
                  </p>
                </div>
                <div
                  className="shrink-0 hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-white"
                  style={{ color: BROWN, borderColor: "rgba(78,52,46,0.14)" }}
                >
                  B2B Access
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="mt-4 w-full rounded-2xl px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:opacity-95 active:opacity-90 transition"
                style={{ backgroundColor: OLIVE }}
              >
                Continue with Google
              </button>

              <div className="my-5 h-px w-full" style={{ backgroundColor: "rgba(78,52,46,0.10)" }} />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-black" style={{ color: BROWN }}>
                    New shop?
                  </h3>
                  <p className="mt-0.5 text-[12px]" style={{ color: BROWN, opacity: 0.75 }}>
                    Request access and we’ll contact you.
                  </p>
                </div>
              </div>

              {leadSent ? (
                <div
                  className="mt-4 rounded-xl px-4 py-3 text-[12px] font-extrabold border"
                  style={{ backgroundColor: "#E9F6EA", borderColor: "rgba(112,130,56,0.35)", color: BROWN }}
                >
                  ✅ Thanks! We received your request. We’ll contact you soon.
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <Input placeholder="Your name *" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                    <Input placeholder="Shop name" value={lead.shopName} onChange={(e) => setLead({ ...lead, shopName: e.target.value })} />
                    <Input placeholder="Email *" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                    <Input placeholder="Phone / WhatsApp" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
                    <textarea
                      placeholder="Message (what products / quantities?)"
                      value={lead.message}
                      onChange={(e) => setLead({ ...lead, message: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-offset-0 min-h-[60px] resize-none bg-white"
                      style={{ borderColor: "rgba(78,52,46,0.18)", color: BROWN }}
                    />
                  </div>

                  <button
                    onClick={submitLead}
                    disabled={sending}
                    className="mt-3 w-full rounded-2xl px-4 py-3 text-[13px] font-black text-white hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed transition"
                    style={{ backgroundColor: BROWN }}
                  >
                    {sending ? "Sending..." : "Request Access"}
                  </button>

                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block w-full rounded-2xl px-4 py-3 text-center text-[13px] font-black border hover:bg-black/5 transition"
                    style={{ borderColor: "rgba(78,52,46,0.20)", color: BROWN, textDecoration: "none" }}
                  >
                    Message us on WhatsApp
                  </a>

                  <div className="mt-2 text-center text-[11px]" style={{ color: BROWN, opacity: 0.6 }}>
                    We usually reply within 1 business day.
                  </div>
                </>
              )}
            </div>
          </div>
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
      className="w-full rounded-xl border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-offset-0 bg-white"
      style={{
        borderColor: "rgba(78,52,46,0.18)",
        color: BROWN,
      }}
    />
  );
}