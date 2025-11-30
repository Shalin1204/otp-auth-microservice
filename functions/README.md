# OTP Auth Microservice – Firebase + Firestore

This project is a **simple, reusable OTP (One-Time Password) backend** built with:

- **Firebase Cloud Functions (2nd Gen, Node 24)**
- **Firestore** for OTP storage

It exposes clean HTTP APIs for:

- Sending OTP to a phone (`/otpSend`)
- Verifying OTP (`/otpVerify`)
- Basic health check (`/health`)

You can plug this service into:

- Web apps (React / Next.js / plain HTML)
- Mobile apps (React Native / Flutter)
- Chatbots (WhatsApp / Telegram / Zoho / etc.)

---

## Tech Stack 

- Node.js (Cloud Functions)
- Firebase Cloud Functions (2nd Gen, `us-central1`)
- Firestore (region `nam5`)
- Deployed on Firebase Blaze plan

---

##  Project Structure 

```bash
otp-auth-microservice/
  .firebaserc
  firebase.json
  firestore.rules
  firestore.indexes.json

  functions/
    index.js           # Cloud Functions source
    package.json
    package-lock.json
    .env               # (ignored) config like OTP_EXPIRY_MINUTES
    node_modules/      # (ignored)

  demo/
    index.html         # Simple browser demo for the API

  README.md
  .gitignore
