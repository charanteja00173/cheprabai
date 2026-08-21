# Cheprabai — Secure Real-time Workspace

A privacy-first, cross-platform communication app: end-to-end encrypted chat, WebRTC video calls, collaborative whiteboard, and encrypted file sharing — in a fully responsive PWA-ready interface.

> **Frontend:** React 18 (CRA) · styled-components · Socket.IO client · PeerJS
> **Backend:** Node.js · Express · Socket.IO · Redis adapter · Cloudinary · Web Push

---

## Features

### Messaging
- **End-to-end encryption** — messages and files are encrypted with AES-GCM in the browser before they leave the device; the server only ever relays ciphertext
- Real-time delivery, typing indicators, read receipts, reactions
- Reply to any message (**swipe-to-reply on touch devices**, toggleable in Settings)
- Message editing via a full-screen editor that preserves formatting and indentation
- Scheduled messages, ephemeral / disappearing messages, view-once media
- Polls, GIFs (GIPHY), bookmarks, pinned messages, message forwarding across rooms
- Full-text search with highlight, infinite scroll history

### Code & content sharing
- Dedicated **code block mode** (`</>` in the composer) — pasted code always renders as a proper code block with a copy button; indentation and symbols are never mangled
- Smart auto-detection of unfenced pasted code
- Inline markdown (`**bold**`, `_italic_`, `~~strike~~`, `` `inline code` ``), fenced code blocks, @mentions

### Rich link previews
Click-to-play embeds for 13+ platforms — YouTube, Instagram (posts/reels/IGTV), TikTok, X/Twitter, Facebook, Reddit, Pinterest, SoundCloud, Vimeo, Dailymotion, Twitch, Streamable, Spotify:
- Lightweight poster cards instead of heavy auto-loading iframes
- Fullscreen viewer with an "Open original" fallback for platforms that block embedding
- Direct media links (.mp4/.jpg/…) open in the native in-app viewer
- Generic articles get server-side OG metadata previews

### File sharing
- Drag-and-drop, multi-file uploads with a pre-send review modal
- **Real-time upload progress**: live percentage, transfer speed, ETA, byte counts
- Photos/videos show a live preview that sharpens as bytes flow
- Files ≤ 200 MB are E2EE before upload; universal in-app viewer (images, video, audio, PDF, Office, CSV, JSON, Markdown, code)

### Calls & streaming
- Group video/audio calls (PeerJS mesh) with spotlight, theater mode, and grid layouts
- Screen share and **in-call media streaming** (video/audio playback mixed into the stream via canvas)
- Low-latency tuning: jitter buffers, sender priority hints, adaptive bitrate
- Resizable picture-in-picture, per-participant volume, speaking indicators, virtual camera filters
- Live latency display and host moderation (mute/remove)

### Platform
- **Web Push notifications** (VAPID) — message alerts in the OS notification panel on Android/desktop; iOS requires Add-to-Home-Screen
- Fully responsive: fluid type scale, touch-first controls, mobile theater layout, swipeable participant rail
- Room themes, custom backgrounds, avatars, room insights (latency, participants)
- Admin control center: feature flags, moderation, platform settings

### Security hardening
- Anti-capture guard: black-frame flash + clipboard poisoning on screenshot attempts, print blackout, unfocus shield, traceable watermarks over call video
- SSRF-hardened link preview service (private-IP/DNS-rebinding blocking, redirect re-validation, size/time caps)
- Rate limiting on uploads, messages, link previews; strict CORS allowlist; Helmet security headers
- Upload size ceilings; XSS-safe rendering (escaped HTML pipeline)

---

## Architecture

```
┌────────────────────┐         HTTPS / WSS          ┌─────────────────────────┐
│  React SPA (CRA)   │◄──── Socket.IO (events) ────►│  Node.js + Express      │
│  - E2EE in browser │                              │  - Socket.IO (+Redis)   │
│  - styled-components│──── multipart upload ──────►│  - REST API             │
│  - PeerJS mesh ────┼──── WebRTC (media, P2P) ────►│  - PeerJS server        │
│  - Service worker  │◄──── Web Push (VAPID) ───────│  - Cloudinary relay     │
└────────────────────┘                              └─────────────────────────┘
```

- **Signaling & chat** travel through Socket.IO; rooms are gated by security codes enforced server-side.
- **Media** flows peer-to-peer (WebRTC); the canvas mixer enables screen-share + camera + media playback compositing.
- **Encrypted files** are stored as opaque blobs on Cloudinary; keys live only in the room, distributed via Signal-style prekeys.

## Project layout

```
cheprabai/
├── src/
│   ├── components/        # Chat, LiveMeeting, UniversalFileViewer, admin UIs…
│   ├── utils/             # clipboard, crypto helpers, export templates
│   ├── context/           # shared React context
│   └── globalStyles.css   # responsive design system layer
└── public/                # manifest, icons, push service worker
```

---

## Getting started

### Prerequisites
- Node.js ≥ 18
- A Cloudinary account (file storage)
- Redis (optional in dev, required in production)

### Backend

```bash
cd cheprabai-backend
npm install
cp .env.example .env        # then fill in values (see below)
npm run dev                 # or: npm start
```

Runs on `http://localhost:4000` by default.

#### Backend environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | HTTP port (default 4000) |
| `NODE_ENV` | prod | `production` enables strict checks |
| `ADMIN_PASSWORD` | prod | Admin dashboard access |
| `SECURITY_CODES` | yes | Comma-separated room-entry codes |
| `ALLOWED_ORIGINS` | yes | Comma-separated CORS allowlist |
| `REDIS_URL` | prod | Redis connection (multi-instance scaling) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | yes | File storage |
| `GIPHY_API_KEY` | no | GIF search (proxied server-side) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | Web Push (generate with `web-push generate-vapid-keys`) |
| `ADMIN_WHATSAPP_PHONE` / `CALLMEBOT_API_KEY` | no | Admin WhatsApp alerts |

### Frontend

```bash
cd cheprabai
npm install
cp .env.example .env        # then fill in values
npm start                   # dev server on http://localhost:3000
```

#### Frontend environment variables

| Variable | Purpose |
|---|---|
| `REACT_APP_SOCKET_ENDPOINT` | Backend base URL |
| `REACT_APP_SECURITY_CODES` | Default room codes offered in the join UI |
| `REACT_APP_GIPHY_API_KEY` | GIPHY key (fallback if backend doesn't proxy) |
| `REACT_APP_NOTIFICATION_SOUND` | Path to incoming-message sound |
| `REACT_APP_PEER_HOST` / `_PORT` / `_PATH` | Custom PeerJS server location |
| `REACT_APP_TURN_URL` / `_USERNAME` / `_PASSWORD` | TURN relay for restrictive networks |

> Note: all `REACT_APP_*` values are embedded in the client bundle — never put secrets there.

### Production build

```bash
CI=false npm run build      # outputs optimized static bundle to build/
npx serve -s build          # quick local smoke test
```

---

## API overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/upload` | POST | Multipart file upload → Cloudinary (rate-limited, size-capped) |
| `/api/link-preview?url=` | GET | SSRF-hardened OG metadata extraction (cached, rate-limited) |
| `/api/gifs?q=&limit=` | GET | Server-proxied GIPHY search/trending |
| `/api/push/vapid` | GET | Web Push public key |
| `/api/push/subscribe` | POST | Register a push subscription for a room |
| `/api/push/unsubscribe` | POST | Remove a push subscription |
| `/api/platform/settings` | GET | Public platform feature flags |

Real-time events (Socket.IO): `joinRoom`, `sendMessage`, `newMessage`, `editMessage`, `messageReaction`, `scheduleMessage`, `typing`, call signaling (`join-call`, `user-connected-call`, screen-share/media broadcast events), and more — see `server.js`.

---

## Security model

- **E2EE by default when a room key exists.** The server relays ciphertext and cannot read message bodies or encrypted files. Unencrypted fallback exists for files > 200 MB.
- **Room access** requires server-validated security codes; owners can moderate (kick/mute).
- **No secrets in the client.** All privileged operations happen behind authenticated admin endpoints.
- **Known limits (honest):** OS-level screenshots/screen recording cannot be blocked by any web app — the anti-capture guard detects what browsers expose and watermarks everything else. Web Push on iOS requires installing the app to the home screen. Socket connections are room-code-gated but not JWT-authenticated.

---

## Scripts

| Location | Command | Description |
|---|---|---|
| frontend | `npm start` | Dev server with hot reload |
| frontend | `CI=false npm run build` | Production bundle (zero-warning build) |
| backend | `npm start` / `npm run dev` | Production / nodemon server |

---

## Roadmap

- [ ] Migrate CRA → Vite (removes dev-toolchain advisories, faster builds)
- [ ] JWT handshake at the Socket.IO layer
- [ ] Redis-backed push-subscription store for multi-instance deployments
- [ ] Automated E2E test suite

---

## License

Private project — all rights reserved.
