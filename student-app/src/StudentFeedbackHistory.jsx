import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Clock3, MessageSquare, RefreshCw, ShieldCheck, Star } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
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
  const filtered = entries.filter(item => mealFilter === 'all' || item.meal_id === mealFilter);
  const grouped = filtered.reduce((groups, item) => {
    const label = getWeekLabel(item.date);
    (groups[label] ||= []).push(item);
    return groups;
  }, {});
  const mealName = id => MEALS.find(meal => meal.id === id)?.label || id || 'Meal';
  const title = isResponsesView ? 'Manager responses' : 'Your previous feedback';

  return (
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
        <span className="history-filter-label"><CalendarDays size={15} /> Filter by meal</span>
        <div className="student-history-filters" role="group" aria-label="Filter feedback by meal">
          {MEALS.map(meal => (
            <button key={meal.id} type="button" className={mealFilter === meal.id ? 'active' : ''} onClick={() => setMealFilter(meal.id)}>{meal.label}</button>
          ))}
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
  );
}
