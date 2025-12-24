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
      if (priceSort === "asc") return Number(a.price) - Number(b.price);
      if (priceSort === "desc") return Number(b.price) - Number(a.price);
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
    pdf.setFontSize(18);
    pdf.text("OliveLine - Price Offer", 20, 20);
    pdf.setFontSize(11);

    pdf.text(`Date: ${new Date().toLocaleDateString("he-IL")}`, 20, 32);
    pdf.text(`Customer Email: ${orderData.customerEmail}`, 20, 40);

    let y = 60;
    pdf.text("Items:", 20, y);
    y += 10;

    orderData.items.forEach((item) => {
      pdf.text(
        `${item.name} x${item.quantity} — ${(item.price * item.quantity).toFixed(
          2
        )} ₪`,
        20,
        y
      );
      y += 6;
    });

    y += 8;
    pdf.text(`Subtotal: ${subtotal.toFixed(2)} ₪`, 20, y);
    y += 6;
    pdf.text(`VAT (18%): ${vat.toFixed(2)} ₪`, 20, y);
    y += 6;
    pdf.text(`Total: ${total.toFixed(2)} ₪`, 20, y);

    y += 15;
    pdf.text("Signature: ____________________", 20, y);
    y += 6;
    pdf.text("Stamp: _______________________", 20, y);

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: BROWN }}>
              Souvenir Catalog
            </h1>
            <p className="text-sm text-gray-700">
              Choose items to generate a price offer for your order.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white shadow-sm rounded-md p-2 flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm px-3 py-2 rounded-md border focus:outline-none"
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
                className="text-sm px-3 py-2 rounded-md border focus:outline-none"
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
                <span className="hidden sm:inline">Basket</span>
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
                <div className="relative h-56 bg-gradient-to-br from-gray-100 to-white flex items-center justify-center">
                  {souvenir.imageURL ? (
                    <img
                      src={souvenir.imageURL}
                      alt={souvenir.name}
                      className="object-contain max-h-full max-w-full transition-transform duration-300 hover:scale-105"
                    />
                  ) : souvenir.images && souvenir.images.length > 0 ? (
                    <img
                      src={souvenir.images[0].url}
                      alt={souvenir.name}
                      className="object-contain max-h-full max-w-full transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="text-gray-400">No image</div>
                  )}

                  {(role === "viewer" || role === "admin") && (
                    <button
                      onClick={() => addToBasket(souvenir)}
                      className="absolute bottom-3 right-3 bg-[#708238] text-white px-3 py-1 rounded-full text-sm shadow hover:scale-105"
                    >
                      + Add
                    </button>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[#4E342E]">
                        {souvenir.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {souvenir.manufacturer}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#708238]">
  {displayPrice.toFixed(2)} NIS
</div>

{nextTier && (
  
  <div className="
  absolute top-4 right-4
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
    absolute top-4 right-4
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

                  <div className="flex items-center justify-between mt-4">
                    <span className="inline-block bg-[#EDE6D6] text-[#4E342E] text-xs px-2 py-1 rounded-md">
                      {category ? category.name : "-"}
                    </span>

                    {(role === "viewer" || role === "admin") && (
                      <div className="flex items-center gap-2">
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
                          className="px-3 py-2 bg-[#708238] text-white rounded-md text-sm hover:bg-[#5b6c2e]"
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
        <div className="fixed top-0 right-0 w-80 h-full bg-white shadow-lg p-5 z-50 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-[#4E342E]">Basket</h3>
            <button
              onClick={() => setShowBasket(false)}
              className="text-xl text-gray-600"
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
          <div className="bg-white rounded-xl max-w-md w-full p-6">
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
