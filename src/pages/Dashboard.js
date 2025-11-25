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

  const [newCategory, setNewCategory] = useState("");
  const [newItem, setNewItem] = useState({
    name: "",
    manufacturer: "",
    price: "",
    imageURL: "",
    categoryId: "",
    description: "", // ✅ added description
    images: [],
  });
  const [addFiles, setAddFiles] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editFiles, setEditFiles] = useState([]);

  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    const categoriesCol = collection(db, "categories");
    const unsubCats = onSnapshot(categoriesCol, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const souvenirsCol = collection(db, "souvenirs");
    const unsubSouvs = onSnapshot(souvenirsCol, (snap) => {
      setSouvenirs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCats();
      unsubSouvs();
    };
  }, []);

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await addDoc(collection(db, "categories"), { name: newCategory.trim() });
    setNewCategory("");
  };

  const uploadFilesForSouvenir = async (souvenirId, files, onProgressKeyPrefix = "") => {
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
              [`${onProgressKeyPrefix}${filename}`]: percent,
            }));
          },
          (error) => {
            console.error("Upload failed", error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url, path });
            } catch (e) {
              reject(e);
            }
          }
        );
      });

      const result = await p;
      uploadResults.push(result);

      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[`${onProgressKeyPrefix}${filename}`];
        return copy;
      });
    }

    return uploadResults;
  };

  const addSouvenir = async () => {
    if (!newItem.name || !newItem.manufacturer || !newItem.price || !newItem.categoryId) {
      alert("Fill name, manufacturer, price, category.");
      return;
    }

    const docRef = await addDoc(collection(db, "souvenirs"), {
      name: newItem.name,
      manufacturer: newItem.manufacturer,
      price: newItem.price,
      imageURL: newItem.imageURL || "",
      categoryId: newItem.categoryId,
      description: newItem.description || "", // ✅ add description
      images: [],
      createdAt: Date.now(),
    });

    const filesArray = Array.from(addFiles || []);
    if (filesArray.length) {
      const uploaded = await uploadFilesForSouvenir(docRef.id, filesArray, "add_");
      await updateDoc(doc(db, "souvenirs", docRef.id), {
        images: uploaded,
      });
    }

    setNewItem({
      name: "",
      manufacturer: "",
      price: "",
      imageURL: "",
      categoryId: "",
      description: "",
      images: [],
    });
    setAddFiles([]);
  };

  const deleteSouvenir = async (id) => {
    if (!window.confirm("Delete this souvenir and all its images?")) return;

    try {
      const listRef = storageRef(storage, `souvenirs/${id}`);
      const res = await listAll(listRef);
      const deletePromises = res.items.map((itemRef) => deleteObject(itemRef));
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn("Error deleting storage files:", e);
    }

    await deleteDoc(doc(db, "souvenirs", id));
  };

  const startEdit = (souvenir) => {
    setEditingId(souvenir.id);
    setEditingItem({
      name: souvenir.name || "",
      manufacturer: souvenir.manufacturer || "",
      price: souvenir.price || "",
      imageURL: souvenir.imageURL || "",
      categoryId: souvenir.categoryId || "",
      description: souvenir.description || "", // ✅ description
      images: souvenir.images || [],
    });
    setEditFiles([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingItem(null);
    setEditFiles([]);
  };

  const saveEdit = async () => {
    if (!editingId || !editingItem) return;

    const docRef = doc(db, "souvenirs", editingId);
    await updateDoc(docRef, {
      name: editingItem.name,
      manufacturer: editingItem.manufacturer,
      price: editingItem.price,
      imageURL: editingItem.imageURL || "",
      categoryId: editingItem.categoryId,
      description: editingItem.description || "", // ✅ description
    });

    const filesArray = Array.from(editFiles || []);
    if (filesArray.length) {
      const uploaded = await uploadFilesForSouvenir(editingId, filesArray, "edit_");
      const updatedImages = [...(editingItem.images || []), ...uploaded];
      await updateDoc(docRef, { images: updatedImages });
      setEditingItem((prev) => ({ ...prev, images: updatedImages }));
    }

    setEditingId(null);
    setEditingItem(null);
    setEditFiles([]);
  };

  const deleteImageFromSouvenir = async (souvenirId, imageObj) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      const fileRef = storageRef(storage, imageObj.path);
      await deleteObject(fileRef);
    } catch (e) {
      console.warn("Error deleting image:", e);
    }

    const docRef = doc(db, "souvenirs", souvenirId);
    const s = souvenirs.find((s) => s.id === souvenirId);
    const currentImages = s?.images || [];
    const newImages = currentImages.filter((im) => im.path !== imageObj.path);
    await updateDoc(docRef, { images: newImages });
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
          <h3>Add Category</h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Category Name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button onClick={addCategory}>Add Category</button>
          </div>
        </div>

        {/* Add Souvenir Form */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap", background: "#fff", padding: 12, borderRadius: 8 }}>
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
            placeholder="Optional thumbnail URL"
            value={newItem.imageURL}
            onChange={(e) => setNewItem({ ...newItem, imageURL: e.target.value })}
          />
          <textarea
            placeholder="Description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />
          <select value={newItem.categoryId} onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}>
            <option value="">Choose Category</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <label>
            <input type="file" multiple onChange={handleAddFiles} style={{ display: "none" }} />
            <div>Choose Images</div>
          </label>
          <button onClick={addSouvenir}>Add Souvenir</button>
        </div>

        {/* Souvenir list (with description) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "20px", marginTop: "30px" }}>
          {souvenirs.map((souvenir) => {
            const category = categories.find((c) => c.id === souvenir.categoryId);
            return (
              <div key={souvenir.id} style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8 }}>
                <h3>{souvenir.name}</h3>
                <p>{souvenir.manufacturer}</p>
                <p>{souvenir.price} ₪</p>
                <p><strong>Category:</strong> {category?.name || "-"}</p>
                <p><strong>Description:</strong> {souvenir.description || "-"}</p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                  {(souvenir.images || []).map((img) => (
                    <div key={img.path}>
                      <img src={img.url} alt="" style={{ width: 70, height: 70, objectFit: "cover" }} />
                      <button onClick={() => deleteImageFromSouvenir(souvenir.id, img)}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => startEdit(souvenir)}>Edit</button>
                <button onClick={() => deleteSouvenir(souvenir.id)}>Delete</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
