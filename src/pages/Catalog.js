import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import Navbar from "../components/Navbar";

function Catalog() {
  const [souvenirs, setSouvenirs] = useState([]);

  useEffect(() => {
    const fetchSouvenirs = async () => {
      const snapshot = await getDocs(collection(db, "souvenirs"));
      setSouvenirs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSouvenirs();
  }, []);

  return (
    <div style={{ backgroundColor: "#EDE6D6", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ padding: "30px" }}>
        <h2 style={{ color: "#4E342E" }}>Souvenir Catalog</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
          marginTop: "20px"
        }}>
          {souvenirs.map((souvenir) => (
            <div key={souvenir.id} style={{
              backgroundColor: "white",
              borderRadius: "10px",
              padding: "15px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
            }}>
              <img
                src={souvenir.imageURL}
                alt={souvenir.name}
                style={{ width: "100%", borderRadius: "10px" }}
              />
              <h3 style={{ color: "#708238" }}>{souvenir.name}</h3>
              <p style={{ color: "#4E342E" }}>{souvenir.manufacturer}</p>
              <p>{souvenir.price} ₪</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Catalog;
