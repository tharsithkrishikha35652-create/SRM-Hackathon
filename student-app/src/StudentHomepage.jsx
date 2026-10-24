import React, { useEffect, useState } from 'react';

const meals = {
  breakfast: { name: 'Breakfast', time: '7:00 AM - 11:00 AM', items: ['Idli', 'Sambar', 'Coconut chutney', 'Pongal', 'Tea'] },
  lunch: { name: 'Lunch', time: '12:30 PM - 3:00 PM', items: ['Rice', 'Sambar', 'Rasam', 'Chicken curry / vegetable kurma', 'Cabbage poriyal', 'Curd'] },
  snacks: { name: 'Snacks', time: '4:00 PM - 6:00 PM', items: ['Tea / Coffee', 'Sundal', 'Seasonal snack'] },
  dinner: { name: 'Dinner', time: '7:00 PM - 10:00 PM', items: ['Chapati', 'Paneer gravy / chicken curry', 'Dal', 'Curd', 'Pickle'] },
};

function StudentHomepage({ session }) {
  const [openMeal, setOpenMeal] = useState(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!openMeal) return undefined;
    const close = event => event.key === 'Escape' && setOpenMeal(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [openMeal]);

  const submitFeedback = async () => {
    if (!rating) { setError('Choose a rating first.'); return; }
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ meal_id: openMeal, service_date: new Date().toLocaleDateString('en-CA'), rating, items: {}, comment: message, category: '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Feedback could not be submitted.');
      setError(data.message || 'Feedback submitted.');
    } catch (submitError) { setError(submitError.message); }
  };

  return <main className="meal-home">
    <header className="meal-home-header"><div><span className="eyebrow">STUDENT MENU</span><h1>Choose a meal</h1><p>Tap a meal to view its menu and leave a rating.</p></div><button className="meal-signout" onClick={() => { localStorage.removeItem('messmate_session_both'); window.location.reload(); }}>Sign out</button></header>
    <nav className="meal-tabs" aria-label="Meal tabs">{Object.keys(meals).map(id => <button key={id} onClick={() => { setOpenMeal(id); setRating(0); setMessage(''); setError(''); }}>{id}</button>)}</nav>
    {openMeal && <div className="meal-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setOpenMeal(null)}><section className="meal-modal" role="dialog" aria-modal="true" aria-labelledby="meal-title"><button className="meal-modal-close" onClick={() => setOpenMeal(null)} aria-label="Close menu">X</button><span className="eyebrow">TODAY'S MENU</span><h2 id="meal-title">{meals[openMeal].name}</h2><p className="meal-time">{meals[openMeal].time}</p><div className="meal-items">{meals[openMeal].items.map(item => <span key={item}>{item}</span>)}</div><h3>Rate this meal</h3><div className="meal-rating" aria-label="Meal rating">{[1, 2, 3, 4, 5].map(value => <button key={value} className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} stars`}>★</button>)}</div><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Add a comment (optional)" rows="3" />{error && <p className="meal-feedback-status">{error}</p>}<button className="primary-button full" onClick={submitFeedback}>Submit feedback</button></section></div>}
  </main>;
}

export function StudentEntry({ App }) {
  const [session] = useState(() => { try { return JSON.parse(localStorage.getItem('messmate_session_both') || 'null'); } catch { return null; } });
  return session?.token ? <StudentHomepage session={session} /> : <App />;
}
