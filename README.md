# StudyFlow — Study Automation

A full-stack study assistant to organize units, upload notes and past papers, track assignment deadlines with notifications, and log daily study sessions.

## Features

- **Units** — Add and manage courses/subjects with color coding
- **Notes** — Upload PDFs, docs, images per unit
- **Past Papers** — Store exam papers with year/semester tags
- **Assignments** — Set deadlines, priorities, and reminder days
- **Notifications** — Automatic alerts for upcoming and overdue deadlines
- **Study Log** — Track daily study time, streaks, and weekly charts
- **Training Journal** — Daily learning log with Cursor notes for day-by-day training
- **Calendar** — Month view of deadlines, study days, and journal entries
- **Browser Notifications** — Desktop alerts for approaching assignment deadlines
- **Study Timetable** — Weekly class and study schedule with today's view on dashboard
- **Exam Prep** — Track syllabus coverage, analyze past papers against covered topics, get predicted questions with solutions from your notes
- **Dashboard** — Overview of everything at a glance

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React, Vite, Tailwind CSS           |
| Backend  | Node.js, Express                    |
| Database | SQLite (sql.js)                     |
| Files    | Local storage via Multer            |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 3. Run the app

Open two terminals:

**Terminal 1 — Backend (port 3001):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Usage Guide

1. **Add units** — Go to Units and create your courses (e.g. "Data Structures", code "CS201")
2. **Upload notes** — Notes page → select unit → upload files
3. **Upload past papers** — Past Papers page → add year/semester for easy filtering
4. **Add assignments** — Set deadline and "remind me X days before" — notifications appear automatically
5. **Log study time** — Study Log page → quick-log buttons or detailed sessions
6. **Training journal** — Journal page → record what you learned and Cursor workflows daily
7. **Calendar** — See all deadlines and study activity in one month view
8. **Enable notifications** — Click "Enable" in the banner for desktop deadline alerts
9. **Timetable** — Add your weekly class and study blocks per unit
10. **Exam Prep** — Add syllabus topics → mark covered → upload notes + past papers → Run Analysis

### Exam Prep workflow

1. Select a unit on the **Exam Prep** page
2. Add syllabus topics (one by one or bulk paste)
3. Check off topics you've covered in class
4. Upload **notes** (PDF/TXT) and **past papers** for that unit
5. Click **Run Analysis** — StudyFlow reviews past papers only up to covered topics and suggests likely exam questions with solutions from your notes
6. Optional: add `OPENAI_API_KEY` in `backend/.env` for AI-enhanced analysis (see `.env.example`)

## Project Structure

```
learning automation/
├── backend/
│   ├── server.js          # Express server
│   ├── db.js              # SQLite schema
│   ├── routes/            # API endpoints
│   ├── services/          # Notification logic
│   ├── middleware/        # File upload config
│   ├── data/              # SQLite database (auto-created)
│   └── uploads/           # Uploaded files (auto-created)
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Units, Notes, etc.
│       ├── components/    # Shared UI components
│       └── api/           # API client
└── README.md
```

## API Endpoints

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| GET    | `/api/dashboard`                | Dashboard summary        |
| GET/POST | `/api/units`                  | List/create units        |
| GET/POST | `/api/notes`                  | List/upload notes        |
| GET/POST | `/api/past-papers`            | List/upload past papers  |
| GET/POST | `/api/assignments`            | List/create assignments  |
| GET    | `/api/notifications`            | List notifications       |
| GET/POST | `/api/study-sessions`         | Study session log        |
| GET/POST | `/api/training-logs`          | Daily training journal   |
| GET    | `/api/calendar`                 | Calendar month data      |
| GET/POST | `/api/timetable`              | Weekly study timetable   |
| GET/POST | `/api/topics`                 | Syllabus topic coverage  |
| POST   | `/api/exam-prep/analyze`        | Analyze past papers vs notes |

## Extending with Cursor

This project is designed to grow as you train it day by day. Ideas for future features:

- Browser push notifications
- Flashcards per unit
- AI-powered quiz generation from notes
- Calendar view for deadlines
- Export study reports
