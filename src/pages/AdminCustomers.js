// AdminCustomers.js
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { auth, db } from "../firebase/firebase";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

/* ---------------- Helpers ---------------- */

// Format Firebase Timestamp or millis
const formatDate = (ts) => {
  if (!ts) return "";
  try {
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toLocaleString("he-IL");
    return new Date(ts).toLocaleString("he-IL");
  } catch {
    return "";
  }
};

// Calculate total order value (new structure first, fallback to items)
const getOrderTotal = (order) =>
  order?.totals?.total ??
  order.items?.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0) ??
  0;

// Status badge classes
const statusBadgeClass = (status) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "offerAccepted":
    case "accepted":
    case "awaitingAdminApproval":
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

export default function AdminCustomers() {
  const [role, setRole] = useState(null);
const [addUserMode, setAddUserMode] = useState("customer"); // "customer" | "admin"

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [showDone, setShowDone] = useState(false);

  // ---- Modals
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  // ---- Messages
  const [pageMessage, setPageMessage] = useState("");

  // ---- Create customer form
  const [customerForm, setCustomerForm] = useState({
    companyName: "",
    registrationNumber: "",
    address: "",
    city: "",
    phone: "",
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    accountantName: "",
    accountantPosition: "",
    accountantPhone: "",
  });

  // ---- Add user form
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("viewer"); // viewer/editor/admin
  const [userMessage, setUserMessage] = useState("");

  /* ---------------- Role check ---------------- */
  useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setRole(snap.data().role);
    };
    checkRole();
  }, []);

  /* ---------------- Load customers ---------------- */
  const loadCustomers = async () => {
    const snap = await getDocs(collection(db, "customers"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setCustomers(list);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  /* ---------------- Drawer: load customer orders ---------------- */
  const openDrawer = async (cust) => {
    setSelectedCustomer(cust);
    setDrawerOpen(true);

    const qOrders = query(collection(db, "orders"), where("customerId", "==", cust.id));
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

  /* ---------------- Excel exports ---------------- */
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
      Updated_At: formatDate(c.updatedAt || c.updatedAt),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), "OliveLine_Customers.xlsx");
  };

  const exportCustomerOrdersExcel = () => {
    if (!selectedCustomer || selectedOrders.length === 0) return;

    const rows = selectedOrders.map((o) => ({
      Order_ID: o.id,
      Order_Last6: o.id.slice(-6),
      Status: o.status || o.stage || "",
      Created: formatDate(o.createdAt),
      Total: getOrderTotal(o).toFixed(2) + " ₪",

      PriceOffer_Draft_URL: o.documents?.offerDraft?.url || "",
      PriceOffer_Signed_URL: o.documents?.offerSigned?.url || "",

      Items: o.items
        ?.map(
          (it) =>
            `${it.name} x${it.quantity} = ${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}₪`
        )
        .join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedCustomer.companyName || "Orders");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Orders_${selectedCustomer.companyName || selectedCustomer.id}.xlsx`
    );
  };

  /* ---------------- Filters ---------------- */
  const filteredCustomers = useMemo(() => {
    const s = search.toLowerCase();
    return customers.filter((c) => {
      return (
        (c.companyName || "").toLowerCase().includes(s) ||
        (c.contactName || "").toLowerCase().includes(s) ||
        (c.city || "").toLowerCase().includes(s)
      );
    });
  }, [customers, search]);

  const filteredOrders = useMemo(() => {
    return selectedOrders.filter((o) => {
      if (!orderSearch.trim()) return true;
      const last6 = o.id.slice(-6).toLowerCase();
      return last6.includes(orderSearch.toLowerCase());
    });
  }, [selectedOrders, orderSearch]);

  const activeOrders = filteredOrders.filter((o) => (o.status || o.stage) !== "done");
  const doneOrders = filteredOrders.filter((o) => (o.status || o.stage) === "done");

  /* ---------------- Modal actions ---------------- */

  // Create Customer
  const openCreateCustomer = () => {
    setPageMessage("");
    setCustomerForm({
      companyName: "",
      registrationNumber: "",
      address: "",
      city: "",
      phone: "",
      contactName: "",
      contactPosition: "",
      contactPhone: "",
      contactEmail: "",
      accountantName: "",
      accountantPosition: "",
      accountantPhone: "",
    });
    setCreateCustomerOpen(true);
  };

  const createCustomer = async (e) => {
    e.preventDefault();
    setPageMessage("");

    const required = ["companyName", "registrationNumber", "address", "city", "phone", "contactName", "contactPhone"];
    for (const field of required) {
      if (!customerForm[field]) {
        setPageMessage("Please fill all required fields.");
        return;
      }
    }

    try {
      await addDoc(collection(db, "customers"), {
        ...customerForm,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid || null,
      });

      setCreateCustomerOpen(false);
      setPageMessage("✅ Customer created successfully.");
      await loadCustomers();
    } catch (err) {
      console.error(err);
      setPageMessage("❌ Error creating customer. See console.");
    }
  };

  // Add user for selected customer
 const openAddUserForSelectedCustomer = () => {
  if (!selectedCustomer) return;
  setAddUserMode("customer");
  setUserEmail("");
  setUserRole("viewer");
  setUserMessage("");
  setAddUserOpen(true);
};


  const addUserSubmit = async (e) => {
  e.preventDefault();
  setUserMessage("");

  if (!userEmail) {
    setUserMessage("Please enter an email.");
    return;
  }

  const emailLower = userEmail.toLowerCase();
  const ref = doc(db, "allowedUsers", emailLower);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setUserMessage("This user already exists in the allowlist.");
      return;
    }

    // ✅ Decide by mode
    const isAdminMode = addUserMode === "admin";

    if (!isAdminMode && !selectedCustomer?.id) {
      setUserMessage("No customer selected.");
      return;
    }

    const payload = {
      allowed: true,
      role: isAdminMode ? "admin" : userRole,       // admin OR viewer/editor
      customerId: isAdminMode ? null : selectedCustomer.id,
      createdAt: Timestamp.now(),
      createdBy: auth.currentUser?.uid || null,
    };

    await setDoc(ref, payload);

    if (isAdminMode) {
      setUserMessage(`✅ Admin ${emailLower} added successfully.`);
    } else {
      setUserMessage(`✅ User ${emailLower} added to "${selectedCustomer.companyName}".`);
    }

    setUserEmail("");
    setUserRole(isAdminMode ? "admin" : "viewer");
  } catch (err) {
    console.error(err);
    setUserMessage("❌ Error adding user. See console.");
  }
};


  /* ---------------- Access control ---------------- */
  if (role && role !== "admin") {
    return (
      <>
        <Navbar />
        <div className="max-w-xl mx-auto mt-20 text-center text-[#4E342E]">
          <h1 className="text-xl font-bold">Admin Access Only</h1>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDE6D6]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#4E342E]">Customer Accounts</h1>
            <p className="text-sm text-gray-700 mt-1">View all customers and inspect their orders in detail.</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openCreateCustomer}
              className="px-4 py-2 rounded-md text-white transition"
              style={{ backgroundColor: OLIVE }}
              title="Add Customer"
            >
              + Add Customer
            </button>
<button
  onClick={() => {
    setAddUserMode("admin");
    setUserEmail("");
    setUserRole("admin");
    setUserMessage("");
    setAddUserOpen(true);
  }}
  className="px-4 py-2 rounded-md text-white transition"
  style={{ backgroundColor: BROWN }}
  title="Add Admin User"
>
  + Add Admin
</button>

            <button
              onClick={exportCustomersExcel}
              className="px-4 py-2 bg-[#708238] text-white rounded-md hover:bg-[#5b6c2e] transition"
            >
              Export Customers Excel
            </button>
          </div>
        </div>

        {pageMessage && (
          <div className="mt-4 p-3 rounded-md border border-[#4E342E]/20 bg-[#FAF9F6] text-[#4E342E]">
            {pageMessage}
          </div>
        )}

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
              className="bg-[#FAF9F6] p-5 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-[#4E342E]/10 border-l-4 transition"
              style={{ borderLeftColor: OLIVE }}
            >
              <h2 className="text-lg font-semibold text-[#4E342E]">{cust.companyName || "Unnamed company"}</h2>
              <p className="text-sm text-gray-700 mt-1">ח&quot;פ / ע&quot;מ: {cust.registrationNumber || "-"}</p>
              <p className="text-sm text-gray-700 mt-1">
                Contact: <span className="font-medium">{cust.contactName || "-"}</span>{" "}
                {cust.contactPhone ? `• ${cust.contactPhone}` : ""}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {cust.city || ""} {cust.address ? `• ${cust.address}` : ""}
              </p>
              <p className="text-xs text-gray-500 mt-2">Updated: {formatDate(cust.updatedAt) || "-"}</p>
            </div>
          ))}

          {filteredCustomers.length === 0 && (
            <div className="col-span-full text-center text-gray-500 mt-10">No customers found.</div>
          )}
        </div>
      </div>

      {/* Bottom Drawer */}
      {drawerOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={closeDrawer}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[80vh] bg-[#FAF9F6] rounded-t-2xl shadow-2xl border border-[#4E342E]/10 p-6 overflow-y-auto"
          >
            {/* drawer header */}
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-[#4E342E]">{selectedCustomer.companyName}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedCustomer.contactName} • {selectedCustomer.contactPosition} •{" "}
                    {selectedCustomer.contactPhone} • {selectedCustomer.contactEmail}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCustomer.city} • {selectedCustomer.address}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={openAddUserForSelectedCustomer}
                      className="px-3 py-1 rounded-md text-sm text-white"
                      style={{ backgroundColor: OLIVE }}
                    >
                      + Add User
                    </button>

                    <button
                      onClick={exportCustomerOrdersExcel}
                      className="px-3 py-1 bg-[#708238] text-white rounded-md text-sm hover:bg-[#5b6c2e]"
                    >
                      Export Orders
                    </button>
                  </div>

                  <button onClick={closeDrawer} className="text-gray-500 hover:text-gray-800 text-xl leading-none">
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
                <p className="mt-1 text-[11px] text-gray-500">Search checks only the last 6 characters of each order ID.</p>
              </div>
            </div>

            {/* Orders content */}
            <div className="mt-4 space-y-4">
              {/* Active orders */}
              <div>
                <h4 className="text-sm font-semibold text-[#4E342E] mb-2">Active Orders</h4>

                {activeOrders.length === 0 && <p className="text-xs text-gray-500">No active orders for this customer.</p>}

                <div className="space-y-3">
                  {activeOrders.map((o) => {
                    const status = o.status || o.stage || "unknown";
                    return (
                      <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-semibold text-[#4E342E]">Order #{o.id.slice(-6)}</div>
                            <div className="text-[11px] text-gray-500">Full ID: {o.id}</div>
                            <div className="text-xs text-gray-500">Created: {formatDate(o.createdAt)}</div>
                          </div>

                          <div className="text-right space-y-1">
                            <span
                              className={"inline-block px-2 py-1 text-[11px] rounded-full border " + statusBadgeClass(status)}
                            >
                              {status}
                            </span>
                            <div className="text-sm font-semibold text-[#708238]">{getOrderTotal(o).toFixed(2)} ₪</div>
                          </div>
                        </div>

                        {/* items */}
                        <ul className="mt-2 text-xs text-gray-700 space-y-1">
                          {o.items?.map((it, idx) => (
                            <li
                              key={it.id || idx}
                              className="flex justify-between border-b border-dashed border-gray-200 pb-0.5"
                            >
                              <span>
                                {it.name} <span className="text-gray-400">× {it.quantity}</span>
                              </span>
                              <span>{(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)} ₪</span>
                            </li>
                          ))}
                        </ul>

                        {/* offer links */}
                        <div className="mt-2 text-xs space-y-1">
                          {o.documents?.offerDraft?.url && (
                            <div>
                              <a
                                href={o.documents.offerDraft.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#708238] hover:text-[#4E342E] underline"
                              >
                                View price offer draft (unsigned)
                              </a>
                            </div>
                          )}

                          {o.documents?.offerSigned?.url && (
                            <div>
                              <a
                                href={o.documents.offerSigned.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#708238] hover:text-[#4E342E] underline"
                              >
                                View signed price offer
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Done orders */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDone((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#EDE6D6] rounded-md border border-[#4E342E]/20 text-sm font-semibold text-[#4E342E]"
                >
                  <span>
                    Completed Orders (Done) {doneOrders.length > 0 && `• ${doneOrders.length}`}
                  </span>
                  <span className="text-xs">{showDone ? "Hide ▲" : "Show ▼"}</span>
                </button>

                {showDone && (
                  <div className="mt-2 space-y-3">
                    {doneOrders.length === 0 && <p className="text-xs text-gray-500">No completed orders to display.</p>}

                    {doneOrders.map((o) => {
                      const status = o.status || o.stage || "done";
                      return (
                        <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-semibold text-[#4E342E]">Order #{o.id.slice(-6)}</div>
                              <div className="text-[11px] text-gray-500">Full ID: {o.id}</div>
                              <div className="text-xs text-gray-500">Created: {formatDate(o.createdAt)}</div>
                            </div>

                            <div className="text-right space-y-1">
                              <span
                                className={"inline-block px-2 py-1 text-[11px] rounded-full border " + statusBadgeClass(status)}
                              >
                                {status}
                              </span>
                              <div className="text-sm font-semibold text-[#708238]">{getOrderTotal(o).toFixed(2)} ₪</div>
                            </div>
                          </div>

                          <ul className="mt-2 text-xs text-gray-700 space-y-1">
                            {o.items?.map((it, idx) => (
                              <li
                                key={it.id || idx}
                                className="flex justify-between border-b border-dashed border-gray-200 pb-0.5"
                              >
                                <span>
                                  {it.name} <span className="text-gray-400">× {it.quantity}</span>
                                </span>
                                <span>{(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)} ₪</span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-2 text-xs space-y-1">
                            {o.documents?.offerDraft?.url && (
                              <div>
                                <a
                                  href={o.documents.offerDraft.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#708238] hover:text-[#4E342E] underline"
                                >
                                  View price offer draft (unsigned)
                                </a>
                              </div>
                            )}
                            {o.documents?.offerSigned?.url && (
                              <div>
                                <a
                                  href={o.documents.offerSigned.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#708238] hover:text-[#4E342E] underline"
                                >
                                  View signed price offer
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredOrders.length === 0 && <p className="text-xs text-gray-500">No orders match this search.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Create Customer Modal ---------------- */}
      {createCustomerOpen && (
        <Modal title="Create Customer Account" onClose={() => setCreateCustomerOpen(false)}>
          <form onSubmit={createCustomer} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Name *" value={customerForm.companyName} onChange={(v) => setCustomerForm((p) => ({ ...p, companyName: v }))} />
              <Field label='Registration Number (ח"פ / ע"מ) *' value={customerForm.registrationNumber} onChange={(v) => setCustomerForm((p) => ({ ...p, registrationNumber: v }))} />
              <Field label="Address *" value={customerForm.address} onChange={(v) => setCustomerForm((p) => ({ ...p, address: v }))} />
              <Field label="City *" value={customerForm.city} onChange={(v) => setCustomerForm((p) => ({ ...p, city: v }))} />
              <Field label="Company Phone *" value={customerForm.phone} onChange={(v) => setCustomerForm((p) => ({ ...p, phone: v }))} />
            </div>

            <div className="border-t pt-4">
              <div className="font-semibold mb-3" style={{ color: OLIVE }}>
                Main Contact Person
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name *" value={customerForm.contactName} onChange={(v) => setCustomerForm((p) => ({ ...p, contactName: v }))} />
                <Field label="Position" value={customerForm.contactPosition} onChange={(v) => setCustomerForm((p) => ({ ...p, contactPosition: v }))} />
                <Field label="Phone *" value={customerForm.contactPhone} onChange={(v) => setCustomerForm((p) => ({ ...p, contactPhone: v }))} />
                <Field label="Email" value={customerForm.contactEmail} onChange={(v) => setCustomerForm((p) => ({ ...p, contactEmail: v }))} />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="font-semibold mb-3" style={{ color: OLIVE }}>
                Accounting Department (Optional)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Name" value={customerForm.accountantName} onChange={(v) => setCustomerForm((p) => ({ ...p, accountantName: v }))} />
                <Field label="Position" value={customerForm.accountantPosition} onChange={(v) => setCustomerForm((p) => ({ ...p, accountantPosition: v }))} />
                <Field label="Phone" value={customerForm.accountantPhone} onChange={(v) => setCustomerForm((p) => ({ ...p, accountantPhone: v }))} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md border"
                onClick={() => setCreateCustomerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md text-white font-semibold"
                style={{ backgroundColor: OLIVE }}
              >
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------------- Add User Modal (for selected customer) ---------------- */}
{addUserOpen && selectedCustomer && (
        <Modal
title={
  addUserMode === "admin"
    ? "Add System Admin"
    : `Add User for ${selectedCustomer.companyName}`
}
          onClose={() => setAddUserOpen(false)}
        >
          <form onSubmit={addUserSubmit} className="space-y-4">

            {addUserMode === "admin" ? (
  <div className="text-sm text-gray-600">
    You are adding a <span className="font-semibold">SYSTEM ADMIN</span> (not linked to any customer).
  </div>
) : (
  <div className="text-sm text-gray-600">
    This user will be linked to:{" "}
    <span className="font-semibold text-[#4E342E]">{selectedCustomer.companyName}</span>
  </div>
)}


            <div>
              <label className="block text-sm font-medium text-[#4E342E]">Email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@company.com"
                className="mt-1 w-full px-3 py-2 rounded-lg border"
                style={{ backgroundColor: CREAM, borderColor: `${BROWN}55` }}
                required
              />
            </div>

          <div>
  <label className="block text-sm font-medium text-[#4E342E]">Role</label>

  {addUserMode === "admin" ? (
    <input
      value="admin"
      disabled
      className="mt-1 w-full px-3 py-2 rounded-lg border text-gray-600"
      style={{ backgroundColor: CREAM, borderColor: `${BROWN}55` }}
    />
  ) : (
    <select
      value={userRole}
      onChange={(e) => setUserRole(e.target.value)}
      className="mt-1 w-full px-3 py-2 rounded-lg border"
      style={{ backgroundColor: CREAM, borderColor: `${BROWN}55` }}
    >
      <option value="viewer">Viewer</option>
      <option value="editor">Editor</option>
    </select>
  )}

  <div className="mt-1 text-xs text-gray-500">
    {addUserMode === "admin"
      ? "Admin has full system access."
      : "Viewer = view only • Editor = can create orders/price offers (depends on your rules)."}
  </div>
</div>


            {userMessage && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: CREAM, border: `1px solid ${BROWN}33`, color: BROWN }}>
                {userMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-md border" onClick={() => setAddUserOpen(false)}>
                Close
              </button>
              <button type="submit" className="px-4 py-2 rounded-md text-white font-semibold" style={{ backgroundColor: OLIVE }}>
                Add User
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Small reusable UI components ---------------- */

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl p-5 border"
        style={{ backgroundColor: SOFTWHITE, borderColor: `${BROWN}22` }}
      >
        <div className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: `${BROWN}22` }}>
          <div className="text-xl font-bold" style={{ color: BROWN }}>
            {title}
          </div>
          <button className="text-gray-500 hover:text-gray-800 text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#4E342E]">
        {label} <span className="text-red-600">*</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1 w-full p-3 border rounded"
        style={{ backgroundColor: "#EDE6D6", borderColor: "#4E342E33" }}
        placeholder={label}
      />
    </div>
  );
}

