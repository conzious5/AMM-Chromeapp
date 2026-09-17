import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, BrainCircuit, ChevronDown,
  CircleUserRound, FileText, Gauge, Inbox, LogOut, MessageSquareText,
  KeyRound, Search, Settings, ShieldCheck, Sparkles, UsersRound
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./styles.css";

type User = { id: string; email: string; name: string; role: "ADMIN" | "TEAM" };
type Overview = {
  databaseReady: boolean;
  measured: Record<string, number | null>;
  trends: Array<{ date: string; emails: number; ammStyle: number; zacsEdit: number; friction: number }>;
  interventions: Array<{ name: string; count: number }>;
  contactReasons: Array<{ name: string; count: number }>;
  attentionQueue: Array<{ id: string; client: string; reason: string; date: string; followUps: number; category: string; status: string }>;
  identityBreakdown: Array<{ authenticatedUser: string; senderAddress: string | null; count: number }>;
};

const sections = [
  ["Overview", Gauge], ["Client Experience", UsersRound], ["Communication", MessageSquareText],
  ["Zac's Edit", Sparkles], ["Operations", Activity], ["Conversations", Inbox],
  ["Insights & Reports", FileText], ["Training", BookOpen], ["Settings", Settings]
] as const;

const kpis: Array<[string, string, string]> = [
  ["emailsAnalyzed", "Emails analyzed", "Measured live operations"],
  ["ammStyleUses", "AMM Style uses", "Completed rewrites"],
  ["zacsEditUses", "Zac's Edit uses", "Deep reviews completed"],
  ["unsupportedPromisesCaught", "Promises caught", "Potential unsupported commitments"],
  ["missingNextStepsCaught", "Missing next steps", "Flagged before sending"],
  ["conversationsNeedingAttention", "Needs attention", "Observable attention signals"]
];

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><BarChart3 size={20} /></div><strong>{title}</strong><p>{children}</p></div>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, remember }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? "Sign in failed."); setLoading(false); return; }
    location.reload();
  }
  return <main className="login-shell">
    <section className="login-panel" aria-labelledby="login-title">
      <div className="brand-mark"><BrainCircuit size={26} aria-hidden="true" /></div>
      <div className="eyebrow">Authentic Moments Media</div>
      <h1 id="login-title">AMM Voice</h1>
      <p className="login-subtitle">Communication Intelligence</p>
      <p className="login-copy">Understand client questions, communication patterns, and the moments that deserve your attention.</p>
      <form className="login-form" onSubmit={submit}>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me on this device</label>
        {error && <div className="form-error" role="alert"><AlertTriangle size={17} />{error}</div>}
        <button className="primary-button" type="submit" disabled={loading}><KeyRound size={18} />{loading ? "Signing in…" : "Sign In"}</button>
      </form>
      <div className="security-note"><ShieldCheck size={16} /> Access is limited to approved AMM accounts.</div>
    </section>
  </main>;
}

type ManagedUser = User & { active: boolean; senderAddresses: string[] };

function SettingsPage({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [resets, setResets] = useState<Record<string, string>>({});
  const [newUser, setNewUser] = useState({ email: "", displayName: "", role: "TEAM" as "ADMIN" | "TEAM", password: "", senderAddresses: "" });
  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const body = response.ok ? await response.json() : { users: [] };
    setUsers(body.users);
  }
  useEffect(() => { if (user.role === "ADMIN") void loadUsers(); }, [user.role]);
  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (newPassword !== confirmation) { setMessage("New passwords do not match."); return; }
    const response = await fetch("/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "Password change failed."); return; }
    location.reload();
  }
  async function logoutAll() { await fetch("/auth/logout-all", { method: "POST" }); location.reload(); }
  async function resetTeamPassword(target: ManagedUser) {
    const password = resets[target.id] ?? "";
    const response = await fetch(`/api/admin/users/${target.id}/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Password reset for ${target.email}; all of their sessions were revoked.` : body.error ?? "Password reset failed.");
    if (response.ok) setResets((value) => ({ ...value, [target.id]: "" }));
  }
  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const senderAddresses = newUser.senderAddresses.split(",").map((value) => value.trim()).filter(Boolean);
    const response = await fetch("/api/admin/users", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: newUser.email, displayName: newUser.displayName, role: newUser.role, password: newUser.password, ...(senderAddresses.length ? { senderAddresses } : {}) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? "User creation failed."); return; }
    setMessage(`Authorized account created for ${body.user.email}.`);
    setNewUser({ email: "", displayName: "", role: "TEAM", password: "", senderAddresses: "" });
    await loadUsers();
  }
  return <><header className="page-header"><div><div className="eyebrow">AMM Voice</div><h1>Settings</h1><p>Account security and authorized-user administration.</p></div></header>
    {message && <div className="notice" role="status"><ShieldCheck size={18} /><div><strong>{message}</strong></div></div>}
    <section className="settings-grid">
      <article className="panel settings-panel"><div className="panel-heading"><div><h2>Change password</h2><p>Changing your password signs out every current session.</p></div></div><form className="settings-form" onSubmit={changePassword}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>New password<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label><button className="primary-button" type="submit">Change password</button></form><button className="danger-button" onClick={logoutAll}>Sign out all sessions</button></article>
      {user.role === "ADMIN" && <article className="panel settings-panel admin-users"><div className="panel-heading"><div><h2>Authorized users</h2><p>Roles are stored and enforced by the server.</p></div></div>{users.map((managed) => <div className="managed-user" key={managed.id}><div><strong>{managed.name}</strong><span>{managed.email} · {managed.role}</span><small>Senders: {managed.senderAddresses.join(", ")}</small></div>{managed.role === "TEAM" && <div className="reset-row"><input aria-label={`New password for ${managed.email}`} type="password" minLength={12} placeholder="Temporary password" value={resets[managed.id] ?? ""} onChange={(event) => setResets((value) => ({ ...value, [managed.id]: event.target.value }))} /><button className="secondary-button" onClick={() => resetTeamPassword(managed)}>Reset password</button></div>}</div>)}</article>}
      {user.role === "ADMIN" && <article className="panel settings-panel create-user-panel"><div className="panel-heading"><div><h2>Create authorized user</h2><p>There is no public registration. Share the temporary password securely and have the user change it after sign-in.</p></div></div><form className="settings-form user-form" onSubmit={createUser}><label>Display name<input value={newUser.displayName} onChange={(event) => setNewUser((value) => ({ ...value, displayName: event.target.value }))} required /></label><label>Email<input type="email" value={newUser.email} onChange={(event) => setNewUser((value) => ({ ...value, email: event.target.value }))} required /></label><label>Role<select value={newUser.role} onChange={(event) => setNewUser((value) => ({ ...value, role: event.target.value as "ADMIN" | "TEAM" }))}><option value="TEAM">TEAM</option><option value="ADMIN">ADMIN</option></select></label><label>Temporary password<input type="password" minLength={12} autoComplete="new-password" value={newUser.password} onChange={(event) => setNewUser((value) => ({ ...value, password: event.target.value }))} required /></label><label className="wide-field">Authorized sender addresses <span>(comma separated; defaults to the login email)</span><input value={newUser.senderAddresses} onChange={(event) => setNewUser((value) => ({ ...value, senderAddresses: event.target.value }))} placeholder="person@example.com, shared@example.com" /></label><button className="primary-button" type="submit">Create authorized user</button></form></article>}
    </section>
  </>;
}

function OverviewPage({ data, days, setDays, onViewConversations }: { data: Overview | null; days: number; setDays: (days: number) => void; onViewConversations: () => void }) {
  return <>
    <header className="page-header">
      <div><div className="eyebrow">Communication Intelligence</div><h1>Overview</h1><p>What is happening across client communication right now.</p></div>
      <label className="range-control">Date range <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={1}>Today</option><option value={7}>7 Days</option><option value={30}>30 Days</option><option value={90}>90 Days</option><option value={365}>Year</option></select><ChevronDown size={15} /></label>
    </header>
    {!data?.databaseReady && <div className="notice"><AlertTriangle size={18} /><div><strong>Analytics database is not connected yet.</strong><span>Add Railway PostgreSQL and run the included migration. The portal will never substitute demo data.</span></div></div>}
    <section className="kpi-grid" aria-label="Key performance indicators">
      {kpis.map(([key, label, description]) => <article className="kpi-card" key={key}><span>{label}</span><strong>{data?.measured[key] ?? "—"}</strong><small>{data?.measured[key] == null ? "Not enough data yet" : description}</small></article>)}
    </section>
    <section className="insight-card"><div><div className="section-kicker"><BrainCircuit size={16} /> Management brief</div><h2>Things Worth Your Attention</h2></div><EmptyState title="Nothing meaningful to report yet">Insights will appear only after enough measured activity supports them.</EmptyState></section>
    <section className="chart-grid">
      <article className="panel chart-wide"><div className="panel-heading"><div><h2>Emails analyzed over time</h2><p>Measured live operations</p></div><span className="data-badge live">LIVE</span></div>{data?.trends.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.trends}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="emails" stroke="#1e40af" strokeWidth={2.5} dot={false} name="Emails" /></LineChart></ResponsiveContainer> : <EmptyState title="Not enough data yet">Email volume will populate as AMM Voice processes real requests.</EmptyState>}</article>
      <article className="panel"><div className="panel-heading"><div><h2>AMM Style vs Zac's Edit</h2><p>Usage by day</p></div></div>{data?.trends.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={data.trends}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="ammStyle" stroke="#1e40af" strokeWidth={2} name="AMM Style" /><Line dataKey="zacsEdit" stroke="#d97706" strokeWidth={2} strokeDasharray="6 4" name="Zac's Edit" /></LineChart></ResponsiveContainer> : <EmptyState title="Not enough data yet">Mode usage appears after the extension begins sending requests.</EmptyState>}</article>
      <article className="panel"><div className="panel-heading"><div><h2>Top Zac's Edit interventions</h2><p>Meaningful client-service changes</p></div></div>{data?.interventions.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.interventions} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={120} /><Tooltip /><Bar dataKey="count" fill="#1e40af" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="Not enough data yet">Interventions are counted only when Zac's Edit reports a meaningful change.</EmptyState>}</article>
      <article className="panel chart-wide"><div className="panel-heading"><div><h2>Usage by person and sender</h2><p>The employee identity remains separate from the Gmail From address</p></div></div>{data?.identityBreakdown.length ? <div className="table-wrap"><table><thead><tr><th>Human user</th><th>Sender address</th><th>Emails handled</th></tr></thead><tbody>{data.identityBreakdown.map((row) => <tr key={`${row.authenticatedUser}:${row.senderAddress ?? "none"}`}><td>{row.authenticatedUser}</td><td>{row.senderAddress ?? "Not detected"}</td><td>{row.count}</td></tr>)}</tbody></table></div> : <EmptyState title="Not enough data yet">Usage will be grouped by authenticated employee and the selected Gmail From address.</EmptyState>}</article>
      <article className="panel chart-wide"><div className="panel-heading"><div><h2>Client Attention Queue</h2><p>Signals requiring human review, not a happiness score</p></div><button className="text-button" onClick={onViewConversations}>View conversations</button></div>{data?.attentionQueue.length ? <div className="table-wrap"><table><thead><tr><th>Client</th><th>Reason flagged</th><th>Category</th><th>Follow-ups</th><th>Status</th></tr></thead><tbody>{data.attentionQueue.map((row) => <tr key={row.id}><td>{row.client}</td><td>{row.reason}</td><td>{row.category}</td><td>{row.followUps}</td><td><span className="status-pill">{row.status}</span></td></tr>)}</tbody></table></div> : <EmptyState title="No conversations are flagged">The queue will show observable concerns such as repeated follow-ups or unresolved confusion.</EmptyState>}</article>
    </section>
  </>;
}

function PlaceholderPage({ name }: { name: string }) {
  const copy: Record<string, string> = {
    "Client Experience": "Observable positive indicators, attention signals, and conversation health will appear here.",
    Communication: "Question coverage, clarity checks, next steps, and communication interventions will be tracked here.",
    "Zac's Edit": "Intervention trends and coaching-oriented team development will appear here.",
    Operations: "Contact reasons, recurring confusion, response time, and process recommendations will appear here.",
    Conversations: "Searchable privacy-minimized conversation references and drill-downs will appear here.",
    "Insights & Reports": "Weekly, monthly, and quarterly reports will be generated from structured data here.",
    Training: "Voice profile versions, corpus coverage, and reviewed training candidates will appear here.",
    Settings: "Account security and administration are available here."
  };
  return <><header className="page-header"><div><div className="eyebrow">AMM Voice</div><h1>{name}</h1><p>{copy[name]}</p></div></header><article className="panel placeholder-panel"><EmptyState title="Ready for real data">This section is wired into the authenticated portal shell and will populate as its structured events become available.</EmptyState></article></>;
}

function Dashboard({ user }: { user: User }) {
  const [section, setSection] = useState("Overview");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { if (section === "Overview") fetch(`/api/portal/overview?days=${days}&source=LIVE`).then((response) => response.ok ? response.json() : null).then(setData); }, [days, section]);
  const initials = useMemo(() => user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), [user.name]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><div className="brand"><div className="brand-mark small"><BrainCircuit size={20} /></div><div><strong>AMM Voice</strong><span>Communication Intelligence</span></div></div><nav aria-label="Portal navigation">{sections.map(([name, Icon]) => <button key={name} className={section === name ? "active" : ""} onClick={() => setSection(name)}><Icon size={18} /><span>{name}</span></button>)}</nav><div className="sidebar-footer"><div className="profile"><span className="avatar">{initials}</span><div><strong>{user.name}</strong><span>{user.role}</span></div></div><button className="logout" aria-label="Sign out" onClick={() => fetch("/auth/logout", { method: "POST" }).then(() => location.reload())}><LogOut size={18} /></button></div></aside>
    <div className="mobile-bar"><div className="brand-mark small"><BrainCircuit size={19} /></div><strong>AMM Voice</strong><label className="mobile-section"><span className="sr-only">Portal section</span><select value={section} onChange={(event) => setSection(event.target.value)}>{sections.map(([name]) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></label><button aria-label="Sign out" onClick={() => fetch("/auth/logout", { method: "POST" }).then(() => location.reload())}><CircleUserRound /></button></div>
    <main className="content" id="main-content"><div className="utility-bar"><label className="search"><Search size={17} /><input aria-label="Search portal" placeholder="Search conversations and insights" /></label><span className="data-badge live">LIVE DATA</span></div>{section === "Overview" ? <OverviewPage data={data} days={days} setDays={setDays} onViewConversations={() => setSection("Conversations")} /> : section === "Settings" ? <SettingsPage user={user} /> : <PlaceholderPage name={section} />}</main>
  </div>;
}

function App() {
  const [state, setState] = useState<{ loading: boolean; user?: User }>({ loading: true });
  useEffect(() => { fetch("/auth/me").then(async (response) => ({ ok: response.ok, body: await response.json() })).then(({ ok, body }) => setState({ loading: false, user: ok ? body.user : undefined })).catch(() => setState({ loading: false })); }, []);
  if (state.loading) return <div className="loading-screen"><div className="spinner" /><span>Loading AMM Voice</span></div>;
  return state.user ? <Dashboard user={state.user} /> : <Login />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
