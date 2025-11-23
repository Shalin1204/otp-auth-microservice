// functions/index.js


const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Load config
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);


const API_VERSION = "2025-10";

// ----- helper: call Shopify Admin API -----
async function callShopify(path, options = {}) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}`;

  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Shopify error", res.status, text);
    throw new Error(`Shopify API error ${res.status}`);
  }

  return res.json();
}

// ----- basic CORS helper -----
function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ========== 1) GET /deals ==========
exports.deals = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const data = await callShopify("/products.json?limit=10&status=active");

    const products = (data.products || []).map((p) => {
      const firstVariant = (p.variants && p.variants[0]) || {};
      const firstImage = (p.images && p.images[0]) || {};

      return {
        id: String(p.id),
        title: p.title,
        image: firstImage.src || null,
        price: firstVariant.price || null,
        shortDesc: p.body_html
          ? p.body_html.replace(/<[^>]+>/g, "").slice(0, 80)
          : "",
        shopifyVariantId: String(firstVariant.id || ""),
      };
    });

    return res.json({ products });
    } catch (err) {
  console.error("Error in /deals", err);
  return res.status(500).json({
    error: "Failed to fetch deals",
    details: err.message || String(err),
    env: {
      SHOPIFY_STORE,
      SHOPIFY_TOKEN_SET: !!SHOPIFY_TOKEN
    }
  });
}

});

// ========== 2) POST /otp/send ==========
exports.otpSend = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }

    // Generate 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    await db.collection("otps").doc(phone).set({
      phone,
      code,
      createdAt: now,
      expiresAt,
      verified: false,
    });

    // For demo: we only log
    console.log(`OTP for ${phone}: ${code}`);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in /otp/send", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ========== 3) POST /otp/verify ==========
exports.otpVerify = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ error: "phone and otp are required" });
    }

    const doc = await db.collection("otps").doc(phone).get();
    if (!doc.exists) {
      return res.json({ valid: false });
    }

    const data = doc.data();
    const now = admin.firestore.Timestamp.now();

    if (
      data.code === otp &&
      data.expiresAt.toMillis() > now.toMillis()
    ) {
      await doc.ref.update({ verified: true });
      return res.json({ valid: true });
    } else {
      return res.json({ valid: false });
    }
  } catch (err) {
    console.error("Error in /otp/verify", err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// ========== 4) POST /orders (create order) ==========
exports.ordersCreate = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { email, phone, name, address, items } = req.body || {};

    if (!email || !phone || !name || !address || !Array.isArray(items)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const orderPayload = {
      order: {
        email,
        phone,
        line_items: items.map((it) => ({
          variant_id: Number(it.variantId),
          quantity: Number(it.quantity || 1),
        })),
        shipping_address: {
          name,
          address1: address,
          phone,
        },
        financial_status: "paid", // dev store
      },
    };

    const data = await callShopify("/orders.json", {
      method: "POST",
      body: orderPayload,
    });

    const order = data.order;

    return res.json({
      success: true,
      orderId: String(order.id),
      orderNumber: order.name,
    });
  } catch (err) {
    console.error("Error in /orders", err);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

// ========== 5) GET /orders?email= ==========
exports.ordersByEmail = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const data = await callShopify(
      `/orders.json?email=${encodeURIComponent(email)}&limit=10`
    );

    const orders = (data.orders || []).map((o) => ({
      id: String(o.id),
      orderNumber: o.name,
      status: o.fulfillment_status || "unfulfilled",
      createdAt: o.created_at,
      total: o.total_price,
      canReturn: !o.cancelled_at,
    }));

    return res.json({ orders });
  } catch (err) {
    console.error("Error in /orders?email", err);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});
