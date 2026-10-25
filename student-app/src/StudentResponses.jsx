import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, MessageSquare, RefreshCw, ShieldCheck, Star } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function StudentResponses({ token }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/feedback/responses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Meal response summaries could not be loaded.');
      setMeals(data.meals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="student-responses-page">
      <header className="student-responses-heading">
        <div>
          <span className="eyebrow">CAMPUS-WIDE FEEDBACK</span>
          <h1>Meal responses</h1>
          <p>See the overall feedback themes and the mess team’s response for each meal. Individual student details are never shown.</p>
        </div>
        <button className="subtle-button" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </header>

      {error && <div className="notice"><AlertCircle size={16} />{error}</div>}
      {loading && meals.length === 0 && <div className="loading-panel"><RefreshCw size={20} className="spin" /> Loading campus meal responses…</div>}
      {!loading && !error && meals.length > 0 && (
        <div className="student-responses-list">
          {meals.map(meal => (
            <article className="student-response-meal" key={meal.id}>
              <header className="student-response-meal-header">
                <div>
                  <span className="eyebrow">MEAL SUMMARY</span>
                  <h2>{meal.name}</h2>
                </div>
                <div className="student-response-metrics">
                  <span><MessageSquare size={14} /> {meal.feedback_count} reports</span>
                  <span><Star size={14} /> {meal.rating_average == null ? 'No ratings' : `${meal.rating_average} / 5 · ${meal.rating_count} ratings`}</span>
                </div>
              </header>

              {meal.feedback_summaries?.length ? (
                <div className="student-response-themes">
                  {meal.feedback_summaries.map((summary, index) => {
                    const responded = Boolean(summary.response?.trim());
                    return (
                      <section className="student-response-theme" key={`${meal.id}-${summary.service_date}-${index}`}>
                        <div className="student-response-theme-heading">
                          <div>
                            <h3>{summary.title}</h3>
                            <span className="student-response-date"><CalendarDays size={13} /> {new Date(`${summary.service_date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <span className={`student-response-status ${responded ? 'answered' : 'pending'}`}>
                            {responded ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                            {responded ? 'Responded' : 'Under review'}
                          </span>
                        </div>
                        <p className="student-response-summary">{summary.summary}</p>
                        <div className={`student-manager-reply ${responded ? 'has-reply' : 'awaiting-reply'}`}>
                          <ShieldCheck size={17} />
                          <div>
                            <strong>{responded ? 'Mess team response' : 'The mess team is reviewing this feedback'}</strong>
                            {responded && <p>{summary.response}</p>}
                          </div>
                          <span className="student-response-report-count">{summary.report_count} {summary.report_count === 1 ? 'report' : 'reports'}</span>
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="student-response-empty">
                  <CheckCircle2 size={18} />
                  <p>No grouped feedback themes for this meal yet.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
