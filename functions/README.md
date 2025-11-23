# Ecom Bot Backend – Shopify × Firebase × Zoho SalesIQ

This repo contains the **backend API layer** for a conversational e-commerce bot.

- **Shopify** → Products, prices, inventory, orders, customers  
- **Firebase Cloud Functions** → Custom HTTP APIs + OTP logic  
- **Firestore** → OTP & extra metadata storage  
- **Zoho SalesIQ Zobot** → Chat UI that calls these APIs via Plugs

The goal:  
> A chat-based shopping experience where users can browse deals, place orders with OTP verification, and track orders – all through a bot.

---

## Tech Stack

- **Node.js / Firebase Cloud Functions (2nd Gen, Node 24)**  
- **Firestore** (Google Cloud Firestore in native mode)  
- **Shopify Admin API** (private custom app)  
- **Zoho SalesIQ Zobot** (codeless + Deluge Plugs) – bot itself is outside this repo

---

## Project Structure

```bash
ecom-bot-backend/
  .firebaserc          # Firebase project alias
  firebase.json        # Firebase config (functions + firestore)
  firestore.rules      # Firestore security rules
  firestore.indexes.json

  functions/
    index.js           # Cloud Functions source
    package.json
    package-lock.json
    .env               # (NOT COMMITTED) Shopify + OTP config
    node_modules/      # (ignored)
