import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const DIETARY_OPTIONS = [
  { id: 'veg', label: 'Vegetarian' },
  { id: 'non_veg', label: 'Non-Vegetarian' },
];
const MEALS = [
  { id: 'breakfast', label: 'Breakfast', time: '7:00–11:00 AM' },
  { id: 'lunch', label: 'Lunch', time: '12:30–3:00 PM' },
  { id: 'snacks', label: 'Snacks', time: '3:00–5:00 PM' },
  { id: 'dinner', label: 'Dinner', time: '7:00–10:00 PM' },
];

export default function CompleteMenu({ token, dietary = 'non_veg', setDietary }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    fetch(`${API}/menu/complete?dietary=${encodeURIComponent(dietary)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || 'The menu could not be loaded.');
        return result;
      })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [token, dietary]);

  const days = data?.days || [];
  const menuName = dietary === 'veg' ? 'Vegetarian' : 'Non-Vegetarian';

  return (
    <section className="complete-menu-page">
      <header className="complete-menu-heading">
        <div>
          <span className="eyebrow">CEG CAMPUS HOSTELS · ANNA UNIVERSITY</span>
          <h1>Complete menu</h1>
          <p>Official weekly meal schedule · Chennai - 25</p>
        </div>
        <span className="complete-menu-period"><CalendarDays size={15} /> Weekly rotation</span>
      </header>

      <div className="complete-menu-toolbar">
        <div className="complete-menu-source">
          <span className="complete-menu-book"><BookOpen size={20} /></span>
          <span><strong>Hostel mess menu</strong><small>Choose a menu to view its full schedule</small></span>
        </div>
        <div className="dietary-menu-tabs" role="tablist" aria-label="Choose menu type">
          {DIETARY_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={dietary === option.id}
              className={`${dietary === option.id ? 'active' : ''} ${option.id === 'veg' ? 'veg' : 'non-veg'}`}
              onClick={() => setDietary(option.id)}
            >{option.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="notice"><AlertCircle size={16} />{error}</div>}
      {!data && !error && <div className="loading-panel"><RefreshCw className="spin" size={20} /> Loading the {menuName.toLowerCase()} menu…</div>}

      {days.length > 0 && <>
        <div className="weekly-menu-title">
          <div><span className="eyebrow">{menuName.toUpperCase()} MENU</span><h2>Seven-day meal plan</h2></div>
          <span className="weekly-menu-count">{days.length} days <span>·</span> 4 meals daily</span>
        </div>
        <div className="weekly-menu-scroll" role="region" aria-label={`${menuName} weekly menu; scroll horizontally to see all meals`} tabIndex="0">
          <table className="weekly-menu-table">
            <thead><tr><th scope="col">Day</th>{MEALS.map(meal => <th scope="col" key={meal.id}><strong>{meal.label}</strong><small>{meal.time}</small></th>)}</tr></thead>
            <tbody>{days.map(day => (
              <tr key={day.date}>
                <th scope="row"><strong>{day.label.split(',')[0]}</strong><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</small></th>
                {MEALS.map(meal => {
                  const items = day.meals?.find(item => item.id === meal.id)?.items || [];
                  return <td key={meal.id}><ul>{items.map((item, index) => <li key={`${meal.id}-${index}`}>{item}</li>)}</ul></td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="complete-menu-footnote"><ShieldCheck size={15} /> Menu based on the official CEG hostel circular. T/C/M means Tea, Coffee and Milk.</p>
      </>}
    </section>
  );
}
