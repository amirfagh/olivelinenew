// MyOrders.js
import React, { useEffect, useState } from "react";
import { auth, db, storage } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "../components/Navbar";

const formatDate = (ts) => {
  if (!ts) return "";
  try {
    if (ts.seconds !== undefined) {
      return new Date(ts.seconds * 1000).toLocaleString("he-IL");
    }
    return new Date(ts).toLocaleString("he-IL");
  } catch {
    return "";
  }
};

const getOrderTotal = (order) =>
  order.items?.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  ) || 0;

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [message, setMessage] = useState(null); // {type,text}

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid)
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
  }, []);

  const pushMessage = (text, type = "success", ms = 2500) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  const handleSignedUpload = async (orderId, file) => {
    try {
      setUploadingId(orderId);

      const path = `signedPriceOffers/${orderId}/${Date.now()}_${file.name.replace(
        /\s+/g,
        "_"
      )}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        signedPriceOfferURL: url,
        signedPriceOfferPath: path,
        status: "awaitingAdminApproval",
        reuploadRequired: false,
      });

      pushMessage(
        "Signed price offer uploaded. Waiting for admin approval.",
        "success",
        4000
      );
    } catch (err) {
      console.error(err);
      pushMessage("Error uploading file. Please try again.", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const renderStatusLabel = (status, reuploadRequired) => {
    if (reuploadRequired) {
      return (
        <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-red-100 text-red-800 border border-red-300">
          Needs reupload
        </span>
      );
    }

    switch (status) {
      case "pending":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-yellow-100 text-yellow-800 border border-yellow-300">
            Waiting for your signature
          </span>
        );
      case "awaitingAdminApproval":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-300">
            Waiting for admin approval
          </span>
        );
      case "offerAccepted":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
            Offer accepted
          </span>
        );
      case "preparing":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-300">
            Preparing
          </span>
        );
      case "delivery":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-orange-100 text-orange-800 border border-orange-300">
            In delivery
          </span>
        );
      case "done":
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-gray-200 text-gray-700 border border-gray-300">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-700 border border-gray-300">
            {status || "unknown"}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#4E342E] mb-4">
          My Orders
        </h1>
        <p className="text-sm text-gray-700 mb-6">
          View your orders, download price offers, and upload signed documents.
        </p>

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
                const total = getOrderTotal(o);
                const canUploadSigned =
                  o.status === "pending" || o.reuploadRequired;

                return (
                  <div
                    key={o.id}
                    className="bg-[#FAF9F6] border border-[#4E342E]/10 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#4E342E]">
                          Order #{o.id.slice(-6)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Created: {formatDate(o.createdAt)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {renderStatusLabel(o.status, o.reuploadRequired)}
                        <div className="text-sm font-semibold text-[#708238]">
                          {total.toFixed(2)} ₪
                        </div>
                      </div>
                    </div>

                    {/* items */}
                    <ul className="mt-3 text-xs text-gray-700 space-y-1">
                      {o.items?.map((it) => (
                        <li
                          key={it.id}
                          className="flex justify-between border-b border-dashed border-gray-200 pb-0.5"
                        >
                          <span>
                            {it.name}{" "}
                            <span className="text-gray-400">
                              × {it.quantity}
                            </span>
                          </span>
                          <span>
                            {(Number(it.price || 0) *
                              Number(it.quantity || 0)
                            ).toFixed(2)}{" "}
                            ₪
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Price offer download/upload */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-xs text-gray-600">
                        {o.priceOfferDraftURL ? (
                          <a
                            href={o.priceOfferDraftURL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#708238] hover:text-[#4E342E] underline"
                          >
                            Download price offer (unsigned)
                          </a>
                        ) : (
                          <span className="text-gray-400">
                            Price offer not available yet.
                          </span>
                        )}

                        {o.signedPriceOfferURL && (
                          <div className="mt-1">
                            <a
                              href={o.signedPriceOfferURL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#708238] hover:text-[#4E342E] underline"
                            >
                              View your signed price offer
                            </a>
                          </div>
                        )}

                        {o.reuploadRequired && (
                          <div className="mt-1 text-red-600 text-[11px]">
                            Admin requested a new signed price offer.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {canUploadSigned && (
                          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                            <span className="px-3 py-2 bg-[#EDE6D6] border border-[#4E342E]/20 rounded-md hover:bg-[#e3dac8]">
                              {uploadingId === o.id
                                ? "Uploading..."
                                : "Upload signed offer"}
                            </span>
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              className="hidden"
                              disabled={uploadingId === o.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                handleSignedUpload(o.id, file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

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
