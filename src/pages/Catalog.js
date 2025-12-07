import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, onSnapshot, addDoc, Timestamp, doc, getDoc } from "firebase/firestore";
import Navbar from "../components/Navbar";

function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [basket, setBasket] = useState([]);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch user role
  useEffect(() => {
    const fetchRole = async () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) setRole(snap.data().role);
    };
    fetchRole();
  }, []);

  // Fetch categories & souvenirs
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubSouvs = onSnapshot(collection(db, "souvenirs"), (snap) =>
      setSouvenirs(snap.docs.map((d) => ({ id: d.id, quantity: 1, ...d.data() })))
    );

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  const displayedSouvenirs = souvenirs
    .filter((s) => (selectedCategory ? s.categoryId === selectedCategory : true))
    .sort((a, b) => {
      if (priceSort === "asc") return Number(a.price) - Number(b.price);
      if (priceSort === "desc") return Number(b.price) - Number(a.price);
      return 0;
    });

  // -------- Basket Functions --------
  const addToBasket = (souvenir) => {
    const existing = basket.find((item) => item.id === souvenir.id);
    if (existing) {
      setBasket(basket.map((item) =>
        item.id === souvenir.id ? { ...item, quantity: item.quantity + souvenir.quantity } : item
      ));
    } else {
      setBasket([...basket, { ...souvenir }]);
    }
    setMessage(`${souvenir.name} added to basket!`);
    setTimeout(() => setMessage(""), 2000);
  };

  const updateBasketQuantity = (id, qty) => {
    if (qty < 1) return;
    setBasket(basket.map((item) => item.id === id ? { ...item, quantity: qty } : item));
  };

  const removeFromBasket = (id) => {
    setBasket(basket.filter((item) => item.id !== id));
  };

  const confirmOrder = () => {
    if (basket.length === 0) {
      alert("Your basket is empty!");
      return;
    }
    setShowModal(true);
  };

  const placeOrder = async () => {
    try {
      await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        items: basket.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
        status: "pending",
        createdAt: Timestamp.now(),
      });
      setBasket([]);
      setShowModal(false);
      setMessage("Order placed successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error placing order:", error);
      setMessage("Error placing order. Try again.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F5F5" }}>
      <Navbar />
      <div style={{ padding: "30px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ color: "#4E342E", marginBottom: 20 }}>Souvenir Catalog</h2>

        {/* ---------- Filters ---------- */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={priceSort}
            onChange={(e) => setPriceSort(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="">Sort by Price</option>
            <option value="asc">Lowest to Highest</option>
            <option value="desc">Highest to Lowest</option>
          </select>
        </div>

        {/* ---------- Souvenir Grid ---------- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {displayedSouvenirs.map((souvenir) => {
            const category = categories.find((c) => c.id === souvenir.categoryId);
            return (
              <div key={souvenir.id} style={{
                backgroundColor: "white",
                borderRadius: 10,
                padding: 15,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}>
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, background: "#f0f0f0" }}>
                  {souvenir.imageURL ? (
                    <img src={souvenir.imageURL} alt={souvenir.name} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  ) : souvenir.images && souvenir.images.length > 0 ? (
                    <img src={souvenir.images[0].url} alt={souvenir.name} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  ) : <div style={{ color: "#999" }}>No image</div>}
                </div>

                <h3 style={{ color: "#708238", marginTop: 12 }}>{souvenir.name}</h3>
                <p style={{ color: "#4E342E", margin: "5px 0" }}>{souvenir.manufacturer}</p>
                <p style={{ margin: "5px 0" }}>{souvenir.price} ₪</p>
                <p style={{ margin: "5px 0" }}><strong>Category:</strong> {category ? category.name : "-"}</p>
                <p style={{ margin: "5px 0" }}><strong>Description:</strong> {souvenir.description || "-"}</p>

                {role === "viewer" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <input
                      type="number"
                      min={1}
                      value={souvenir.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value);
                        if (qty >= 1) {
                          souvenir.quantity = qty;
                        }
                      }}
                      style={{ width: 60, padding: 5, borderRadius: 4, border: "1px solid #ccc" }}
                    />
                    <button
                      onClick={() => addToBasket(souvenir)}
                      style={{
                        backgroundColor: "#708238",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        cursor: "pointer"
                      }}
                    >
                      Add to Basket
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ---------- Basket ---------- */}
        {basket.length > 0 && (
          <div style={{ marginTop: 30, background: "#fff", padding: 20, borderRadius: 8 }}>
            <h3>Basket</h3>
            <ul>
              {basket.map((item) => (
                <li key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>{item.name}</span>
                  <span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateBasketQuantity(item.id, parseInt(e.target.value))}
                      style={{ width: 50, padding: 3, borderRadius: 4, border: "1px solid #ccc", marginRight: 6 }}
                    />
                    x {item.price} ₪
                  </span>
                  <button onClick={() => removeFromBasket(item.id)} style={{ background: "red", color: "white", border: "none", borderRadius: 4, cursor: "pointer", padding: "3px 6px" }}>Remove</button>
                </li>
              ))}
            </ul>
            <p><strong>Total: {basket.reduce((sum, item) => sum + item.price * item.quantity, 0)} ₪</strong></p>
            <button
              onClick={confirmOrder}
              style={{
                backgroundColor: "#4E342E",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "10px 20px",
                cursor: "pointer"
              }}
            >
              Place Order
            </button>
          </div>
        )}

        {/* ---------- Confirmation Modal ---------- */}
        {showModal && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}>
            <div style={{ background: "#fff", padding: 20, borderRadius: 8, maxWidth: 400, width: "100%" }}>
              <h3>Confirm Order</h3>
              <p>Are you sure you want to place this order?</p>
              <ul>
                {basket.map(item => (
                  <li key={item.id}>{item.name} x {item.quantity}</li>
                ))}
              </ul>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer" }}>Cancel</button>
                <button onClick={placeOrder} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "#4E342E", color: "white" }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {message && <p style={{ marginTop: 10, color: "#333" }}>{message}</p>}
      </div>
    </div>
  );
}

export default Catalog;
