// AdminCustomers.js
import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// --- Helpers ---

// Format Firebase Timestamp or millis
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

// Calculate total order value
const getOrderTotal = (order) =>
  order.items?.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  ) || 0;

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [showDone, setShowDone] = useState(false);

  // --- Load all customers once ---
  useEffect(() => {
    const loadCustomers = async () => {
      const snap = await getDocs(collection(db, "customers"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCustomers(list);
    };
    loadCustomers();
  }, []);

  // --- Open drawer & load this customer's orders ---
  const openDrawer = async (cust) => {
    setSelectedCustomer(cust);
    setDrawerOpen(true);

    const qOrders = query(
      collection(db, "orders"),
      where("userId", "==", cust.id)
    );

    const snap = await getDocs(qOrders);
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setSelectedOrders(orders);
    setOrderSearch("");
    setShowDone(false);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setSelectedCustomer(null);
      setSelectedOrders([]);
      setOrderSearch("");
      setShowDone(false);
    }, 200);
  };

  // --- Excel: export all customers summary ---
  const exportCustomersExcel = () => {
    const rows = customers.map((c) => ({
      Company: c.companyName || "",
      Registration_Number: c.registrationNumber || "",
      City: c.city || "",
      Address: c.address || "",
      Phone: c.phone || "",
      Contact_Person: c.contactName || "",
      Contact_Phone: c.contactPhone || "",
      Contact_Email: c.contactEmail || "",
      Contact_Position: c.contactPosition || "",
      Accountant_Name: c.accountantName || "",
      Accountant_Phone: c.accountantPhone || "",
      Accountant_Position: c.accountantPosition || "",
      Updated_At: formatDate(c.updatedAt),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      "OliveLine_Customers.xlsx"
    );
  };

  // --- Excel: export this customer's orders ---
  const exportCustomerOrdersExcel = () => {
    if (!selectedCustomer || selectedOrders.length === 0) return;

    const rows = selectedOrders.map((o) => ({
      Order_ID: o.id,
      Order_Last6: o.id.slice(-6),
      Status: o.status || "",
      Created: formatDate(o.createdAt),
      Total: getOrderTotal(o).toFixed(2) + " ₪",
      Price_Offer_File: o.priceOfferURL || "",
      Items: o.items
        ?.map(
          (it) =>
            `${it.name} x${it.quantity} = ${(Number(it.price || 0) *
              Number(it.quantity || 0)).toFixed(2)}₪`
        )
        .join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      selectedCustomer.companyName || "Orders"
    );

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Orders_${selectedCustomer.companyName || selectedCustomer.id}.xlsx`
    );
  };

  // --- Filter customers by name / contact ---
  const filteredCustomers = customers.filter((c) => {
    const s = search.toLowerCase();
    return (
      (c.companyName || "").toLowerCase().includes(s) ||
      (c.contactName || "").toLowerCase().includes(s) ||
      (c.city || "").toLowerCase().includes(s)
    );
  });

  // --- Filter orders by last 6 chars of ID ---
  const filteredOrders = selectedOrders.filter((o) => {
    if (!orderSearch.trim()) return true;
    const last6 = o.id.slice(-6).toLowerCase();
    return last6.includes(orderSearch.toLowerCase());
  });

  const activeOrders = filteredOrders.filter((o) => o.status !== "done");
  const doneOrders = filteredOrders.filter((o) => o.status === "done");

  // Status badge classes
  const statusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "offerAccepted":
      case "accepted":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "preparing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "delivery":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "done":
        return "bg-gray-200 text-gray-700 border-gray-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#4E342E]">
              Customer Accounts
            </h1>
            <p className="text-sm text-gray-700 mt-1">
              View all customers and inspect their orders in detail.
            </p>
          </div>

          <button
            onClick={exportCustomersExcel}
            className="px-4 py-2 bg-[#708238] text-white rounded-md hover:bg-[#5b6c2e] transition"
          >
            Export Customers Excel
          </button>
        </div>

        {/* Search customers */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by company, contact, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 rounded-md border border-gray-300 bg-[#FAF9F6] focus:outline-none focus:ring-2 focus:ring-[#708238]/60"
          />
        </div>

        {/* Customers grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              onClick={() => openDrawer(cust)}
              className="bg-[#FAF9F6] p-5 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-[#4E342E]/10 border-l-4 border-l-[#708238] transition"
            >
              <h2 className="text-lg font-semibold text-[#4E342E]">
                {cust.companyName || "Unnamed company"}
              </h2>
              <p className="text-sm text-gray-700 mt-1">
                ח&quot;פ / ע&quot;מ: {cust.registrationNumber || "-"}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                Contact:{" "}
                <span className="font-medium">
                  {cust.contactName || "-"}
                </span>{" "}
                {cust.contactPhone ? `• ${cust.contactPhone}` : ""}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {cust.city || ""} {cust.address ? `• ${cust.address}` : ""}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Updated: {formatDate(cust.updatedAt) || "-"}
              </p>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="col-span-full text-center text-gray-500 mt-10">
              No customers found.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Drawer */}
      {drawerOpen && selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={closeDrawer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[80vh] bg-[#FAF9F6] rounded-t-2xl shadow-2xl border border-[#4E342E]/10 p-6 overflow-y-auto"
          >
            {/* drawer header */}
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-[#4E342E]">
                    {selectedCustomer.companyName}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedCustomer.contactName} •{" "}
                    {selectedCustomer.contactPosition} •{" "}
                    {selectedCustomer.contactPhone} •{" "}
                    {selectedCustomer.contactEmail}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCustomer.city} • {selectedCustomer.address}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={exportCustomerOrdersExcel}
                    className="px-3 py-1 bg-[#708238] text-white rounded-md text-sm hover:bg-[#5b6c2e]"
                  >
                    Export Orders
                  </button>
                  <button
                    onClick={closeDrawer}
                    className="text-gray-500 hover:text-gray-800 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Order search by last 6 chars */}
              <div>
                <input
                  type="text"
                  placeholder="Search order by LAST 6 characters (e.g. 4u9HN2)..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#708238]/60"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Search checks only the last 6 characters of each order ID.
                </p>
              </div>
            </div>

            {/* Orders content */}
            <div className="mt-4 space-y-4">
              {/* Active orders */}
              <div>
                <h4 className="text-sm font-semibold text-[#4E342E] mb-2">
                  Active Orders
                </h4>

                {activeOrders.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No active orders for this customer.
                  </p>
                )}

                <div className="space-y-3">
                  {activeOrders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-semibold text-[#4E342E]">
                            Order #{o.id.slice(-6)}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Full ID: {o.id}
                          </div>
                          <div className="text-xs text-gray-500">
                            Created: {formatDate(o.createdAt)}
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <span
                            className={
                              "inline-block px-2 py-1 text-[11px] rounded-full border " +
                              statusBadgeClass(o.status)
                            }
                          >
                            {o.status || "unknown"}
                          </span>
                          <div className="text-sm font-semibold text-[#708238]">
                            {getOrderTotal(o).toFixed(2)} ₪
                          </div>
                        </div>
                      </div>

                      {/* items */}
                      <ul className="mt-2 text-xs text-gray-700 space-y-1">
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

                      {o.priceOfferURL && (
                        <div className="mt-2 text-xs">
                          <a
                            href={o.priceOfferURL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#708238] hover:text-[#4E342E] underline"
                          >
                            View price offer file
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Completed (Done) orders - collapsible */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDone((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#EDE6D6] rounded-md border border-[#4E342E]/20 text-sm font-semibold text-[#4E342E]"
                >
                  <span>
                    Completed Orders (Done){" "}
                    {doneOrders.length > 0 && `• ${doneOrders.length}`}
                  </span>
                  <span className="text-xs">
                    {showDone ? "Hide ▲" : "Show ▼"}
                  </span>
                </button>

                {showDone && (
                  <div className="mt-2 space-y-3">
                    {doneOrders.length === 0 && (
                      <p className="text-xs text-gray-500">
                        No completed orders to display.
                      </p>
                    )}

                    {doneOrders.map((o) => (
                      <div
                        key={o.id}
                        className="bg-white border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-semibold text-[#4E342E]">
                              Order #{o.id.slice(-6)}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Full ID: {o.id}
                            </div>
                            <div className="text-xs text-gray-500">
                              Created: {formatDate(o.createdAt)}
                            </div>
                          </div>

                          <div className="text-right space-y-1">
                            <span
                              className={
                                "inline-block px-2 py-1 text-[11px] rounded-full border " +
                                statusBadgeClass(o.status)
                              }
                            >
                              {o.status || "done"}
                            </span>
                            <div className="text-sm font-semibold text-[#708238]">
                              {getOrderTotal(o).toFixed(2)} ₪
                            </div>
                          </div>
                        </div>

                        {/* items */}
                        <ul className="mt-2 text-xs text-gray-700 space-y-1">
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

                        {o.priceOfferURL && (
                          <div className="mt-2 text-xs">
                            <a
                              href={o.priceOfferURL}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#708238] hover:text-[#4E342E] underline"
                            >
                              View price offer file
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {filteredOrders.length === 0 && (
                <p className="text-xs text-gray-500">
                  No orders match this search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
