// src/pages/ManufacturersReports.js
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import * as XLSX from "xlsx";

const OLIVE = "#708238";
const CREAM = "#EDE6D6";
const BROWN = "#4E342E";
const SOFTWHITE = "#FAF9F6";

const VAT_RATE_DEFAULT = 0.18;

// ---------- utils ----------
const pad2 = (n) => String(n).padStart(2, "0");
const toDateInput = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const chunkArray = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const formatMoney = (n) => `₪ ${Number(n || 0).toFixed(2)}`;

const safeSheetName = (name) => {
  const cleaned = String(name || "Sheet").replace(/[\\/:*?\[\]]/g, "_");
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
};

// Tier multiplier based on CURRENT tierPricing (fallback for legacy orders)
const getTierMultiplierUsed = (productLike, quantity) => {
  const tiers = productLike?.tierPricing;
  if (!Array.isArray(tiers) || tiers.length === 0) return 1;

  const sorted = [...tiers].sort((a, b) => safeNum(a.min) - safeNum(b.min));
  let tier = sorted.find(
    (t) => quantity >= safeNum(t.min) && quantity <= safeNum(t.max)
  );
  if (!tier) tier = sorted[sorted.length - 1];
  return safeNum(tier.multiplier || 1);
};

// ---------- Firestore fetch helpers ----------
async function fetchManufacturers() {
  const snap = await getDocs(collection(db, "manufacturers"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Robust DONE fetch:
 * - Supports both: quotation.status == "done" OR root status == "done"
 * - Then filters by date in JS (works with createdAt Timestamp or number)
 */
async function fetchDoneOrdersInRange(fromISO, toISO) {
  const fromMs = startOfDay(new Date(fromISO)).getTime();
  const toMs = endOfDay(new Date(toISO)).getTime();

  const q1 = query(
    collection(db, "orders"),
    where("quotation.status", "==", "done")
  );
  const q2 = query(collection(db, "orders"), where("status", "==", "done"));

  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const map = new Map();
  [...s1.docs, ...s2.docs].forEach((d) =>
    map.set(d.id, { id: d.id, ...d.data() })
  );

  const allDone = Array.from(map.values());

  return allDone.filter((o) => {
    const createdAtMs =
      o.createdAt?.toDate
        ? o.createdAt.toDate().getTime()
        : typeof o.createdAt === "number"
        ? o.createdAt
        : 0;

    return createdAtMs >= fromMs && createdAtMs <= toMs;
  });
}

async function fetchSouvenirsByIds(productIds) {
  const unique = Array.from(new Set(productIds)).filter(Boolean);
  if (unique.length === 0) return new Map();

  const chunks = chunkArray(unique, 10);
  const map = new Map();

  for (const idsChunk of chunks) {
    const qy = query(
      collection(db, "souvenirs"),
      where("__name__", "in", idsChunk)
    );
    const snap = await getDocs(qy);
    snap.forEach((docSnap) =>
      map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })
    );
  }
  return map;
}

// ---------- Excel helpers ----------
function aoaToSheetWithWidths(aoa, colWidths = []) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths?.length) {
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  }
  return ws;
}

function exportWorkbook(wb, filename) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildHeader(meta) {
  return [
    ["Report", meta.title],
    ["Manufacturer", meta.manufacturerName || "All"],
    ["Period", `${meta.fromISO} → ${meta.toISO}`],
    ["Generated At", new Date().toLocaleString()],
    ["Notes", meta.note || ""],
    [],
  ];
}

function exportSummaryDetails({ summaryRows, detailRows, meta }) {
  const wb = XLSX.utils.book_new();

  const header = buildHeader({
    ...meta,
    title: "Manufacturer Payables (BUY pricing)",
  });

  const summaryAOA = [
    ...header,
    [
      "Manufacturer",
      "ManufacturerId",
      "OrdersCount",
      "LinesCount",
      "TotalQty",
      "TotalToPay",
    ],
    ...summaryRows.map((r) => [
      r.manufacturerName,
      r.manufacturerId,
      r.ordersCount,
      r.linesCount,
      r.totalQty,
      r.totalToPay,
    ]),
    [],
    [
      "Grand Total",
      "",
      "",
      "",
      "",
      summaryRows.reduce((s, r) => s + safeNum(r.totalToPay), 0),
    ],
  ];

  const detailsAOA = [
    ...header,
    [
      "Manufacturer",
      "ManufacturerId",
      "OrderId",
      "OrderDate",
      "CustomerId",
      "ProductId",
      "ProductName",
      "Qty",
      "Buy Unit",
      "Line Total",
    ],
    ...detailRows.map((r) => [
      r.manufacturerName,
      r.manufacturerId,
      r.orderId,
      r.orderDate,
      r.customerId,
      r.productId,
      r.productName,
      r.qty,
      Number(r.buyUnitPrice || 0).toFixed(2),
      Number(r.buyLineTotal || 0).toFixed(2),
    ]),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    aoaToSheetWithWidths(summaryAOA, [28, 18, 12, 12, 12, 14]),
    "Summary"
  );
  XLSX.utils.book_append_sheet(
    wb,
    aoaToSheetWithWidths(detailsAOA, [
      24, 18, 18, 22, 14, 18, 34, 8, 12, 14,
    ]),
    "Details"
  );

  const safeName = String(meta.manufacturerName || "all").replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
  exportWorkbook(
    wb,
    `manufacturer_payables_${safeName}_${meta.fromISO}_to_${meta.toISO}.xlsx`
  );
}

/**
 * ✅ Manufacturer Statement (what you send to the manufacturer)
 * - NO sell prices
 * - NO profit
 * - NO avg buy unit
 * - Shows only qty + totals to pay
 */
function exportManufacturerStatement({ statement, meta }) {
  const wb = XLSX.utils.book_new();

  const header = buildHeader({
    ...meta,
    title: "Manufacturer Statement (Per-Product Breakdown)",
  });

  const productsAOA = [
    ...header,
    ["Product", "ProductId", "Total Qty", "Total To Pay"],
    ...statement.products.map((p) => [
      p.productName,
      p.productId,
      p.totalQty,
      p.totalToPay,
    ]),
    [],
    ["Total To Pay", "", "", statement.totalToPay],
  ];

  const linesAOA = [
    ...header,
    ["OrderId", "OrderDate", "CustomerId", "Product", "Qty", "Buy Unit", "Line Total"],
    ...statement.lines.map((l) => [
      l.orderId,
      l.orderDate,
      l.customerId,
      l.productName,
      l.qty,
      Number(l.buyUnitPrice || 0).toFixed(2),
      Number(l.buyLineTotal || 0).toFixed(2),
    ]),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    aoaToSheetWithWidths(productsAOA, [36, 18, 12, 14]),
    "Products"
  );
  XLSX.utils.book_append_sheet(
    wb,
    aoaToSheetWithWidths(linesAOA, [18, 22, 14, 34, 8, 12, 14]),
    "Lines"
  );

  const safeM = String(meta.manufacturerName || "manufacturer").replace(
    /[\\/:*?"<>|]/g,
    "_"
  );
  exportWorkbook(
    wb,
    `manufacturer_statement_${safeM}_${meta.fromISO}_to_${meta.toISO}.xlsx`
  );
}

function exportAllStatementsWorkbook({ statementsByManufacturer, meta }) {
  const wb = XLSX.utils.book_new();

  const header = buildHeader({ ...meta, title: "All Manufacturer Statements" });

  const summaryAOA = [
    ...header,
    [
      "Manufacturer",
      "ManufacturerId",
      "ProductsCount",
      "LinesCount",
      "Total Qty",
      "Total To Pay",
    ],
    ...Object.values(statementsByManufacturer).map((st) => [
      st.manufacturerName,
      st.manufacturerId,
      st.products.length,
      st.lines.length,
      st.products.reduce((s, p) => s + safeNum(p.totalQty), 0),
      st.totalToPay,
    ]),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    aoaToSheetWithWidths(summaryAOA, [28, 18, 14, 12, 12, 14]),
    "Summary"
  );

  // One sheet per manufacturer (manufacturer-friendly)
  Object.values(statementsByManufacturer).forEach((st) => {
    const sh = safeSheetName(
      st.manufacturerName || st.manufacturerId || "Manufacturer"
    );

    const aoa = [
      ...buildHeader({
        ...meta,
        title: "Manufacturer Statement (Per-Product)",
        manufacturerName: st.manufacturerName,
        note: st.note || "",
      }),
      ["Product", "ProductId", "Total Qty", "Total To Pay"],
      ...st.products.map((p) => [p.productName, p.productId, p.totalQty, p.totalToPay]),
      [],
      ["Total To Pay", "", "", st.totalToPay],
    ];

    XLSX.utils.book_append_sheet(
      wb,
      aoaToSheetWithWidths(aoa, [36, 18, 12, 14]),
      sh
    );
  });

  exportWorkbook(wb, `all_manufacturer_statements_${meta.fromISO}_to_${meta.toISO}.xlsx`);
}

/**
 * ✅ Internal Sales Report (FOR YOU ONLY)
 * Includes revenue, cost, profit, margin + breakdowns.
 */
function exportSalesReportWorkbook({ salesReport }) {
  const wb = XLSX.utils.book_new();

  const header = buildHeader({
    title: "Internal Sales Report",
    manufacturerName: "All (internal)",
    fromISO: salesReport.fromISO,
    toISO: salesReport.toISO,
    note: "Revenue = Sell totals, Cost = Payable totals, Profit = Revenue - Cost",
  });

  const summaryAOA = [
    ...header,
    ["Metric", "Value"],
    ["Orders", salesReport.ordersCount],
    ["Total Qty", salesReport.qty],
    ["Revenue", salesReport.revenue],
    ["Cost", salesReport.cost],
    ["Profit", salesReport.profit],
    ["Margin %", salesReport.margin],
  ];

  const manAOA = [
    ...header,
    ["Manufacturer", "Orders", "Qty", "Revenue", "Cost", "Profit", "Margin %"],
    ...salesReport.byManufacturer.map((m) => [
      m.manufacturerName,
      m.ordersCount,
      m.qty,
      m.revenue,
      m.cost,
      m.profit,
      m.margin,
    ]),
  ];

  const prodAOA = [
    ...header,
    ["Product", "ProductId", "Manufacturer", "Qty", "Revenue", "Cost", "Profit", "Margin %"],
    ...salesReport.byProduct.map((p) => [
      p.productName,
      p.productId,
      p.manufacturerName,
      p.qty,
      p.revenue,
      p.cost,
      p.profit,
      p.margin,
    ]),
  ];

  XLSX.utils.book_append_sheet(wb, aoaToSheetWithWidths(summaryAOA, [22, 18]), "Summary");
  XLSX.utils.book_append_sheet(wb, aoaToSheetWithWidths(manAOA, [28, 10, 10, 14, 14, 14, 10]), "By Manufacturer");
  XLSX.utils.book_append_sheet(wb, aoaToSheetWithWidths(prodAOA, [34, 18, 24, 10, 14, 14, 14, 10]), "By Product");

  exportWorkbook(wb, `internal_sales_report_${salesReport.fromISO}_to_${salesReport.toISO}.xlsx`);
}

// ---------- Main Component ----------
export default function ManufacturersReports() {
  // defaults: last 30 days
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInput(d);
  });
  const [dateTo, setDateTo] = useState(() => toDateInput(new Date()));

  const [manufacturers, setManufacturers] = useState([]);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState("all");
  const [manufacturerSearch, setManufacturerSearch] = useState("");

  const [sortKey, setSortKey] = useState("totalToPay"); // name | totalToPay | totalQty | orders
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  const [includeVatOnBuy, setIncludeVatOnBuy] = useState(false);
  const [payByBuyBaseOnly, setPayByBuyBaseOnly] = useState(true);

  const [expandedManufacturerId, setExpandedManufacturerId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // report data
  const [report, setReport] = useState(null);

  // ✅ internal sales report
  const [salesReport, setSalesReport] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchManufacturers();
        setManufacturers(list);
      } catch (e) {
        console.error(e);
        setError("Failed to load manufacturers.");
      }
    })();
  }, []);

  const manufacturerOptions = useMemo(() => {
    const q = manufacturerSearch.trim().toLowerCase();
    if (!q) return manufacturers;
    return manufacturers.filter((m) =>
      (m.name || "").toLowerCase().includes(q)
    );
  }, [manufacturers, manufacturerSearch]);

  const selectedManufacturerName = useMemo(() => {
    if (selectedManufacturerId === "all") return "All manufacturers";
    return (
      manufacturers.find((m) => m.id === selectedManufacturerId)?.name ||
      "Selected"
    );
  }, [selectedManufacturerId, manufacturers]);

  const periodValid = useMemo(() => {
    const a = new Date(dateFrom).getTime();
    const b = new Date(dateTo).getTime();
    return Number.isFinite(a) && Number.isFinite(b) && a <= b;
  }, [dateFrom, dateTo]);

  const setPreset = (preset) => {
    const now = new Date();

    if (preset === "last7") {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      setDateFrom(toDateInput(from));
      setDateTo(toDateInput(now));
      return;
    }

    if (preset === "thisMonth") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(toDateInput(from));
      setDateTo(toDateInput(to));
      return;
    }

    if (preset === "lastMonth") {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(toDateInput(from));
      setDateTo(toDateInput(to));
      return;
    }

    if (preset === "thisYear") {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      setDateFrom(toDateInput(from));
      setDateTo(toDateInput(to));
      return;
    }
  };

  const handleGenerate = async () => {
    setError("");
    setReport(null);
    setSalesReport(null);
    setExpandedManufacturerId(null);

    if (!periodValid) {
      setError("Invalid period: Date From must be earlier than Date To.");
      return;
    }

    setLoading(true);

    try {
      const orders = await fetchDoneOrdersInRange(dateFrom, dateTo);

      // Collect productIds for fallback computations and missing doc detection
      const legacyProductIds = [];

      for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : [];
        for (const it of items) {
          const hasBuySnapshot =
            it.buyUnitPrice != null ||
            it.buyBase != null ||
            it.tierMultiplierUsed != null ||
            it.buyLineTotal != null;

          if (!hasBuySnapshot && it.productId) legacyProductIds.push(it.productId);
        }
      }

      const souvenirsMap = await fetchSouvenirsByIds([...legacyProductIds]);

      // Data structures
      const manufacturerAgg = new Map(); // manufacturerId -> totals
      const detailRows = [];
      const statementsByManufacturer = {}; // manufacturerId -> statement data

      // Health counters
      let legacyLinesCount = 0;
      let missingManufacturerIdCount = 0;
      let missingProductDocCount = 0;

      // For drilldown: manufacturer -> product aggregation
      const productAggByManufacturer = new Map(); // mid -> Map(productId -> agg)

      // ✅ Internal sales aggregations
      const salesAggByManufacturer = new Map();
      const salesAggByProduct = new Map();
      let salesRevenueTotal = 0;
      let salesCostTotal = 0;
      let salesQtyTotal = 0;
      const salesOrdersSet = new Set();

      for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : [];
        const orderDate = o.createdAt?.toDate
          ? o.createdAt.toDate().toLocaleString()
          : typeof o.createdAt === "number"
          ? new Date(o.createdAt).toLocaleString()
          : "";
        const customerId = o.customerId || "";

        const vatRate = safeNum(o?.quotation?.vatRate ?? VAT_RATE_DEFAULT);

        for (const it of items) {
          const productId = it.productId || "";
          const qty = safeNum(it.quantity);

          // SELL info (internal only)
          const sellUnitPrice = safeNum(it.price);
          const sellLineTotal = sellUnitPrice * qty;

          const product = souvenirsMap.get(productId);

          const manufacturerId = it.manufacturerId || product?.manufacturerId || "";
          const manufacturerName =
            it.manufacturerName ||
            it.manufacturer ||
            product?.manufacturer ||
            "Unknown Manufacturer";

          const missingManufacturerId = !manufacturerId;
          if (missingManufacturerId) missingManufacturerIdCount += 1;

          // Filter by selected manufacturer (for payable report)
          if (
            selectedManufacturerId !== "all" &&
            manufacturerId !== selectedManufacturerId
          ) {
            continue;
          }

          // BUY snapshot preferred
          let buyBase = it.buyBase != null ? safeNum(it.buyBase) : null;
          let tierMultiplierUsed =
            it.tierMultiplierUsed != null ? safeNum(it.tierMultiplierUsed) : null;
          let buyUnitPrice = it.buyUnitPrice != null ? safeNum(it.buyUnitPrice) : null;
          let buyLineTotal = it.buyLineTotal != null ? safeNum(it.buyLineTotal) : null;

          let isLegacyBuyCalc = false;

          const missingProductDoc = !product && (buyUnitPrice == null || buyLineTotal == null);
          if (missingProductDoc) missingProductDocCount += 1;

          // Legacy fallback from current product doc
          if ((buyUnitPrice == null || buyLineTotal == null) && product) {
            isLegacyBuyCalc = true;
            legacyLinesCount += 1;

            const base = safeNum(product?.buy);
            const mult = getTierMultiplierUsed(product, qty);
            const unit = base * mult;
            const line = unit * qty;

            buyBase = buyBase ?? base;
            tierMultiplierUsed = tierMultiplierUsed ?? mult;
            buyUnitPrice = buyUnitPrice ?? unit;
            buyLineTotal = buyLineTotal ?? line;
          }

          buyBase = safeNum(buyBase);
          tierMultiplierUsed = safeNum(tierMultiplierUsed || 0);
          buyUnitPrice = safeNum(buyUnitPrice);
          buyLineTotal = safeNum(buyLineTotal);

          // ✅ Payable amount logic (base-only or tiered buy)
          const baseOnlyLineTotal = buyBase * qty;   // NO multiplier
          const tieredLineTotal = buyLineTotal;      // WITH multiplier

          let payableLineTotal = payByBuyBaseOnly ? baseOnlyLineTotal : tieredLineTotal;

          const payableLineTotalFinal = includeVatOnBuy
            ? payableLineTotal * (1 + vatRate)
            : payableLineTotal;

          const productName = it.name || product?.name || "";
          const midKey = manufacturerId || "unknown";

          detailRows.push({
            manufacturerId: manufacturerId || "unknown",
            manufacturerName,
            orderId: o.id,
            orderDate,
            customerId,
            productId,
            productName,
            qty,
            buyBase,
            tierMultiplierUsed,
            buyUnitPrice,
            buyLineTotal: payableLineTotalFinal,
            isLegacyBuyCalc,
            missingManufacturerId,
            missingProductDoc: missingProductDoc && !product,
          });

          // Aggregate manufacturer totals (payables)
          const existing =
            manufacturerAgg.get(midKey) || {
              manufacturerId: manufacturerId || "unknown",
              manufacturerName,
              totalToPay: 0,
              totalQty: 0,
              ordersSet: new Set(),
              linesCount: 0,
            };

          existing.totalToPay += payableLineTotalFinal;
          existing.totalQty += qty;
          existing.ordersSet.add(o.id);
          existing.linesCount += 1;

          if (existing.manufacturerName === "Unknown Manufacturer" && manufacturerName) {
            existing.manufacturerName = manufacturerName;
          }
          manufacturerAgg.set(midKey, existing);

          // Drilldown per-product (payables)
          if (!productAggByManufacturer.has(midKey)) {
            productAggByManufacturer.set(midKey, new Map());
          }
          const pMap = productAggByManufacturer.get(midKey);

          const pKey = productId || productName || "unknownProduct";
          const pExisting =
            pMap.get(pKey) || {
              productId: productId || "",
              productName: productName || "Unknown Product",
              totalQty: 0,
              totalToPay: 0,
            };

          pExisting.totalQty += qty;
          pExisting.totalToPay += payableLineTotalFinal;
          pMap.set(pKey, pExisting);

          // ✅ Internal Sales aggregation (revenue/cost/profit)
          salesRevenueTotal += sellLineTotal;
          salesCostTotal += payableLineTotalFinal;
          salesQtyTotal += qty;
          salesOrdersSet.add(o.id);

          const mPrev = salesAggByManufacturer.get(midKey) || {
            manufacturerId: manufacturerId || "unknown",
            manufacturerName,
            revenue: 0,
            cost: 0,
            qty: 0,
            ordersSet: new Set(),
          };
          mPrev.revenue += sellLineTotal;
          mPrev.cost += payableLineTotalFinal;
          mPrev.qty += qty;
          mPrev.ordersSet.add(o.id);
          salesAggByManufacturer.set(midKey, mPrev);

          const spPrev = salesAggByProduct.get(pKey) || {
            productId: productId || "",
            productName: productName || "Unknown Product",
            manufacturerName,
            revenue: 0,
            cost: 0,
            qty: 0,
          };
          spPrev.revenue += sellLineTotal;
          spPrev.cost += payableLineTotalFinal;
          spPrev.qty += qty;
          salesAggByProduct.set(pKey, spPrev);
        }
      }

      // summary rows (payables)
      let summaryRows = Array.from(manufacturerAgg.values()).map((m) => ({
        manufacturerId: m.manufacturerId,
        manufacturerName: m.manufacturerName,
        ordersCount: m.ordersSet.size,
        linesCount: m.linesCount,
        totalQty: m.totalQty,
        totalToPay: Number(m.totalToPay.toFixed(2)),
      }));

      // sorting
      const dir = sortDir === "asc" ? 1 : -1;
      summaryRows.sort((a, b) => {
        if (sortKey === "name")
          return dir * (a.manufacturerName || "").localeCompare(b.manufacturerName || "");
        if (sortKey === "totalQty")
          return dir * (safeNum(a.totalQty) - safeNum(b.totalQty));
        if (sortKey === "orders")
          return dir * (safeNum(a.ordersCount) - safeNum(b.ordersCount));
        return dir * (safeNum(a.totalToPay) - safeNum(b.totalToPay));
      });

      // details sorting for stable preview
      detailRows.sort((a, b) => {
        const m = (a.manufacturerName || "").localeCompare(b.manufacturerName || "");
        if (m !== 0) return m;
        return (a.orderDate || "").localeCompare(b.orderDate || "");
      });

      // Build statements per manufacturer (manufacturer-friendly export)
      for (const s of summaryRows) {
        const mid = s.manufacturerId || "unknown";
        const pMap = productAggByManufacturer.get(mid) || new Map();

        const products = Array.from(pMap.values())
          .map((p) => ({
            productId: p.productId,
            productName: p.productName,
            totalQty: p.totalQty,
            totalToPay: Number(p.totalToPay.toFixed(2)),
          }))
          .sort((a, b) => safeNum(b.totalToPay) - safeNum(a.totalToPay));

        const lines = detailRows
          .filter((r) => r.manufacturerId === mid)
          .map((r) => ({
            orderId: r.orderId,
            orderDate: r.orderDate,
            customerId: r.customerId,
            productId: r.productId,
            productName: r.productName,
            qty: r.qty,
            buyUnitPrice: Number((r.buyUnitPrice || 0).toFixed(2)),
            buyLineTotal: Number((r.buyLineTotal || 0).toFixed(2)),
            isLegacyBuyCalc: r.isLegacyBuyCalc,
          }));

        statementsByManufacturer[mid] = {
          manufacturerId: mid,
          manufacturerName: s.manufacturerName,
          products,
          lines,
          totalToPay: Number(s.totalToPay.toFixed(2)),
          note: legacyLinesCount > 0 ? "Some lines may be legacy-calculated." : "",
        };
      }

      const grandTotal = summaryRows.reduce((sum, r) => sum + safeNum(r.totalToPay), 0);

      setReport({
        ordersCount: orders.length,
        summaryRows,
        detailRows,
        grandTotal: Number(grandTotal.toFixed(2)),
        health: {
          legacyLinesCount,
          missingManufacturerIdCount,
          missingProductDocCount,
        },
        statementsByManufacturer,
      });

      // ✅ Build internal salesReport
      const revenue = Number(salesRevenueTotal.toFixed(2));
      const cost = Number(salesCostTotal.toFixed(2));
      const profit = Number((revenue - cost).toFixed(2));
      const margin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0;

      const byManufacturer = Array.from(salesAggByManufacturer.values())
        .map((m) => {
          const p = m.revenue - m.cost;
          return {
            manufacturerId: m.manufacturerId,
            manufacturerName: m.manufacturerName,
            ordersCount: m.ordersSet.size,
            qty: m.qty,
            revenue: Number(m.revenue.toFixed(2)),
            cost: Number(m.cost.toFixed(2)),
            profit: Number(p.toFixed(2)),
            margin: m.revenue > 0 ? Number(((p / m.revenue) * 100).toFixed(2)) : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit);

      const byProduct = Array.from(salesAggByProduct.values())
        .map((p) => {
          const pr = p.revenue - p.cost;
          return {
            productId: p.productId,
            productName: p.productName,
            manufacturerName: p.manufacturerName,
            qty: p.qty,
            revenue: Number(p.revenue.toFixed(2)),
            cost: Number(p.cost.toFixed(2)),
            profit: Number(pr.toFixed(2)),
            margin: p.revenue > 0 ? Number(((pr / p.revenue) * 100).toFixed(2)) : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit);

      setSalesReport({
        fromISO: dateFrom,
        toISO: dateTo,
        ordersCount: salesOrdersSet.size,
        qty: salesQtyTotal,
        revenue,
        cost,
        profit,
        margin,
        byManufacturer,
        byProduct,
      });
    } catch (e) {
      console.error(e);
      setError("Failed to generate report. Check statuses, dates, and Firestore rules.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportSummaryDetails = () => {
    if (!report) return;

    const noteParts = [];
    if (report.health.legacyLinesCount > 0)
      noteParts.push(`Legacy lines: ${report.health.legacyLinesCount}`);
    if (report.health.missingManufacturerIdCount > 0)
      noteParts.push(`Missing manufacturerId lines: ${report.health.missingManufacturerIdCount}`);
    if (report.health.missingProductDocCount > 0)
      noteParts.push(`Missing product docs: ${report.health.missingProductDocCount}`);
    if (includeVatOnBuy) noteParts.push("BUY totals include VAT (toggle ON)");
    noteParts.push(payByBuyBaseOnly ? "Payables = BuyBase only" : "Payables = Tiered buy");

    exportSummaryDetails({
      summaryRows: report.summaryRows,
      detailRows: report.detailRows,
      meta: {
        manufacturerName: selectedManufacturerName,
        fromISO: dateFrom,
        toISO: dateTo,
        note: noteParts.join(" | "),
      },
    });
  };

  const handleExportAllStatements = () => {
    if (!report) return;

    exportAllStatementsWorkbook({
      statementsByManufacturer: report.statementsByManufacturer,
      meta: {
        manufacturerName: "All manufacturers",
        fromISO: dateFrom,
        toISO: dateTo,
        note: [
          includeVatOnBuy ? "BUY totals include VAT" : "BUY totals exclude VAT",
          payByBuyBaseOnly ? "Payables = BuyBase only" : "Payables = Tiered buy",
        ].join(" | "),
      },
    });
  };

  const exportStatementForManufacturer = (manufacturerId, manufacturerName) => {
    if (!report) return;

    const st = report.statementsByManufacturer[manufacturerId || "unknown"];
    if (!st) return;

    exportManufacturerStatement({
      statement: st,
      meta: {
        manufacturerName: manufacturerName || st.manufacturerName,
        fromISO: dateFrom,
        toISO: dateTo,
        note: [
          includeVatOnBuy ? "BUY totals include VAT" : "BUY totals exclude VAT",
          payByBuyBaseOnly ? "Payables = BuyBase only" : "Payables = Tiered buy",
        ].join(" | "),
      },
    });
  };

  const handleExportSalesReport = () => {
    if (!salesReport) return;
    exportSalesReportWorkbook({ salesReport });
  };

  // Filter summary by search too
  const filteredSummary = useMemo(() => {
    if (!report) return [];
    const q = manufacturerSearch.trim().toLowerCase();
    if (!q) return report.summaryRows;
    return report.summaryRows.filter((r) =>
      (r.manufacturerName || "").toLowerCase().includes(q)
    );
  }, [report, manufacturerSearch]);

  const toggleExpanded = (mid) => {
    setExpandedManufacturerId((prev) => (prev === mid ? null : mid));
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: SOFTWHITE }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-5" style={{ borderColor: CREAM }}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: BROWN }}>
                Manufacturer Payables & Statements
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Done orders → group by manufacturer → calculate{" "}
                <span className="font-semibold" style={{ color: OLIVE }}>
                  BUY totals
                </span>{" "}
                and generate per-product manufacturer statements.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPreset("last7")}
                className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
              >
                Last 7 days
              </button>
              <button
                onClick={() => setPreset("thisMonth")}
                className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
              >
                This month
              </button>
              <button
                onClick={() => setPreset("lastMonth")}
                className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
              >
                Last month
              </button>
              <button
                onClick={() => setPreset("thisYear")}
                className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
              >
                This year
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border">
              <label className="block text-[11px] text-gray-500 mb-1">
                Manufacturer filter
              </label>
              <select
                value={selectedManufacturerId}
                onChange={(e) => setSelectedManufacturerId(e.target.value)}
                className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="all">All manufacturers</option>
                {manufacturerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <input
                  value={manufacturerSearch}
                  onChange={(e) => setManufacturerSearch(e.target.value)}
                  placeholder="Search manufacturer..."
                  className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border">
              <label className="block text-[11px] text-gray-500 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border">
              <label className="block text-[11px] text-gray-500 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none"
              />
              {!periodValid ? (
                <div className="mt-2 text-xs text-red-600">
                  Date From must be earlier than Date To.
                </div>
              ) : null}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border">
              <label className="block text-[11px] text-gray-500 mb-1">Sort summary</label>
              <div className="flex gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="flex-1 bg-white border rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="totalToPay">Total to pay</option>
                  <option value="name">Name</option>
                  <option value="totalQty">Total qty</option>
                  <option value="orders">Orders count</option>
                </select>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  className="w-28 bg-white border rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <label className="text-xs text-gray-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeVatOnBuy}
                    onChange={(e) => setIncludeVatOnBuy(e.target.checked)}
                  />
                  Apply VAT on BUY totals
                </label>

                <label className="text-xs text-gray-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={payByBuyBaseOnly}
                    onChange={(e) => setPayByBuyBaseOnly(e.target.checked)}
                  />
                  Pay manufacturer by BuyBase only (no multiplier)
                </label>

                <span className="text-[11px] text-gray-500">
                  {includeVatOnBuy ? "VAT added" : "VAT excluded"} •{" "}
                  {payByBuyBaseOnly ? "Base-only payables" : "Tiered payables"}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !periodValid}
              className="px-4 py-2 rounded-xl text-white font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: OLIVE }}
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>

            <button
              onClick={handleExportSummaryDetails}
              disabled={!report || loading}
              className="px-4 py-2 rounded-xl font-semibold border bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: OLIVE, color: OLIVE }}
            >
              Export Summary + Details
            </button>

            <button
              onClick={handleExportAllStatements}
              disabled={!report || loading}
              className="px-4 py-2 rounded-xl font-semibold border bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: BROWN, color: BROWN }}
            >
              Export All Manufacturer Statements
            </button>

            <button
              onClick={handleExportSalesReport}
              disabled={!salesReport || loading}
              className="px-4 py-2 rounded-xl font-semibold border bg-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: OLIVE, color: OLIVE }}
            >
              Export Sales Report (Internal)
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}
        </div>

        {/* Report */}
        {report ? (
          <>
            {/* Stats + Health */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="text-xs text-gray-500">Done orders</div>
                <div className="text-2xl font-extrabold mt-1" style={{ color: BROWN }}>
                  {report.ordersCount}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="text-xs text-gray-500">Lines</div>
                <div className="text-2xl font-extrabold mt-1" style={{ color: BROWN }}>
                  {report.detailRows.length}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="text-xs text-gray-500">Grand total to pay</div>
                <div className="text-2xl font-extrabold mt-1" style={{ color: OLIVE }}>
                  {formatMoney(report.grandTotal)}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="text-xs text-gray-500 mb-2">Data health</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-full text-xs border bg-amber-50 text-amber-800 border-amber-200">
                    Legacy: {report.health.legacyLinesCount}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs border bg-red-50 text-red-700 border-red-200">
                    Missing manufacturerId: {report.health.missingManufacturerIdCount}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs border bg-red-50 text-red-700 border-red-200">
                    Missing product docs: {report.health.missingProductDocCount}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">
                  Best practice: snapshot buy pricing + manufacturer in new orders.
                </div>
              </div>
            </div>

            {/* Sales summary quick view (internal) */}
            {salesReport ? (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="text-xs text-gray-500">Revenue (sell)</div>
                  <div className="text-2xl font-extrabold mt-1" style={{ color: BROWN }}>
                    {formatMoney(salesReport.revenue)}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="text-xs text-gray-500">Cost (payables)</div>
                  <div className="text-2xl font-extrabold mt-1" style={{ color: BROWN }}>
                    {formatMoney(salesReport.cost)}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="text-xs text-gray-500">Profit</div>
                  <div className="text-2xl font-extrabold mt-1" style={{ color: OLIVE }}>
                    {formatMoney(salesReport.profit)}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="text-xs text-gray-500">Margin</div>
                  <div className="text-2xl font-extrabold mt-1" style={{ color: OLIVE }}>
                    {salesReport.margin}%
                  </div>
                </div>
              </div>
            ) : null}

            {/* Summary table */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold" style={{ color: BROWN }}>
                  Summary (click a manufacturer to open statement)
                </h2>
                <div className="text-xs text-gray-500">
                  Showing: <span className="font-medium">{filteredSummary.length}</span> manufacturers
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">Manufacturer</th>
                      <th className="py-2 pr-4">Orders</th>
                      <th className="py-2 pr-4">Lines</th>
                      <th className="py-2 pr-4">Total Qty</th>
                      <th className="py-2 pr-4">Statement</th>
                      <th className="py-2 pr-2 text-right">Total To Pay</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSummary.length === 0 ? (
                      <tr>
                        <td className="py-4 text-gray-500" colSpan={6}>
                          No data for selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSummary.map((r) => {
                        const expanded = expandedManufacturerId === r.manufacturerId;
                        return (
                          <React.Fragment key={r.manufacturerId}>
                            <tr
                              className="border-b hover:bg-gray-50 cursor-pointer"
                              onClick={() => toggleExpanded(r.manufacturerId)}
                            >
                              <td className="py-2 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">
                                    {expanded ? "▾" : "▸"}
                                  </span>
                                  <span className="font-medium">{r.manufacturerName}</span>
                                  <span className="text-[10px] text-gray-400">
                                    ({r.manufacturerId})
                                  </span>
                                </div>
                              </td>

                              <td className="py-2 pr-4">{r.ordersCount}</td>
                              <td className="py-2 pr-4">{r.linesCount}</td>
                              <td className="py-2 pr-4">{r.totalQty}</td>

                              <td className="py-2 pr-4">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    exportStatementForManufacturer(r.manufacturerId, r.manufacturerName);
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white hover:bg-gray-50"
                                  style={{ borderColor: OLIVE, color: OLIVE }}
                                >
                                  Export statement
                                </button>
                              </td>

                              <td className="py-2 pr-2 text-right font-semibold" style={{ color: OLIVE }}>
                                {formatMoney(r.totalToPay)}
                              </td>
                            </tr>

                            {expanded ? (
                              <tr className="border-b">
                                <td colSpan={6} className="py-4">
                                  <ManufacturerDrilldown
                                    manufacturerId={r.manufacturerId}
                                    manufacturerName={r.manufacturerName}
                                    statement={report.statementsByManufacturer[r.manufacturerId]}
                                    onExport={() =>
                                      exportStatementForManufacturer(r.manufacturerId, r.manufacturerName)
                                    }
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Details preview */}
            <div className="mt-6 bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold" style={{ color: BROWN }}>
                  Details (preview)
                </h2>
                <div className="text-xs text-gray-500">
                  Export for full details (includes health flags).
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-4">Manufacturer</th>
                      <th className="py-2 pr-4">Order</th>
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4">Qty</th>
                      <th className="py-2 pr-4">Buy unit</th>
                      <th className="py-2 pr-2 text-right">Line total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.detailRows.slice(0, 80).map((r, idx) => (
                      <tr key={`${r.orderId}-${r.productId}-${idx}`} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{r.manufacturerName}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.isLegacyBuyCalc ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] border bg-amber-50 text-amber-800 border-amber-200">
                                legacy calc
                              </span>
                            ) : null}
                            {r.missingManufacturerId ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] border bg-red-50 text-red-700 border-red-200">
                                missing manufacturerId
                              </span>
                            ) : null}
                            {r.missingProductDoc ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] border bg-red-50 text-red-700 border-red-200">
                                missing product doc
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="py-2 pr-4">{r.orderId}</td>
                        <td className="py-2 pr-4">{r.productName}</td>
                        <td className="py-2 pr-4">{r.qty}</td>
                        <td className="py-2 pr-4">{formatMoney(r.buyUnitPrice)}</td>
                        <td className="py-2 pr-2 text-right font-semibold" style={{ color: OLIVE }}>
                          {formatMoney(r.buyLineTotal)}
                        </td>
                      </tr>
                    ))}

                    {report.detailRows.length > 80 ? (
                      <tr>
                        <td colSpan={6} className="py-3 text-center text-gray-500">
                          Showing first 80 rows — export Excel for full list.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border p-6 text-center text-gray-600">
            Choose filters and click <span className="font-semibold">Generate Report</span>.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Drilldown component ----------
function ManufacturerDrilldown({ manufacturerId, manufacturerName, statement, onExport }) {
  if (!statement) {
    return <div className="text-sm text-gray-600">No statement data available for this manufacturer.</div>;
  }

  const topProducts = statement.products.slice(0, 12);

  return (
    <div className="bg-gray-50 border rounded-2xl p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">Manufacturer</div>
          <div className="text-lg font-semibold" style={{ color: BROWN }}>
            {manufacturerName}
          </div>
          <div className="text-xs text-gray-400 mt-1">{manufacturerId}</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={onExport}
            className="px-4 py-2 rounded-xl text-white font-semibold"
            style={{ backgroundColor: OLIVE }}
          >
            Export manufacturer statement
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-3">
          <div className="text-xs text-gray-500">Products</div>
          <div className="text-xl font-extrabold" style={{ color: BROWN }}>
            {statement.products.length}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-3">
          <div className="text-xs text-gray-500">Lines</div>
          <div className="text-xl font-extrabold" style={{ color: BROWN }}>
            {statement.lines.length}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-3">
          <div className="text-xs text-gray-500">Total to pay</div>
          <div className="text-xl font-extrabold" style={{ color: OLIVE }}>
            {formatMoney(statement.totalToPay)}
          </div>
        </div>
      </div>

      {/* Per-product breakdown */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold" style={{ color: BROWN }}>
            Per-product breakdown
          </h3>
          <div className="text-xs text-gray-500">
            Showing top {topProducts.length} products by amount
          </div>
        </div>

        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Qty</th>
                <th className="py-2 px-3 text-right">Total to pay</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={`${p.productId}-${p.productName}`} className="border-b last:border-b-0">
                  <td className="py-2 px-3">
                    <div className="font-medium">{p.productName}</div>
                    {p.productId ? (
                      <div className="text-[10px] text-gray-400">{p.productId}</div>
                    ) : null}
                  </td>
                  <td className="py-2 px-3">{p.totalQty}</td>
                  <td className="py-2 px-3 text-right font-semibold" style={{ color: OLIVE }}>
                    {formatMoney(p.totalToPay)}
                  </td>
                </tr>
              ))}
              {statement.products.length > topProducts.length ? (
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-xs text-gray-500">
                    Export statement to see all products.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contributing lines (preview) */}
      <div className="mt-5">
        <h3 className="font-semibold mb-2" style={{ color: BROWN }}>
          Contributing lines (preview)
        </h3>
        <div className="overflow-x-auto bg-white border rounded-xl">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 px-3">Order</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Qty</th>
                <th className="py-2 px-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.slice(0, 10).map((l, idx) => (
                <tr key={`${l.orderId}-${idx}`} className="border-b last:border-b-0">
                  <td className="py-2 px-3">{l.orderId}</td>
                  <td className="py-2 px-3">{l.orderDate}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{l.productName}</div>
                    {l.isLegacyBuyCalc ? (
                      <div className="text-[10px] text-amber-700">legacy calc</div>
                    ) : null}
                  </td>
                  <td className="py-2 px-3">{l.qty}</td>
                  <td className="py-2 px-3 text-right font-semibold" style={{ color: OLIVE }}>
                    {formatMoney(l.buyLineTotal)}
                  </td>
                </tr>
              ))}
              {statement.lines.length > 10 ? (
                <tr>
                  <td colSpan={5} className="py-2 px-3 text-xs text-gray-500">
                    Export statement for full line list.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
