// Catalog.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Navbar from "../components/Navbar";

function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);

  // filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceSort, setPriceSort] = useState(""); // "asc", "desc", or ""

  useEffect(() => {
    // fetch categories
    const categoriesCol = collection(db, "categories");
    const unsubCats = onSnapshot(categoriesCol, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // fetch souvenirs
    const souvenirsCol = collection(db, "souvenirs");
    const unsubSouvs = onSnapshot(souvenirsCol, (snap) => {
      setSouvenirs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  // filtered and sorted souvenirs
  const displayedSouvenirs = souvenirs
    .filter((s) => (selectedCategory ? s.categoryId === selectedCategory : true))
    .sort((a, b) => {
      if (priceSort === "asc") return Number(a.price) - Number(b.price);
      if (priceSort === "desc") return Number(b.price) - Number(a.price);
      return 0;
    });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F5F5" }}>
      <Navbar />
      <div style={{ padding: "30px", maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ color: "#4E342E", marginBottom: 20 }}>Souvenir Catalog</h2>

        {/* ---------- Filters ---------- */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Price sorting */}
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
              <div
                key={souvenir.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 10,
                  padding: 15,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}
              >
                {/* Main thumbnail */}
                <div
                  style={{
                    height: 200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: 8,
                    background: "#f0f0f0",
                  }}
                >
                  {souvenir.imageURL ? (
                    <img
                      src={souvenir.imageURL}
                      alt={souvenir.name}
                      style={{ maxWidth: "100%", maxHeight: "100%" }}
                    />
                  ) : souvenir.images && souvenir.images.length > 0 ? (
                    <img
                      src={souvenir.images[0].url}
                      alt={souvenir.name}
                      style={{ maxWidth: "100%", maxHeight: "100%" }}
                    />
                  ) : (
                    <div style={{ color: "#999" }}>No image</div>
                  )}
                </div>

                <h3 style={{ color: "#708238", marginTop: 12 }}>{souvenir.name}</h3>
                <p style={{ color: "#4E342E", margin: "5px 0" }}>{souvenir.manufacturer}</p>
                <p style={{ margin: "5px 0" }}>{souvenir.price} ₪</p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Category:</strong> {category ? category.name : "-"}
                </p>
                <p style={{ margin: "5px 0" }}>
                  <strong>Description:</strong> {souvenir.description || "-"}
                </p>

                {/* All images */}
                {souvenir.images && souvenir.images.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      overflowX: "auto",
                      marginTop: 10,
                      paddingBottom: 5,
                    }}
                  >
                    {souvenir.images.map((img) => (
                      <img
                        key={img.path}
                        src={img.url}
                        alt={souvenir.name}
                        style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {displayedSouvenirs.length === 0 && (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "#666" }}>
              No souvenirs found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Catalog;
