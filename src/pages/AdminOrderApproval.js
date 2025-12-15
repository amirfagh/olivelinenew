// AdminOrderApproval.js
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import Navbar from "../components/Navbar";

/* ---------- helpers ---------- */
const formatDate = (ts) => {
  if (!ts) return "";
  try {
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString("he-IL");
    }
    return new Date(ts).toLocaleString("he-IL");
  } catch {
    return "";
  }
};

const getOrderTotal = (order) =>
  order.totals?.total ??
  order.items?.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  ) ??
  0;

/* ---------- component ---------- */
export default function AdminOrderApproval() {
  const [orders, setOrders] = useState([]);
  const [role, setRole] = useState(null);
  const [message, setMessage] = useState(null);

  /* ---------- role check ---------- */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const fetchRole = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setRole((snap.data().role || "").trim());
      }
    };

    fetchRole();
  }, []);

  /* ---------- fetch orders ---------- */
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "==", "awaitingAdminApproval")
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

  /* ---------- toast ---------- */
  const pushMessage = (text, type = "success", ms = 3000) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  /* ---------- approve ---------- */
  const approveOrder = async (orderId) => {
    try {
      const user = auth.currentUser;

      await updateDoc(doc(db, "orders", orderId), {
        status: "offerAccepted",
        stage: "preparation",
        "approval.approvedBy": user.uid,
        "approval.approvedAt": Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      pushMessage("Order approved. Manufacturing can start.");
    } catch (err) {
      console.error(err);
      pushMessage("Error approving order.", "error");
    }
  };

  /* ---------- reject ---------- */
  const sendBackForReupload = async (order) => {
    try {
      const rejectionCount = order.approval?.rejectionCount || 0;

      await updateDoc(doc(db, "orders", order.id), {
        status: "pending",
        stage: "customer",
        "approval.rejectionCount": rejectionCount + 1,
        "approval.lastRejectedAt": Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      pushMessage("Order sent back to customer for reupload.");
    } catch (err) {
      console.error(err);
      pushMessage("Error updating order.", "error");
    }
  };

  /* ---------- access guard ---------- */
  if (role && role !== "admin") {
    return (
      <div className="min-h-screen bg-[#EDE6D6]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-xl font-bold text-[#4E342E]">
            Admin Access Only
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Only admins can review and approve price offers.
          </p>
        </div>
      </div>
    );
  }

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#4E342E] mb-4">
          Orders Awaiting Approval
        </h1>

        {orders.length === 0 ? (
          <p className="text-gray-500">
            No orders waiting for approval.
          </p>
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
                const hasSigned =
                  Boolean(o.documents?.offerSigned?.url);

                return (
                  <div
                    key={o.id}
                    className="bg-[#FAF9F6] border border-[#4E342E]/10 rounded-lg p-4 shadow-sm"
                  >
                    {/* header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-semibold text-[#4E342E]">
                          Order #{o.id.slice(-6)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Created: {formatDate(o.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Customer: {o.userEmail}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-300">
                          Awaiting approval
                        </span>
                        <div className="mt-1 text-sm font-semibold text-[#708238]">
                          {total.toFixed(2)} ₪
                        </div>
                      </div>
                    </div>

                    {/* items */}
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

                    {/* signed doc */}
                    <div className="mt-3 text-xs">
                      {hasSigned ? (
                        <a
                          href={o.documents.offerSigned.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#708238] underline"
                        >
                          View signed price offer
                        </a>
                      ) : (
                        <span className="text-red-600">
                          No signed price offer attached
                        </span>
                      )}
                    </div>

                    {/* actions */}
                    <div className="mt-4 flex gap-3 justify-end">
                      <button
                        onClick={() => sendBackForReupload(o)}
                        className="px-4 py-2 rounded-md border border-red-500 text-red-600 text-sm hover:bg-red-50"
                      >
                        Send back for reupload
                      </button>

                      <button
                        onClick={() => approveOrder(o.id)}
                        disabled={!hasSigned}
                        className={`px-4 py-2 rounded-md text-sm text-white ${
                          hasSigned
                            ? "bg-[#708238] hover:bg-[#5b6c2e]"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                      >
                        Approve order
                      </button>
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
