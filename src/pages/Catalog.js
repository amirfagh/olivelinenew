// Catalog.js
import React, { useState, useEffect } from "react";
import { db, auth, storage } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import Navbar from "../components/Navbar";
import olivelineLogo from "../assets/oliveline-logoo.png";
const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

function QuantityStepper({ value, onChange, min = 1, max = 9999 }) {
  const qty = Number(value || min);
  const decDisabled = qty <= min;

  return (
    <div
      className="inline-flex items-center rounded-xl overflow-hidden border shadow-sm"
      style={{ borderColor: OLIVE, backgroundColor: SOFTWHITE }}
    >
      <button
        type="button"
        onClick={() => !decDisabled && onChange(qty - 1)}
        disabled={decDisabled}
        className={`
          w-10 h-10 flex items-center justify-center
          text-xl font-semibold select-none
          transition
          ${decDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#EDE6D6] active:scale-95"}
        `}
        style={{ color: BROWN }}
        aria-label="Decrease quantity"
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={qty}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="
          qty-input
          w-14 h-10 text-center text-sm font-semibold
          outline-none
          border-l border-r
          bg-white
        "
        style={{ borderColor: OLIVE, color: BROWN }}
      />

      <button
        type="button"
        onClick={() => onChange(Math.min(max, qty + 1))}
        className="
          w-10 h-10 flex items-center justify-center
          text-xl font-semibold select-none
          hover:bg-[#EDE6D6] active:scale-95 transition
        "
        style={{ color: BROWN }}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export default function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [basket, setBasket] = useState([]);
  const [message, setMessage] = useState(null);
  const [role, setRole] = useState(null);
  const [customerId, setCustomerId] = useState(null);
const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [imageIndexMap, setImageIndexMap] = useState({});
  const [galleryItem, setGalleryItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // { images: [], index: 0 }
  const hoverTimerRef = React.useRef(null);
  const AUTO_PLAY_MS = 2500;
  const autoPlayRef = React.useRef({});

  const [showBasket, setShowBasket] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
const logoDataUrlRef = React.useRef(null);

useEffect(() => {
  (async () => {
    try {
      logoDataUrlRef.current = await toDataUrl(olivelineLogo);
    } catch (e) {
      logoDataUrlRef.current = null;
    }
  })();
}, []);
  const calculateTierPrice = (item, quantity) => {
    const buy = Number(item.buy);
    const tiers = item.tierPricing;

    if (!buy || !Array.isArray(tiers) || tiers.length === 0) {
      return buy; // fallback
    }

    const sortedTiers = [...tiers].sort((a, b) => a.min - b.min);

    // 1️⃣ Try exact match first
    let tier = sortedTiers.find((t) => quantity >= t.min && quantity <= t.max);

    // 2️⃣ If no match, use the highest min tier (∞ behavior)
    if (!tier) {
      tier = sortedTiers[sortedTiers.length - 1];
    }

    return buy * Number(tier.multiplier);
  };

  const getNextTierHint = (item, quantity) => {
    const tiers = item.tierPricing;
    const buy = Number(item.buy);

    if (!Array.isArray(tiers) || tiers.length < 2) return null;

    const sorted = [...tiers].sort((a, b) => a.min - b.min);

    const currentIndex = sorted.findIndex(
      (t) => quantity >= t.min && quantity <= t.max
    );

    if (currentIndex === -1) return null;

    const nextTier = sorted[currentIndex + 1];
    if (!nextTier) return null;

    return {
      minQty: nextTier.min,
      nextPrice: buy * Number(nextTier.multiplier),
    };
  };

  const getTierContext = (item, quantity) => {
    const buy = Number(item.buy);
    const tiers = item.tierPricing;

    if (!Array.isArray(tiers) || tiers.length === 0) return null;

    const sorted = [...tiers].sort((a, b) => a.min - b.min);

    // ✅ find the highest tier that quantity qualifies for
    const currentTier =
      [...sorted].reverse().find((t) => quantity >= t.min) || sorted[0];

    const currentIndex = sorted.findIndex((t) => t.min === currentTier.min);
    const nextTier = sorted[currentIndex + 1] || null;

    const currentPrice = buy * Number(currentTier.multiplier);

    // ✅ BEST PRICE UNLOCKED (infinite logic)
    if (!nextTier) {
      return {
        currentPrice,
        isBestPrice: true,
        nextTier: null,
        nextPrice: null,
        savePercent: null,
        progress: null,
      };
    }

    // ✅ still has a next tier
    const nextPrice = buy * Number(nextTier.multiplier);
    const savePercent = Math.round(((currentPrice - nextPrice) / currentPrice) * 100);

    const progress = Math.min(
      100,
      Math.max(
        0,
        ((quantity - currentTier.min) / (nextTier.min - currentTier.min)) * 100
      )
    );

    return {
      currentPrice,
      nextTier,
      nextPrice,
      savePercent,
      progress,
      isBestPrice: false,
    };
  };

  const nextImage = (id, imagesLength) => {
    setImageIndexMap((prev) => ({
      ...prev,
      [id]: ((prev[id] || 0) + 1) % imagesLength,
    }));
  };

  const prevImage = (id, imagesLength) => {
    setImageIndexMap((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) === 0 ? imagesLength - 1 : (prev[id] || 0) - 1,
    }));
  };

  useEffect(() => {
    // clear all existing intervals
    Object.values(autoPlayRef.current).forEach(clearInterval);
    autoPlayRef.current = {};

    souvenirs.forEach((souvenir) => {
      if (!souvenir.images || souvenir.images.length < 2) return;

      autoPlayRef.current[souvenir.id] = setInterval(() => {
        setImageIndexMap((prev) => ({
          ...prev,
          [souvenir.id]: ((prev[souvenir.id] || 0) + 1) % souvenir.images.length,
        }));
      }, AUTO_PLAY_MS);
    });

    return () => {
      Object.values(autoPlayRef.current).forEach(clearInterval);
    };
  }, [souvenirs]);

  useEffect(() => {
    if (role !== "admin") return;

    const unsub = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [role]);

  // 🔑 Fetch role + customerId from users collection
  useEffect(() => {
    const fetchUserContext = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        setRole((data.role || "").trim());
        setCustomerId(data.customerId || null);
      }
    };

    fetchUserContext();
  }, []);

  // Categories & souvenirs
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubSouvs = onSnapshot(collection(db, "souvenirs"), (snap) =>
      setSouvenirs(
        snap.docs.map((d) => ({
          id: d.id,
          quantity: 1,
          ...d.data(),
        }))
      )
    );

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  const displayedSouvenirs = souvenirs
    .filter((s) => (s.available ?? true) === true)
    .filter((s) => (selectedCategory ? s.categoryId === selectedCategory : true))
    .sort((a, b) => {
      if (priceSort === "asc") return Number(a.buy) - Number(b.buy);
      if (priceSort === "desc") return Number(b.buy) - Number(a.buy);
      return 0;
    });

  const pushMessage = (text, type = "success", ms = 2500) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  const addToBasket = (souvenir) => {
    const existing = basket.find((item) => item.id === souvenir.id);

    const image =
      souvenir.imageURL || (souvenir.images?.length ? souvenir.images[0].url : null);

    const quantity = Number(souvenir.quantity || 1);
    const unitPrice = calculateTierPrice(souvenir, quantity);

    const itemToAdd = {
      ...souvenir,
      image,
      price: unitPrice,
    };

    if (existing) {
      setBasket((prev) =>
        prev.map((item) =>
          item.id === souvenir.id
            ? { ...item, quantity: Number(item.quantity) + quantity }
            : item
        )
      );
    } else {
      setBasket((prev) => [...prev, itemToAdd]);
    }

    pushMessage(`${souvenir.name} added to basket!`);
  };

  const updateBasketQuantity = (id, qty) => {
    if (qty < 1 || Number.isNaN(qty)) return;

    setBasket((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const newPrice = calculateTierPrice(item, qty);

        return {
          ...item,
          quantity: qty,
          price: newPrice, // ✅ recalculated unit price
        };
      })
    );
  };

  const removeFromBasket = (id) => {
    setBasket((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = basket.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );
  const vat = subtotal * 0.18;
  const total = subtotal + vat;

  const confirmOrder = () => {
    if (!auth.currentUser) {
      pushMessage("You must be signed in", "error");
      return;
    }
    if (basket.length === 0) {
      pushMessage("Your basket is empty", "error");
      return;
    }
    setShowConfirm(true);
    setShowBasket(false);
  };
const toDataUrl = async (src) => {
  const res = await fetch(src);
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};
  // PDF generator (unchanged UI-wise)
  // PDF generator (UPDATED)
const generatePriceOfferPdfBlob = async (orderData) => {
  const pdf = new jsPDF();
  const left = 20;
  const right = 140;

  // ===== HEADER (LOGO) =====
  try {
    if (logoDataUrlRef.current) {
  pdf.addImage(logoDataUrlRef.current, "PNG", left, 10, 65, 30);
} else {
  pdf.setFontSize(18);
  pdf.text("OLIVELINE", left, 20);
}
  } catch (e) {
    // fallback (if logo fails for any reason)
    pdf.setFontSize(18);
    pdf.text("OLIVELINE", left, 20);
  }

  

  pdf.setFontSize(12);
  pdf.text("QUOTE", right, 20);

  pdf.setFontSize(10);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, right, 30);
  pdf.text(`Quote No: ${orderData.quotation.number}`, right, 36);
  // ✅ removed Customer ID
  // ✅ removed Valid Until

  // ===== CUSTOMER =====
  pdf.setFontSize(11);
  pdf.text("CUSTOMER", left, 60);

  const companyName = orderData.customerCompanyName || orderData.customerEmail || "-";
  pdf.setFontSize(10);
  pdf.text(`Dear ${companyName},`, left, 68);

  // ===== TABLE HEADER =====
  let y = 80;
  pdf.setFontSize(10);
  pdf.line(left, y, 190, y);
  y += 6;

  pdf.text("DESCRIPTION", left, y);
  pdf.text("QTY", 120, y);
  pdf.text("UNIT PRICE", 140, y);
  pdf.text("TOTAL", 170, y);

  y += 4;
  pdf.line(left, y, 190, y);

  // ===== ITEMS =====
  y += 6;
  orderData.items.forEach((item) => {
    pdf.text(item.name, left, y);
    pdf.text(String(item.quantity), 122, y);
    pdf.text(Number(item.price).toFixed(2), 142, y);
    pdf.text((Number(item.price) * Number(item.quantity)).toFixed(2), 172, y, { align: "right" });
    y += 6;
  });

  // ===== TOTALS =====
  y += 6;
  pdf.line(120, y, 190, y);
  y += 6;

  pdf.text("Subtotal:", 140, y);
  pdf.text(Number(orderData.totals.subtotal).toFixed(2), 190, y, { align: "right" });

  y += 6;
  pdf.text("VAT (18%):", 140, y);
  pdf.text(Number(orderData.totals.vat).toFixed(2), 190, y, { align: "right" });

  y += 6;
  pdf.setFontSize(11);
  pdf.text("TOTAL:", 140, y);
  pdf.text(Number(orderData.totals.total).toFixed(2), 190, y, { align: "right" });

  // ===== TERMS (UPDATED) =====
  y += 16;
  pdf.setFontSize(10);
  pdf.text("Terms and Conditions:", left, y);
  y += 6;
  pdf.text("• Delivery: up to 10 business days", left, y);
  y += 5;
  pdf.text("• 50% advance payment required, 50% upon receiving the goods", left, y);

  // ===== SIGNATURE =====
  y += 12;
  pdf.text("Signature: ____________________", left, y);
  y += 6;
  pdf.text("Stamp: _______________________", left, y);

  // ===== FOOTER =====
  y += 12;
  pdf.text("THANK YOU", left, y);

  return pdf.output("blob");
};

  const placeOrder = async () => {
    try {
      const items = basket.map((b) => ({
        productId: b.id,
        name: b.name,
        price: Number(b.price),
        quantity: Number(b.quantity),
      }));

     const finalCustomerId = role === "admin" ? selectedCustomer : customerId;

let customerObj = null;

if (role === "admin") {
  customerObj = customers.find((c) => c.id === finalCustomerId) || null;
} else if (finalCustomerId) {
  const cSnap = await getDoc(doc(db, "customers", finalCustomerId));
  customerObj = cSnap.exists() ? { id: cSnap.id, ...cSnap.data() } : null;
}

const companyNameForPdf =
  customerObj?.companyName ||
  customerObj?.contactName ||
  auth.currentUser?.email ||
  "";

      const orderPayload = {
  customerId: finalCustomerId,
  customerCompanyName: companyNameForPdf, // ✅ NEW
  customerEmail:
    role === "admin"
      ? customerObj?.email || ""
      : auth.currentUser.email,
  createdBy: auth.currentUser.uid,
  quotation: {
    number: `OL-Q-${Date.now()}`,
    issuedAt: Timestamp.now(),
    validUntil: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    currency: "NIS",
    vatRate: 0.18,
    paymentTerms: "50% advance, balance before delivery",
    deliveryTime: "7–10 business days",
  },
  items,
  status: "pending",
  stage: "offer",
  totals: { subtotal, vat, total },
  documents: { offerDraft: {}, offerSigned: {} },
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

      const orderRef = await addDoc(collection(db, "orders"), orderPayload);

      const pdfBlob = await generatePriceOfferPdfBlob(orderPayload);
      const pdfPath = `priceOffers/${orderRef.id}/price_offer.pdf`;

      const pdfRef = ref(storage, pdfPath);
      await uploadBytes(pdfRef, pdfBlob);
      const pdfURL = await getDownloadURL(pdfRef);

      await updateDoc(orderRef, {
        "documents.offerDraft": {
          url: pdfURL,
          path: pdfPath,
          createdAt: Timestamp.now(),
        },
      });

      setBasket([]);
      pushMessage("Order placed. Price offer generated.", "success", 4000);
    } catch (err) {
      console.error(err);
      pushMessage("Failed to place order", "error");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <Navbar />

      {/* Top shell */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header & Filters (polished) */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: BROWN }}>
                Souvenir Catalog
              </h1>
              <p className="text-sm sm:text-base text-gray-700 mt-1">
                Choose items to generate a price offer for your order.
              </p>
            </div>

            <div className="w-full sm:w-auto">
              <div className="bg-white/90 backdrop-blur shadow-sm rounded-2xl p-2 sm:p-2.5 border"
                   style={{ borderColor: "rgba(78,52,46,0.08)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_auto] gap-2 sm:gap-2 items-center">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="
                      text-sm px-3 py-2 rounded-xl border
                      focus:outline-none focus:ring-2 focus:ring-offset-1
                      w-full
                    "
                    style={{ borderColor: "rgba(112,130,56,0.35)" }}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={priceSort}
                    onChange={(e) => setPriceSort(e.target.value)}
                    className="
                      text-sm px-3 py-2 rounded-xl border
                      focus:outline-none focus:ring-2 focus:ring-offset-1
                      w-full
                    "
                    style={{ borderColor: "rgba(112,130,56,0.35)" }}
                  >
                    <option value="">Sort by Price</option>
                    <option value="asc">Lowest to Highest</option>
                    <option value="desc">Highest to Lowest</option>
                  </select>

                  <button
                    onClick={() => {
                      setSelectedCategory("");
                      setPriceSort("");
                    }}
                    className="
                      text-sm px-3 py-2 rounded-xl
                      bg-gray-50 border hover:bg-gray-100
                      active:scale-[0.99] transition
                      w-full
                    "
                    style={{ borderColor: "rgba(78,52,46,0.12)" }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* subtle divider */}
          <div className="mt-5 h-px w-full bg-black/5" />
        </div>

        {/* Product grid (polished card) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {displayedSouvenirs.map((souvenir) => {
            const qty = Number(souvenir.quantity || 1);
            const displayPrice = calculateTierPrice(souvenir, qty);
            const nextTier = getNextTierHint(souvenir, qty);
            const tierCtx = getTierContext(souvenir, qty);

            const category = categories.find((c) => c.id === souvenir.categoryId);

            return (
              <article
                key={souvenir.id}
                className="
                  relative bg-white rounded-3xl
                  shadow-sm hover:shadow-md
                  transition overflow-hidden
                  border
                "
                style={{ borderColor: "rgba(78,52,46,0.08)" }}
              >
                {/* PRICE BADGE AREA (keeps badge away from title) */}
                <div className="absolute top-3 right-3 z-10">
                  {nextTier ? (
                    <div className="bg-red-100 text-red-800 text-[11px] font-semibold px-3 py-1 rounded-full border border-red-200 shadow-sm">
                      Better @ {nextTier.minQty}+ → {nextTier.nextPrice.toFixed(2)} ₪
                    </div>
                  ) : tierCtx?.isBestPrice ? (
                    <div className="bg-green-100 text-green-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-green-200 shadow-sm">
                      Best price unlocked ✓
                    </div>
                  ) : null}
                </div>

                {/* Image */}
                <div
                  className="relative h-56 flex items-center justify-center bg-gradient-to-br from-gray-100 to-white overflow-hidden"
                  onMouseEnter={() => clearInterval(autoPlayRef.current[souvenir.id])}
                  onMouseLeave={() => {
                    if (souvenir.images?.length > 1) {
                      autoPlayRef.current[souvenir.id] = setInterval(() => {
                        nextImage(souvenir.id, souvenir.images.length);
                      }, AUTO_PLAY_MS);
                    }
                  }}
                >
                  {souvenir.images && souvenir.images.length > 0 ? (
                    <>
                      <img
                        src={souvenir.images[imageIndexMap[souvenir.id] || 0].url}
                        alt={souvenir.name}
                        onClick={() => {
                          clearInterval(autoPlayRef.current[souvenir.id]);
                          setGalleryItem({
                            images: souvenir.images,
                            index: imageIndexMap[souvenir.id] || 0,
                          });
                        }}
                        className="object-contain max-h-full max-w-full cursor-pointer hover:scale-[1.03] transition"
                      />

                      {/* LEFT */}
                      {souvenir.images.length > 1 && (
                        <button
                          onClick={() => prevImage(souvenir.id, souvenir.images.length)}
                          className="
                            absolute left-2 top-1/2 -translate-y-1/2
                            w-9 h-9 rounded-full flex items-center justify-center
                            shadow-md transition
                            text-2xl font-bold
                            hover:scale-105 active:scale-95
                          "
                          style={{ backgroundColor: "rgba(237,230,214,0.95)", color: OLIVE }}
                          aria-label="Previous image"
                        >
                          ‹
                        </button>
                      )}

                      {/* RIGHT */}
                      {souvenir.images.length > 1 && (
                        <button
                          onClick={() => nextImage(souvenir.id, souvenir.images.length)}
                          className="
                            absolute right-2 top-1/2 -translate-y-1/2
                            w-9 h-9 rounded-full flex items-center justify-center
                            shadow-md transition
                            text-2xl font-bold
                            hover:scale-105 active:scale-95
                          "
                          style={{ backgroundColor: "rgba(237,230,214,0.95)", color: OLIVE }}
                          aria-label="Next image"
                        >
                          ›
                        </button>
                      )}

                      {/* DOTS */}
                      <div className="absolute bottom-2 flex gap-1">
                        {souvenir.images.map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              (imageIndexMap[souvenir.id] || 0) === i ? "bg-[#708238]" : "bg-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : souvenir.imageURL ? (
                    <img
                      src={souvenir.imageURL}
                      alt={souvenir.name}
                      className="object-contain max-h-full max-w-full"
                    />
                  ) : (
                    <div className="text-gray-400">No image</div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight truncate" style={{ color: BROWN }}>
                        {souvenir.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                          style={{ backgroundColor: "#F4F0E8", color: BROWN }}
                        >
                          {category ? category.name : "-"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-semibold" style={{ color: OLIVE }}>
                        {displayPrice.toFixed(2)} NIS
                      </div>
                      <div className="text-[11px] text-gray-400 -mt-0.5">Unit price</div>
                    </div>
                  </div>

                  {/* tier helper */}
                  {tierCtx?.nextTier && tierCtx.savePercent > 0 && (
                    <div className="text-xs text-gray-600 mt-3">
                      Save{" "}
                      <span className="font-semibold" style={{ color: OLIVE }}>
                        {tierCtx.savePercent}%
                      </span>{" "}
                      at {tierCtx.nextTier.min}+ units
                    </div>
                  )}

                  {tierCtx?.nextTier && !tierCtx.isBestPrice && (
                    <div className="mt-2">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${tierCtx.progress}%`, backgroundColor: OLIVE }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {Math.max(0, tierCtx.nextTier.min - qty)} more units for better price
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-700 mt-3 line-clamp-3">
                    {souvenir.description || "No description"}
                  </p>

                  {/* Size + Material chips */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {souvenir.size && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-[#4E342E] text-xs px-2.5 py-1 rounded-lg">
                        <span>📏</span> <span>{souvenir.size}</span>
                      </span>
                    )}
                    {souvenir.material && (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-[#4E342E] text-xs px-2.5 py-1 rounded-lg">
                        <span>🪵</span> <span>{souvenir.material}</span>
                      </span>
                    )}
                  </div>

                  {/* CTA row */}
                  {(role === "viewer" || role === "admin") && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex justify-center sm:justify-start">
                        <QuantityStepper
                          value={souvenir.quantity}
                          onChange={(newQty) => {
                            setSouvenirs((prev) =>
                              prev.map((it) =>
                                it.id === souvenir.id ? { ...it, quantity: newQty } : it
                              )
                            );
                          }}
                        />
                      </div>

                      <button
                        onClick={() => addToBasket(souvenir)}
                        className="
                          w-full sm:flex-1
                          px-4 py-2.5 rounded-xl text-sm font-semibold
                          text-white shadow-sm
                          hover:shadow active:scale-[0.99] transition
                        "
                        style={{ backgroundColor: OLIVE }}
                      >
                        Add to basket
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {displayedSouvenirs.length === 0 && (
          <div className="mt-12 text-center">
            <div className="mx-auto max-w-md bg-white rounded-2xl border p-6 shadow-sm">
              <div className="text-lg font-semibold" style={{ color: BROWN }}>
                No souvenirs found
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Try changing category or sorting, then check again.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Basket Button */}
      {(role === "viewer" || role === "admin") && (
        <button
          onClick={() => setShowBasket(true)}
          className="
            fixed bottom-6 right-6 z-50
            inline-flex items-center gap-2
            px-4 py-3 rounded-full shadow-lg
            hover:scale-105 active:scale-95 transition
          "
          style={{ backgroundColor: OLIVE, color: "white" }}
          aria-label="Open basket"
        >
          <span className="text-xl">🛒</span>
          <span className="hidden sm:inline font-medium">Basket</span>

          {basket.length > 0 && (
            <span className="ml-1 bg-red-500 text-white rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center text-xs font-semibold">
              {basket.length}
            </span>
          )}
        </button>
      )}

      {/* Basket Drawer (UI improved, same behavior) */}
      {showBasket && (
        <>
          {/* overlay (visual only; does NOT close on click to avoid changing behavior) */}
          <div className="fixed inset-0 bg-black/30 z-40" />

          <div
            className="
              fixed top-0 right-0 z-50
              w-[92vw] max-w-sm h-full
              bg-white shadow-2xl
              p-5 flex flex-col
              border-l
            "
            style={{ borderColor: "rgba(78,52,46,0.10)" }}
          >
            <div className="relative mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-center" style={{ color: BROWN }}>
                Basket
              </h3>

              <button
                onClick={() => setShowBasket(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl leading-none text-gray-700 px-2 hover:opacity-80"
                aria-label="Close basket"
              >
                ✖
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {basket.length === 0 ? (
                <div className="text-center mt-12">
                  <div className="text-5xl">🧺</div>
                  <p className="text-gray-600 mt-3">Your basket is empty</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {basket.map((item) => (
                    <li
                      key={item.id}
                      className="w-full rounded-2xl border p-3 shadow-sm"
                      style={{ borderColor: "rgba(78,52,46,0.10)" }}
                    >
                      <div className="flex items-start gap-3 w-full">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-14 h-14 object-cover rounded-xl shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 text-xs flex items-center justify-center rounded-xl shrink-0">
                            No image
                          </div>
                        )}

                        {/* ✅ min-w-0 prevents overflow on small screens */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: BROWN }}>
                            {item.name}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <QuantityStepper
                              value={item.quantity}
                              onChange={(newQty) => updateBasketQuantity(item.id, newQty)}
                            />

                            <div className="text-sm min-w-[140px] flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-500">Unit</span>
                                <span className="font-semibold whitespace-nowrap" style={{ color: BROWN }}>
                                  {Number(item.price).toFixed(2)} NIS
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-3 mt-1">
                                <span className="text-xs text-gray-500">Line</span>
                                <span className="font-semibold whitespace-nowrap" style={{ color: OLIVE }}>
                                  {(Number(item.price) * Number(item.quantity)).toFixed(2)} NIS
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromBasket(item.id)}
                          className="shrink-0 px-2.5 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap
                                     text-white bg-red-500 hover:bg-red-600 active:scale-[0.98] transition"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {basket.length > 0 && (
              <div className="mt-4 border-t pt-4 space-y-2">
                <p className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{subtotal.toFixed(2)} NIS</span>
                </p>
                <p className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (18%)</span>
                  <span className="font-semibold">{vat.toFixed(2)} NIS</span>
                </p>

                <div className="h-px bg-black/5 my-2" />

                <p className="flex justify-between font-semibold text-lg" style={{ color: BROWN }}>
                  <span>Total</span>
                  <span>{total.toFixed(2)} NIS</span>
                </p>

                <button
                  onClick={confirmOrder}
                  className="w-full py-3 rounded-xl text-white font-semibold shadow-sm hover:shadow active:scale-[0.99] transition"
                  style={{ backgroundColor: BROWN }}
                >
                  Place Order & Generate Price Offer
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-[92vw] max-w-md p-6 max-h-[85vh] overflow-y-auto shadow-2xl border"
               style={{ borderColor: "rgba(78,52,46,0.10)" }}>
            <h3 className="text-lg font-semibold" style={{ color: BROWN }}>
              Confirm Order
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              A price offer PDF with your order details will be generated for you to sign and stamp in the "My Orders" page.
            </p>

            <ul className="mt-4 space-y-2 max-h-36 overflow-auto text-sm">
              {basket.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4">
                  <span className="truncate">{it.name} x {it.quantity}</span>
                  <span className="font-semibold whitespace-nowrap">
                    {(Number(it.price) * Number(it.quantity)).toFixed(2)} NIS
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div className="font-medium text-sm text-gray-700">Total</div>
              <div className="font-semibold text-lg" style={{ color: OLIVE }}>
                {total.toFixed(2)} NIS
              </div>
            </div>

            {role === "admin" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Customer
                </label>
                <select
                  value={selectedCustomer || ""}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "rgba(112,130,56,0.35)" }}
                >
                  <option value="">-- Choose customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.contactName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border rounded-xl hover:bg-gray-50 active:scale-[0.99] transition"
                style={{ borderColor: "rgba(78,52,46,0.15)" }}
              >
                Cancel
              </button>

              <button
  onClick={async () => {
    if (role === "admin" && !selectedCustomer) {
      pushMessage("Please select a customer", "error");
      return;
    }

    setShowConfirm(false);       // close modal immediately
    setIsPlacingOrder(true);     // start loading state
    pushMessage("Creating price offer...", "success", 10000);

    await placeOrder();          // run heavy logic

    setIsPlacingOrder(false);    // stop loading
  }}
  disabled={isPlacingOrder}
  className="flex-1 py-2.5 rounded-xl text-white font-semibold shadow-sm hover:shadow active:scale-[0.99] transition disabled:opacity-60"
  style={{ backgroundColor: OLIVE }}
>
  {isPlacingOrder ? "Creating..." : "Confirm & Create Offer"}
</button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery modal */}
      {galleryItem && (
        <div className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center">
          <button
            onClick={() => setGalleryItem(null)}
            className="absolute top-6 right-6 text-white text-3xl hover:opacity-80"
            aria-label="Close gallery"
          >
            ✕
          </button>

          <button
            onClick={() =>
              setGalleryItem((g) => ({
                ...g,
                index: g.index === 0 ? g.images.length - 1 : g.index - 1,
              }))
            }
            className="absolute left-3 sm:left-6 text-white text-4xl hover:opacity-80"
            aria-label="Previous gallery image"
          >
            ‹
          </button>

          <img
            src={galleryItem.images[galleryItem.index].url}
            alt="Gallery"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
          />

          <button
            onClick={() =>
              setGalleryItem((g) => ({
                ...g,
                index: (g.index + 1) % g.images.length,
              }))
            }
            className="absolute right-3 sm:right-6 text-white text-4xl hover:opacity-80"
            aria-label="Next gallery image"
          >
            ›
          </button>

          <div className="absolute bottom-6 text-white text-sm">
            {galleryItem.index + 1} / {galleryItem.images.length}
          </div>
        </div>
      )}

      {/* Toast */}
      {message && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-8 z-50 px-4 py-2 rounded-xl shadow-lg ${
            message.type === "success" ? "text-white" : "text-white"
          }`}
          style={{
            backgroundColor: message.type === "success" ? OLIVE : "#dc2626",
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}