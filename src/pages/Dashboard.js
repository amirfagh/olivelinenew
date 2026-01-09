// Dashboard.js
import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll
} from "firebase/storage";
import Navbar from "../components/Navbar";

function Dashboard() {
  const [souvenirs, setSouvenirs] = useState([]);
  const [categories, setCategories] = useState([]);
const EMPTY_TIER = { min: 1, max: 1, multiplier: 1 };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" };
const selectStyle = { ...inputStyle, background: "#fff" };

  // New category and new item form
  const [newCategory, setNewCategory] = useState("");
  const [newItem, setNewItem] = useState({
    name: "",
    manufacturer: "",
    buy: "",
    description: "",
    size: "",
    weight: "",
    material: "",
    imageURL: "",
    categoryId: "",
    images: [],
    tierPricing: [],
  });
  const [addFiles, setAddFiles] = useState([]);

  // Edit modal
  const [editingId, setEditingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editFiles, setEditFiles] = useState([]);

  const [uploadProgress, setUploadProgress] = useState({});

  /* Fetch categories & souvenirs */
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubSouvs = onSnapshot(collection(db, "souvenirs"), (snap) => {
      setSouvenirs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  /* Add Category */
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await addDoc(collection(db, "categories"), { name: newCategory.trim() });
    setNewCategory("");
  };

  /* Upload files helper */
  const uploadFilesForSouvenir = async (souvenirId, files, prefix = "") => {
    if (!files || files.length === 0) return [];
    const uploadResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = `${Date.now()}_${i}_${file.name.replace(/\s+/g, "_")}`;
      const path = `souvenirs/${souvenirId}/${filename}`;
      const ref = storageRef(storage, path);

      const uploadTask = uploadBytesResumable(ref, file);

      const p = new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress((prev) => ({
              ...prev,
              [`${prefix}${filename}`]: percent,
            }));
          },
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ url, path });
          }
        );
      });

      const result = await p;
      uploadResults.push(result);

      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[`${prefix}${filename}`];
        return copy;
      });
    }

    return uploadResults;
  };

  /* Add Souvenir */
  const addSouvenir = async () => {
    // REQUIRED FIELDS
    if (
      !newItem.name ||
      !newItem.manufacturer ||
      !newItem.buy ||
      !newItem.description ||
      !newItem.size ||
      !newItem.material ||
      !newItem.categoryId
    ) {
      alert("Please fill all required fields.");
      return;
    }

    const docRef = await addDoc(collection(db, "souvenirs"), {
      name: newItem.name,
      manufacturer: newItem.manufacturer,
      buy: newItem.buy,
      description: newItem.description,
      size: newItem.size,
      weight: newItem.weight || "",
      material: newItem.material,
      imageURL: newItem.imageURL || "",
      categoryId: newItem.categoryId,
      images: [],
       tierPricing: newItem.tierPricing || [],
      createdAt: Date.now(),
    });

    const filesArray = Array.from(addFiles || []);
    if (filesArray.length) {
      const uploaded = await uploadFilesForSouvenir(docRef.id, filesArray, "add_");
      await updateDoc(doc(db, "souvenirs", docRef.id), { images: uploaded });
    }

    setNewItem({
      name: "",
      manufacturer: "",
      buy: "",
      description: "",
      size: "",
      weight: "",
      material: "",
      imageURL: "",
      categoryId: "",
      images: [],
        tierPricing: [],
    });
    setAddFiles([]);
  };

  /* Delete souvenir */
  const deleteSouvenir = async (id) => {
    if (!window.confirm("Delete this souvenir?")) return;

    try {
      const listRef = storageRef(storage, `souvenirs/${id}`);
      const res = await listAll(listRef);
      await Promise.all(res.items.map((itemRef) => deleteObject(itemRef)));
    } catch {}

    await deleteDoc(doc(db, "souvenirs", id));
  };

  /* Start Edit */
  const startEdit = (s) => {
    setEditingId(s.id);
    setEditingItem({ ...s,  tierPricing: s.tierPricing || [], });
    setEditFiles([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingItem(null);
    setEditFiles([]);
  };

  /* Save Edit */
  const saveEdit = async () => {
    if (!editingItem) return;

    const docRef = doc(db, "souvenirs", editingId);

    await updateDoc(docRef, {
      name: editingItem.name,
      manufacturer: editingItem.manufacturer,
      buy: editingItem.buy,
      description: editingItem.description,
      size: editingItem.size,
      weight: editingItem.weight || "",
      material: editingItem.material,
      imageURL: editingItem.imageURL || "",
      categoryId: editingItem.categoryId,
       tierPricing: editingItem.tierPricing || [],
    });

    const filesArray = Array.from(editFiles || []);
    if (filesArray.length) {
      const uploaded = await uploadFilesForSouvenir(editingId, filesArray, "edit_");
      await updateDoc(docRef, {
        images: [...editingItem.images, ...uploaded],
      });
    }

    cancelEdit();
  };

  /* Delete single image */
  const deleteImageFromSouvenir = async (souvenirId, imageObj) => {
    if (!window.confirm("Delete this image?")) return;

    try {
      await deleteObject(storageRef(storage, imageObj.path));
    } catch {}

    const s = souvenirs.find((s) => s.id === souvenirId);
    const newImages = s.images.filter((im) => im.path !== imageObj.path);

    await updateDoc(doc(db, "souvenirs", souvenirId), { images: newImages });
  };

  const handleAddFiles = (e) => setAddFiles(e.target.files);
  const handleEditFiles = (e) => setEditFiles(e.target.files);

  return (
    <div style={{ backgroundColor: "#EDE6D6", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ padding: "30px" }}>
        <h2 style={{ color: "#4E342E" }}>Admin Dashboard (OliveLine)</h2>

        {/* Category Section */}
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ color: "#4E342E" }}>Add Category</h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Category Name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              onClick={addCategory}
              style={{
                backgroundColor: "#4E342E",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "8px 15px",
                cursor: "pointer",
              }}
            >
              Add Category
            </button>
          </div>

          <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {categories.map((c) => (
              <div key={c.id} style={{ background: "#FFF", padding: "6px 10px", borderRadius: 6 }}>
                {c.name}
              </div>
            ))}
          </div>
        </div>

        {/* Add Souvenir Form */}
        <div
          style={{
            marginTop: "30px",
            background: "#fff",
            padding: 12,
            borderRadius: 8,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            alignItems: "center",
          }}
        >

          <input
            type="text"
            placeholder="Name *"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />

          <input
            type="text"
            placeholder="Manufacturer *"
            value={newItem.manufacturer}
            onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
          />

          <input
            type="number"
            placeholder="Buy Price *"
            value={newItem.buy}
            onChange={(e) => setNewItem({ ...newItem, buy: e.target.value })}
          />
{/* Tier Pricing (per item) */}
<div style={{ width: "100%" }}>
  <strong>Tier Pricing (per item)</strong>

  {(newItem.tierPricing || []).map((tier, index) => (
  <div
    key={index}
    style={{
  display: "flex",
  gap: 8,
  marginTop: 6,
  alignItems: "center",
  flexWrap: "wrap",
}}

  >
    <input
      type="number"
      placeholder="Min Qty"
      value={tier.min}
      onChange={(e) => {
        const copy = [...(newItem.tierPricing || [])];
        copy[index].min = Number(e.target.value);
        setNewItem({ ...newItem, tierPricing: copy });
      }}
    />

    <input
      type="number"
      placeholder="Max Qty"
      value={tier.max}
      onChange={(e) => {
        const copy = [...(newItem.tierPricing || [])];
        copy[index].max = Number(e.target.value);
        setNewItem({ ...newItem, tierPricing: copy });
      }}
    />

    <input
      type="number"
      step="0.1"
      placeholder="Multiplier"
      value={tier.multiplier}
      onChange={(e) => {
        const copy = [...(newItem.tierPricing || [])];
        copy[index].multiplier = Number(e.target.value);
        setNewItem({ ...newItem, tierPricing: copy });
      }}
    />

    <button
      onClick={() => {
        const copy = (newItem.tierPricing || []).filter((_, i) => i !== index);
        setNewItem({ ...newItem, tierPricing: copy });
      }}
    >
      ✕
    </button>
  </div>
))}


  <button
    style={{ marginTop: 6 }}
    onClick={() =>
      setNewItem({
        ...newItem,
        tierPricing: [...newItem.tierPricing, { ...EMPTY_TIER }],
      })
    }
  >
    + Add Tier
  </button>
</div>

          <input
            type="text"
            placeholder="Description *"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />

          <input
            type="text"
            placeholder="Size (x*y*z) *"
            value={newItem.size}
            onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
          />

          <input
            type="text"
            placeholder="Material *"
            value={newItem.material}
            onChange={(e) => setNewItem({ ...newItem, material: e.target.value })}
          />

          <input
            type="text"
            placeholder="Weight (optional)"
            value={newItem.weight}
            onChange={(e) => setNewItem({ ...newItem, weight: e.target.value })}
          />

          <input
            type="text"
            placeholder="Thumbnail URL (optional)"
            value={newItem.imageURL}
            onChange={(e) => setNewItem({ ...newItem, imageURL: e.target.value })}
          />

          <select
            value={newItem.categoryId}
            onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
          >
            <option value="">Choose Category *</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <label style={{ cursor: "pointer" }}>
            <input type="file" multiple onChange={handleAddFiles} style={{ display: "none" }} />
            <div style={{ padding: "6px 10px", background: "#eee", borderRadius: 6 }}>
              Choose Images
            </div>
          </label>

          <button
            onClick={addSouvenir}
            style={{
              backgroundColor: "#708238",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 15px",
              cursor: "pointer",
            }}
          >
            Add Souvenir
          </button>
        </div>

        {/* Files Preview */}
        {addFiles.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <strong>Files to upload:</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {Array.from(addFiles).map((f, i) => (
                <div key={i} style={{ padding: 6, background: "#fff", borderRadius: 6 }}>
                  {f.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Souvenirs Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",

            gap: "20px",
            marginTop: "30px",
          }}
        >
          {souvenirs.map((s) => {
            const cat = categories.find((c) => c.id === s.categoryId);
            return (
              <div
                key={s.id}
                style={{
                  background: "white",
                  borderRadius: "10px",
                  padding: "15px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    height: 180,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    background: "#f8f8f8",
                    borderRadius: 8,
                  }}
                >
                  {s.imageURL ? (
                    <img src={s.imageURL} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  ) : s.images?.length > 0 ? (
                    <img src={s.images[0].url} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  ) : (
                    "No image"
                  )}
                </div>

                <h3 style={{ color: "#708238", marginTop: 12 }}>{s.name}</h3>
                <p>{s.manufacturer}</p>
                <p><b>Buy:</b> {s.buy} ₪</p>
                <p><b>Description:</b> {s.description}</p>
                <p><b>Size:</b> {s.size}</p>
                <p><b>Material:</b> {s.material}</p>
                {s.weight && <p><b>Weight:</b> {s.weight}</p>}
                <p><b>Category:</b> {cat?.name || "—"}</p>

                {/* images thumbnails */}
                <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto" }}>
                  {s.images?.map((img) => (
                    <div key={img.path} style={{ position: "relative" }}>
                      <img
                        src={img.url}
                        style={{
                          width: 70,
                          height: 70,
                          objectFit: "cover",
                          borderRadius: 6,
                        }}
                      />
                      <button
                        onClick={() => deleteImageFromSouvenir(s.id, img)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "2px 5px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => startEdit(s)}
                    style={{
                      backgroundColor: "#4E342E",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteSouvenir(s.id)}
                    style={{
                      backgroundColor: "#B00020",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit Modal */}
        {editingId && editingItem && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
           <div
  style={{
    background: "#fff",
    padding: 20,
    borderRadius: 8,
    width: "min(900px, 92vw)",
    maxHeight: "88vh",
    overflowY: "auto",
  }}
>

              <h3>Edit Souvenir</h3>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                />

                <input
                  type="text"
                  placeholder="Manufacturer"
                  value={editingItem.manufacturer}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, manufacturer: e.target.value })
                  }
                />

                <input
                  type="number"
                  placeholder="Buy Price"
                  value={editingItem.buy}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, buy: e.target.value })
                  }
                />
{/* Tier Pricing (per item) */}
<div style={{ width: "100%", marginTop: 10 }}>
  <strong>Tier Pricing</strong>

  {(editingItem.tierPricing || []).map((tier, index) => (
    <div
      key={index}
      style={{
  display: "flex",
  gap: 8,
  marginTop: 6,
  alignItems: "center",
  flexWrap: "wrap",
}}

    >
      <input
        type="number"
        placeholder="Min Qty"
        value={tier.min}
        onChange={(e) => {
          const copy = [...editingItem.tierPricing];
          copy[index].min = Number(e.target.value);
          setEditingItem({ ...editingItem, tierPricing: copy });
        }}
      />

      <input
        type="number"
        placeholder="Max Qty"
        value={tier.max}
        onChange={(e) => {
          const copy = [...editingItem.tierPricing];
          copy[index].max = Number(e.target.value);
          setEditingItem({ ...editingItem, tierPricing: copy });
        }}
      />

      <input
        type="number"
        step="0.1"
        placeholder="Multiplier"
        value={tier.multiplier}
        onChange={(e) => {
          const copy = [...editingItem.tierPricing];
          copy[index].multiplier = Number(e.target.value);
          setEditingItem({ ...editingItem, tierPricing: copy });
        }}
      />

      <button
        onClick={() => {
          const copy = editingItem.tierPricing.filter((_, i) => i !== index);
          setEditingItem({ ...editingItem, tierPricing: copy });
        }}
      >
        ✕
      </button>
    </div>
  ))}

  <button
    style={{ marginTop: 6 }}
    onClick={() =>
      setEditingItem({
        ...editingItem,
        tierPricing: [
          ...(editingItem.tierPricing || []),
          { min: 1, max: 1, multiplier: 1 },
        ],
      })
    }
  >
    + Add Tier
  </button>
</div>

                <input
                  type="text"
                  placeholder="Description"
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, description: e.target.value })
                  }
                />

                <input
                  type="text"
                  placeholder="Size (x*y*z)"
                  value={editingItem.size}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, size: e.target.value })
                  }
                />

                <input
                  type="text"
                  placeholder="Material"
                  value={editingItem.material}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, material: e.target.value })
                  }
                />

                <input
                  type="text"
                  placeholder="Weight (optional)"
                  value={editingItem.weight}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, weight: e.target.value })
                  }
                />

                <input
                  type="text"
                  placeholder="Thumbnail URL"
                  value={editingItem.imageURL}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, imageURL: e.target.value })
                  }
                />

                <select
                  value={editingItem.categoryId}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, categoryId: e.target.value })
                  }
                >
                  <option value="">Choose Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <label>
                  <input type="file" multiple onChange={handleEditFiles} style={{ display: "none" }} />
                  <div style={{ padding: 6, background: "#eee", borderRadius: 6, cursor: "pointer" }}>
                    Add Images
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={saveEdit}
                  style={{
                    backgroundColor: "#708238",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 15px",
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>

                <button
                  onClick={cancelEdit}
                  style={{
                    backgroundColor: "#B00020",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 15px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
