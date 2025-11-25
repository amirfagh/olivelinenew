import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import Navbar from "../components/Navbar";

function Dashboard() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [newItem, setNewItem] = useState({
    name: "",
    manufacturer: "",
    price: "",
    imageURL: ""
  });

  // Fetch souvenirs from Firestore
  const fetchSouvenirs = async () => {
    const snapshot = await getDocs(collection(db, "souvenirs"));
    setSouvenirs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchSouvenirs();
  }, []);

  // Add new souvenir
  const addSouvenir = async () => {
    if (!newItem.name || !newItem.manufacturer || !newItem.price) return;
    await addDoc(collection(db, "souvenirs"), newItem);
    setNewItem({ name: "", manufacturer: "", price: "", imageURL: "" });
    fetchSouvenirs();
  };

  // Delete souvenir
  const deleteSouvenir = async (id) => {
    await deleteDoc(doc(db, "souvenirs", id));
    fetchSouvenirs();
  };

  return (
    <div style={{ backgroundColor: "#EDE6D6", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ padding: "30px" }}>
        <h2 style={{ color: "#4E342E" }}>Admin Dashboard</h2>

        {/* Add Item Form */}
        <div style={{
          display: "flex",
          gap: "10px",
          marginTop: "20px",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <input
            type="text"
            placeholder="Souvenir Name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Manufacturer"
            value={newItem.manufacturer}
            onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
          />
          <input
            type="number"
            placeholder="Price"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          />
          <input
            type="text"
            placeholder="Image URL"
            value={newItem.imageURL}
            onChange={(e) => setNewItem({ ...newItem, imageURL: e.target.value })}
          />
          <button
            onClick={addSouvenir}
            style={{
              backgroundColor: "#708238",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 15px",
              cursor: "pointer"
            }}
          >
            Add Souvenir
          </button>
        </div>

        {/* Souvenir List */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
          marginTop: "30px"
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
              <button
                onClick={() => deleteSouvenir(souvenir.id)}
                style={{
                  backgroundColor: "#4E342E",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  marginTop: "8px"
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
