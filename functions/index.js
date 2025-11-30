// OTP Auth Microservice – Firebase Functions + Firestore

const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// How long OTP is valid (in minutes)
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);

// ----- basic CORS helper -----
function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ----- helper to safely read JSON body -----
async function readJsonBody(req) {
  // If body is already parsed (in some environments), use it
  if (req.body && Object.keys(req.body).length > 0) {
    return req.body;
  }

  // Otherwise, manually read raw body
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        const json = data ? JSON.parse(data) : {};
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

// ========== 0) GET /health ==========
exports.health = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send();

  return res.json({
    status: "ok",
    message: "OTP service is running",
    timestamp: new Date().toISOString(),
  });
});

// ========== 1) POST /otpSend ==========
// Body: { "phone": "+91XXXXXXXXXX" }
exports.otpSend = functions.https.onRequest(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const { phone } = body || {};

    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }

    // Generate 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // Save or overwrite OTP for this phone
    await db.collection("otps").doc(phone).set({
      phone,
      code,
      createdAt: now,
      expiresAt,
      verified: false,
    });

    // TODO: integrate real SMS API (Twilio, MSG91, etc.)
    console.log(`OTP for ${phone}: ${code}`);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in /otpSend", err);
    return res.status(500).json({
      error: "Failed to send OTP",
      details: err.message || String(err),
    });
  }
});

// ========== 2) POST /otpVerify ==========
// Body: { "phone": "+91XXXXXXXXXX", "otp": "1234" }
exports.otpVerify = functions.https.onRequest(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const { phone, otp } = body || {};

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ error: "phone and otp are required" });
    }

    const doc = await db.collection("otps").doc(phone).get();
    if (!doc.exists) {
      return res.json({ valid: false, reason: "not_found" });
    }

    const data = doc.data();
    const now = admin.firestore.Timestamp.now();

    if (data.expiresAt.toMillis() <= now.toMillis()) {
      return res.json({ valid: false, reason: "expired" });
    }

    if (data.code !== otp) {
      return res.json({ valid: false, reason: "mismatch" });
    }

    await doc.ref.update({ verified: true });

    return res.json({ valid: true });
  } catch (err) {
    console.error("Error in /otpVerify", err);
    return res.status(500).json({
      error: "Failed to verify OTP",
      details: err.message || String(err),
    });
  }
});
