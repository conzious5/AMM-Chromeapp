import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, BrainCircuit, ChevronDown,
  CircleUserRound, FileText, Gauge, Inbox, LogOut, MessageSquareText,
  Search, Settings, ShieldCheck, Sparkles, UsersRound
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./styles.css";

type User = { email: string; name: string; role: "ADMIN" | "TEAM" };
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

function Login({ oauthReady }: { oauthReady: boolean }) {
  return <main className="login-shell">
    <section className="login-panel" aria-labelledby="login-title">
      <div className="brand-mark"><BrainCircuit size={26} aria-hidden="true" /></div>
      <div className="eyebrow">Authentic Moments Media</div>
      <h1 id="login-title">AMM Voice</h1>
      <p className="login-subtitle">Communication Intelligence</p>
      <p className="login-copy">Understand client questions, communication patterns, and the moments that deserve your attention.</p>
      <a className={`google-button ${oauthReady ? "" : "disabled"}`} href={oauthReady ? "/auth/google" : undefined} aria-disabled={!oauthReady}>
        <span className="google-g">G</span> Continue with Google
      </a>
      {!oauthReady && <div className="setup-note"><AlertTriangle size={17} /><span>Google sign-in is awaiting administrator configuration.</span></div>}
      <div className="security-note"><ShieldCheck size={16} /> Access is limited to approved AMM accounts.</div>
    </section>
  </main>;
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
    Settings: "Approved users, roles, model configuration, retention, thresholds, and privacy controls will appear here."
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
    <main className="content" id="main-content"><div className="utility-bar"><label className="search"><Search size={17} /><input aria-label="Search portal" placeholder="Search conversations and insights" /></label><span className="data-badge live">LIVE DATA</span></div>{section === "Overview" ? <OverviewPage data={data} days={days} setDays={setDays} onViewConversations={() => setSection("Conversations")} /> : <PlaceholderPage name={section} />}</main>
  </div>;
}

function App() {
  const [state, setState] = useState<{ loading: boolean; user?: User; oauthReady: boolean }>({ loading: true, oauthReady: false });
  useEffect(() => { fetch("/auth/me").then(async (response) => ({ ok: response.ok, body: await response.json() })).then(({ ok, body }) => setState({ loading: false, user: ok ? body.user : undefined, oauthReady: body.oauthReady ?? true })).catch(() => setState({ loading: false, oauthReady: false })); }, []);
  if (state.loading) return <div className="loading-screen"><div className="spinner" /><span>Loading AMM Voice</span></div>;
  return state.user ? <Dashboard user={state.user} /> : <Login oauthReady={state.oauthReady} />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
