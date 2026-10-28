# कागदमित्र (KagadMitra)

Photograph any government notice, scheme form, soil health card or bank letter and hear a simple Marathi explanation.

## Problem
Farmers in Maharashtra receive official papers in English or heavy official language and often depend on others to understand them. This can mean missed deadlines, wrong documents and ignored warnings.

## USP
Unlike translation or scanner apps, KagadMitra does not only translate. It says what to do, what to bring, which dates matter and what looks risky, in spoken Marathi, and it shows its confidence and unclear parts.

## Features
- Photo upload or camera, 3 fictional sample documents
- Output in Marathi (default), Hindi or English
- Cards: what it is, steps, documents, dates, red flags, confidence, unclear parts
- Read aloud (browser speech, Marathi then Hindi then any voice) and WhatsApp share
- No login, no database, no image storage; "Demo fallback" for samples if the API fails

## Tech stack
Next.js 14 (App Router), Tailwind CSS, Gemini API (called only from `app/api/explain/route.js`), Vercel.

## Setup
```bash
npm install
cp .env.example .env.local      # then paste your GEMINI_API_KEY (from aistudio.google.com/apikey)
npm run dev                     # open http://localhost:3000
```
Change the model name in the `GEMINI_MODEL` constant at the top of `app/api/explain/route.js` if needed.

## Deploy
Push to GitHub, import the repo in Vercel, add `GEMINI_API_KEY` under Environment Variables, deploy.

## How it works
1. Browser shrinks the image (max 1200px, JPEG 0.7) and posts it to `/api/explain`.
2. The server validates it and calls Gemini with a system instruction, asking for JSON.
3. The server parses and validates the JSON and returns it. If it fails for a sample, a saved answer is returned.

## Limitations
- AI can misread blurry or handwritten papers; the confidence level is the model's own estimate, not a measured accuracy.
- It only explains. It does not give legal or financial advice and cannot tell if a document is genuine.
- The photo is sent to the Gemini API to produce the answer; it is not stored by this app. Check Google's current free-tier data terms.
- Marathi voice depends on voices installed on the phone.
- Sample documents are fictional.

## Screenshots
_Add screenshots here: home, result cards, red flags, mobile view._
