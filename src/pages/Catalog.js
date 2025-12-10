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
  const [message, setMessage] = useState(null); // { type, text }
  const [role, setRole] = useState(null);
  const [customerDoc, setCustomerDoc] = useState(null);

  const [showBasket, setShowBasket] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch role & customer info
  useEffect(() => {
    const fetchRoleAndCustomer = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setRole((userSnap.data().role || "").trim());
        }

        // Customer account doc (id = userId)
        const custRef = doc(db, "customers", user.uid);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          setCustomerDoc({ id: custSnap.id, ...custSnap.data() });
        }
      } catch (e) {
        console.error("Error fetching role/customer:", e);
      }
    };

    fetchRoleAndCustomer();
  }, []);

  // Firestore listeners for categories & souvenirs
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

  // Add to basket
  const addToBasket = (souvenir) => {
    const existing = basket.find((item) => item.id === souvenir.id);

    const image = souvenir.imageURL
      ? souvenir.imageURL
      : souvenir.images && souvenir.images.length > 0
      ? souvenir.images[0].url
      : null;

    const itemToAdd = { ...souvenir, image };

    if (existing) {
      setBasket((prev) =>
        prev.map((item) =>
          item.id === souvenir.id
            ? { ...item, quantity: item.quantity + Number(souvenir.quantity) }
            : item
        )
      );
    } else {
      setBasket((prev) => [...prev, itemToAdd]);
    }

    pushMessage(`${souvenir.name} added to basket!`, "success");
  };

  const updateBasketQuantity = (id, qty) => {
    if (qty < 1 || Number.isNaN(qty)) return;
    setBasket((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
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
      pushMessage("You must be signed in to place an order", "error");
      return;
    }
    if (basket.length === 0) {
      pushMessage("Your basket is empty", "error");
      return;
    }
    setShowConfirm(true);
    setShowBasket(false);
  };

  // Generate price-offer PDF (unsigned) for this order
  const generatePriceOfferPdfBlob = (orderData) => {
    const docPdf = new jsPDF();

    // Header
    docPdf.setFontSize(18);
    docPdf.setTextColor(78, 52, 46); // BROWN
    docPdf.text("OliveLine - Price Offer", 20, 20);

    docPdf.setFontSize(11);
    docPdf.setTextColor(0, 0, 0);

    const customerName =
      customerDoc?.companyName || customerDoc?.contactName || "";
    const customerReg = customerDoc?.registrationNumber || "";
    const customerAddress = `${customerDoc?.city || ""} ${
      customerDoc?.address || ""
    }`;

    docPdf.text(`Date: ${new Date().toLocaleDateString("he-IL")}`, 20, 30);
    docPdf.text(`Customer: ${customerName}`, 20, 38);
    if (customerReg) docPdf.text(`Registration No.: ${customerReg}`, 20, 46);
    if (customerAddress) docPdf.text(`Address: ${customerAddress}`, 20, 54);
    docPdf.text(`Contact Email: ${orderData.userEmail || ""}`, 20, 62);

    // Items table
    let y = 75;
    docPdf.setFontSize(12);
    docPdf.text("Items:", 20, y);
    y += 8;

    docPdf.setFontSize(10);
    docPdf.text("Name", 20, y);
    docPdf.text("Qty", 100, y);
    docPdf.text("Price", 120, y);
    docPdf.text("Total", 150, y);
    y += 6;

    orderData.items.forEach((item) => {
      docPdf.text(String(item.name), 20, y);
      docPdf.text(String(item.quantity), 100, y);
      docPdf.text(`${Number(item.price).toFixed(2)} NIS`, 120, y);
      docPdf.text(
        `${(Number(item.price) * Number(item.quantity)).toFixed(2)} NIS`,
        150,
        y
      );
      y += 6;
    });

    y += 4;
    docPdf.text(
      `Subtotal: ${subtotal.toFixed(2)} NIS`,
      120,
      y
    );
    y += 6;
    docPdf.text(
      `VAT (18%): ${vat.toFixed(2)} NIS`,
      120,
      y
    );
    y += 6;
    docPdf.setFontSize(12);
    docPdf.text(
      `Total: ${total.toFixed(2)} NIS`,
      120,
      y
    );

    y += 15;
    docPdf.setFontSize(10);
    docPdf.text("Please sign and stamp this offer and return it to us.", 20, y);
    y += 6;
    docPdf.text("Signature: _______________________", 20, y);
    y += 6;
    docPdf.text("Stamp: ___________________________", 20, y);

    const pdfBlob = docPdf.output("blob");
    return pdfBlob;
  };

  const placeOrder = async () => {
    if (!auth.currentUser) {
      pushMessage("You must be signed in to place an order", "error");
      return;
    }
    if (basket.length === 0) {
      pushMessage("Your basket is empty", "error");
      return;
    }

    try {
      const orderData = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        items: basket.map(({ id, name, price, quantity }) => ({
          id,
          name,
          price,
          quantity,
        })),
        status: "pending", // waiting for customer to sign price offer
        createdAt: Timestamp.now(),
      };

      const orderRef = await addDoc(collection(db, "orders"), orderData);

      // Generate & upload price-offer PDF
      const blob = generatePriceOfferPdfBlob(orderData);
      const path = `priceOffersDraft/${orderRef.id}/price_offer.pdf`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await updateDoc(orderRef, {
        priceOfferDraftURL: url,
        priceOfferDraftPath: path,
      });

      setBasket([]);
      setShowConfirm(false);
      pushMessage(
        "Order placed. Price offer is ready in 'My Orders' for signature.",
        "success",
        4000
      );
    } catch (err) {
      console.error(err);
      pushMessage("Error placing order. Please try again.", "error");
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

            {role === "viewer" && (
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
            const category = categories.find(
              (c) => c.id === souvenir.categoryId
            );
            return (
              <article
                key={souvenir.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transform hover:-translate-y-1 transition overflow-hidden"
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

                  {role === "viewer" && (
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
                        {Number(souvenir.price).toFixed(2)} NIS
                      </div>
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

                    {role === "viewer" && (
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

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={placeOrder}
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
