const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { Resend } = require("resend");

// ---- Secrets / Params ----
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// You can change these in code anytime:
const FROM_EMAIL = defineString("FROM_EMAIL", { default: "orders@olive-line.com" });
const ADMIN_EMAIL = defineString("ADMIN_EMAIL", { default: "oliveline25@gmail.com" });

// ----------------------
// helpers
// ----------------------
const STATUS_LABELS = {
  pending: "Pending (Customer Signature)",
  awaitingAdminApproval: "Awaiting Admin Approval",
  offerAccepted: "Price Offer Accepted",
  preparing: "Preparing Order",
  delivery: "Out for Delivery",
  done: "Completed",
};

function getOrderStatus(order) {
  // supports both:
  // order.status OR order.quotation.status
  return order?.status || order?.quotation?.status || "";
}

function statusLabel(key) {
  return STATUS_LABELS[key] || key || "unknown";
}

function formatMoney(n) {
  if (typeof n !== "number") return "-";
  return `${Math.round(n)}₪`;
}

function safeDate(ts) {
  try {
    if (ts?.toDate) return ts.toDate();
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    return new Date();
  } catch {
    return new Date();
  }
}

function itemsHtml(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "<p>No items.</p>";

  const rows = items
    .map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const total = price * qty;
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.name || ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatMoney(total)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;">Item</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd;">Qty</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function docsHtml(order) {
  const draft = order?.documents?.offerDraft?.url;
  const signed = order?.documents?.offerSigned?.url;

  return `
    <div style="margin-top:10px;">
      <div style="font-weight:700;margin-bottom:6px;">Documents</div>
      <ul style="margin:0;padding-left:18px;line-height:1.7;">
        <li>${draft ? `<a href="${draft}" target="_blank" rel="noreferrer">Offer Draft</a>` : "Offer Draft: -"}</li>
        <li>${signed ? `<a href="${signed}" target="_blank" rel="noreferrer">Signed Offer</a>` : "Signed Offer: -"}</li>
      </ul>
    </div>
  `;
}

function wrapHtml({ title, subtitle, body }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#FAF9F6;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="background:#708238;color:#FAF9F6;padding:16px 18px;">
        <div style="font-size:18px;font-weight:700;">OliveLine</div>
        <div style="font-size:13px;opacity:.9;margin-top:4px;">${subtitle || ""}</div>
      </div>
      <div style="padding:18px;color:#4E342E;">
        <div style="font-size:16px;font-weight:700;margin-bottom:10px;">${title}</div>
        ${body || ""}
      </div>
      <div style="padding:14px 18px;background:#EDE6D6;color:#4E342E;font-size:12px;opacity:.85;">
        Automated message from OliveLine.
      </div>
    </div>
  </div>`;
}

async function send(resend, to, subject, html) {
  if (!to) return;
  await resend.emails.send({
    from: FROM_EMAIL.value(),
    to,
    subject,
    html,
  });
}

async function sendToAdminAndCustomer(resend, order, subject, html) {
  await send(resend, ADMIN_EMAIL.value(), subject, html);
  if (order?.customerEmail) await send(resend, order.customerEmail, subject, html);
}

// ----------------------
// 1) Email on ORDER CREATED
// ----------------------
exports.onOrderCreated = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const order = event.data?.data();
    const orderId = event.params.orderId;

    const resend = new Resend(RESEND_API_KEY.value());

    const qNum = order?.quotation?.number || "-";
    const status = statusLabel(getOrderStatus(order));
    const createdAt = safeDate(order?.createdAt);

    const body = `
      <p><b>New order created</b></p>
      <p style="line-height:1.7;">
        <b>Order ID:</b> ${orderId}<br/>
        <b>Quotation:</b> ${qNum}<br/>
        <b>Status:</b> ${status}<br/>
        <b>Customer Email:</b> ${order?.customerEmail || "-"}<br/>
        <b>Created:</b> ${createdAt.toLocaleString()}
      </p>
      ${itemsHtml(order?.items)}
      ${docsHtml(order)}
      <div style="margin-top:12px;text-align:right;">
        <div>Subtotal: <b>${formatMoney(order?.totals?.subtotal)}</b></div>
        <div>VAT: <b>${formatMoney(order?.totals?.vat)}</b></div>
        <div style="margin-top:6px;">Total: <b style="color:#708238;">${formatMoney(order?.totals?.total)}</b></div>
      </div>
    `;

    const html = wrapHtml({
      title: "New Order Created",
      subtitle: `Quotation ${qNum} • Order ${orderId}`,
      body,
    });

    await sendToAdminAndCustomer(resend, order, `OliveLine: New order (${qNum}) • ${status}`, html);
    logger.info("onOrderCreated email sent", { orderId });
  }
);

// ----------------------
// 2) Email on STATUS CHANGED
// ----------------------
exports.onOrderStatusChanged = onDocumentUpdated(
  { document: "orders/{orderId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const orderId = event.params.orderId;

    const beforeStatus = getOrderStatus(before);
    const afterStatus = getOrderStatus(after);

    // Only send if status changed
    if (beforeStatus === afterStatus) return;

    const resend = new Resend(RESEND_API_KEY.value());

    const qNum = after?.quotation?.number || "-";
    const from = statusLabel(beforeStatus);
    const to = statusLabel(afterStatus);

    const body = `
      <p><b>Order status updated</b></p>
      <p style="line-height:1.7;">
        <b>Order ID:</b> ${orderId}<br/>
        <b>Quotation:</b> ${qNum}<br/>
        <b>From:</b> ${from}<br/>
        <b>To:</b> <b style="color:#708238;">${to}</b>
      </p>
      ${itemsHtml(after?.items)}
      ${docsHtml(after)}
      <p style="margin-top:12px;text-align:right;">
        Total: <b style="color:#708238;">${formatMoney(after?.totals?.total)}</b>
      </p>
    `;

    const html = wrapHtml({
      title: "Order Status Changed",
      subtitle: `Quotation ${qNum} • Order ${orderId}`,
      body,
    });

    await sendToAdminAndCustomer(resend, after, `OliveLine: Status → ${to} (${qNum})`, html);
    logger.info("onOrderStatusChanged email sent", { orderId, beforeStatus, afterStatus });
  }
);

// ----------------------
// 3) Email on SIGNED OFFER UPLOADED
// ----------------------
exports.onSignedOfferUploaded = onDocumentUpdated(
  { document: "orders/{orderId}", secrets: [RESEND_API_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const orderId = event.params.orderId;

    const beforeUrl = before?.documents?.offerSigned?.url || "";
    const afterUrl = after?.documents?.offerSigned?.url || "";

    // Only when signed offer appears/changes
    if (!afterUrl || beforeUrl === afterUrl) return;

    const resend = new Resend(RESEND_API_KEY.value());
    const qNum = after?.quotation?.number || "-";

    const body = `
      <p><b>Signed offer uploaded</b></p>
      <p style="line-height:1.7;">
        <b>Order ID:</b> ${orderId}<br/>
        <b>Quotation:</b> ${qNum}<br/>
        <b>Signed Offer:</b> <a href="${afterUrl}" target="_blank" rel="noreferrer">Open</a>
      </p>
      ${docsHtml(after)}
    `;

    const html = wrapHtml({
      title: "Signed Offer Received",
      subtitle: `Quotation ${qNum} • Order ${orderId}`,
      body,
    });

    await sendToAdminAndCustomer(resend, after, `OliveLine: Signed offer received (${qNum})`, html);
    logger.info("onSignedOfferUploaded email sent", { orderId });
  }
);
