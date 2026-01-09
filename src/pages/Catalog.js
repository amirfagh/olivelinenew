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

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

export default function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [basket, setBasket] = useState([]);
  const [message, setMessage] = useState(null);
  const [role, setRole] = useState(null);
  const [customerId, setCustomerId] = useState(null);
const [imageIndexMap, setImageIndexMap] = useState({});
const [galleryItem, setGalleryItem] = useState(null);
// { images: [], index: 0 }
const hoverTimerRef = React.useRef(null);
const AUTO_PLAY_MS = 2500;
const autoPlayRef = React.useRef({});

  const [showBasket, setShowBasket] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customers, setCustomers] = useState([]);
const [selectedCustomer, setSelectedCustomer] = useState(null);

const calculateTierPrice = (item, quantity) => {
  const buy = Number(item.buy);
  const tiers = item.tierPricing;

  if (!buy || !Array.isArray(tiers) || tiers.length === 0) {
    return buy; // fallback
  }

  const sortedTiers = [...tiers].sort((a, b) => a.min - b.min);

// 1️⃣ Try exact match first
let tier = sortedTiers.find(
  (t) => quantity >= t.min && quantity <= t.max
);

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
    [...sorted]
      .reverse()
      .find((t) => quantity >= t.min) || sorted[0];

  const currentIndex = sorted.findIndex(
    (t) => t.min === currentTier.min
  );

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
  const savePercent = Math.round(
    ((currentPrice - nextPrice) / currentPrice) * 100
  );

  const progress = Math.min(
    100,
    Math.max(
      0,
      ((quantity - currentTier.min) /
        (nextTier.min - currentTier.min)) *
        100
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
    [id]:
      (prev[id] || 0) === 0
        ? imagesLength - 1
        : (prev[id] || 0) - 1,
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
        [souvenir.id]:
          ((prev[souvenir.id] || 0) + 1) %
          souvenir.images.length,
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
    .filter((s) =>
      selectedCategory ? s.categoryId === selectedCategory : true
    )
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
    souvenir.imageURL ||
    (souvenir.images?.length ? souvenir.images[0].url : null);

  // ✅ MUST be declared BEFORE using it below
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
          ? { ...item, quantity: Number(item.quantity) + quantity } // ✅ uses quantity here
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

  // PDF generator (unchanged UI-wise)
 const generatePriceOfferPdfBlob = (orderData) => {
  const pdf = new jsPDF();
  const left = 20;
  const right = 140;

  // ===== HEADER =====
  pdf.setFontSize(18);
  pdf.text("OLIVELINE", left, 20);
  pdf.setFontSize(11);
  pdf.text("Your Direct Link to Holy Land Treasures", left, 28);

  pdf.setFontSize(12);
  pdf.text("QUOTE", right, 20);

  pdf.setFontSize(10);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, right, 30);
  pdf.text(`Quote No: ${orderData.quotation.number}`, right, 36);
  pdf.text(`Customer ID: ${orderData.customerId || "-"}`, right, 42);
  pdf.text(
    `Valid Until: ${orderData.quotation.validUntil
      .toDate()
      .toLocaleDateString()}`,
    right,
    48
  );

  // ===== CUSTOMER =====
  pdf.setFontSize(11);
  pdf.text("CUSTOMER", left, 60);

  pdf.setFontSize(10);
  pdf.text(`Email: ${orderData.customerEmail}`, left, 68);

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
    pdf.text(item.price.toFixed(2), 142, y);
    pdf.text(
      (item.price * item.quantity).toFixed(2),
      172,
      y,
      { align: "right" }
    );
    y += 6;
  });

  // ===== TOTALS =====
  y += 6;
  pdf.line(120, y, 190, y);
  y += 6;

  pdf.text("Subtotal:", 140, y);
  pdf.text(subtotal.toFixed(2), 190, y, { align: "right" });

  y += 6;
  pdf.text("VAT (18%):", 140, y);
  pdf.text(vat.toFixed(2), 190, y, { align: "right" });

  y += 6;
  pdf.setFontSize(11);
  pdf.text("TOTAL:", 140, y);
  pdf.text(total.toFixed(2), 190, y, { align: "right" });

  // ===== TERMS =====
  y += 16;
  pdf.setFontSize(10);
  pdf.text("Terms and Conditions:", left, y);
  y += 6;
  pdf.text("• Prices valid for 14 days", left, y);
  y += 5;
  pdf.text("• 50% advance payment required", left, y);
  y += 5;
  pdf.text("• Handmade Holy Land olive wood products", left, y);

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
const finalCustomerId =
  role === "admin" ? selectedCustomer : customerId;
      const orderPayload = {
  customerId: finalCustomerId,
  customerEmail:
    role === "admin"
      ? customers.find((c) => c.id === finalCustomerId)?.email || ""
      : auth.currentUser.email,

  createdBy: auth.currentUser.uid,

  quotation: {
    number: `OL-Q-${Date.now()}`,
    issuedAt: Timestamp.now(),
    validUntil: Timestamp.fromDate(
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    ),
    currency: "NIS",
    vatRate: 0.18,
    paymentTerms: "50% advance, balance before delivery",
    deliveryTime: "7–10 business days",
  },

  items,
  status: "pending",
  stage: "offer",

  totals: {
    subtotal,
    vat,
    total,
  },

  documents: {
    offerDraft: {},
    offerSigned: {},
  },

  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};


      const orderRef = await addDoc(collection(db, "orders"), orderPayload);

      const pdfBlob = generatePriceOfferPdfBlob(orderPayload);
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
      setShowConfirm(false);
      pushMessage("Order placed. Price offer generated.", "success", 4000);
    } catch (err) {
      console.error(err);
      pushMessage("Failed to place order", "error");
    }
  };

   return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header & filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">

          <div>
            <h1 className="text-2xl font-semibold" style={{ color: BROWN }}>
              Souvenir Catalog
            </h1>
            <p className="text-sm text-gray-700">
              Choose items to generate a price offer for your order.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">

            <div className="bg-white shadow-sm rounded-md p-2 flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm px-3 py-2 rounded-md border focus:outline-none w-full sm:w-auto"

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
                className="text-sm px-3 py-2 rounded-md border focus:outline-none w-full sm:w-auto"

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
                className="text-sm px-3 py-2 rounded-md bg-gray-100 border hover:bg-gray-200"
              >
                Reset
              </button>
            </div>

            {(role === "viewer" || role === "admin") && (
              <button
                onClick={() => setShowBasket(true)}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full shadow bg-[#708238] text-white hover:scale-105 transform transition"
              >
                <span className="text-lg">🛒</span>
<span className="inline">Basket</span>
                {basket.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    {basket.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedSouvenirs.map((souvenir) => {
            const displayPrice = calculateTierPrice(
  souvenir,
  Number(souvenir.quantity || 1)
);
const nextTier = getNextTierHint(
  souvenir,
  Number(souvenir.quantity || 1)
);
const qty = Number(souvenir.quantity || 1);
const tierCtx = getTierContext(souvenir, qty);

            const category = categories.find(
              (c) => c.id === souvenir.categoryId
            );
            
            
            return (
              <article
                key={souvenir.id}
                className="relative bg-white rounded-2xl shadow-sm hover:shadow-md transform hover:-translate-y-1 transition overflow-hidden"
              >
<div
  className="relative h-56 flex items-center justify-center 
             bg-gradient-to-br from-gray-100 to-white 
             overflow-hidden"
  onMouseEnter={() =>
    clearInterval(autoPlayRef.current[souvenir.id])
  }
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

  className="object-contain max-h-full max-w-full cursor-pointer hover:scale-105 transition"
/>


      {/* LEFT */}
      {souvenir.images.length > 1 && (
       <button
  onClick={() =>
    prevImage(souvenir.id, souvenir.images.length)
  }
  className="absolute left-2 top-1/2 -translate-y-1/2 
             w-9 h-9 rounded-full flex items-center justify-center
             shadow transition
             text-2xl font-bold"
  style={{ backgroundColor: CREAM, color: OLIVE }}
>
  ‹
</button>

      )}

      {/* RIGHT */}
      {souvenir.images.length > 1 && (
        <button
  onClick={() =>
    nextImage(souvenir.id, souvenir.images.length)
  }
 className="absolute right-2 top-1/2 -translate-y-1/2 
             w-9 h-9 rounded-full flex items-center justify-center
             shadow transition
             text-2xl font-bold"
  style={{ backgroundColor: CREAM, color: OLIVE }}
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
              (imageIndexMap[souvenir.id] || 0) === i
                ? "bg-[#708238]"
                : "bg-gray-300"
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


                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[#4E342E]">
                        {souvenir.name}
                      </h3>
                      
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#708238]">
  {displayPrice.toFixed(2)} NIS
</div>

{nextTier && (
  
  <div className="
  absolute top-3 right-3 sm:top-4 sm:right-4
max-w-[80%] sm:max-w-none

  bg-red-200 text-red-800
  text-xs font-semibold
  px-3 py-1
  rounded-full
  border border-red-300
  shadow
">
  Better @ {nextTier.minQty}+ → {nextTier.nextPrice.toFixed(2)} ₪
</div>
)}
{tierCtx?.isBestPrice && (
  <div className="
    absolute top-3 right-3 sm:top-4 sm:right-4
max-w-[80%] sm:max-w-none

    bg-green-100 text-green-700
    text-xs font-semibold
    px-3 py-1
    rounded-full
    border border-green-300
    shadow-sm
  ">
    Best price unlocked ✓
  </div>
)}
{tierCtx?.nextTier && tierCtx.savePercent > 0 && (
  <div className="text-xs text-gray-500 mt-1">
    Save{" "}
    <span className="font-medium text-[#708238]">
      {tierCtx.savePercent}%
    </span>{" "}
    at {tierCtx.nextTier.min}+ units
  </div>
)}
{tierCtx?.nextTier && !tierCtx.isBestPrice && (

  <div className="mt-2">
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#708238] transition-all"
        style={{ width: `${tierCtx.progress}%` }}
      />
    </div>
    <div className="text-[10px] text-gray-400 mt-1">
      {Math.max(0, tierCtx.nextTier.min - qty)} more units for better price

    </div>
  </div>
)}


                      <div className="text-xs text-gray-400">Price</div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mt-3 line-clamp-3">
                    {souvenir.description || "No description"}
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">

                    <span className="inline-block bg-[#EDE6D6] text-[#4E342E] text-xs px-2 py-1 rounded-md">
                      {category ? category.name : "-"}
                    </span>

                    {(role === "viewer" || role === "admin") && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">

                        <div className="flex items-center border rounded-md overflow-hidden">
                          <button
                            onClick={() =>
                              setSouvenirs((prev) =>
                                prev.map((it) =>
                                  it.id === souvenir.id
                                    ? {
                                        ...it,
                                        quantity: Math.max(
                                          1,
                                          Number(it.quantity) - 1
                                        ),
                                      }
                                    : it
                                )
                              )
                            }
                            className="px-3 py-1 text-sm"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={souvenir.quantity}
                            onChange={(e) => {
                              const val =
                                e.target.value === ""
                                  ? ""
                                  : Math.max(1, Number(e.target.value));
                              setSouvenirs((prev) =>
                                prev.map((it) =>
                                  it.id === souvenir.id
                                    ? { ...it, quantity: val }
                                    : it
                                )
                              );
                            }}
                            className="w-14 text-center text-sm outline-none py-1"
                          />
                          <button
                            onClick={() =>
                              setSouvenirs((prev) =>
                                prev.map((it) =>
                                  it.id === souvenir.id
                                    ? {
                                        ...it,
                                        quantity: Number(it.quantity) + 1,
                                      }
                                    : it
                                )
                              )
                            }
                            className="px-3 py-1 text-sm"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => addToBasket(souvenir)}
                          className="w-full sm:w-auto px-3 py-2 bg-[#708238] text-white rounded-md text-sm hover:bg-[#5b6c2e]"

                        >
                          Add to basket
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {displayedSouvenirs.length === 0 && (
          <div className="mt-12 text-center text-gray-500">
            No souvenirs found for these filters.
          </div>
        )}
      </div>

      {/* Basket Drawer */}
      {showBasket && (
        <div className="fixed top-0 right-0 w-[92vw] max-w-sm h-full bg-white shadow-lg p-5 z-50 flex flex-col">

          <div className="relative mb-4">
  <h3
    className="text-lg sm:text-xl font-semibold text-center"
    style={{ color: BROWN }}
  >
    Basket
  </h3>

  <button
    onClick={() => setShowBasket(false)}
    className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl leading-none text-gray-700 px-2"
    aria-label="Close basket"
  >
    ✖
  </button>
</div>



          <div className="flex-1 overflow-y-auto">
            {basket.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">
                Your basket is empty
              </p>
            ) : (
              <ul className="space-y-4">
                {basket.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gray-100 text-xs flex items-center justify-center rounded">
                        No image
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateBasketQuantity(
                              item.id,
                              Number(e.target.value)
                            )
                          }
                          className="w-16 p-1 border rounded text-sm"
                        />
                        <span className="text-sm text-gray-700">
                          {Number(item.price).toFixed(2)} NIS
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromBasket(item.id)}
                      className="text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {basket.length > 0 && (
            <div className="mt-4 border-t pt-4 space-y-2">
              <p className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{subtotal.toFixed(2)} NIS</span>
              </p>
              <p className="flex justify-between text-sm">
                <span>VAT (18%):</span>
                <span>{vat.toFixed(2)} NIS</span>
              </p>
              <p className="flex justify-between font-semibold text-lg text-[#4E342E]">
                <span>Total:</span>
                <span>{total.toFixed(2)} NIS</span>
              </p>

              <button
                onClick={confirmOrder}
                className="w-full bg-[#4E342E] hover:bg-[#3e271e] text-white py-2 rounded mt-3"
              >
                Place Order & Generate Price Offer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
         <div className="bg-white rounded-xl w-[92vw] max-w-md p-6 max-h-[85vh] overflow-y-auto">

            <h3 className="text-lg font-semibold text-[#4E342E]">
              Confirm Order
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              A price offer PDF with your order details will be generated for
              you to sign and stamp in the "My Orders" page.
            </p>

            <ul className="mt-4 space-y-2 max-h-36 overflow-auto text-sm">
              {basket.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between"
                >
                  <span>
                    {it.name} x {it.quantity}
                  </span>
                  <span>
                    {(Number(it.price) * Number(it.quantity)).toFixed(2)} NIS
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between">
              <div className="font-medium text-sm">Total</div>
              <div className="font-semibold text-lg text-[#708238]">
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
      className="w-full border rounded-md px-3 py-2 text-sm"
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
                className="flex-1 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
  onClick={() => {
    if (role === "admin" && !selectedCustomer) {
      pushMessage("Please select a customer", "error");
      return;
    }
    placeOrder();
  }}
  className="flex-1 py-2 bg-[#708238] text-white rounded-md"
>
  Confirm & Create Offer
</button>

            </div>
          </div>
        </div>
      )}
{galleryItem && (
  <div className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center">
    <button
      onClick={() => setGalleryItem(null)}
      className="absolute top-6 right-6 text-white text-3xl"
    >
      ✕
    </button>

    <button
      onClick={() =>
        setGalleryItem((g) => ({
          ...g,
          index:
            g.index === 0
              ? g.images.length - 1
              : g.index - 1,
        }))
      }
      className="absolute left-3 sm:left-6 text-white text-4xl"

    >
      ‹
    </button>

    <img
      src={galleryItem.images[galleryItem.index].url}
      className="max-h-[90vh] max-w-[90vw] object-contain"
    />

    <button
      onClick={() =>
        setGalleryItem((g) => ({
          ...g,
          index: (g.index + 1) % g.images.length,
        }))
      }
      className="absolute right-3 sm:right-6 text-white text-4xl"

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
          className={`fixed left-1/2 -translate-x-1/2 bottom-8 z-50 px-4 py-2 rounded-md shadow-md ${
            message.type === "success"
              ? "bg-[#708238] text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
