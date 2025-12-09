// Dashboard.js
import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  addDoc,
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
  listAll,
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
    description: "",
    size: "",
    weight: "",
    material: "",
    imageURL: "",
    categoryId: "",
    images: [],
  });

  const [addFiles, setAddFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editFiles, setEditFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  /* Fetch Categories + Souvenirs */
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, "categories"), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubSouvs = onSnapshot(collection(db, "souvenirs"), (snap) =>
      setSouvenirs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

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

  /* Upload Helper */
  const uploadFilesForSouvenir = async (souvenirId, files, prefix = "") => {
    if (!files || files.length === 0) return [];
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const path = `souvenirs/${souvenirId}/${filename}`;
      const ref = storageRef(storage, path);

      const task = uploadBytesResumable(ref, file);

      const url = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const progress = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setUploadProgress((prev) => ({
              ...prev,
              [`${prefix}${filename}`]: progress,
            }));
          },
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          }
        );
      });

      uploaded.push({ url, path });

      setUploadProgress((prev) => {
        const copy = { ...prev };
        delete copy[`${prefix}${filename}`];
        return copy;
      });
    }

    return uploaded;
  };

  /* Add Souvenir */
  const addSouvenir = async () => {
    const required = ["name", "manufacturer", "price", "description", "size", "material", "categoryId"];
    for (let key of required) {
      if (!newItem[key]) return alert("Please fill all required fields.");
    }

    const docRef = await addDoc(collection(db, "souvenirs"), {
      ...newItem,
      createdAt: Date.now(),
      images: [],
    });

    if (addFiles.length) {
      const uploaded = await uploadFilesForSouvenir(docRef.id, addFiles, "add_");
      await updateDoc(doc(db, "souvenirs", docRef.id), { images: uploaded });
    }

    setNewItem({
      name: "",
      manufacturer: "",
      price: "",
      description: "",
      size: "",
      weight: "",
      material: "",
      imageURL: "",
      categoryId: "",
      images: [],
    });
    setAddFiles([]);
  };

  /* Edit Souvenir */
  const startEdit = (s) => {
    setEditingId(s.id);
    setEditingItem({ ...s });
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const ref = doc(db, "souvenirs", editingId);

    await updateDoc(ref, {
      name: editingItem.name,
      manufacturer: editingItem.manufacturer,
      price: editingItem.price,
      description: editingItem.description,
      size: editingItem.size,
      weight: editingItem.weight || "",
      material: editingItem.material,
      imageURL: editingItem.imageURL || "",
      categoryId: editingItem.categoryId,
    });

    if (editFiles.length) {
      const uploaded = await uploadFilesForSouvenir(editingId, editFiles, "edit_");
      await updateDoc(ref, {
        images: [...editingItem.images, ...uploaded],
      });
    }

    setEditingId(null);
    setEditingItem(null);
    setEditFiles([]);
  };

  /* Delete Image */
  const deleteImageFromSouvenir = async (souvenirId, imageObj) => {
    if (!window.confirm("Delete this image?")) return;
    await deleteObject(storageRef(storage, imageObj.path));

    const s = souvenirs.find((x) => x.id === souvenirId);
    const newImages = s.images.filter((img) => img.path !== imageObj.path);

    await updateDoc(doc(db, "souvenirs", souvenirId), { images: newImages });
  };

  /* Delete Souvenir */
  const deleteSouvenir = async (id) => {
    if (!window.confirm("Delete this souvenir?")) return;

    try {
      const folder = storageRef(storage, `souvenirs/${id}`);
      const items = await listAll(folder);
      await Promise.all(items.items.map((ref) => deleteObject(ref)));
    } catch {}

    await deleteDoc(doc(db, "souvenirs", id));
  };

  return (
    <div className="bg-cream min-h-screen">
      <Navbar />

      <div className="max-w-7xl mx-auto p-8">

        <h2 className="text-3xl font-bold text-brown mb-8">
          Admin Dashboard (OliveLine)
        </h2>

        {/* ------------------- ADD CATEGORY ------------------- */}
        <div className="mb-10 bg-softwhite border border-brown/20 p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-brown mb-4">Add Category</h3>

          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category Name"
              className="p-2 rounded border border-brown/30 bg-cream text-brown"
            />

            <button
              onClick={addCategory}
              className="bg-brown text-softwhite px-5 py-2 rounded hover:bg-[#3e271e]"
            >
              Add Category
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {categories.map((c) => (
              <span key={c.id} className="px-3 py-1 bg-softwhite border border-brown/20 rounded text-brown shadow-sm">
                {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* ------------------- ADD SOUVENIR ------------------- */}
        <div className="bg-softwhite border border-brown/20 p-6 rounded-lg shadow-sm mb-10 flex flex-wrap gap-4">

          {/* inputs */}
          {[
            { key: "name", ph: "Name *" },
            { key: "manufacturer", ph: "Manufacturer *" },
            { key: "price", ph: "Price *", type: "number" },
            { key: "description", ph: "Description *" },
            { key: "size", ph: "Size (x*y*z) *" },
            { key: "material", ph: "Material *" },
            { key: "weight", ph: "Weight (optional)" },
            { key: "imageURL", ph: "Thumbnail URL (optional)" },
          ].map((f) => (
            <input
              key={f.key}
              type={f.type || "text"}
              placeholder={f.ph}
              value={newItem[f.key]}
              onChange={(e) => setNewItem({ ...newItem, [f.key]: e.target.value })}
              className="p-2 border border-brown/30 bg-cream rounded flex-1 min-w-[200px] text-brown"
            />
          ))}

          <select
            value={newItem.categoryId}
            onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
            className="p-2 border border-brown/30 bg-cream rounded min-w-[180px] text-brown"
          >
            <option value="">Choose Category *</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <label className="cursor-pointer">
            <input type="file" multiple onChange={(e) => setAddFiles(e.target.files)} className="hidden" />
            <div className="px-4 py-2 bg-brown/20 text-brown rounded hover:bg-brown/30">
              Choose Images
            </div>
          </label>

          <button
            onClick={addSouvenir}
            className="bg-olive text-softwhite px-5 py-2 rounded hover:bg-[#5b6c2e]"
          >
            Add Souvenir
          </button>
        </div>

        {/* ------------------- FILES PREVIEW ------------------- */}
        {addFiles.length > 0 && (
          <div className="mb-8">
            <strong className="text-brown">Files to upload:</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {Array.from(addFiles).map((f, i) => (
                <span key={i} className="bg-softwhite border border-brown/20 px-3 py-1 rounded shadow-sm text-brown">
                  {f.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ------------------- SOUVENIRS GRID ------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {souvenirs.map((s) => {
            const cat = categories.find((c) => c.id === s.categoryId);

            return (
              <div key={s.id} className="bg-softwhite border border-brown/20 rounded-lg shadow-sm p-4">

                {/* Image */}
                <div className="h-48 bg-cream rounded flex items-center justify-center overflow-hidden">
                  {s.imageURL ? (
                    <img src={s.imageURL} className="max-h-full max-w-full object-contain" />
                  ) : s.images?.length > 0 ? (
                    <img src={s.images[0].url} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-brown/40">No image</span>
                  )}
                </div>

                {/* Info */}
                <h3 className="text-olive font-semibold mt-3">{s.name}</h3>
                <p className="text-brown/80">{s.manufacturer}</p>
                <p className="text-brown"><b>Price:</b> {s.price} ₪</p>
                <p className="text-brown/90 text-sm"><b>Description:</b> {s.description}</p>
                <p className="text-brown/90 text-sm"><b>Size:</b> {s.size}</p>
                <p className="text-brown/90 text-sm"><b>Material:</b> {s.material}</p>
                {s.weight && <p className="text-brown/90 text-sm"><b>Weight:</b> {s.weight}</p>}
                <p className="text-brown/90 text-sm"><b>Category:</b> {cat?.name}</p>

                {/* Thumbnails */}
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {s.images?.map((img) => (
                    <div key={img.path} className="relative">
                      <img src={img.url} className="w-16 h-16 object-cover rounded" />

                      <button
                        onClick={() => deleteImageFromSouvenir(s.id, img)}
                        className="absolute top-1 right-1 bg-brown/80 text-softwhite px-1 rounded text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => startEdit(s)}
                    className="bg-brown text-softwhite px-4 py-1 rounded hover:bg-[#3e271e]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteSouvenir(s.id)}
                    className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* ------------------- EDIT MODAL ------------------- */}
        {editingId && editingItem && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-softwhite border border-brown/20 rounded-xl p-6 w-full max-w-3xl shadow-lg">

              <h3 className="text-xl font-semibold text-brown mb-4">Edit Souvenir</h3>

              <div className="flex flex-wrap gap-4">

                {/* Editable fields */}
                {[
                  { k: "name", ph: "Name" },
                  { k: "manufacturer", ph: "Manufacturer" },
                  { k: "price", ph: "Price", type: "number" },
                  { k: "description", ph: "Description" },
                  { k: "size", ph: "Size (x*y*z)" },
                  { k: "material", ph: "Material" },
                  { k: "weight", ph: "Weight (optional)" },
                  { k: "imageURL", ph: "Thumbnail URL" },
                ].map((f) => (
                  <input
                    key={f.k}
                    type={f.type || "text"}
                    placeholder={f.ph}
                    value={editingItem[f.k]}
                    onChange={(e) => setEditingItem({ ...editingItem, [f.k]: e.target.value })}
                    className="p-2 border border-brown/30 bg-cream rounded flex-1 min-w-[200px] text-brown"
                  />
                ))}

                <select
                  value={editingItem.categoryId}
                  onChange={(e) => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                  className="p-2 border border-brown/30 bg-cream rounded min-w-[180px] text-brown"
                >
                  <option value="">Choose Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <label className="cursor-pointer">
                  <input type="file" multiple onChange={(e) => setEditFiles(e.target.files)} className="hidden" />
                  <div className="p-2 bg-brown/20 rounded hover:bg-brown/30 text-brown">
                    Add Images
                  </div>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={saveEdit}
                  className="bg-olive text-softwhite px-4 py-2 rounded hover:bg-[#5b6c2e]"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => { setEditingId(null); setEditingItem(null); }}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
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
