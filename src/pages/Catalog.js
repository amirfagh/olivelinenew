import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import Navbar from "../components/Navbar";

// OliveLine Catalog with Tailwind + brand colors
export default function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [basket, setBasket] = useState([]);
  const [message, setMessage] = useState(null); // { type, text }
  const [role, setRole] = useState(null);

  const [showBasket, setShowBasket] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // --- Fetch role ---
  useEffect(() => {
    const fetchRole = async () => {
      if (!auth.currentUser) return;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) setRole((snap.data().role || "").trim());
      } catch (e) {
        console.error("Error fetching role:", e);
      }
    };
    fetchRole();
  }, []);

  // --- Firestore listeners ---
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubSouvs = onSnapshot(collection(db, "souvenirs"), (snap) =>
      setSouvenirs(
        snap.docs.map((d) => ({ id: d.id, quantity: 1, ...d.data() }))
      )
    );

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  // Derived displayed list
  const displayedSouvenirs = souvenirs
    .filter((s) => (selectedCategory ? s.categoryId === selectedCategory : true))
    .sort((a, b) => {
      if (priceSort === "asc") return Number(a.price) - Number(b.price);
      if (priceSort === "desc") return Number(b.price) - Number(a.price);
      return 0;
    });

  // --- Toast helper ---
  const pushMessage = (text, type = "success", ms = 2500) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  // --- Basket helpers ---
  const addToBasket = (souvenir) => {
    const existing = basket.find((item) => item.id === souvenir.id);

    const qty = Number(souvenir.quantity) || 1;

    // Pick the first valid image
    const image = souvenir.imageURL
      ? souvenir.imageURL
      : souvenir.images && souvenir.images.length > 0
      ? souvenir.images[0].url
      : null;

    if (existing) {
      setBasket((prev) =>
        prev.map((item) =>
          item.id === souvenir.id
            ? { ...item, quantity: Number(item.quantity) + qty }
            : item
        )
      );
    } else {
      const itemToAdd = { ...souvenir, image, quantity: qty };
      setBasket((prev) => [...prev, itemToAdd]);
    }

    pushMessage(`${souvenir.name} added to basket!`, "success");
  };

  const updateBasketQuantity = (id, qty) => {
    if (qty < 1 || isNaN(qty)) return;
    setBasket((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
    );
  };

  const removeFromBasket = (id) => {
    setBasket((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmOrder = () => {
    if (!auth.currentUser)
      return pushMessage("You must be signed in to place an order", "error");
    if (basket.length === 0)
      return pushMessage("Your basket is empty", "error");
    setShowConfirm(true);
    setShowBasket(false);
  };

  const placeOrder = async () => {
    try {
      await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        items: basket.map(({ id, name, price, quantity }) => ({
          id,
          name,
          price,
          quantity,
        })),
        status: "pending",
        createdAt: Timestamp.now(),
      });
      setBasket([]);
      setShowConfirm(false);
      pushMessage("Order placed successfully!", "success", 3000);
    } catch (error) {
      console.error(error);
      pushMessage("Error placing order.", "error");
    }
  };

  const subtotal = basket.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );
  const vat = subtotal * 0.18;
  const total = subtotal + vat;

  return (
    <div className="min-h-screen bg-cream text-brown">
      <Navbar />

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-brown">
              Souvenir Catalog
            </h1>
            <p className="text-sm text-brown/70">
              Handpicked olive-wood and specialty items from OliveLine.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filters toolbar */}
            <div className="bg-softwhite shadow-sm rounded-md p-2 flex items-center gap-2 border border-brown/10">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm px-3 py-2 rounded-md border border-brown/20 focus:outline-none focus:ring-2 focus:ring-olive/40 bg-softwhite"
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
                className="text-sm px-3 py-2 rounded-md border border-brown/20 focus:outline-none focus:ring-2 focus:ring-olive/40 bg-softwhite"
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
                className="text-sm px-3 py-2 rounded-md bg-cream border border-brown/20 hover:bg-softwhite transition"
              >
                Reset
              </button>
            </div>

            {/* Basket button for viewers */}
            {role === "viewer" && (
              <button
                onClick={() => setShowBasket(true)}
                className="relative inline-flex items-center gap-2 px-4 py-2 bg-olive text-softwhite rounded-full shadow hover:scale-105 transform transition"
              >
                <span className="text-lg">🛒</span>
                <span className="hidden sm:inline">Basket</span>
                {basket.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brown text-softwhite rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    {basket.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Grid of products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedSouvenirs.map((souvenir) => {
            const category = categories.find(
              (c) => c.id === souvenir.categoryId
            );
            return (
              <article
                key={souvenir.id}
                className="bg-softwhite rounded-2xl shadow-sm border border-brown/10 hover:shadow-md transform hover:-translate-y-1 transition overflow-hidden"
              >
                <div className="relative h-56 bg-cream flex items-center justify-center">
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
                    <div className="text-brown/40">No image</div>
                  )}

                  {/* quick add floating button */}
                  {role === "viewer" && (
                    <button
                      onClick={() => addToBasket(souvenir)}
                      className="absolute bottom-3 right-3 bg-olive text-softwhite px-3 py-1 rounded-full text-sm shadow hover:bg-brown transition"
                    >
                      + Add
                    </button>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-brown">
                        {souvenir.name}
                      </h3>
                      <p className="text-xs text-brown/60 mt-1">
                        {souvenir.manufacturer}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-olive">
                        {Number(souvenir.price).toFixed(2)} ₪
                      </div>
                      <div className="text-xs text-brown/50">Price</div>
                    </div>
                  </div>

                  <p className="text-sm text-brown mt-3">
                    {souvenir.description || "No description"}
                  </p>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-block bg-olive/10 text-olive text-xs px-2 py-1 rounded-md">
                        {category ? category.name : "-"}
                      </span>
                    </div>

                    {role === "viewer" && (
                      <div className="flex items-center gap-2">
                        {/* Quantity stepper */}
                        <div className="flex items-center border border-brown/20 rounded-md overflow-hidden bg-softwhite">
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
                            className="px-3 py-1 text-sm text-brown"
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
                            className="w-14 text-center text-sm outline-none py-1 bg-softwhite"
                          />
                          <button
                            onClick={() =>
                              setSouvenirs((prev) =>
                                prev.map((it) =>
                                  it.id === souvenir.id
                                    ? {
                                        ...it,
                                        quantity:
                                          Number(it.quantity || 1) + 1,
                                      }
                                    : it
                                )
                              )
                            }
                            className="px-3 py-1 text-sm text-brown"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => addToBasket(souvenir)}
                          className="px-3 py-2 bg-brown text-softwhite rounded-md text-sm hover:bg-olive transition"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* empty state */}
        {displayedSouvenirs.length === 0 && (
          <div className="mt-12 text-center text-brown/60">
            No souvenirs found for these filters.
          </div>
        )}
      </div>

      {/* Basket Drawer */}
      {showBasket && (
        <div className="fixed top-0 right-0 w-full sm:w-96 h-full bg-softwhite shadow-2xl p-5 z-40 flex flex-col border-l border-brown/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-brown">Basket</h3>
            <button
              onClick={() => setShowBasket(false)}
              className="text-2xl text-brown/70 hover:text-brown"
            >
              ✖
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {basket.length === 0 ? (
              <p className="text-brown/60 text-center mt-10">
                Your basket is empty
              </p>
            ) : (
              <ul className="space-y-4">
                {basket.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-cream rounded overflow-hidden flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-brown/50">
                          No image
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-brown">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateBasketQuantity(
                              item.id,
                              Math.max(1, Number(e.target.value))
                            )
                          }
                          className="w-16 p-1 border border-brown/20 rounded text-sm bg-softwhite"
                        />
                        <span className="text-sm text-brown/80">
                          {Number(item.price).toFixed(2)} ₪
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromBasket(item.id)}
                      className="text-xs bg-brown text-softwhite px-2 py-1 rounded hover:bg-olive transition"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {basket.length > 0 && (
            <div className="mt-4 border-t border-brown/20 pt-4 space-y-2">
              <p className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{subtotal.toFixed(2)} ₪</span>
              </p>
              <p className="flex justify-between text-sm">
                <span>VAT (18%):</span>
                <span>{vat.toFixed(2)} ₪</span>
              </p>
              <p className="flex justify-between font-semibold text-lg text-brown">
                <span>Total:</span>
                <span>{total.toFixed(2)} ₪</span>
              </p>

              <button
                onClick={confirmOrder}
                className="w-full bg-brown hover:bg-olive text-softwhite py-2 rounded mt-3 transition"
              >
                Place Order
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-softwhite rounded-xl max-w-md w-full p-6 shadow-lg border border-brown/20">
            <h3 className="text-lg font-semibold text-brown">
              Confirm Order
            </h3>
            <p className="text-sm text-brown/70 mt-2">
              You're about to place the following order:
            </p>

            <ul className="mt-4 space-y-2 max-h-40 overflow-auto">
              {basket.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between text-sm text-brown"
                >
                  <div>
                    {it.name} x {it.quantity}
                  </div>
                  <div className="font-medium">
                    {(Number(it.price) * Number(it.quantity)).toFixed(2)} ₪
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between text-brown">
              <div className="font-medium">Total</div>
              <div className="font-semibold">{total.toFixed(2)} ₪</div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border border-brown/30 rounded-md text-brown hover:bg-cream transition"
              >
                Cancel
              </button>
              <button
                onClick={placeOrder}
                className="flex-1 py-2 bg-olive text-softwhite rounded-md hover:bg-brown transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {message && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-8 z-50 px-4 py-2 rounded-md shadow-md text-softwhite ${
            message.type === "success" ? "bg-olive" : "bg-red-600"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
