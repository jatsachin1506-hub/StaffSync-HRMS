import React, { createContext, useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const api = axios.create({ baseURL: API });
api.interceptors.request.use(c => {
  const token = localStorage.getItem("staffsync_token");
  if (token) c.headers.Authorization = `Bearer ${token}`;
  return c;
});
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("staffsync_user")); } catch { return null; }
  });
  const login = data => {
    localStorage.setItem("staffsync_token", data.token);
    localStorage.setItem("staffsync_user", JSON.stringify(data.user));
    setUser(data.user);
  };
  const logout = () => {
    localStorage.removeItem("staffsync_token"); localStorage.removeItem("staffsync_user"); setUser(null);
  };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
const useAuth = () => useContext(AuthContext);
function Shell({ children }) {
  const { user, logout } = useAuth();
  return <div className="app-shell"><aside className="sidebar">
    <Link className="brand" to="/"> <span className="brand-icon">S</span> StaffSync</Link>
    <p className="nav-label">WORKSPACE</p>
    <Link to="/">▦ &nbsp; Overview</Link>
    <Link to="/attendance">◷ &nbsp; Attendance</Link>
    <Link to="/leaves">▤ &nbsp; Leave management</Link>
    <Link to="/announcements">◉ &nbsp; Announcements</Link>
    <Link to="/trainings">✦ &nbsp; Training</Link>
    {(user?.role === "HR" || user?.role === "Manager") && <Link to="/employees">♙ &nbsp; Employees</Link>}
    <div className="sidebar-bottom"><div className="avatar">{user?.name?.[0]?.toUpperCase() || "S"}</div><div className="user-mini"><b>{user?.name}</b><span>{user?.role}</span></div><button className="logout" onClick={logout} title="Log out">↪</button></div>
  </aside><main className="main"><header className="topbar"><div><span className="eyebrow">PEOPLE OPERATIONS</span><h2>Workspace</h2></div><div className="top-user"><span className="online-dot"></span>{user?.name}</div></header>{children}</main></div>;
}
function Notice({ message, error }) { return message ? <div className={error ? "notice error" : "notice"}>{message}</div> : null; }
function Login() {
  const { user, login } = useAuth(); const nav = useNavigate();
  const [register, setRegister] = useState(false); const [form, setForm] = useState({name:"",email:"",password:"",department:"General"});
  const [message,setMessage] = useState(""); const [error,setError] = useState(false); const [busy,setBusy] = useState(false);
  if (user) return <Navigate to="/" replace/>;
  const change = e => setForm({...form,[e.target.name]:e.target.value});
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      const {data} = await api.post(`/auth/${register ? "register" : "login"}`, form);
      login(data); nav("/");
    } catch (e) { setError(true); setMessage(e.response?.data?.message || "Could not connect. Check that the backend is running."); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-art"><div className="art-logo">S</div><div><span className="eyebrow light">PEOPLE FIRST. WORK SMARTER.</span><h1>Great teams<br/>start with <i>clarity.</i></h1><p>One calm, connected workspace for your people, processes and progress.</p></div><div className="art-foot">STAFFSYNC · PEOPLE OPERATIONS</div></div><div className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><span className="eyebrow">WELCOME TO STAFFSYNC</span><h2>{register ? "Create your account" : "Welcome back"}</h2><p className="muted">{register ? "Join your organisation's workspace." : "Sign in to continue to your workspace."}</p><Notice message={message} error={error}/>{register && <label>Full name<input name="name" value={form.name} onChange={change} placeholder="e.g. Renu Rekwal" required/></label>}<label>Work email<input type="email" name="email" value={form.email} onChange={change} placeholder="you@company.com" required/></label><label>Password<input type="password" name="password" value={form.password} onChange={change} placeholder="At least 6 characters" minLength="6" required/></label>{register && <label>Department<select name="department" value={form.department} onChange={change}><option>General</option><option>Engineering</option><option>Human Resources</option><option>Finance</option><option>Marketing</option></select></label>}<button className="primary full" disabled={busy}>{busy ? "Please wait…" : register ? "Create account →" : "Sign in →"}</button><p className="switch-auth">{register ? "Already registered?" : "New to StaffSync?"} <button type="button" onClick={()=>{setRegister(!register);setMessage("");}}>{register ? "Sign in" : "Create account"}</button></p><p className="tiny">Demo project · Never use a real work password here.</p></form></div></div>;
}
function Dashboard() {
 const {user}=useAuth(); const [counts,setCounts]=useState({employees:0,attendance:0,leaves:0,announcements:[]}); const [err,setErr]=useState("");
 useEffect(()=>{(async()=>{try{const [a,l,n]=await Promise.all([api.get("/attendance"),api.get("/leaves"),api.get("/announcements")]);let emp=0;if(user.role!=="Employee"){try{emp=(await api.get("/employees")).data.length}catch{}}setCounts({employees:emp,attendance:a.data.length,leaves:l.data.length,announcements:n.data.slice(0,3)});}catch{setErr("Unable to load all data. Make sure the backend and MongoDB are running.");}})()},[user]);
 const hr=user.role==="HR", manager=user.role==="Manager";
 return <Shell><section className="welcome-row"><div><span className="eyebrow">YOUR OVERVIEW</span><h1>Good to see you, {user.name.split(" ")[0]} <span>✦</span></h1><p>Here's what's happening with your team today.</p></div><span className="date-pill">{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span></section><Notice message={err} error/><div className="stats-grid"><Stat label={hr||manager?"Team members":"Attendance records"} value={hr||manager?counts.employees:counts.attendance} change={hr||manager?"Registered accounts":"Your marked days"} icon="♙" tone="green"/><Stat label="Leave requests" value={counts.leaves} change="Requests in workspace" icon="▤" tone="peach"/><Stat label="Announcements" value={counts.announcements.length} change="Latest updates" icon="◉" tone="blue"/><Stat label="Your role" value={user.role} change={user.department||"General"} icon="✦" tone="lavender"/></div><div className="content-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">QUICK ACTIONS</span><h3>Make a move</h3></div></div><div className="action-list"><Link to="/attendance" className="action-item"><span className="action-icon green-bg">◷</span><span><b>Mark attendance</b><small>Record that you're in today</small></span><span className="arrow">↗</span></Link><Link to="/leaves" className="action-item"><span className="action-icon peach-bg">▤</span><span><b>Request time off</b><small>Submit or review a leave request</small></span><span className="arrow">↗</span></Link><Link to="/announcements" className="action-item"><span className="action-icon blue-bg">◉</span><span><b>Company updates</b><small>See the latest announcements</small></span><span className="arrow">↗</span></Link><Link to="/trainings" className="action-item"><span className="action-icon purple-bg">✦</span><span><b>Learning & development</b><small>Explore training opportunities</small></span><span className="arrow">↗</span></Link></div></section><section className="panel announcement-panel"><div className="panel-head"><div><span className="eyebrow">STAY IN THE LOOP</span><h3>Latest announcements</h3></div><Link className="text-link" to="/announcements">View all ↗</Link></div>{counts.announcements.length?counts.announcements.map(a=><article className="announcement" key={a._id}><span className="announcement-dot"></span><div><b>{a.title}</b><p>{a.message}</p><small>{new Date(a.createdAt).toLocaleDateString()}</small></div></article>):<div className="empty"><span>◉</span><b>Nothing new just yet</b><p>Company announcements will show up here.</p></div>}</section></div><footer className="footer">STAFFSYNC <span>·</span> A calmer way to work together</footer></Shell>;
}
function Stat({label,value,change,icon,tone}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{change}</small></div>; }
function Page({title,subtitle,children}) { return <Shell><section className="page-heading"><span className="eyebrow">WORKSPACE / {title.toUpperCase()}</span><h1>{title}</h1><p>{subtitle}</p></section>{children}<footer className="footer">STAFFSYNC <span>·</span> A calmer way to work together</footer></Shell>; }
function Attendance() {
 const [rows,setRows]=useState([]),[msg,setMsg]=useState(""),[err,setErr]=useState(false);
 const load=()=>api.get("/attendance").then(r=>setRows(r.data)).catch(()=>{setErr(true);setMsg("Could not load attendance.");});
 useEffect(()=>{load()},[]);
 async function mark(){try{await api.post("/attendance",{date:new Date().toISOString().slice(0,10)});setErr(false);setMsg("Attendance marked for today.");load()}catch{setErr(true);setMsg("Unable to mark attendance.");}}
 return <Page title="Attendance" subtitle="Keep your workday records accurate and up to date."><Notice message={msg} error={err}/><div className="panel"><div className="panel-head"><div><span className="eyebrow">DAILY CHECK-IN</span><h3>Your attendance</h3></div><button className="primary" onClick={mark}>＋ Mark present</button></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Employee</th><th>Department</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r._id}><td>{r.date}</td><td>{r.user?.name||"You"}</td><td>{r.user?.department||"—"}</td><td><span className="status approved">{r.status}</span></td></tr>)}</tbody></table>{!rows.length&&<div className="empty"><b>No attendance records yet</b><p>Use “Mark present” to record today's attendance.</p></div>}</div></div></Page>;
}
function Leaves() {
 const {user}=useAuth(); const [rows,setRows]=useState([]),[form,setForm]=useState({reason:"",fromDate:"",toDate:""}),[msg,setMsg]=useState(""),[err,setErr]=useState(false);
 const load=()=>api.get("/leaves").then(r=>setRows(r.data)).catch(()=>{setErr(true);setMsg("Could not load leave requests.");});
 useEffect(()=>{load()},[]);
 async function apply(e){e.preventDefault();try{await api.post("/leaves",form);setForm({reason:"",fromDate:"",toDate:""});setErr(false);setMsg("Leave request submitted.");load()}catch(e){setErr(true);setMsg(e.response?.data?.message||"Could not submit request.");}}
 async function decide(id,status){try{await api.patch(`/leaves/${id}`,{status});setMsg(`Request ${status.toLowerCase()}.`);load()}catch{setErr(true);setMsg("Unable to update request.");}}
 const canReview=user.role==="HR"||user.role==="Manager";
 return <Page title="Leave management" subtitle="Request time off and keep track of decisions."><Notice message={msg} error={err}/><div className="content-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">TIME OFF</span><h3>New leave request</h3></div></div><form className="stack-form" onSubmit={apply}><label>Reason<textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Briefly explain your request" required rows="3"/></label><div className="two-col"><label>From<input type="date" value={form.fromDate} onChange={e=>setForm({...form,fromDate:e.target.value})} required/></label><label>To<input type="date" value={form.toDate} min={form.fromDate} onChange={e=>setForm({...form,toDate:e.target.value})} required/></label></div><button className="primary">Submit request →</button></form></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">REQUEST HISTORY</span><h3>Recent requests</h3></div></div>{rows.map(r=><article className="leave-item" key={r._id}><div className="leave-date"><b>{new Date(r.fromDate+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</b><span>to {r.toDate}</span></div><div className="leave-info"><b>{r.user?.name||"Your request"}</b><p>{r.reason}</p><span className={`status ${r.status.toLowerCase()}`}>{r.status}</span>{canReview&&r.status==="Pending"&&<div className="decision"><button onClick={()=>decide(r._id,"Approved")}>Approve</button><button onClick={()=>decide(r._id,"Rejected")}>Reject</button></div>}</div></article>)}{!rows.length&&<div className="empty"><b>No requests yet</b><p>Leave requests will appear here.</p></div>}</section></div></Page>;
}
function Announcements() {
 const {user}=useAuth();const [rows,setRows]=useState([]),[form,setForm]=useState({title:"",message:""}),[msg,setMsg]=useState(""),[err,setErr]=useState(false);
 const load=()=>api.get("/announcements").then(r=>setRows(r.data)).catch(()=>{setErr(true);setMsg("Could not load announcements.");});useEffect(()=>{load()},[]);
 async function post(e){e.preventDefault();try{await api.post("/announcements",form);setForm({title:"",message:""});setErr(false);setMsg("Announcement published.");load()}catch(e){setErr(true);setMsg(e.response?.data?.message||"Only HR can publish announcements.");}}
 return <Page title="Announcements" subtitle="Company news, reminders and important updates."><Notice message={msg} error={err}/>{user.role==="HR"&&<section className="panel form-panel"><h3>Publish an update</h3><form className="stack-form" onSubmit={post}><label>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label>Message<textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows="3" required/></label><button className="primary">Publish announcement →</button></form></section>}<div className="announcement-grid">{rows.map(a=><article className="panel announcement-card" key={a._id}><span className="announcement-mark">◉</span><small>{new Date(a.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small><h3>{a.title}</h3><p>{a.message}</p></article>)}</div>{!rows.length&&<div className="panel empty"><b>No announcements yet</b><p>When HR posts an update, it will appear here.</p></div>}</Page>;
}
function Trainings() {
 const {user}=useAuth();const [rows,setRows]=useState([]),[form,setForm]=useState({title:"",description:"",date:""}),[msg,setMsg]=useState(""),[err,setErr]=useState(false);
 const load=()=>api.get("/trainings").then(r=>setRows(r.data)).catch(()=>{setErr(true);setMsg("Could not load training programs.");});useEffect(()=>{load()},[]);
 async function add(e){e.preventDefault();try{await api.post("/trainings",form);setForm({title:"",description:"",date:""});setMsg("Training program added.");setErr(false);load()}catch(e){setErr(true);setMsg(e.response?.data?.message||"Unable to add training.");}}
 return <Page title="Learning & development" subtitle="Build skills through team training and development programs."><Notice message={msg} error={err}/>{(user.role==="HR"||user.role==="Manager")&&<section className="panel form-panel"><h3>Add a training program</h3><form className="stack-form" onSubmit={add}><label>Program title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="2"/></label><label>Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><button className="primary">Add program →</button></form></section>}<div className="training-grid">{rows.map(t=><article className="panel training-card" key={t._id}><span className="training-icon">✦</span><span className="eyebrow">LEARNING PROGRAM</span><h3>{t.title}</h3><p>{t.description||"A learning opportunity to build new skills."}</p><small>{t.date||"Date to be announced"}</small></article>)}</div>{!rows.length&&<div className="panel empty"><b>No training programs yet</b><p>New learning opportunities will appear here.</p></div>}</Page>;
}
function Employees() {
 const [rows,setRows]=useState([]),[msg,setMsg]=useState("");
 useEffect(()=>{api.get("/employees").then(r=>setRows(r.data)).catch(e=>setMsg(e.response?.data?.message||"Could not load employee directory."));},[]);
 return <Page title="Employee directory" subtitle="People and teams across your organisation."><Notice message={msg} error={!!msg}/><div className="panel"><div className="panel-head"><h3>All accounts</h3><span className="count-pill">{rows.length} people</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><span className="employee-cell"><span className="avatar small">{r.name[0]}</span>{r.name}</span></td><td>{r.email}</td><td>{r.department}</td><td><span className="status pending">{r.role}</span></td></tr>)}</tbody></table>{!rows.length&&!msg&&<div className="empty">No employees registered yet.</div>}</div></div></Page>;
}
function App() { const {user}=useAuth(); return <Routes><Route path="/login" element={<Login/>}/><Route path="*" element={user ? <ProtectedRoutes/> : <Navigate to="/login" replace/>}/></Routes>; }
function ProtectedRoutes(){return <Routes><Route path="/" element={<Dashboard/>}/><Route path="/attendance" element={<Attendance/>}/><Route path="/leaves" element={<Leaves/>}/><Route path="/announcements" element={<Announcements/>}/><Route path="/trainings" element={<Trainings/>}/><Route path="/employees" element={<Employees/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;}
createRoot(document.getElementById("root")).render(<BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter>);
