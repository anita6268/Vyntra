# VYNTRA — Premium Real-Time Messaging Platform

## Overview
Vyntra is a premium, production-grade real-time messaging application built with React, Node.js, Express, MongoDB, Socket.io, and WebRTC. It delivers polished glassmorphism UI, secure real-time chat, voice/video calls, AI assistant, file sharing, groups, themes, and wallpapers.

## Key Features
- Real-time messaging with Socket.io
- Optimistic message delivery with seen receipts
- Typing indicators and online presence
- Voice & video calls via WebRTC
- AI Assistant with provider failover (Groq + Gemini)
- File/image sharing via Cloudinary
- Groups with admin permissions
- Themes & wallpapers
- Profile photo editor (crop, move, zoom, rotate, flip, reset)
- Pinned messages, starred messages, message search
- Block/unblock, mute, delete for everyone
- Subscription/plan system

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS, daisyUI, Framer Motion, Lucide React, Zustand
- Backend: Node.js, Express, MongoDB (Mongoose), Socket.io, JWT, Arcjet, Cloudinary, Resend, Groq SDK, Google GenAI
- Real-time: Socket.io with WebRTC signaling
- AI: Groq (primary) + Gemini (fallback) with automatic failover

## Architecture
- Monorepo: frontend/ + backend/
- Backend: Express REST API + Socket.io server
- Frontend: Single-page React app with Zustand state management
- Real-time: Socket.io for chat, presence, typing, calls
- Calls: WebRTC with server-side signaling relay

## Authentication
- JWT-based authentication with HttpOnly cookies
- protectRoute middleware on all protected routes
- Socket.io authentication middleware
- Rate limiting via Arcjet

## Real-time communication
- Socket.io with polling + websocket transports
- Message delivery, seen receipts, typing indicators
- Group rooms for efficient broadcasting
- Call signaling via WebRTC

## Voice/video calling
- WebRTC with ICE candidate exchange
- Server-side call history persistence
- Busy/offline detection
- HD calls for Pro users

## AI Assistant
- Unified AI provider with automatic failover
- Groq primary, Gemini fallback
- Sanitized error messages (no secrets exposed)
- Features: translate, summarize, grammar check, meeting notes, reply suggestions, smart reply, chat

## File/image sharing
- Cloudinary upload with validation
- Server-side authorization checks
- Download with signed URLs
- No secrets exposed to frontend

## Groups
- Create, delete, leave groups
- Admin permissions
- Group typing indicators
- Group info panel

## Themes & wallpapers
- Multiple themes via daisyUI
- Custom wallpaper per conversation
- Theme marketplace

## Security
- JWT authentication
- Authorization checks on all routes
- Arcjet rate limiting
- Input validation
- Safe error responses
- CORS configured
- Socket authentication
- No secrets in frontend

## Installation
1. Clone the repository
2. Copy backend/.env.example to backend/.env and configure
3. Copy frontend/.env.example to frontend/.env and configure
4. Run: cd backend && npm install && cd ../frontend && npm install
5. Start backend: cd backend && npm run dev
6. Start frontend: cd frontend && npm run dev

## Environment variables
See backend/.env.example and frontend/.env.example

## Running frontend/backend
- Backend: npm run dev (in backend/)
- Frontend: npm run dev (in frontend/)

## Screenshots
![Vyntra screenshot](frontend/public/screenshot-for-readme.png)

## Future improvements
- End-to-end encryption
- Message encryption at rest
- Push notifications
- Mobile app
- Advanced group features

## Developer section
- Run lint: npm run lint (frontend)
- Build: npm run build (frontend)
- Backend syntax: node --check on all backend source files
- Attachment (file send) end-to-end check — real HTTP POSTs against a running
  backend, prints the real status code + error `code` for every allowed/blocked
  file type, then deletes the messages it created:
  `cd backend && node scripts/upload-e2e-check.mjs` (use `--base <url>` for another port)
- Attachment browser check — real Chromium: one click = one POST, 201 clears the
  composer, a failing upload keeps the attachment:
  `cd frontend && $env:VYNTRA_TEST_JWT="<jwt cookie>" ; npx playwright test --config=playwright.config.js`
- Media storage mode is printed at backend startup (`[STORAGE] …`) so you can see
  instantly whether uploads go to Cloudinary, to the development data-URL
  fallback, or would answer 503 MEDIA_STORAGE_UNAVAILABLE.