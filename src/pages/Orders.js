import React, { useEffect, useState } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import Navbar from "../components/Navbar";

// ----------------------
// OLIVELINE THEME COLORS
// ----------------------
const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

// -------------------------------------------
// STATUS DEFINITION (5 STAGES TOTAL)
// -------------------------------------------
const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "offerAccepted", label: "Price Offer Accepted" },
  { key: "preparing", label: "Preparing Order" },
  { key: "delivery", label: "Out for Delivery" },
  
];

// Get next status key
const getNextStatusKey = (current) => {
  if (current === "pending") return null; // blocked until upload
  if (current === "offerAccepted") return "preparing";
  if (current === "preparing") return "delivery";
  if (current === "delivery") return "done"; // final stage
  return null;
};


export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [uploadingOrderId, setUploadingOrderId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ------------------------
  //  FETCH ORDERS
  // ------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ------------------------
  //  UPLOAD PRICE OFFER (PDF + IMAGES)
  // ------------------------
  const uploadPriceOffer = async (orderId, file) => {
    if (!file) return;

    setUploadingOrderId(orderId);
    setUploadProgress(0);

    const filename = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const path = `priceOffers/${orderId}/${filename}`;
    const ref = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(ref, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadProgress(percent);
      },
      (error) => {
        console.error("Upload error:", error);
        setUploadingOrderId(null);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        // SAVE IN FIRESTORE + MOVE TO NEXT STAGE
        await updateDoc(doc(db, "orders", orderId), {
          priceOfferURL: url,
          priceOfferPath: path,
          status: "offerAccepted",
        });

        setUploadingOrderId(null);
        setUploadProgress(0);
      }
    );
  };

  // ------------------------
  //  MOVE TO NEXT STATUS
  // ------------------------
  const moveToNextStatus = async (order) => {
    const current = order.status;
    const next = getNextStatusKey(current);
    if (!next) return;

    // ❌ BLOCK MOVING FROM PENDING
    if (current === "pending") return;

    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: next,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Error updating order status.");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <Navbar />

      <div className="max-w-7xl mx-auto p-8">
        <h2
          className="text-3xl font-bold mb-10"
          style={{ color: BROWN }}
        >
          Orders Management
        </h2>

        {/* --- GRID: 5 STATUS COLUMNS --- */}
       <div className="grid gap-6"
     style={{ gridTemplateColumns: `repeat(${STATUS_STEPS.length}, minmax(300px, 1fr))` }}>

          {STATUS_STEPS.map((status) => (
            <div
              key={status.key}
              className="p-4 rounded-xl shadow-sm flex flex-col"
              style={{ backgroundColor: SOFTWHITE }}
            >
              <h3
                className="text-xl font-semibold mb-4 text-center"
                style={{ color: OLIVE }}
              >
                {status.label}
              </h3>

              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {orders
                  .filter((o) => o.status === status.key)
                  .map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-lg shadow"
                      style={{ backgroundColor: "#ffffff" }}
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-semibold" style={{ color: BROWN }}>
                          Order #{order.id.slice(-6)}
                        </p>
                        <span className="text-xs opacity-60">
                          {new Date(
                            order.createdAt?.seconds * 1000
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Order items */}
                      <ul className="text-sm mt-2 space-y-1">
                        {order.items?.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between border-b pb-1"
                          >
                            <span>{item.name}</span>
                            <span>
                              {item.quantity} × {item.price} ₪
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* TOTAL */}
                      <div className="mt-3 text-right font-semibold" style={{ color: OLIVE }}>
                        Total:{" "}
                        {order.items
                          ?.reduce(
                            (sum, it) =>
                              sum + Number(it.price) * Number(it.quantity),
                            0
                          )
                          .toFixed(2)}{" "}
                        ₪
                      </div>

                      {/* --- PENDING COLUMN: UPLOAD REQUIRED --- */}
                      {status.key === "pending" && (
                        <div className="mt-4">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              onChange={(e) =>
                                uploadPriceOffer(order.id, e.target.files[0])
                              }
                              className="hidden"
                            />
                            <div
                              className="px-3 py-2 text-sm rounded-md text-center"
                              style={{
                                backgroundColor: OLIVE,
                                color: SOFTWHITE,
                              }}
                            >
                              Upload Price Offer
                            </div>
                          </label>

                          {uploadingOrderId === order.id && (
                            <div className="text-xs mt-2" style={{ color: OLIVE }}>
                              Uploading… {uploadProgress}%
                            </div>
                          )}

                          <p className="text-[11px] mt-2 text-center opacity-60">
                            Cannot continue until file uploaded
                          </p>
                        </div>
                      )}

                      {/* --- OTHER COLUMNS: NEXT BUTTON --- */}
                      {status.key !== "pending" &&
                        status.key !== "done" && (
                          <button
                            onClick={() => moveToNextStatus(order)}
                            className="w-full mt-4 flex items-center justify-center gap-1 text-sm rounded-md py-2 transition"
                            style={{
                              backgroundColor: OLIVE,
                              color: SOFTWHITE,
                            }}
                          >
                            <span>Next</span>
                            <span className="text-xs">➜</span>
                          </button>
                        )}

                      {/* DONE COLUMN MESSAGE */}
                      {status.key === "done" && (
                        <p
                          className="text-center font-semibold mt-3"
                          style={{ color: OLIVE }}
                        >
                          ✓ Completed
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
