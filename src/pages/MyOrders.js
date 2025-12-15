// MyOrders.js
import React, { useEffect, useState } from "react";
import { auth, db, storage } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "../components/Navbar";

/* ---------- helpers ---------- */
const formatDate = (ts) => {
  if (!ts) return "";
  try {
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString("he-IL");
    return new Date(ts).toLocaleString("he-IL");
  } catch {
    return "";
  }
};

const getOrderTotal = (order) =>
  order.totals?.total ??
  order.items?.reduce(
    (sum, it) => sum + Number(it.price) * Number(it.quantity),
    0
  ) ??
  0;

/* ---------- component ---------- */
export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [customerId, setCustomerId] = useState(null);

  /* ---------- fetch customerId ---------- */
  useEffect(() => {
    const loadCustomerId = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        setCustomerId(snap.data().customerId || null);
      }
    };

    loadCustomerId();
  }, []);

  /* ---------- fetch orders ---------- */
  useEffect(() => {
    if (!customerId) return;

    const q = query(
      collection(db, "orders"),
      where("customerId", "==", customerId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setOrders(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });

    return () => unsub();
  }, [customerId]);

  /* ---------- toast ---------- */
  const pushMessage = (text, type = "success", ms = 3000) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  /* ---------- upload signed offer ---------- */
  const handleSignedUpload = async (orderId, file) => {
    if (!file) return;

    try {
      setUploadingId(orderId);

      const path = `priceOffers/${orderId}/signed_${Date.now()}_${file.name.replace(
        /\s+/g,
        "_"
      )}`;

      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "orders", orderId), {
        "documents.offerSigned": {
          url,
          path,
          uploadedAt: Timestamp.now(),
        },
        status: "awaitingAdminApproval",
        stage: "approval",
        updatedAt: Timestamp.now(),
      });

      pushMessage(
        "Signed price offer uploaded. Waiting for admin approval."
      );
    } catch (err) {
      console.error(err);
      pushMessage("Upload failed. Please try again.", "error");
    } finally {
      setUploadingId(null);
    }
  };

  /* ---------- status label ---------- */
  const renderStatusLabel = (order) => {
    const rejected = order.approval?.rejectionCount > 0;

    if (rejected && order.status === "pending") {
      return (
        <span className="px-2 py-1 rounded-full text-[11px] bg-red-100 text-red-800 border border-red-300">
          Needs reupload
        </span>
      );
    }

    switch (order.status) {
      case "pending":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-yellow-100 text-yellow-800 border border-yellow-300">
            Waiting for your signature
          </span>
        );
      case "awaitingAdminApproval":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-300">
            Waiting for admin approval
          </span>
        );
      case "offerAccepted":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
            Offer accepted
          </span>
        );
      case "preparing":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-300">
            Preparing
          </span>
        );
      case "delivery":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-orange-100 text-orange-800 border border-orange-300">
            In delivery
          </span>
        );
      case "done":
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-gray-200 text-gray-700 border border-gray-300">
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-700 border border-gray-300">
            {order.status}
          </span>
        );
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#4E342E] mb-4">
          My Orders
        </h1>

        {orders.length === 0 ? (
          <p className="text-gray-500">You have no orders yet.</p>
        ) : (
          <div className="space-y-4">
            {orders
              .slice()
              .sort(
                (a, b) =>
                  (b.createdAt?.seconds || 0) -
                  (a.createdAt?.seconds || 0)
              )
              .map((o) => {
                const canUpload = o.status === "pending";

                return (
                  <div
                    key={o.id}
                    className="bg-[#FAF9F6] border border-[#4E342E]/10 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-semibold text-[#4E342E]">
                          Order #{o.id.slice(-6)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Created: {formatDate(o.createdAt)}
                        </div>
                      </div>

                      <div className="text-right">
                        {renderStatusLabel(o)}
                        <div className="text-sm font-semibold text-[#708238] mt-1">
                          {getOrderTotal(o).toFixed(2)} ₪
                        </div>
                      </div>
                    </div>

                    <ul className="mt-3 text-xs text-gray-700 space-y-1">
                      {o.items.map((it) => (
                        <li
                          key={it.productId}
                          className="flex justify-between border-b border-dashed border-gray-200 pb-0.5"
                        >
                          <span>
                            {it.name} × {it.quantity}
                          </span>
                          <span>
                            {(it.price * it.quantity).toFixed(2)} ₪
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-col sm:flex-row sm:justify-between gap-3">
                      <div className="text-xs">
                        {o.documents?.offerDraft?.url && (
                          <a
                            href={o.documents.offerDraft.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#708238] underline"
                          >
                            Download price offer
                          </a>
                        )}

                        {o.documents?.offerSigned?.url && (
                          <div className="mt-1">
                            <a
                              href={o.documents.offerSigned.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#708238] underline"
                            >
                              View signed offer
                            </a>
                          </div>
                        )}

                        {o.approval?.rejectionCount > 0 && (
                          <div className="mt-1 text-red-600 text-[11px]">
                            Admin requested a new signed offer
                          </div>
                        )}
                      </div>

                      {canUpload && (
                        <label className="cursor-pointer text-xs">
                          <span className="px-3 py-2 bg-[#EDE6D6] border border-[#4E342E]/20 rounded-md">
                            {uploadingId === o.id
                              ? "Uploading..."
                              : "Upload signed offer"}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            disabled={uploadingId === o.id}
                            onChange={(e) =>
                              handleSignedUpload(o.id, e.target.files?.[0])
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {message && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 bottom-8 px-4 py-2 rounded-md shadow-md ${
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
