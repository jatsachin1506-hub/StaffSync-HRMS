# StaffSync — HR Management System

A starter MERN project for employee, attendance, leave, announcement, and training management.

## Requirements
- Node.js 18+
- MongoDB local installation or MongoDB Atlas connection
- Git and a GitHub account

## 1. Run the backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Set `MONGO_URI` in `backend/.env`. The backend runs at `http://localhost:5000`.

## 2. Run the frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (usually `http://localhost:5173`).

## Demo accounts
Register a new account using the Register page. Choose Employee or Manager for public registration.
For security, HR role should be assigned manually in MongoDB or by an administrator.

## Features included
- Register/login with JWT and bcrypt password hashing
- Role-based dashboards (Employee, Manager, HR)
- Employee directory (HR view)
- Attendance marking and history
- Leave requests and manager/HR approval
- Announcements (HR can post)
- Training listing (HR can add)
- Responsive UI

## Notes
This is a learning-project starter. Before real-world use, add production-grade validation, rate limiting, audit logs, tests, and secure deployment settings. Never commit `.env` or real credentials.
