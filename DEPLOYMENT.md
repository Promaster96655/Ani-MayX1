# 🚀 AniMayX Deployment Guide (Netlify + Render)

Aapka full-stack application do parts se bana hai:
1. **Frontend (React)**: Jo visual interface hai (Netlify par host hoga).
2. **Backend (Express Server - `server.ts`)**: Jo video streaming, AniSkip, metadata sync, and database handles karta hai (Render par host hoga).

Kyunki **Netlify sirf static files host kar sakta hai**, isliye aapka Express server wahan direct run nahi ho sakta. Jab tak backend alag se deploy nahi hoga, website par data load nahi hoga (404 error milega).

Niche diye gaye steps ko follow karke apne backend ko active rakhein aur Netlify par data show karein!

---

## 🗺️ High-Level Architecture (Kaise kaam karega)
1. Aap apna poora code **GitHub** par push karenge.
2. **Render.com** par hum backend deploy karenge (jo aapke `server.ts` ko chalayega).
3. **Netlify** par hum frontend deploy karenge (jo build assets generate karega).
4. Hum Netlify ke `_redirects` file ko update karenge taaki saari `/api/*` calls aapke Render backend par redirect ho sakein.

---

## Step 1: Deploy Backend to Render.com (FREE)

Render par backend deploy karne ke liye niche diye gaye steps follow karein:

1. **Render par Sign Up karein**: [Render.com](https://render.com) par jao aur GitHub account se sign up/login karo.
2. **New Web Service banayein**:
   - Dashboard me **New +** button par click karein aur **Web Service** select karein.
   - Apne GitHub repository ko connect karein.
3. **Configure Service Settings**:
   - **Name**: `animayx-backend` (ya jo aap chahein)
   - **Environment / Runtime**: `Node`
   - **Region**: Apne hisab se nearest select karein (e.g., Singapore ya Oregon)
   - **Branch**: `main` (ya jo aapka primary branch hai)
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Start Command**: 
     ```bash
     npm start
     ```
   - **Instance Type**: **Free**
4. **Environment Variables Add karein** (Advanced tab me click karke):
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = *(Aapka Gemini API key agar use ho raha hai)*
5. **Deploy**: **Create Web Service** par click karein. 5-10 minutes me aapka backend live ho jayega aur aapko ek live URL milega, jaise:
   `https://animayx-backend.onrender.com`

---

## Step 2: Update `/public/_redirects` in Your Project

Apne code me, `/public/_redirects` file ko update karein taaki Netlify ko pata chale ki use aapke naye Render backend se baat karni hai.

1. Open `/public/_redirects` file.
2. Edit line number 3:
   ```text
   /api/*  https://YOUR-RENDER-BACKEND-URL.onrender.com/api/:splat  200
   ```
   *(Apne Render dashboard se URL copy karke `https://YOUR-RENDER-BACKEND-URL.onrender.com` ki jagah paste karein).*
3. Apne is change ko commit karke GitHub par push kar dein.

---

## Step 3: Deploy Frontend to Netlify

Netlify par frontend setup karne ke liye:

1. **Netlify me login karein**: [Netlify.com](https://www.netlify.com) par jao aur GitHub se login karein.
2. **Add New Site**: **Add new site** > **Import an existing project** select karein.
3. GitHub repository connect karke select karein.
4. **Configure Build settings**:
   - **Build Command**: `npm run build`
   - **Publish directory**: `dist`
5. **Environment Variables** (Site settings > Environment variables me):
   - Key: `VITE_API_BASE_URL`
   - Value: `https://YOUR-RENDER-BACKEND-URL.onrender.com` *(Aapka live Render URL)*
6. **Deploy**: **Deploy Site** par click karein. Netlify frontend build karke aapko ek URL de dega (e.g., `https://animayx.netlify.app`).

---

## Step 4: Add Netlify Domain to Firebase Authorized Domains (CRITICAL 🔑)

Google login aur database syncing ko Netlify par chalane ke liye, aapko Firebase Console me Netlify ke domain ko whitelist karna hoga:

1. Go to **Firebase Console** ([console.firebase.google.com](https://console.firebase.google.com)).
2. Apne project par click karein.
3. Left menu me **Build > Authentication** select karein.
4. **Settings** (tab) > **Authorized domains** section me jayein.
5. **Add domain** button par click karein aur aapka Netlify domain add karein (e.g., `animayx.netlify.app`).
6. Save karein. Ab aapka Google login aur state synchronization bina kisi error ke Netlify par work karega!

---

## 🛠️ Verification Checklist
- [ ] Kya Render par Web Service "Live" status me hai?
- [ ] Kya Netlify me `VITE_API_BASE_URL` environment variable configured hai?
- [ ] Kya `/public/_redirects` me correct Render backend URL updated hai?
- [ ] Kya Firebase Console ke "Authorized domains" me Netlify domain added hai?

Aapka full-stack platform ab 100% active, fast, aur secure tarike se cloud par live hai!
