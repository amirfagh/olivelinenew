import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import Navbar from "../components/Navbar";

// ----------------------
// OLIVELINE THEME COLORS
// ----------------------
const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

// -------------------------------------------
// STATUS DEFINITIONS (FULL FLOW)
// -------------------------------------------
const STATUS_STEPS = [
  { key: "pending", label: "Pending (Customer Signature)" },
  { key: "awaitingAdminApproval", label: "Awaiting Admin Approval" },
  { key: "offerAccepted", label: "Price Offer Accepted" },
  { key: "preparing", label: "Preparing Order" },
  { key: "delivery", label: "Out for Delivery" },
  { key: "done", label: "Completed" },
];

// -------------------------------------------
// GET NEXT STATUS
// -------------------------------------------
const getNextStatusKey = (current) => {
  switch (current) {
    case "pending":
      return null; // customer action only
    case "awaitingAdminApproval":
      return "offerAccepted";
    case "offerAccepted":
      return "preparing";
    case "preparing":
      return "delivery";
    case "delivery":
      return "done";
    default:
      return null;
  }
};

export default function Orders() {
  const [orders, setOrders] = useState([]);

  // ------------------------
  // FETCH ORDERS
  // ------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ------------------------
  // MOVE TO NEXT STATUS
  // ------------------------
  const moveToNextStatus = async (order) => {
    const next = getNextStatusKey(order.status);
    if (!next) return;

    // ❌ BLOCK admin approval if no signed offer
    if (
      order.status === "awaitingAdminApproval" &&
      !order.documents?.offerSigned?.url
    ) {
      alert("Customer has not uploaded a signed price offer yet.");
      return;
    }

    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: next,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Status update error:", err);
      alert("Failed to update order status.");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <Navbar />

      <div className="max-w-7xl mx-auto p-8">
        <h2 className="text-3xl font-bold mb-10" style={{ color: BROWN }}>
          Orders Management
        </h2>

        {/* --- GRID: ALL STATUSES VISIBLE --- */}
<div
  className="grid gap-4"
  style={{
    gridTemplateColumns: `repeat(${STATUS_STEPS.length}, minmax(180px, 1fr))`,
  }}
>
  {STATUS_STEPS.map((status) => (
    <div
      key={status.key}
      className="rounded-lg shadow-sm flex flex-col"
      style={{ backgroundColor: SOFTWHITE }}
    >
      {/* COLUMN HEADER */}
      <h3
        className="text-sm font-semibold text-center py-2 border-b"
        style={{ color: OLIVE }}
      >
        {status.label}
      </h3>

      {/* COLUMN CONTENT */}
      <div className="space-y-2 flex-1 overflow-y-auto px-2 py-2">
        {orders
          .filter((o) => o.status === status.key)
          .map((order) => (
            <div
              key={order.id}
              className="rounded-md border p-2 bg-white"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center">
                <span
                  className="font-semibold text-xs"
                  style={{ color: BROWN }}
                >
                  #{order.id.slice(-6)}
                </span>
                <span className="text-[10px] opacity-60">
                  {order.createdAt?.seconds
                    ? new Date(
                        order.createdAt.seconds * 1000
                      ).toLocaleDateString()
                    : ""}
                </span>
              </div>

              {/* ITEMS */}
              <ul className="mt-1 text-[11px] space-y-[2px]">
                {order.items?.map((item) => (
                  <li
                    key={item.productId}
                    className="flex justify-between"
                  >
                    <span className="truncate max-w-[110px]">
                      {item.name} × {item.quantity}
                    </span>
                    <span>
                      {(item.price * item.quantity).toFixed(0)}₪
                    </span>
                  </li>
                ))}
              </ul>

              {/* TOTAL */}
              <div
                className="text-right text-xs font-semibold mt-1"
                style={{ color: OLIVE }}
              >
                {order.totals?.total?.toFixed(0)} ₪
              </div>

              {/* ACTIONS */}
              {status.key !== "pending" &&
                status.key !== "done" && (
                  <button
                    onClick={() => moveToNextStatus(order)}
                    className="w-full mt-1 text-[11px] py-1 rounded"
                    style={{
                      backgroundColor: OLIVE,
                      color: SOFTWHITE,
                    }}
                  >
                    ➜ Next
                  </button>
                )}

              {status.key === "pending" && (
                <p className="text-[10px] text-center mt-1 opacity-60">
                  Waiting for signature
                </p>
              )}

              {status.key === "done" && (
                <p
                  className="text-[11px] text-center mt-1 font-semibold"
                  style={{ color: OLIVE }}
                >
                  ✓ Done
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
