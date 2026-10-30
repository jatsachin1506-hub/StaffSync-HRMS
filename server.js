import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/staffsync");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Employee", "Manager", "HR"], default: "Employee" },
  department: { type: String, default: "General" },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);
const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ["Present", "Absent"], default: "Present" },
  markedAt: { type: Date, default: Date.now }
});
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
const Attendance = mongoose.model("Attendance", attendanceSchema);
const leaveSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});
const Leave = mongoose.model("Leave", leaveSchema);
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model("Announcement", announcementSchema);
const trainingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  date: { type: String, default: "" }
});
const Training = mongoose.model("Training", trainingSchema);

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Login required" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_only_change_me"); next(); }
  catch { return res.status(401).json({ message: "Invalid or expired token" }); }
}
function roles(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role)
    ? next() : res.status(403).json({ message: "You do not have permission for this action" });
}
const safeUser = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department });

app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "StaffSync API" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ message: "Name, email and password (minimum 6 characters) are required" });
    if (await User.findOne({ email })) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({
      name, email, password: await bcrypt.hash(password, 10),
      department: department || "General", role: "Employee"
    });
    res.status(201).json({ user: safeUser(user), token: jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "dev_only_change_me", { expiresIn: "1d" }) });
  } catch (e) { res.status(500).json({ message: "Could not register user" }); }
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password || "", user.password)))
    return res.status(401).json({ message: "Invalid email or password" });
  res.json({ user: safeUser(user), token: jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "dev_only_change_me", { expiresIn: "1d" }) });
});
app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: safeUser(user) });
});

app.get("/api/employees", auth, roles("HR", "Manager"), async (_req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  res.json(users.map(safeUser));
});
app.get("/api/attendance", auth, async (req, res) => {
  const filter = req.user.role === "HR" || req.user.role === "Manager" ? {} : { user: req.user.id };
  const rows = await Attendance.find(filter).populate("user", "name email department").sort({ date: -1 }).limit(100);
  res.json(rows);
});
app.post("/api/attendance", auth, async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const row = await Attendance.findOneAndUpdate(
      { user: req.user.id, date }, { $set: { status: "Present", markedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(row);
  } catch { res.status(500).json({ message: "Could not mark attendance" }); }
});
app.get("/api/leaves", auth, async (req, res) => {
  const filter = req.user.role === "HR" || req.user.role === "Manager" ? {} : { user: req.user.id };
  res.json(await Leave.find(filter).populate("user", "name email department").sort({ createdAt: -1 }));
});
app.post("/api/leaves", auth, async (req, res) => {
  const { reason, fromDate, toDate } = req.body;
  if (!reason || !fromDate || !toDate || toDate < fromDate)
    return res.status(400).json({ message: "Enter a reason and valid date range" });
  res.status(201).json(await Leave.create({ user: req.user.id, reason, fromDate, toDate }));
});
app.patch("/api/leaves/:id", auth, roles("HR", "Manager"), async (req, res) => {
  if (!["Approved", "Rejected"].includes(req.body.status))
    return res.status(400).json({ message: "Status must be Approved or Rejected" });
  const leave = await Leave.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
    .populate("user", "name email department");
  if (!leave) return res.status(404).json({ message: "Leave request not found" });
  res.json(leave);
});
app.get("/api/announcements", auth, async (_req, res) => res.json(await Announcement.find().sort({ createdAt: -1 })));
app.post("/api/announcements", auth, roles("HR"), async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ message: "Title and message are required" });
  res.status(201).json(await Announcement.create({ title, message, createdBy: req.user.id }));
});
app.get("/api/trainings", auth, async (_req, res) => res.json(await Training.find().sort({ date: 1 })));
app.post("/api/trainings", auth, roles("HR", "Manager"), async (req, res) => {
  const { title, description, date } = req.body;
  if (!title) return res.status(400).json({ message: "Training title is required" });
  res.status(201).json(await Training.create({ title, description, date }));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`StaffSync API running on port ${port}`));
