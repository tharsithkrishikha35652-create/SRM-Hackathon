import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Clock3, MessageSquare, RefreshCw, ShieldCheck, Star } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const MEALS = [
  { id: 'all', label: 'All meals' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

function mondayOfWeek(value) {
  const date = new Date(`${value || new Date().toISOString().slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function getWeekLabel(value) {
  const start = mondayOfWeek(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const options = { day: '2-digit', month: 'short' };
  return `Week of ${start.toLocaleDateString('en-GB', options)} – ${end.toLocaleDateString('en-GB', options)}`;
}

export default function StudentFeedbackHistory({ token, view = 'feedback' }) {
  const [data, setData] = useState({ ratings: [], complaints: [] });
  const [mealFilter, setMealFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isResponsesView = view === 'responses';

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    fetch(`${API}/feedback/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || 'Your feedback could not be loaded.');
        return result;
      })
      .then(result => { if (live) setData({ ratings: result.ratings || [], complaints: result.complaints || [] }); })
      .catch(err => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token]);

  const entries = useMemo(() => [
    ...data.ratings.map(item => ({ ...item, type: 'rating', date: item.service_date })),
    ...data.complaints.map(item => ({ ...item, type: 'complaint', date: item.service_date })),
  ].sort((a, b) => `${b.date || ''}${b.created_at || ''}`.localeCompare(`${a.date || ''}${a.created_at || ''}`)), [data]);
  const availableDays = useMemo(() => [...new Set(entries.map(item => item.date).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [entries]);
  const filtered = entries.filter(item => {
    const matchesMeal = mealFilter === 'all' || item.meal_id === mealFilter;
    const matchesDay = dayFilter === 'all' || item.date === dayFilter;
    return matchesMeal && matchesDay;
  });
  const grouped = filtered.reduce((groups, item) => {
    const label = getWeekLabel(item.date);
    (groups[label] ||= []).push(item);
    return groups;
  }, {});
  const mealName = id => MEALS.find(meal => meal.id === id)?.label || id || 'Meal';
  const title = isResponsesView ? 'Manager responses' : 'Your previous feedback';

  return (
    <>
      <style>{`
        .student-history-page { display: flex; flex-direction: column; gap: 18px; }
        .student-history-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; padding: 22px 24px; border: 1px solid var(--line); border-radius: 24px; background: linear-gradient(135deg, var(--surface) 0%, rgba(223, 90, 44, 0.04) 100%); box-shadow: var(--shadow); }
        .student-history-heading h1 { margin: 8px 0 8px; font-size: clamp(28px, 3vw, 40px); letter-spacing: -0.06em; }
        .student-history-heading p { margin: 0; color: var(--muted); max-width: 55ch; }
        .student-history-count { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.75); border-radius: 999px; padding: 10px 14px; color: var(--text); font-size: 12px; font-weight: 800; }
        .student-history-count svg { color: var(--accent); }
        .student-history-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); }
        .student-history-toolbar-group { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
        .history-filter-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: var(--muted); }
        .history-filter-label svg { color: var(--accent); }
        .student-history-filters { display: flex; flex-wrap: wrap; gap: 8px; }
        .student-history-filters button { border: 1px solid transparent; background: var(--surface-2); color: var(--muted); border-radius: 999px; padding: 9px 13px; font-size: 11px; font-weight: 800; transition: 0.18s ease; }
        .student-history-filters button.active { background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); color: #fff; box-shadow: 0 10px 18px rgba(223,90,44,0.15); }
        .student-history-date-filter { min-width: 180px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); border-radius: 12px; padding: 9px 12px; font-size: 12px; font-weight: 700; }
        .notice, .loading-panel, .empty-state { border: 1px solid var(--line); background: var(--surface); border-radius: 18px; box-shadow: var(--shadow); }
        .notice { display: flex; align-items: center; gap: 10px; padding: 14px 16px; color: var(--text); font-size: 12px; font-weight: 700; }
        .notice svg { color: var(--accent); }
        .loading-panel { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: var(--muted); font-weight: 700; }
        .loading-panel .spin { animation: spin 1s linear infinite; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; padding: 40px 20px; }
        .empty-state > div { width: 58px; height: 58px; display: grid; place-items: center; border-radius: 18px; background: var(--accent-soft); color: var(--accent); }
        .empty-state h3 { margin: 0; font-size: clamp(20px, 2vw, 28px); }
        .empty-state p { margin: 0; color: var(--muted); max-width: 42ch; }
        .student-history-week { display: flex; flex-direction: column; gap: 14px; }
        .student-history-week-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 4px; }
        .student-history-week-heading h2 { margin: 0; font-size: 20px; letter-spacing: -0.05em; }
        .student-history-week-heading span { display: inline-flex; align-items: center; justify-content: center; padding: 8px 10px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .student-history-list { display: flex; flex-direction: column; gap: 14px; }
        .student-history-card { display: grid; grid-template-columns: 56px 1fr; gap: 16px; padding: 18px; border: 1px solid var(--line); background: linear-gradient(180deg, var(--surface) 0%, rgba(255,255,255,0.78) 100%); border-radius: 20px; box-shadow: var(--shadow); }
        .student-history-icon { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
        .student-history-icon.complaint { background: rgba(223, 90, 44, 0.08); }
        .student-history-entry { display: flex; flex-direction: column; gap: 10px; }
        .student-history-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; color: var(--muted); font-size: 11px; }
        .student-history-meta strong { color: var(--text); font-size: 13px; }
        .student-history-meta span { display: inline-flex; align-items: center; gap: 6px; }
        .student-history-type { padding: 6px 9px; border-radius: 999px; font-weight: 800; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
        .student-history-type.rating { background: rgba(54,123,88,.10); color: var(--green); }
        .student-history-type.complaint { background: rgba(223,90,44,.10); color: var(--accent); }
        .student-history-entry h3 { margin: 0; font-size: clamp(18px, 2vw, 24px); letter-spacing: -0.05em; }
        .student-history-stars { display: flex; align-items: center; gap: 4px; color: var(--accent); }
        .student-history-entry p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .student-manager-response { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line); background: rgba(231,239,234,0.55); }
        .student-manager-response svg { color: var(--green); margin-top: 2px; }
        .student-manager-response strong { display: block; margin-bottom: 4px; font-size: 12px; }
        .student-manager-response span { display: block; color: var(--muted); font-size: 12px; line-height: 1.5; }
        .student-manager-response.awaiting-response { background: rgba(223,90,44,0.04); border-color: rgba(223,90,44,0.12); }
        .student-manager-response.awaiting-response svg { color: var(--accent); }
        .student-response-note { display: inline-flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: rgba(54,123,88,0.06); color: var(--muted); border: 1px solid rgba(54,123,88,0.12); font-size: 12px; font-weight: 700; }
        .student-response-note svg { color: var(--green); }
        @media (max-width: 700px) {
          .student-history-heading { flex-direction: column; align-items: flex-start; }
          .student-history-toolbar { flex-direction: column; align-items: flex-start; }
          .student-history-card { grid-template-columns: 44px 1fr; padding: 14px; }
          .student-history-icon { width: 44px; height: 44px; border-radius: 14px; }
        }
      `}</style>
      <section className="student-history-page">
        <header className="student-history-heading">
          <div>
            <span className="eyebrow">YOUR MESSMATE HISTORY</span>
            <h1>{title}</h1>
            <p>{isResponsesView ? 'Review manager replies and response status for each meal and week.' : 'All the ratings and concerns you have previously submitted.'}</p>
          </div>
          <span className="student-history-count"><MessageSquare size={15} /> {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
        </header>

        <div className="student-history-toolbar">
          <div className="student-history-toolbar-group">
            <span className="history-filter-label"><CalendarDays size={15} /> Filter by day</span>
            <select className="student-history-date-filter" value={dayFilter} onChange={event => setDayFilter(event.target.value)} aria-label="Filter feedback by recorded day">
              <option value="all">All days</option>
              {availableDays.map(day => (
                <option key={day} value={day}>{formatDate(day)}</option>
              ))}
            </select>
          </div>
          <div className="student-history-toolbar-group">
            <span className="history-filter-label"><CalendarDays size={15} /> Filter by meal</span>
            <div className="student-history-filters" role="group" aria-label="Filter feedback by meal">
              {MEALS.map(meal => (
                <button key={meal.id} type="button" className={mealFilter === meal.id ? 'active' : ''} onClick={() => setMealFilter(meal.id)}>{meal.label}</button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="notice"><AlertCircle size={16} />{error}</div>}
        {loading && <div className="loading-panel"><RefreshCw className="spin" size={20} /> Loading your history…</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div><MessageSquare size={25} /></div>
            <h3>{entries.length ? 'No entries for this meal.' : 'No feedback submitted yet.'}</h3>
            <p>{isResponsesView ? 'Manager replies will appear here alongside the meal and week they relate to.' : 'Once you rate a meal or submit a concern, it will be listed here by meal and week.'}</p>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([week, weekEntries]) => (
          <section className="student-history-week" key={week}>
            <div className="student-history-week-heading"><h2>{week}</h2><span>{weekEntries.length} {weekEntries.length === 1 ? 'submission' : 'submissions'}</span></div>
            <div className="student-history-list">
              {weekEntries.map(item => (
                <article className="student-history-card" key={`${item.type}-${item.id}`}>
                  <div className={`student-history-icon ${item.type === 'complaint' ? 'complaint' : ''}`}>{item.type === 'rating' ? <Star size={18} /> : <MessageSquare size={18} />}</div>
                  <div className="student-history-entry">
                    <div className="student-history-meta"><strong>{mealName(item.meal_id)}</strong><span><Clock3 size={13} /> {formatDate(item.date)}</span><span className={`student-history-type ${item.type}`}>{item.type === 'rating' ? 'Meal rating' : 'Concern'}</span></div>
                    <h3>{item.type === 'rating' ? `${item.rating}/5 meal rating` : item.title || 'Meal concern'}</h3>
                    {item.type === 'rating' && <div className="student-history-stars" aria-label={`${item.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(value => <Star key={value} size={14} fill={value <= item.rating ? 'currentColor' : 'none'} />)}</div>}
                    <p>{item.type === 'rating' ? (item.comment || 'No comment added.') : (item.description || 'No description provided.')}</p>
                    {isResponsesView && (
                      <div className={`student-manager-response ${item.response ? 'has-response' : 'awaiting-response'}`}>
                        <ShieldCheck size={17} />
                        <div><strong>{item.response ? 'Manager response' : item.type === 'rating' ? 'No separate manager reply recorded' : (item.group_status || '').toLowerCase() === 'responded' ? 'Response submitted' : 'Awaiting manager response'}</strong>
                          {item.response ? <span>{item.response}</span> : <span>{item.type === 'rating' ? 'This rating is visible here with its meal and week; a reply will appear if one is associated with it.' : 'A reply will appear here when the manager responds to this concern.'}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {isResponsesView && <p className="student-response-note"><ShieldCheck size={15} /> Replies are shown with the specific meal and week of the feedback they address.</p>}
      </section>
    </>
  );
}
