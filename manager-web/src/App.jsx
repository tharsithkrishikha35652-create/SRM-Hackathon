import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Utensils, LayoutDashboard, CalendarDays, MessageSquare, BrainCircuit,
  ClipboardCheck, BarChart3, Settings, Sun, Moon, Search, ChevronRight,
  Clock3, Star, AlertTriangle, CheckCircle2, CircleAlert, Coffee, Soup,
  Salad, Pencil, Trash2, Plus, X, Send, Download, RefreshCw, LogOut,
  ShieldCheck, Filter, Eye, Check, Users, Activity, Bell, AlertOctagon,
  ShieldAlert, Award, FileText, CheckCheck, Info, Flame
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/api' : 'http://127.0.0.1:8000/api');
const STORE_KEY = 'messmate_manager_session';

const MEALS = [
  { id: 'breakfast', name: 'Breakfast', time: '7:00 AM – 11:00 AM', icon: Coffee },
  { id: 'lunch', name: 'Lunch', time: '12:30 PM – 3:00 PM', icon: Soup },
  { id: 'snacks', name: 'Snacks', time: '3:00 PM – 5:00 PM', icon: Salad },
  { id: 'dinner', name: 'Dinner', time: '7:00 PM – 10:00 PM', icon: Utensils }
];

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['escalations', 'Escalations', AlertOctagon],
  ['menu', 'Menu Management', CalendarDays],
  ['feedback', 'Feedback & Complaints', MessageSquare],
  ['insights', 'AI Insights', BrainCircuit],
  ['responses', 'Responses', ClipboardCheck],
  ['reports', 'Reports', BarChart3],
  ['settings', 'Settings', Settings]
];

async function api(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({ detail: 'Unexpected server response.' }));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

function readSession() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}

function dateISO(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateLabel(date = new Date()) {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name = 'Manager') {
  return name.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
}

function Status({ value }) {
  const cls = String(value || 'Open').toLowerCase().replace(/\s+/g, '-');
  return <span className={`status status-${cls}`}>{value || 'Open'}</span>;
}

function Brand() {
  return (
    <div className="brand-lockup">
      <span className="brand-symbol"><Utensils size={20}/></span>
      <span><strong>MessMate</strong><small>CEG HOSTEL PORTAL</small></span>
    </div>
  );
}

function Button({ children, kind = 'secondary', ...props }) {
  return <button className={`button button-${kind}`} {...props}>{children}</button>;
}

function Metric({ label, value, note, icon: Icon, tone = '' }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}><Icon size={17}/></span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <span className="eyebrow">MESSMATE · AUDIT &amp; ACTION</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function RiskBadge({ issue, onClick }) {
  const level = (issue.risk_level || 'LOW').toUpperCase();
  const score = issue.risk_score ?? 0;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
      <button
        type="button"
        className={`risk-badge risk-badge-${level.toLowerCase()}`}
        onClick={() => onClick && onClick(issue)}
        title="Click to view full Risk Score Formula & Audit Breakdown"
      >
        <ShieldAlert size={12}/>
        <span>{score} · {level}</span>
      </button>
      {issue.is_food_safety_hazard === 1 && (
        <span className="hazard-pill" title="Critical Food Safety Hazard flagged">
          <Flame size={11}/> Hazard
        </span>
      )}
      {issue.escalated && (
        <span className="escalated-pill" title="Active Inspection Escalation triggered">
          <AlertOctagon size={11}/> Escalated
        </span>
      )}
    </div>
  );
}

function Login({ onLogin, error, busy }) {
  const [identifier, setIdentifier] = useState('manager@srm.edu');
  const [password, setPassword] = useState('Manager@123');
  const [show, setShow] = useState(false);

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <Brand/>
        <div className="login-brand-copy">
          <span className="eyebrow">CAMPUS DINING · OPERATIONS &amp; AUDIT</span>
          <h1>Food feedback.<br/><em>Actionable insights.</em></h1>
          <p>Deterministic risk scoring and AI intelligence without compromising student privacy.</p>
        </div>
        <span className="login-footnote"><ShieldCheck size={15}/> Privacy-first feedback management</span>
      </section>
      <section className="login-form-panel">
        <div className="login-card">
          <span className="eyebrow">MANAGEMENT &amp; REVIEW PORTAL</span>
          <h2>Welcome back.</h2>
          <p>Sign in to review student feedback, inspect risk scores, and verify resolutions.</p>
          <form onSubmit={e => { e.preventDefault(); onLogin(identifier, password); }}>
            <label htmlFor="manager-id">Email / username</label>
            <input
              id="manager-id"
              autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="manager@srm.edu"
              required
            />
            <label htmlFor="manager-password">Password</label>
            <div className="password-field">
              <input
                id="manager-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" className="icon-plain" onClick={() => setShow(x => !x)} aria-label="Toggle password visibility">
                <Eye size={17}/>
              </button>
            </div>
            {error && <div className="error-box"><CircleAlert size={16}/>{error}</div>}
            <button className="button button-primary login-submit" disabled={busy}>
              {busy && <RefreshCw className="spin" size={16}/>}
              Sign in<ChevronRight size={17}/>
            </button>
          </form>
          <div className="login-note">
            <ShieldCheck size={15}/> Authorized personnel only. Student accounts access the mobile app.
          </div>
          <div className="demo-credentials">
            <strong>Quick Demo Accounts</strong>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                type="button"
                className="demo-role-btn"
                onClick={() => { setIdentifier('manager@srm.edu'); setPassword('Manager@123'); }}
              >
                Mess Manager
              </button>
              <button
                type="button"
                className="demo-role-btn"
                onClick={() => { setIdentifier('reviewer@srm.edu'); setPassword('Reviewer@123'); }}
              >
                Hostel Warden (Reviewer)
              </button>
            </div>
            <small style={{ marginTop: '4px' }}>
              Reviewers have authority to verify resolutions &amp; close escalations.
            </small>
          </div>
        </div>
        <span className="login-copyright">MESSMATE / ENTERPRISE RISK &amp; OPERATIONS</span>
      </section>
    </main>
  );
}

function IssueTable({ issues, onRespond, onAudit, onVerify, isReviewer = false, canRespond = true }) {
  if (!issues.length) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={24}/>
        <strong>No issues to display</strong>
        <span>Grouped feedback and risk evaluations will appear here.</span>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Meal / date</th>
            <th>Issue summary</th>
            <th>Risk Score</th>
            <th>Reports</th>
            <th>Response deadline</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => (
            <tr key={issue.id}>
              <td>
                <strong className="capitalize">{issue.meal_id}</strong>
                <small>{shortDate(issue.service_date)}</small>
                {issue.category && <small style={{ color: 'var(--accent)', fontWeight: 600 }}>{issue.category}</small>}
              </td>
              <td>
                <strong>{issue.title}</strong>
                <small className="table-summary">{issue.summary}</small>
              </td>
              <td>
                <RiskBadge issue={issue} onClick={onAudit}/>
              </td>
              <td>
                <span className="count-pill" title={`${issue.count} complaints across ${issue.distinct_weeks || 1} distinct weeks`}>
                  {issue.count} ({issue.distinct_weeks || 1}w)
                </span>
              </td>
              <td>
                <span className={`deadline ${issue.overdue ? 'overdue' : ''}`}>
                  <Clock3 size={13}/>
                  {shortDate(issue.deadline)}
                  {issue.overdue && ' (Overdue)'}
                </span>
              </td>
              <td>
                <Status value={issue.status}/>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Button kind="secondary" onClick={() => onAudit(issue)} title="View full score breakdown and audit logs">
                    <Info size={13}/> Audit
                  </Button>
                  {canRespond && issue.type !== 'Rating' && (
                    <Button onClick={() => onRespond(issue)}>
                      {issue.status === 'Responded' ? 'Edit' : 'Respond'}
                    </Button>
                  )}
                  {isReviewer && issue.type !== 'Rating' && (
                    <Button kind="light" onClick={() => onVerify(issue)} title="Verify corrective action and award 15-pt credit">
                      <Award size={13}/> Verify
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditModal({ issue, token, isReviewer, onClose, onRefresh, onRespond, setToast, setError }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [togglingSafety, setTogglingSafety] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/manager/issues/${issue.id}`, token);
      setDetail(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [issue.id, token, setError]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleVerify(e) {
    e.preventDefault();
    if (!verifyNotes.trim()) {
      setError('Please provide verification notes.');
      return;
    }
    setSubmittingVerify(true);
    try {
      await api(`/manager/issues/${issue.id}/verify-resolution`, token, {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: verifyNotes.trim() })
      });
      setToast('Resolution verified! 15 point credit applied.');
      setVerifyNotes('');
      await loadDetail();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmittingVerify(false);
    }
  }

  async function handleToggleSafety() {
    setTogglingSafety(true);
    const nextState = !detail?.is_food_safety_hazard;
    try {
      await api(`/manager/issues/${issue.id}/override-safety`, token, {
        method: 'POST',
        body: JSON.stringify({
          is_safety_hazard: nextState,
          reason: nextState ? 'Urgent food safety hazard flagged by reviewer/manager' : 'Safety hazard cleared upon inspection'
        })
      });
      setToast(nextState ? 'Flagged as urgent safety hazard (Escalated).' : 'Safety hazard cleared.');
      await loadDetail();
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setTogglingSafety(false);
    }
  }

  const d = detail || issue;
  const W = d.recurrence_score ?? 0;
  const D = d.delay_score ?? 0;
  const C = d.resolution_credits ?? 0;
  const R = d.risk_score ?? 0;
  const level = d.risk_level || 'LOW';

  return (
    <Modal title={`Risk Score Audit: #${d.id} · ${d.title}`} onClose={onClose}>
      <div className="issue-context">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="eyebrow">{d.meal_id?.toUpperCase()} · {shortDate(d.service_date)}</span>
          <RiskBadge issue={d}/>
        </div>
        <h3>{d.title}</h3>
        <p>{d.summary}</p>
        <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '11px', color: 'var(--muted)' }}>
          <span><strong>Category:</strong> {d.category || 'General'}</span>
          <span><strong>AI Confidence:</strong> {Math.round((d.confidence || 0.9) * 100)}%</span>
          <span><strong>Total Reports:</strong> {d.count || 1}</span>
        </div>
      </div>

      <div className="formula-card">
        <div className="formula-header">DETERMINISTIC RISK SCORE FORMULA</div>
        <div className="formula-math">
          R = max(0, min(100, W + D - C)) = {R} / 100 ({level})
        </div>
        <div className="breakdown-row">
          <div className="breakdown-label">
            <span>Recurrence points (W)</span>
            <small>min(45, 15 × (N - 1)) where N = {d.distinct_weeks || 1} distinct weeks</small>
          </div>
          <span className="breakdown-value" style={{ color: W > 0 ? 'var(--red)' : 'inherit' }}>+{W} pts</span>
        </div>
        <div className="breakdown-row">
          <div className="breakdown-label">
            <span>Missed deadline delay penalty (D)</span>
            <small>min(30, 10 + 5 ⌊T/24⌋) after 24h missed</small>
          </div>
          <span className="breakdown-value" style={{ color: D > 0 ? 'var(--red)' : 'inherit' }}>+{D} pts</span>
        </div>
        <div className="breakdown-row">
          <div className="breakdown-label">
            <span>Verified resolution credits (C)</span>
            <small>15 pts awarded per reviewer verification / positive rating</small>
          </div>
          <span className="breakdown-value" style={{ color: C > 0 ? 'var(--green)' : 'inherit' }}>-{C} pts</span>
        </div>
        <div className="breakdown-row" style={{ fontWeight: 800 }}>
          <span>Calculated Risk Level</span>
          <span className={`risk-badge risk-badge-${level.toLowerCase()}`}>{level}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-box"><RefreshCw className="spin" size={16}/> Loading audit history…</div>
      ) : (
        <>
          <div style={{ marginTop: '14px' }}>
            <strong>Calendar Week Distribution ({detail?.weeks?.length || 0})</strong>
            <div className="audit-list">
              {detail?.weeks?.map(w => (
                <div key={w.week_key} className="audit-item">
                  <div className="audit-item-top">
                    <span>Week {w.week_key}</span>
                    <span>{w.complaint_count} complaint(s)</span>
                  </div>
                  <small className="small-muted">Average meal rating during week: {w.avg_rating ? w.avg_rating.toFixed(1) : '—'} / 5</small>
                </div>
              ))}
              {!detail?.weeks?.length && <small className="small-muted">No week records found.</small>}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <strong>Response Cycles &amp; Deadlines ({detail?.cycles?.length || 0})</strong>
            <div className="audit-list">
              {detail?.cycles?.map(cyc => (
                <div key={cyc.id || cyc.cycle_number} className="audit-item">
                  <div className="audit-item-top">
                    <span>Cycle #{cyc.cycle_number} — <Status value={cyc.status}/></span>
                    {cyc.delay_hours > 0 && <span style={{ color: 'var(--red)' }}>{cyc.delay_hours}h Overdue</span>}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--muted)' }}>
                    <span>Deadline: {shortDate(cyc.deadline)}</span>
                    {cyc.responded_at && <span> · Responded: {shortDate(cyc.responded_at)}</span>}
                  </div>
                </div>
              ))}
              {!detail?.cycles?.length && <small className="small-muted">No response cycles recorded.</small>}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <strong>Verified Resolutions &amp; Credits ({detail?.resolutions?.length || 0})</strong>
            <div className="audit-list">
              {detail?.resolutions?.map(res => (
                <div key={res.id} className="audit-item">
                  <div className="audit-item-top">
                    <span style={{ color: 'var(--green)' }}>✓ {res.trigger_type} ({res.points_reduced} pts)</span>
                    <small>{shortDate(res.verified_at)}</small>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '10px' }}>{res.notes}</p>
                  <small className="small-muted">Verified by: {res.reviewer_name}</small>
                </div>
              ))}
              {!detail?.resolutions?.length && <small className="small-muted">No verified resolution credits applied yet.</small>}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <strong>Active Inspection Escalations ({detail?.escalations?.length || 0})</strong>
            <div className="audit-list">
              {detail?.escalations?.map(esc => (
                <div key={esc.id} className="audit-item" style={{ borderColor: esc.status === 'ACTIVE' ? 'var(--red)' : 'var(--line)' }}>
                  <div className="audit-item-top">
                    <span style={{ color: esc.status === 'ACTIVE' ? 'var(--red)' : 'var(--green)' }}>
                      {esc.status === 'ACTIVE' ? '🚨 ACTIVE ESCALATION' : '✓ RESOLVED'}
                    </span>
                    <small>{shortDate(esc.created_at)}</small>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '10px' }}>{esc.trigger_reason}</p>
                </div>
              ))}
              {!detail?.escalations?.length && <small className="small-muted">No escalations on this issue.</small>}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--green)' }}/>
              <strong>Anonymized Student Feedback ({detail?.complaints?.length || 0})</strong>
            </div>
            <div className="audit-list">
              {detail?.complaints?.map(comp => (
                <div key={comp.id} className="audit-item">
                  <div className="audit-item-top">
                    <span className="small-muted">Report #{comp.id}</span>
                    <span className="small-muted">{shortDate(comp.created_at)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', fontStyle: 'italic' }}>
                    &ldquo;{comp.complaint_text}&rdquo;
                  </p>
                </div>
              ))}
              {!detail?.complaints?.length && <small className="small-muted">No feedback texts linked.</small>}
            </div>
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Safety Hazard Override</strong>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
                  Food safety hazards immediately trigger high-priority inspection regardless of score.
                </p>
              </div>
              <Button onClick={handleToggleSafety} disabled={togglingSafety}>
                <Flame size={14}/>
                {detail?.is_food_safety_hazard ? 'Clear Safety Hazard' : 'Flag Safety Hazard'}
              </Button>
            </div>

            {isReviewer && (
              <form onSubmit={handleVerify} style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span className="eyebrow" style={{ color: '#6d28d9' }}>REVIEWER ACTION: VERIFY RESOLUTION</span>
                <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '4px 0 8px' }}>
                  Verify that the kitchen staff corrected this issue. Awards 15 credit points and recalculates risk.
                </p>
                <textarea
                  rows="2"
                  value={verifyNotes}
                  onChange={e => setVerifyNotes(e.target.value)}
                  placeholder="Enter physical inspection or kitchen verification notes…"
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '11px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <Button kind="primary" disabled={submittingVerify || !verifyNotes.trim()}>
                    <CheckCheck size={14}/> Verify Resolution (-15 pts)
                  </Button>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      <div className="form-footer" style={{ marginTop: '16px' }}>
        <Button onClick={onClose}>Close</Button>
        <Button kind="primary" onClick={() => { onClose(); onRespond(issue); }}>
          <Send size={14}/> Respond to Issue
        </Button>
      </div>
    </Modal>
  );
}

function EscalationsView({ escalations, loading, onRefresh, isReviewer, onAudit, onCloseEscalation }) {
  const activeList = escalations.filter(e => e.status === 'ACTIVE');
  const resolvedList = escalations.filter(e => e.status !== 'ACTIVE');

  return (
    <>
      <div className="notice-box" style={{ borderColor: activeList.length ? '#ef4444' : 'var(--line)', background: activeList.length ? '#fef2f2' : 'var(--surface)' }}>
        <AlertOctagon size={20} style={{ color: activeList.length ? '#dc2626' : 'var(--green)' }}/>
        <div>
          <strong style={{ color: activeList.length ? '#991b1b' : 'var(--text)' }}>
            {activeList.length} Active Inspection Escalation{activeList.length === 1 ? '' : 's'}
          </strong>
          <span>
            Issues with risk scores ≥ 60 (HIGH or CRITICAL) or flagged as Food Safety Hazards are automatically escalated for formal review.
          </span>
        </div>
      </div>

      <div style={{ marginTop: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2>Active Escalations Requiring Action</h2>
          <Button onClick={onRefresh}><RefreshCw size={13}/> Refresh</Button>
        </div>

        {!activeList.length && (
          <div className="empty-state">
            <CheckCircle2 size={24}/>
            <strong>No active escalations</strong>
            <span>All recurring complaints and food safety standards are within acceptable thresholds.</span>
          </div>
        )}

        <div className="escalation-grid">
          {activeList.map(esc => (
            <article key={esc.id} className="escalation-card active-escalation">
              <div className="escalation-card-head">
                <div>
                  <span className="eyebrow" style={{ color: 'var(--red)' }}>
                    {esc.meal_id?.toUpperCase()} · {shortDate(esc.service_date)}
                  </span>
                  <h3 style={{ margin: '4px 0' }}>{esc.title}</h3>
                </div>
                <span className={`risk-badge risk-badge-${(esc.risk_level || 'HIGH').toLowerCase()}`}>
                  Score {esc.risk_score} · {esc.risk_level}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                <strong>Trigger:</strong> {esc.trigger_reason}
              </p>
              <small className="small-muted">
                Escalated at: {new Date(esc.created_at).toLocaleString('en-IN')}
              </small>
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                <Button kind="secondary" onClick={() => onAudit({ id: esc.group_id, title: esc.title, meal_id: esc.meal_id })}>
                  <Info size={13}/> View Breakdown
                </Button>
                {isReviewer ? (
                  <Button kind="primary" onClick={() => onCloseEscalation(esc)}>
                    <CheckCircle2 size={13}/> Close Escalation
                  </Button>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={12}/> Reviewer resolution required
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {resolvedList.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h2>Resolved Escalation History</h2>
          <div className="table-wrap" style={{ marginTop: '10px' }}>
            <table>
              <thead>
                <tr>
                  <th>Meal / Date</th>
                  <th>Issue Title</th>
                  <th>Trigger Reason</th>
                  <th>Escalated At</th>
                  <th>Closed At</th>
                  <th>Resolution Notes</th>
                </tr>
              </thead>
              <tbody>
                {resolvedList.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.meal_id}</strong><small>{shortDate(r.service_date)}</small></td>
                    <td><strong>{r.title}</strong></td>
                    <td><small>{r.trigger_reason}</small></td>
                    <td><small>{shortDate(r.created_at)}</small></td>
                    <td><small>{shortDate(r.closed_at)}</small></td>
                    <td><small>{r.resolution_notes || 'Resolved upon review'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function App({ embeddedSession, onEmbeddedLogout } = {}) {
  const [session, setSession] = useState(() => embeddedSession || readSession());
  const [feedbackData, setFeedbackData] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('messmate_manager_theme') || 'light');
  const [active, setActive] = useState('dashboard');
  const [overview, setOverview] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [menu, setMenu] = useState([]);
  const [menuDate, setMenuDate] = useState(dateISO());
  const [menuDietary, setMenuDietary] = useState('non_veg');

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [mealFilter, setMealFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tabFilter, setTabFilter] = useState('all');

  const [modal, setModal] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [menuForm, setMenuForm] = useState({ name: '', description: '', dietary_type: 'Veg', meal_id: 'breakfast' });

  const token = session?.token;
  const isReviewer = session?.user?.role === 'reviewer';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('messmate_manager_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const loadOverview = useCallback(async (showLoader = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [data, feedback, esc] = await Promise.all([
        api('/manager/overview', token),
        api('/manager/feedback', token),
        api('/manager/escalations', token).catch(() => ({ items: [] }))
      ]);
      setOverview(data);
      setFeedbackData(feedback.items || []);
      setEscalations(esc.items || []);
    } catch (e) {
      setError(e.message);
      if (/sign in|session/i.test(e.message)) {
        localStorage.removeItem(STORE_KEY);
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMenu = useCallback(async (date = menuDate, diet = menuDietary) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/manager/menu?menu_date=${encodeURIComponent(date)}&dietary=${encodeURIComponent(diet)}`, token);
      setMenu(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, menuDate, menuDietary]);

  useEffect(() => {
    if (token) loadOverview();
  }, [token, loadOverview]);

  useEffect(() => {
    if (!token) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadOverview(false);
    };
    const interval = setInterval(refreshWhenVisible, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [token, loadOverview]);

  useEffect(() => {
    if (token && active === 'menu') loadMenu(menuDate, menuDietary);
  }, [token, active, menuDate, menuDietary, loadMenu]);

  async function triggerAI() {
    try {
      await api('/manager/ai/trigger', token, { method: 'POST' });
      setToast('AI background analysis queued.');
      setTimeout(() => loadOverview(false), 1500);
    } catch (e) {
      setError(e.message);
    }
  }

  async function login(identifier, password) {
    setBusy(true);
    setLoginError('');
    try {
      const data = await api('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ identifier, password, role: 'manager' })
      });
      setSession(data);
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      setTheme(data.user?.theme || theme);
      setToast(`Signed in as ${data.user?.name || 'Administrator'}.`);
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { if (token) await api('/auth/logout', token, { method: 'POST' }); } catch {}
    localStorage.removeItem(STORE_KEY);
    setSession(null);
    setOverview(null);
    setMenu([]);
    setEscalations([]);
    onEmbeddedLogout?.();
  }

  async function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (token) api('/profile/theme', token, { method: 'PUT', body: JSON.stringify({ theme: next }) }).catch(() => {});
  }

  async function saveResponse(issue) {
    if (responseText.trim().length < 3) {
      setError('Please enter a response before submitting.');
      return;
    }
    try {
      await api(`/manager/issues/${issue.id}/respond`, token, {
        method: 'POST',
        body: JSON.stringify({ response: responseText.trim() })
      });
      setModal(null);
      setResponseText('');
      setToast('Manager response saved and delay timer stopped.');
      await loadOverview(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCloseEscalation(esc) {
    setModal({ type: 'close_escalation', escalation: esc });
    setCloseNotes('');
  }

  async function submitCloseEscalation(e) {
    e.preventDefault();
    if (!closeNotes.trim()) {
      setError('Please provide resolution notes.');
      return;
    }
    try {
      await api(`/manager/escalations/${modal.escalation.id}/close`, token, {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: closeNotes.trim() })
      });
      setModal(null);
      setToast('Escalation closed successfully.');
      await loadOverview(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveMenuItem(e) {
    e.preventDefault();
    try {
      await api('/manager/menu', token, {
        method: 'POST',
        body: JSON.stringify({ ...menuForm, menu_date: menuDate, id: modal?.item?.id || null })
      });
      setModal(null);
      setToast('Menu item saved.');
      await loadMenu(menuDate, menuDietary);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteMenuItem(item) {
    if (!window.confirm(`Remove “${item.name}” from this date's menu?`)) return;
    try {
      await api(`/manager/menu/${item.id}`, token, { method: 'DELETE' });
      setToast('Menu item removed.');
      await loadMenu(menuDate, menuDietary);
    } catch (e) {
      setError(e.message);
    }
  }

  const issues = overview?.issues || [];
  const activeEscalationsCount = escalations.filter(e => e.status === 'ACTIVE').length;

  const filteredIssues = useMemo(() => {
    const source = active === 'feedback' ? feedbackData : issues;
    return source.filter(i => {
      const q = search.toLowerCase();
      const tabMatch = active !== 'feedback' || tabFilter === 'all' || (tabFilter === 'ratings' ? i.type === 'Rating' : i.type !== 'Rating');
      const statusMatch = i.type === 'Rating' ? statusFilter === 'all' : (statusFilter === 'all' || (statusFilter === 'open' ? i.status !== 'Responded' : i.status === 'Responded'));
      return tabMatch && (mealFilter === 'all' || i.meal_id === mealFilter) && statusMatch && [i.title, i.summary, i.meal_id, i.status, i.category].join(' ').toLowerCase().includes(q);
    });
  }, [active, feedbackData, issues, search, mealFilter, statusFilter, tabFilter]);

  const openIssues = issues.filter(i => i.status !== 'Responded');
  const totalRatings = overview?.total_ratings || 0;
  const totalComplaints = overview?.total_complaints || 0;

  const avgRating = useMemo(() => {
    const rs = Object.values(overview?.meal_ratings || {});
    const count = rs.reduce((n, r) => n + (r.count || 0), 0);
    return count ? (rs.reduce((n, r) => n + r.average * r.count, 0) / count).toFixed(1) : '—';
  }, [overview]);

  const responseRate = issues.length ? Math.round(issues.filter(i => i.status === 'Responded').length / issues.length * 100) : 100;

  function respond(issue) {
    setResponseText(issue.response || '');
    setModal({ type: 'response', issue });
  }

  function openAudit(issue) {
    setModal({ type: 'audit', issue });
  }

  function openVerify(issue) {
    setModal({ type: 'audit', issue });
  }

  function exportCSV() {
    const rows = [
      ['Meal', 'Date', 'Issue', 'Summary', 'Category', 'Risk Score', 'Risk Level', 'Reports', 'Status', 'Deadline', 'Manager response'],
      ...issues.map(i => [
        i.meal_id, i.service_date, i.title, i.summary, i.category || '', i.risk_score ?? 0, i.risk_level || 'LOW', i.count, i.status, i.deadline, i.response || ''
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'messmate-risk-and-feedback-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    setToast('Report exported as CSV.');
  }

  if (!token) return <Login onLogin={login} error={loginError} busy={busy}/>;

  const title = NAV.find(x => x[0] === active)?.[1] || 'Dashboard';

  return (
    <div className="manager-app">
      <aside className="sidebar">
        <Brand/>
        <div className="side-label">WORKSPACE</div>
        <nav>
          {NAV.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${active === id ? 'active' : ''}`}
              onClick={() => { setActive(id); setError(''); }}
            >
              <Icon size={17}/>
              <span>{label}</span>
              {id === 'escalations' && activeEscalationsCount > 0 && (
                <small className="nav-count" style={{ background: 'var(--red)' }}>{activeEscalationsCount}</small>
              )}
              {id === 'responses' && openIssues.length > 0 && (
                <small className="nav-count">{openIssues.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={18}/>
            <strong>Student privacy protected</strong>
            <p>Issues are grouped by topic and meal. Individual student identities are protected.</p>
          </div>
          <div className="profile-row">
            <span className="avatar">{initials(session.user?.name)}</span>
            <div className="profile-copy">
              <strong>{session.user?.name || 'Mess Manager'}</strong>
              <small className={`role-pill ${isReviewer ? 'reviewer' : 'manager'}`} style={{ width: 'fit-content', marginTop: '2px' }}>
                {isReviewer ? 'Hostel Warden' : 'Mess Manager'}
              </small>
            </div>
            <button className="icon-plain" onClick={logout} title="Sign out"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-symbol"><Utensils size={17}/></span>
            <strong>MessMate</strong>
          </div>
          <div className="breadcrumb">
            MANAGER WORKSPACE <ChevronRight size={13}/>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="date-chip"><CalendarDays size={15}/>{dateLabel()}</span>
            <button className="icon-button" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
            </button>
            <span className="avatar">{initials(session.user?.name)}</span>
          </div>
        </header>

        <section className="page-content">
          {error && (
            <div className="alert-banner">
              <CircleAlert size={17}/>
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss"><X size={15}/></button>
            </div>
          )}

          <div className="page-heading">
            <div>
              <span className="eyebrow">{active === 'dashboard' ? 'MESS FEEDBACK OVERVIEW &amp; RISK SCORE ENGINE' : 'MANAGER WORKSPACE'}</span>
              <h1>{title}</h1>
              <p>
                {({
                  dashboard: 'Overview of mess feedback, food quality, and deterministic risk score engine.',
                  escalations: 'Monitor and inspect high-risk issues (score ≥ 60) and food safety hazards.',
                  menu: 'Official Anna University CEG weekly schedule with customizable overrides.',
                  feedback: 'View and manage student feedback without revealing individual submitters.',
                  insights: 'Patterns and recurring issues grouped by fast Gemini intelligence.',
                  responses: 'Manage and respond to student complaints within the 24-hour window.',
                  reports: 'Review and export comprehensive meal feedback and risk reports.',
                  settings: 'Manage your appearance and account preferences.'
                })[active]}
              </p>
            </div>
            <div className="heading-actions">
              <Button onClick={() => active === 'menu' ? loadMenu(menuDate) : loadOverview()}>
                <RefreshCw size={15}/> Refresh
              </Button>
              {active === 'reports' && (
                <Button kind="primary" onClick={exportCSV}><Download size={15}/> Export CSV</Button>
              )}
            </div>
          </div>

          {loading && !overview && active !== 'menu' && (
            <div className="loading-box"><RefreshCw className="spin" size={20}/> Loading manager data…</div>
          )}

          {active === 'dashboard' && (
            <Dashboard
              overview={overview}
              issues={issues}
              openIssues={openIssues}
              avgRating={avgRating}
              totalRatings={totalRatings}
              totalComplaints={totalComplaints}
              responseRate={responseRate}
              activeEscalationsCount={activeEscalationsCount}
              navigate={setActive}
              respond={respond}
              onAudit={openAudit}
              onVerify={openVerify}
              isReviewer={isReviewer}
              onTriggerAI={triggerAI}
            />
          )}

          {active === 'escalations' && (
            <EscalationsView
              escalations={escalations}
              loading={loading}
              onRefresh={() => loadOverview(false)}
              isReviewer={isReviewer}
              onAudit={openAudit}
              onCloseEscalation={handleCloseEscalation}
            />
          )}

          {active === 'menu' && (
            <MenuManagement
              menu={menu}
              menuDate={menuDate}
              setMenuDate={setMenuDate}
              menuDietary={menuDietary}
              setMenuDietary={d => { setMenuDietary(d); loadMenu(menuDate, d); }}
              onAdd={() => {
                setMenuForm({ name: '', description: '', dietary_type: menuDietary === 'veg' ? 'Veg' : 'Non-Veg', meal_id: 'breakfast' });
                setModal({ type: 'menu' });
              }}
              onEdit={item => {
                setMenuForm({ id: item.id || null, name: item.name || '', description: item.description || '', dietary_type: item.dietary_type || 'Veg', meal_id: item.meal_id || 'breakfast' });
                setModal({ type: 'menu', item });
              }}
              onDelete={deleteMenuItem}
            />
          )}

          {active === 'feedback' && (
            <IssueList
              issues={filteredIssues}
              search={search}
              setSearch={setSearch}
              mealFilter={mealFilter}
              setMealFilter={setMealFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              tabFilter={tabFilter}
              setTabFilter={setTabFilter}
              respond={respond}
              onAudit={openAudit}
              onVerify={openVerify}
              isReviewer={isReviewer}
            />
          )}

          {active === 'insights' && (
            <Insights
              issues={issues}
              aiStatus={overview?.ai_status}
              riskSummary={overview?.risk_summary}
              onTriggerAI={triggerAI}
              navigate={setActive}
            />
          )}

          {active === 'responses' && (
            <IssueList
              issues={filteredIssues.filter(i => i.status !== 'Responded')}
              search={search}
              setSearch={setSearch}
              mealFilter={mealFilter}
              setMealFilter={setMealFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              tabFilter="all"
              setTabFilter={setTabFilter}
              respond={respond}
              onAudit={openAudit}
              onVerify={openVerify}
              isReviewer={isReviewer}
              responseView
            />
          )}

          {active === 'reports' && (
            <Reports
              overview={overview}
              issues={issues}
              avgRating={avgRating}
              responseRate={responseRate}
              exportCSV={exportCSV}
              onAudit={openAudit}
            />
          )}

          {active === 'settings' && (
            <SettingsPanel theme={theme} toggleTheme={toggleTheme} user={session.user}/>
          )}
        </section>

        <footer className="app-footer">
          <span>MESSMATE <b>·</b> WEBAPP MANAGEMENT &amp; RISK ENGINE</span>
          <span>Privacy-first mess feedback management</span>
        </footer>
      </main>

      <nav className="mobile-nav">
        {NAV.filter(([id]) => ['dashboard', 'escalations', 'menu', 'feedback', 'responses'].includes(id)).map(([id, label, Icon]) => (
          <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
            <Icon size={18}/>
            <span>{label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {modal?.type === 'response' && (
        <Modal title="Respond to complaint" onClose={() => setModal(null)}>
          <div className="issue-context">
            <span className="eyebrow">{modal.issue.meal_id?.toUpperCase()} · {shortDate(modal.issue.service_date)}</span>
            <h3>{modal.issue.title}</h3>
            <p>{modal.issue.summary}</p>
            <div className="context-count">
              <Users size={15}/> Consolidated from <strong>{modal.issue.count}</strong> report(s). Individual names are hidden.
            </div>
          </div>
          <form className="modal-form" onSubmit={e => { e.preventDefault(); saveResponse(modal.issue); }}>
            <label htmlFor="response-text">Manager response / corrective action</label>
            <textarea
              id="response-text"
              rows="5"
              maxLength="1500"
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Explain what action will be taken to resolve this problem…"
              required
            />
            <div className="form-footer">
              <small>{responseText.length}/1500 characters</small>
              <Button kind="primary" disabled={responseText.trim().length < 3}>
                <Send size={15}/> Save response
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'close_escalation' && (
        <Modal title="Close Inspection Escalation" onClose={() => setModal(null)}>
          <div className="issue-context">
            <span className="eyebrow" style={{ color: 'var(--red)' }}>ESCALATION #{modal.escalation.id}</span>
            <h3>{modal.escalation.title}</h3>
            <p><strong>Trigger reason:</strong> {modal.escalation.trigger_reason}</p>
          </div>
          <form className="modal-form" onSubmit={submitCloseEscalation}>
            <label htmlFor="close-notes">Resolution inspection notes</label>
            <textarea
              id="close-notes"
              rows="4"
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="Document the kitchen audit, corrective measures verified, or reason for closing…"
              required
            />
            <div className="form-footer">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <Button kind="primary" disabled={!closeNotes.trim()}>
                <CheckCircle2 size={15}/> Confirm &amp; Close Escalation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'audit' && (
        <AuditModal
          issue={modal.issue}
          token={token}
          isReviewer={isReviewer}
          onClose={() => setModal(null)}
          onRefresh={() => loadOverview(false)}
          onRespond={respond}
          setToast={setToast}
          setError={setError}
        />
      )}

      {modal?.type === 'menu' && (
        <Modal title={modal.item?.id ? 'Edit menu item' : 'Add menu item'} onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={saveMenuItem}>
            <label>Meal
              <select value={menuForm.meal_id} onChange={e => setMenuForm({ ...menuForm, meal_id: e.target.value })}>
                {MEALS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label>Item name
              <input value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} required maxLength="120"/>
            </label>
            <label>Description
              <input value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} maxLength="250"/>
            </label>
            <label>Food type
              <select value={menuForm.dietary_type} onChange={e => setMenuForm({ ...menuForm, dietary_type: e.target.value })}>
                <option>Veg</option>
                <option>Non-Veg</option>
                <option>Vegan</option>
              </select>
            </label>
            <div className="form-footer">
              <small>Menu date: {menuDate}</small>
              <Button kind="primary"><Check size={15}/> Save item</Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17}/>
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button>
        </div>
      )}
    </div>
  );
}

function Dashboard({ overview, issues, openIssues, avgRating, totalRatings, totalComplaints, responseRate, activeEscalationsCount, navigate, respond, onAudit, onVerify, isReviewer, onTriggerAI }) {
  const ratings = overview?.meal_ratings || {};
  const maxRating = Math.max(5, ...Object.values(ratings).map(x => x.average || 0));
  const riskSummary = overview?.risk_summary || { low: 0, medium: 0, high: 0, critical: 0, active_escalations: 0 };
  const highRiskCount = (riskSummary.high || 0) + (riskSummary.critical || 0);

  // Sort open issues by risk score descending
  const prioritizedIssues = [...openIssues].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

  return (
    <div className="dashboard-content">
      <section className="hero-panel">
        <div>
          <span className="hero-kicker"><Activity size={14}/> DINING OPERATIONS &amp; RISK MONITORING</span>
          <h2>Deterministic Risk Scoring.<br/><em>Data-driven kitchen follow-ups.</em></h2>
          <p>Recurring issues earn recurrence points over distinct calendar weeks, response delays accumulate penalties, and verified actions restore score balance.</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button kind="light" onClick={() => navigate('escalations')}>
              <AlertOctagon size={15}/> View Escalations ({activeEscalationsCount})
            </Button>
            <Button kind="secondary" onClick={() => navigate('feedback')}>
              Review Feedback <ChevronRight size={15}/>
            </Button>
          </div>
        </div>
        <div className="hero-stat">
          <span>ACTIVE ESCALATIONS</span>
          <strong style={{ color: activeEscalationsCount > 0 ? '#fca5a5' : '#fff' }}>{activeEscalationsCount}</strong>
          <small>{openIssues.length} open issue group(s)</small>
          <div className="hero-bars">
            {[26, 42, 33, 58, 48, 75, 63, 92].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }}/>
            ))}
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <Metric
          label="Total feedback"
          value={totalRatings + totalComplaints}
          note="Ratings &amp; complaints"
          icon={MessageSquare}
        />
        <Metric
          label="High / Critical Risk"
          value={highRiskCount}
          note={`${riskSummary.critical || 0} critical, ${riskSummary.high || 0} high`}
          icon={AlertTriangle}
          tone={highRiskCount > 0 ? 'tone-red' : ''}
        />
        <Metric
          label="Average rating"
          value={avgRating === '—' ? '—' : `${avgRating} / 5`}
          note="Across recorded ratings"
          icon={Star}
          tone="tone-gold"
        />
        <Metric
          label="Response rate"
          value={`${responseRate}%`}
          note={`${issues.filter(i => i.status === 'Responded').length} of ${issues.length} responded`}
          icon={CheckCircle2}
          tone="tone-green"
        />
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MEAL PERFORMANCE</span>
              <h2>Ratings by meal</h2>
            </div>
            <span className="small-muted">Today</span>
          </div>
          {MEALS.map(m => {
            const r = ratings[m.id] || {};
            return (
              <div className="rating-row" key={m.id}>
                <span className="rating-meal">{m.name}</span>
                <div className="rating-track">
                  <span style={{ width: `${(Number(r.average || 0) / maxRating) * 100}%` }}/>
                </div>
                <strong>{r.average ? Number(r.average).toFixed(1) : '—'}</strong>
                <small>{r.count || 0} ratings</small>
              </div>
            );
          })}
          <div className="panel-foot">
            <span>Ratings use submitted student feedback.</span>
            <button className="text-button" onClick={() => navigate('reports')}>View reports <ChevronRight size={14}/></button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RISK &amp; COMPLIANCE</span>
              <h2>High priority issues</h2>
            </div>
            <button className="text-button" onClick={() => navigate('responses')}>All open ({openIssues.length}) <ChevronRight size={14}/></button>
          </div>
          {prioritizedIssues.slice(0, 3).map(issue => (
            <div className="priority-row" key={issue.id}>
              <span className={`priority-icon ${issue.risk_score >= 60 ? 'tone-red' : ''}`}>
                {issue.risk_score >= 60 ? <AlertOctagon size={16}/> : <AlertTriangle size={16}/>}
              </span>
              <div className="priority-copy">
                <strong>{issue.title}</strong>
                <span>{issue.meal_id} · {issue.count} report(s) · {issue.distinct_weeks || 1} wk(s)</span>
              </div>
              <RiskBadge issue={issue} onClick={onAudit}/>
              <button className="icon-button small" onClick={() => respond(issue)} title="Respond"><ChevronRight size={16}/></button>
            </div>
          ))}
          {!openIssues.length && (
            <div className="empty-state">
              <CheckCircle2 size={24}/>
              <strong>All caught up</strong>
              <span>No open grouped issues at the moment.</span>
            </div>
          )}
          <Button onClick={() => navigate('insights')} style={{ marginTop: '12px' }}>
            <BrainCircuit size={15}/> View AI feedback trends
          </Button>
        </section>
      </div>

      <section className="panel issue-preview">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ANONYMISED FEEDBACK &amp; RISK AUDIT</span>
            <h2>Active recurring issues</h2>
          </div>
          <button className="text-button" onClick={() => navigate('feedback')}>View all <ChevronRight size={14}/></button>
        </div>
        <IssueTable
          issues={prioritizedIssues.slice(0, 6)}
          onRespond={respond}
          onAudit={onAudit}
          onVerify={onVerify}
          isReviewer={isReviewer}
        />
      </section>
    </div>
  );
}

function MenuManagement({ menu, menuDate, setMenuDate, menuDietary, setMenuDietary, onAdd, onEdit, onDelete }) {
  return (
    <>
      <div className="menu-toolbar">
        <div>
          <span className="eyebrow">CEG HOSTEL MENU SCHEDULE</span>
          <h2>Daily menu</h2>
          <p>Official Anna University CEG hostel weekly rotation with custom overrides.</p>
        </div>
        <div className="menu-actions">
          <div style={{ display: 'inline-flex', background: 'var(--card-bg, #eee)', padding: '2px', borderRadius: '8px', gap: '4px', marginRight: '8px' }}>
            <button
              type="button"
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                background: menuDietary === 'non_veg' ? '#e11d48' : 'transparent',
                color: menuDietary === 'non_veg' ? '#fff' : 'inherit'
              }}
              onClick={() => setMenuDietary('non_veg')}
            >
              🍗 Non-Veg
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                background: menuDietary === 'veg' ? '#16a34a' : 'transparent',
                color: menuDietary === 'veg' ? '#fff' : 'inherit'
              }}
              onClick={() => setMenuDietary('veg')}
            >
              🥗 Pure Veg
            </button>
          </div>
          <input aria-label="Menu date" type="date" value={menuDate} onChange={e => setMenuDate(e.target.value)}/>
          <Button kind="primary" onClick={onAdd}><Plus size={15}/> Add item</Button>
        </div>
      </div>
      <div className="meal-admin-grid">
        {MEALS.map(meal => {
          const items = menu.filter(i => i.meal_id === meal.id);
          const Icon = meal.icon;
          return (
            <article className="meal-admin-card" key={meal.id}>
              <div className="meal-admin-head">
                <span className="meal-admin-icon"><Icon size={18}/></span>
                <span className="eyebrow">{meal.time}</span>
              </div>
              <h3>{meal.name}</h3>
              {items.length ? (
                <div className="menu-item-list">
                  {items.map(item => (
                    <div key={item.id}>
                      <span className="menu-item-copy">
                        <strong>{item.name}</strong>
                        {item.description && <small>{item.description}</small>}
                        <em className={`diet diet-${(item.dietary_type || 'veg').toLowerCase().replace('-', '')}`}>
                          {item.dietary_type || 'Veg'}
                        </em>
                      </span>
                      <span className="item-actions">
                        <button onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><Pencil size={14}/></button>
                        <button onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`}><Trash2 size={14}/></button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-menu">No items recorded for this meal.</div>
              )}
              <Button onClick={() => onEdit({ meal_id: meal.id })}>
                <Plus size={14}/> Add to {meal.name}
              </Button>
            </article>
          );
        })}
      </div>
      <div className="notice-box">
        <CircleAlert size={17}/>
        <div>
          <strong>CEG Hostels Official Menu Active</strong>
          <span>Menu is loaded directly from official CEG hostel Vegetarian &amp; Non-Vegetarian circular (15-09-2026 to 31-01-2027). Custom items added here override the defaults.</span>
        </div>
      </div>
    </>
  );
}

function IssueList({ issues, search, setSearch, mealFilter, setMealFilter, statusFilter, setStatusFilter, tabFilter, setTabFilter, respond, onAudit, onVerify, isReviewer = false, responseView = false }) {
  return (
    <>
      <div className="privacy-banner">
        <span><ShieldCheck size={21}/></span>
        <div>
          <strong>Student identities are hidden</strong>
          <small>Issues are consolidated by recurring topic and meal with deterministic risk scoring. Individual student submitters are never shown.</small>
        </div>
      </div>
      <div className="filter-tabs">
        {[['all', 'All'], ['complaints', 'Complaints'], ['ratings', 'Ratings']].map(([id, label]) => (
          <button key={id} className={tabFilter === id ? 'selected' : ''} onClick={() => setTabFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="filter-toolbar">
        <label className="search-box">
          <Search size={16}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by keyword, category, or meal…"/>
        </label>
        <label className="select-filter">
          <Filter size={14}/>
          <select value={mealFilter} onChange={e => setMealFilter(e.target.value)}>
            <option value="all">All meals</option>
            {MEALS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="select-filter">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="responded">Responded</option>
          </select>
        </label>
      </div>
      <div className="list-summary">
        <strong>{issues.length} grouped issue{issues.length === 1 ? '' : 's'}</strong>
        <span>{responseView ? 'Open issues requiring manager action' : 'Click "Audit" or any Risk Badge to view the full score formula'}</span>
      </div>
      <section className="panel">
        <IssueTable
          issues={issues}
          onRespond={respond}
          onAudit={onAudit}
          onVerify={onVerify}
          isReviewer={isReviewer}
        />
      </section>
    </>
  );
}

function Insights({ issues, aiStatus, riskSummary, onTriggerAI, navigate }) {
  const total = issues.reduce((n, x) => n + Number(x.count || 0), 0);
  const sorted = [...issues].sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
  const words = [...new Set(issues.flatMap(i => `${i.title} ${i.summary}`.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 4)))].slice(0, 16);
  const providerLabel = aiStatus?.provider === 'google-genai' ? `Google Gemini (${aiStatus.model})` : 'Deterministic Pattern Grouping';

  return (
    <>
      <section className="insight-banner">
        <span className="insight-symbol"><BrainCircuit size={24}/></span>
        <div>
          <span className="eyebrow">FAST GEMINI FEEDBACK INTELLIGENCE + RISK ENGINE</span>
          <h2>Actionable intelligence, not noisy complaint walls.</h2>
          <p>
            {total} reports organised into {issues.length} issues. Gemini Flash summarizes feedback in the background with zero student wait-time, while our deterministic backend calculates calendar recurrence and response delay penalties.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <small><span className="live-dot"/>{providerLabel} · student identities protected</small>
            <Button kind="light" onClick={onTriggerAI} disabled={aiStatus?.is_analyzing}>
              <RefreshCw className={aiStatus?.is_analyzing ? 'spin' : ''} size={14}/>
              {aiStatus?.is_analyzing ? 'Analyzing in background…' : 'Run Gemini Analysis'}
            </Button>
          </div>
        </div>
      </section>

      <div className="insight-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div>
          <span>Total reports</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>High / Critical Risk</span>
          <strong style={{ color: (riskSummary?.high || 0) + (riskSummary?.critical || 0) > 0 ? 'var(--red)' : 'inherit' }}>
            {(riskSummary?.high || 0) + (riskSummary?.critical || 0)}
          </strong>
        </div>
        <div>
          <span>Active Escalations</span>
          <strong style={{ color: (riskSummary?.active_escalations || 0) > 0 ? 'var(--red)' : 'inherit' }}>
            {riskSummary?.active_escalations || 0}
          </strong>
        </div>
        <div>
          <span>Pending AI Analysis</span>
          <strong>{aiStatus?.pending_count || 0}</strong>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MOST REPORTED</span>
              <h2>Issue frequency</h2>
            </div>
          </div>
          {sorted.map(issue => (
            <div className="frequency-row" key={issue.id}>
              <div>
                <strong>{issue.title}</strong>
                <small>{issue.meal_id} · {issue.count} report(s) · Score: {issue.risk_score ?? 0}</small>
              </div>
              <div className="frequency-track">
                <span style={{ width: `${Math.max(5, issue.count / Math.max(1, ...sorted.map(x => x.count)) * 100)}%` }}/>
              </div>
              <b>{issue.count}</b>
            </div>
          ))}
          {!issues.length && (
            <div className="empty-state">
              <BrainCircuit size={24}/>
              <strong>Insights will appear here</strong>
              <span>Grouped issues appear when feedback is submitted.</span>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RECURRING LANGUAGE</span>
              <h2>Common keywords</h2>
            </div>
          </div>
          <div className="keyword-cloud">
            {words.length ? words.map(w => <span key={w}>{w}</span>) : <small>No keywords yet.</small>}
          </div>
          <div className="privacy-note">
            <ShieldCheck size={16}/>
            <span>Summaries describe dining quality trends only. Individual students cannot be identified.</span>
          </div>
          <Button kind="primary" onClick={() => navigate('feedback')}>
            Review grouped issues <ChevronRight size={15}/>
          </Button>
        </section>
      </div>
    </>
  );
}

function Reports({ overview, issues, avgRating, responseRate, exportCSV, onAudit }) {
  const ratings = overview?.meal_ratings || {};
  return (
    <>
      <div className="metric-grid">
        <Metric label="Complaint reports" value={overview?.total_complaints || 0} note="Recorded for today" icon={MessageSquare}/>
        <Metric label="Ratings received" value={overview?.total_ratings || 0} note="Recorded for today" icon={Star} tone="tone-gold"/>
        <Metric label="Average rating" value={avgRating === '—' ? '—' : `${avgRating} / 5`} note="Weighted average" icon={BarChart3} tone="tone-green"/>
        <Metric label="Response completion" value={`${responseRate}%`} note="Issue groups responded to" icon={CheckCircle2}/>
      </div>
      <section className="panel report-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">REPORT EXPORT &amp; COMPLIANCE REGISTER</span>
            <h2>Issue and risk register</h2>
            <p>Export grouped issues, risk scores, recurrence weeks, and manager response cycles.</p>
          </div>
          <Button kind="primary" onClick={exportCSV}><Download size={15}/> Export CSV</Button>
        </div>
        <IssueTable issues={issues} onRespond={() => {}} onAudit={onAudit} canRespond={false}/>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">MEAL RATINGS</span>
            <h2>Rating summary</h2>
          </div>
        </div>
        {MEALS.map(m => (
          <div className="rating-row" key={m.id}>
            <span className="rating-meal">{m.name}</span>
            <div className="rating-track">
              <span style={{ width: `${Number(ratings[m.id]?.average || 0) * 20}%` }}/>
            </div>
            <strong>{ratings[m.id]?.average ?? '—'}</strong>
            <small>{ratings[m.id]?.count || 0} ratings</small>
          </div>
        ))}
      </section>
    </>
  );
}

function SettingsPanel({ theme, toggleTheme, user }) {
  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">APPEARANCE</span>
            <h2>Theme preferences</h2>
            <p>Choose the display that works best for your workspace.</p>
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-icon">{theme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}</span>
          <div className="setting-copy">
            <strong>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</strong>
            <small>Your theme preference is saved in this browser and to your account.</small>
          </div>
          <Button onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</Button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h2>User Profile &amp; Role</h2>
          </div>
        </div>
        <div className="account-detail">
          <span>Display name</span>
          <strong>{user?.name || 'Mess Manager'}</strong>
        </div>
        <div className="account-detail">
          <span>Login identifier</span>
          <strong>{user?.identifier || '—'}</strong>
        </div>
        <div className="account-detail">
          <span>Access level</span>
          <strong className={`role-pill ${user?.role === 'reviewer' ? 'reviewer' : 'manager'}`}>
            {user?.role === 'reviewer' ? 'Hostel Warden / Reviewer' : 'Mess Manager'}
          </strong>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PRIVACY &amp; DATA COMPLIANCE</span>
            <h2>Feedback privacy guarantee</h2>
          </div>
        </div>
        <div className="privacy-row">
          <ShieldCheck size={20}/>
          <div>
            <strong>Student names and registration numbers are hidden from management</strong>
            <p>
              The system groups student feedback by topic, meal, and date. Individual student identifiers are excluded from LLM prompts and management views to protect student anonymity.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
