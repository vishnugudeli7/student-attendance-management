# Attendance Register — QR-Based Student Attendance System

A full-stack attendance management system. Students carry a unique QR code
(printed on an ID card, or shown on their phone). A teacher opens the **Scan
Station**, points a camera at each code, and attendance is marked instantly —
no manual roll call, no paper registers.

## Features

- **Role-based access** — Admin (full control) and Teacher (their own classes only)
- **Class & student management** — add classes, assign teachers, add students
- **Auto-generated QR codes** — every student gets a unique, regenerable QR token
- **Live scan station** — camera-based scanning with duplicate-scan protection
- **Attendance reports** — per-class percentage, automatic defaulter flagging (<75%)
- **CSV export** — download attendance data for any class/date range
- **Zero external DB setup** — uses Node's built-in SQLite (`node:sqlite`), stored as a single file

## Tech stack

| Layer      | Choice                                      |
|------------|----------------------------------------------|
| Backend    | Node.js + Express                            |
| Database   | SQLite (built into Node 22+, no install needed) |
| Auth       | JWT (jsonwebtoken) + bcrypt password hashing |
| QR codes   | `qrcode` (generate) + `html5-qrcode` (scan, via CDN) |
| Frontend   | Plain HTML/CSS/JS — no build step required   |

## Requirements

- **Node.js 22 or newer** (needed for the built-in `node:sqlite` module)
- A webcam or phone camera for the scan station

## Setup

```bash
cd backend
npm install
node db/seed.js        # creates the default admin account
node server.js          # starts the server on http://localhost:4000
```

Open **http://localhost:4000** in your browser.

**Default admin login:**
- Email: `admin@school.com`
- Password: `admin123`

> Change this password (or create a fresh admin manually in the database) before
> using this in a real classroom — the seed account is for first-time setup only.

## How to use it

1. **Sign in** as admin.
2. **Classes tab** → add a class (e.g. "10th Grade", Section "A") and optionally
   assign a teacher account (create teacher accounts under the **Teachers** tab first).
3. **Students & QR tab** → select the class, add students. Each student
   automatically gets a unique QR code — click **View QR** to preview/print it
   as their ID card.
4. **Open Scan Station** (top-right button) → pick the class, date, and period
   → click **Open Session & Start Scanning**. Point the camera at each
   student's QR code; they're marked present with a live tally and progress bar.
   Re-scanning the same code is detected and ignored (no double-marking).
5. **Reports tab** → pick a class and date range to see attendance percentage
   per student, with defaulters (below 75%) flagged. Export to CSV anytime.

## Project structure

```
attendance-system/
├── backend/
│   ├── server.js              # Express entry point
│   ├── db/
│   │   ├── database.js        # schema (users, classes, students, sessions, attendance)
│   │   └── seed.js            # creates default admin
│   ├── middleware/auth.js     # JWT verification + role guard
│   └── routes/
│       ├── auth.js            # login, teacher registration
│       ├── classes.js         # class CRUD
│       ├── students.js        # student CRUD + QR generation
│       ├── attendance.js      # sessions + the core /scan endpoint
│       └── export.js          # CSV export
└── frontend/
    ├── index.html
    ├── css/style.css
    ├── js/{api.js, admin.js}
    └── pages/{login.html, admin.html, scan.html}
```

## Database schema (high level)

- `users` — admins & teachers (role-based)
- `classes` — class + section, linked to a teacher
- `students` — linked to a class, each with a unique `qr_token`
- `sessions` — one per (class, date, period) — represents a single roll-call
- `attendance` — one row per student who scanned in during a session

## Extending this further

Ideas if you want to take this further for a bigger showcase:
- **Parent/student notifications** (SMS/email) when marked absent — add Twilio/SendGrid
- **Geofencing** — only accept scans from within school Wi-Fi/GPS range
- **Face recognition fallback** for students who forget their ID card
- **Multi-school support** — add a `schools` table above `classes`
- **PostgreSQL** — swap `db/database.js` for a Postgres client when scaling beyond one school
- **Native mobile app** — wrap the scan station in React Native for offline-capable scanning

## Notes on the QR security model

Each student's QR encodes a random UUID (`qr_token`), not their roll number or
name — so a photographed/leaked QR code can't be reverse-engineered to reveal
identity, and it can be **regenerated** instantly from the admin panel if a
student loses their card (old code stops working immediately).
