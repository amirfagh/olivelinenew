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

export default function AdminOrderApproval() {
  const [orders, setOrders] = useState([]);
  const [role, setRole] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const fetchRole = async () => {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setRole((snap.data().role || "").trim());
      }
    };

    fetchRole();
  }, []);

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

  const pushMessage = (text, type = "success", ms = 2500) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), ms);
  };

  const approveOrder = async (orderId) => {
    try {
      const user = auth.currentUser;
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "offerAccepted",
        approvedAt: Timestamp.now(),
        approvedBy: user ? user.uid : null,
        reuploadRequired: false,
      });
      pushMessage("Order approved and price offer accepted.", "success");
    } catch (err) {
      console.error(err);
      pushMessage("Error approving order.", "error");
    }
  };

  const sendBackForReupload = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "pending",
        reuploadRequired: true,
      });
      pushMessage(
        "Order sent back to customer for new signed price offer.",
        "success"
      );
    } catch (err) {
      console.error(err);
      pushMessage("Error updating order.", "error");
    }
  };

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

  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#4E342E] mb-4">
          Orders Awaiting Approval
        </h1>
        <p className="text-sm text-gray-700 mb-6">
          Review signed price offers from customers and approve or send them
          back for a new upload.
        </p>

        {orders.length === 0 ? (
          <p className="text-gray-500">
            No orders waiting for approval at the moment.
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
                        <div className="text-xs text-gray-500">
                          Customer: {o.userEmail}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex px-2 py-1 rounded-full text-[11px] bg-blue-100 text-blue-800 border border-blue-300">
                          awaitingAdminApproval
                        </span>
                        <div className="mt-1 text-sm font-semibold text-[#708238]">
                          {total.toFixed(2)} ₪
                        </div>
                      </div>
                    </div>

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

                    <div className="mt-3 text-xs text-gray-700">
                      {o.signedPriceOfferURL ? (
                        <a
                          href={o.signedPriceOfferURL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#708238] hover:text-[#4E342E] underline"
                        >
                          View signed price offer (PDF / image)
                        </a>
                      ) : (
                        <span className="text-red-500">
                          No signed price offer file attached.
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 justify-end">
                      <button
                        onClick={() => sendBackForReupload(o.id)}
                        className="px-4 py-2 rounded-md border border-red-500 text-red-600 text-sm hover:bg-red-50"
                      >
                        Send back for reupload
                      </button>
                      <button
                        onClick={() => approveOrder(o.id)}
                        disabled={!o.signedPriceOfferURL}
                        className={`px-4 py-2 rounded-md text-sm text-white ${
                          o.signedPriceOfferURL
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
