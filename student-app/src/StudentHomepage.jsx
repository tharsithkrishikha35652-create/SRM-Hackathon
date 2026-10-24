import React, { useEffect, useRef, useState } from 'react';
import CompleteMenu from './CompleteMenu.jsx';
import StudentFeedbackHistory from './StudentFeedbackHistory.jsx';
import './student-feedback.css';
import './student-meal-rating.css';
import './student-meal-rating-mobile.css';
import './student-menu-scroll.css';
import {
  Utensils, Sun, Moon, Home, BookOpen, MessageSquare, UserRound, ChevronDown,
  ChevronRight, CalendarDays, Clock3, Star, Soup, Coffee, Bell,
  Sparkles, ArrowUpRight, LogOut, ShieldCheck
} from 'lucide-react';

const meals = {
  breakfast: {
    name: 'Breakfast',
    time: '7:00 AM - 11:00 AM',
    items: ['Idli', 'Sambar', 'Coconut chutney', 'Pongal', 'Tea'],
    color: 'peach',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=700&q=85',
  },
  lunch: {
    name: 'Lunch',
    time: '12:30 PM - 3:00 PM',
    items: ['Rice', 'Sambar', 'Rasam', 'Chicken curry / vegetable kurma', 'Cabbage poriyal', 'Curd'],
    color: 'green',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=700&q=85',
  },
  snacks: {
    name: 'Snacks',
    time: '3:00 PM - 5:00 PM',
    items: ['Tea / Coffee', 'Sundal', 'Seasonal snack'],
    color: 'yellow',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=85',
  },
  dinner: {
    name: 'Dinner',
    time: '7:00 PM - 10:00 PM',
    items: ['Chapati', 'Paneer gravy / chicken curry', 'Dal', 'Curd', 'Pickle'],
    color: 'purple',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=85',
  },
};

const mealOrder = ['breakfast', 'lunch', 'snacks', 'dinner'];
const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const foodPhotos = {
  dosa: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=85',
  idli: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=900&q=85',
  biryani: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=900&q=85',
  samosa: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85',
  curry: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85',
  thali: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=900&q=85',
  tea: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=85',
  cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85',
};

function mealImageFor(meal) {
  const items = (meal?.items || []).join(' ').toLowerCase();
  if (/\bdosa\b|dosai/.test(items)) return foodPhotos.dosa;
  if (/\bidli\b|idly/.test(items)) return foodPhotos.idli;
  if (/biryani|biriyani/.test(items)) return foodPhotos.biryani;
  if (/samosa|samosas/.test(items)) return foodPhotos.samosa;
  if (/tea cake|\bcake\b|kesari|payasam/.test(items)) return foodPhotos.cake;
  if (/\btea\b|\bcoffee\b|biscuit/.test(items)) return foodPhotos.tea;
  if (/chicken|mutton|fish/.test(items)) return foodPhotos.curry;
  if (/paneer|kurma|sambar|rasam|rice|chapati|chapathi/.test(items)) return foodPhotos.thali;
  return meals[meal?.id]?.image || meals.lunch.image;
}

function Brand({ compact = false }) {
  return (
    <div className="brand">
      <div className="brand-mark"><Utensils size={21} /></div>
      {!compact && (
        <div>
          <div className="brand-name">MessMate<span>.</span></div>
          <div className="brand-tag">Better food. Happier campus.</div>
        </div>
      )}
    </div>
  );
}

function ThemeButton({ theme, onClick }) {
  return (
    <button className="icon-button" onClick={onClick} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Change theme">
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function MealCard({ meal, isActive, alreadyRated, onRate }) {
  const Icon = meal.id === 'breakfast' || meal.id === 'snacks' ? Coffee : Soup;
  return (
    <article className={`meal-card featured ${meal.color || ''}`}>
      <div className="meal-card-image" style={{ backgroundImage: `url(${meal.image})` }}>
        <span className={`meal-status ${isActive && !alreadyRated ? 'open' : ''}`}>
          {isActive && !alreadyRated && <span />}{isActive ? alreadyRated ? 'Rated today' : 'Feedback open' : meal.status === 'upcoming' ? 'Coming up' : 'Feedback closed'}
        </span>
        <div className="meal-icon"><Icon size={18} /></div>
      </div>
      <div className="meal-card-body">
        <div className="meal-title-row">
          <div>
            <h3>{meal.name}</h3>
          </div>
        </div>
        <div className="meal-card-bottom">
          <button className="text-action" onClick={() => onRate(meal)}>
            {isActive && !alreadyRated ? 'Rate this meal' : 'View full menu'} <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function StudentHomepage({ session }) {
  const [openMeal, setOpenMeal] = useState(null);
  const [activePage, setActivePage] = useState('home');
  const [todayMenu, setTodayMenu] = useState(null);
  const [todayMenuError, setTodayMenuError] = useState('');
  const [dietary, setDietary] = useState(() => {
    try { return JSON.parse(localStorage.getItem('messmate_student_dietary') || '"non_veg"'); }
    catch { return 'non_veg'; }
  });
  const [rating, setRating] = useState(0);
  const [itemRatings, setItemRatings] = useState({});
  const [itemRatingsOpen, setItemRatingsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('messmate_theme') || 'light');
  const autoOpenedMealKey = useRef(null);
  const dismissedMealKey = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('messmate_theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('messmate_student_dietary', JSON.stringify(dietary));
  }, [dietary]);

  useEffect(() => {
    let live = true;
    const loadToday = async () => {
      try {
        const [menuResponse, feedbackResponse] = await Promise.all([
          fetch(`${API}/menu/today?dietary=${encodeURIComponent(dietary)}`, { headers: { Authorization: `Bearer ${session.token}` } }),
          fetch(`${API}/feedback/mine`, { headers: { Authorization: `Bearer ${session.token}` } }),
        ]);
        const [menuData, feedbackData] = await Promise.all([
          menuResponse.json().catch(() => ({})),
          feedbackResponse.json().catch(() => ({})),
        ]);
        if (!menuResponse.ok) throw new Error(menuData.detail || 'Today’s meal schedule could not be loaded.');
        if (!live) return;
        const activeMeal = menuData.meals?.find(meal => meal.id === menuData.active_meal) || null;
        const alreadyRated = (feedbackData.ratings || []).some(item => item.meal_id === activeMeal?.id && item.service_date === menuData.date);
        setTodayMenu({ ...menuData, activeMeal, alreadyRated });
        setTodayMenuError('');
      } catch (loadError) {
        if (live) setTodayMenuError(loadError.message);
      }
    };

    loadToday();
    const refreshInterval = window.setInterval(loadToday, 60_000);
    return () => { live = false; window.clearInterval(refreshInterval); };
  }, [session.token, dietary]);

  useEffect(() => {
    const meal = todayMenu?.activeMeal;
    if (!meal || todayMenu.alreadyRated || activePage !== 'home') return;
    const key = `${todayMenu.date}:${meal.id}`;
    if (autoOpenedMealKey.current === key || dismissedMealKey.current === key) return;
    autoOpenedMealKey.current = key;
    setOpenMeal(meal.id);
    setRating(0);
    setItemRatings({});
    setItemRatingsOpen(false);
    setMessage('');
    setError('');
  }, [todayMenu, activePage]);

  useEffect(() => {
    if (!openMeal) return undefined;
    const close = event => event.key === 'Escape' && setOpenMeal(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [openMeal]);

  const currentMealData = todayMenu?.meals?.find(meal => meal.id === openMeal) || meals[openMeal] || meals.lunch;
  const currentMeal = { ...currentMealData, image: mealImageFor(currentMealData) };
  const activeMeal = todayMenu?.activeMeal || null;
  const canRateOpenMeal = Boolean(openMeal && activeMeal?.id === openMeal && !todayMenu?.alreadyRated);

  const openMealMenu = meal => {
    setOpenMeal(meal.id);
    setRating(0);
    setItemRatings({});
    setItemRatingsOpen(false);
    setError('');
    setMessage('');
  };

  const closeMealFeedback = () => {
    if (openMeal && todayMenu?.date) dismissedMealKey.current = `${todayMenu.date}:${openMeal}`;
    setOpenMeal(null);
  };

  const submitFeedback = async () => {
    if (!canRateOpenMeal) {
      setError(`Feedback is only available during ${currentMeal.time}.`);
      return;
    }
    if (!rating) {
      setError('Choose a rating first.');
      return;
    }
    setError('');

    try {
      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          meal_id: openMeal,
          service_date: new Date().toLocaleDateString('en-CA'),
          rating,
          items: itemRatings,
          comment: message,
          category: 'General',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Feedback could not be submitted.');
      setError(data.message || 'Feedback submitted.');
      setMessage('');
      setRating(0);
      setItemRatings({});
      setItemRatingsOpen(false);
      setTodayMenu(previous => previous ? { ...previous, alreadyRated: true } : previous);
      setOpenMeal(null);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="side-label">WORKSPACE</div>
        <nav>
          <button className={`nav-item ${activePage === 'home' ? 'active' : ''}`} onClick={() => { setActivePage('home'); setOpenMeal(null); }}><Home size={18} /><span>Home</span>{activePage === 'home' && <span className="nav-indicator" />}</button>
          <button className={`nav-item ${activePage === 'menu' ? 'active' : ''}`} onClick={() => { setActivePage('menu'); setOpenMeal(null); }}><BookOpen size={18} /><span>Complete menu</span>{activePage === 'menu' && <span className="nav-indicator" />}</button>
          <button className={`nav-item ${activePage === 'feedback' ? 'active' : ''}`} onClick={() => { setActivePage('feedback'); setOpenMeal(null); }}><MessageSquare size={18} /><span>Feedback</span>{activePage === 'feedback' && <span className="nav-indicator" />}</button>
          <button className={`nav-item ${activePage === 'responses' ? 'active' : ''}`} onClick={() => { setActivePage('responses'); setOpenMeal(null); }}><UserRound size={18} /><span>Responses</span>{activePage === 'responses' && <span className="nav-indicator" />}</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="side-user">
          <div className="avatar">{(session?.user?.name || 'ST').slice(0, 2).toUpperCase()}</div>
          <div className="side-user-copy">
            <strong>{session?.user?.name || 'Student'}</strong>
            <span>Student account</span>
          </div>
          <button
            className="icon-button small"
            title="Sign out"
            onClick={() => {
              localStorage.removeItem('messmate_session_both');
              window.location.reload();
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Brand compact /></div>
          <div className="breadcrumb">STUDENT WORKSPACE <ChevronRight size={13} /> <strong>{activePage === 'menu' ? 'Complete menu' : activePage === 'feedback' ? 'Feedback' : activePage === 'responses' ? 'Responses' : 'Today'}</strong></div>
          <div className="top-actions">
            <div className="status-pill"><span /> Local demo</div>
            <ThemeButton theme={theme} onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} />
            <div className="top-avatar">{(session?.user?.name || 'S').slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'menu' ? (
            <CompleteMenu token={session.token} dietary={dietary} setDietary={setDietary} />
          ) : activePage === 'feedback' || activePage === 'responses' ? (
            <StudentFeedbackHistory token={session.token} view={activePage} />
          ) : (
            <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR CAMPUS, YOUR VOICE</div>
              <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {session?.user?.name?.split(' ')[0] || 'there'}<span className="heading-wave">.</span></h1>
              <p>Here’s what’s cooking today.</p>
            </div>
            <div className="heading-right">
              <div className="date-chip"><CalendarDays size={16} />{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <section className="welcome-banner">
            <div className="welcome-banner-copy">
              <div className="banner-kicker"><span className="pulse-dot" /> TODAY AT THE MESS</div>
              <h2>Good food is a<br /><em>team effort.</em></h2>
              <p>Rate your meal. Share your thoughts. Help us serve better.</p>
              <button className="banner-button" onClick={() => activeMeal ? openMealMenu(activeMeal) : setActivePage('menu')}>
                {activeMeal && !todayMenu?.alreadyRated ? `Rate ${activeMeal.name}` : 'Explore today’s menu'} <ChevronRight size={17} />
              </button>
            </div>
            <div className="banner-art">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-plate">
                <div className="art-food"><span /> </div>
              </div>
              <div className="art-utensils" />
              <div className="art-sticker"><Bell size={12} /> Live feedback</div>
            </div>
          </section>

          {todayMenuError && <div className="notice">{todayMenuError}</div>}
          <div className="meal-tabs" role="tablist" aria-label="Choose a meal to view">
            {mealOrder.map(id => {
              const meal = todayMenu?.meals?.find(item => item.id === id) || { ...meals[id], id, status: 'closed' };
              const isActiveMeal = id === activeMeal?.id;
              return <button key={id} type="button" role="tab" aria-selected={openMeal === id} className={`${openMeal === id ? 'active' : ''} ${isActiveMeal ? 'feedback-window-tab' : ''}`} onClick={() => openMealMenu(meal)}>
                {meals[id].name}{isActiveMeal && !todayMenu?.alreadyRated && <span className="meal-tab-live-dot" aria-label="Feedback open" />}
              </button>;
            })}
          </div>
          <div className="section-heading">
            <div><span className="eyebrow">MEAL WINDOWS</span><h2>Today’s meals</h2></div>
            {!todayMenu?.activeMeal && <span className="date-chip"><Clock3 size={15} />Feedback opens during meal hours</span>}
          </div>
          <div className="meal-grid">
            {(todayMenu?.meals || mealOrder.map(id => ({ ...meals[id], id, status: 'closed' }))).map(meal => (
              <MealCard key={meal.id} meal={{ ...meals[meal.id], ...meal, image: mealImageFor(meal) }} isActive={meal.id === activeMeal?.id} alreadyRated={meal.id === activeMeal?.id && todayMenu?.alreadyRated} onRate={() => openMealMenu(meal)} />
            ))}
          </div>
            </>
          )}
        </div>
      </main>

      {activePage === 'home' && openMeal && (
        <div className="meal-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeMealFeedback()}>
          <section className="meal-modal meal-rating-modal" role="dialog" aria-modal="true" aria-labelledby="meal-title">
            <header className="meal-rating-header">
              <button className="meal-modal-close" onClick={closeMealFeedback} aria-label="Close meal menu">‹</button>
              <div><span className="eyebrow">{canRateOpenMeal ? 'YOUR FEEDBACK' : 'MEAL MENU'}</span><h2>{canRateOpenMeal ? 'Rate your meal' : 'Meal details'}</h2></div>
            </header>
            <div className="meal-rating-content">
              <div className="meal-rating-summary">
                <img src={currentMeal.image} alt={`${currentMeal.name} meal`} />
                <div><h3 id="meal-title">{currentMeal.name}</h3><p>Meal service</p><span className="meal-rating-time"><Clock3 size={13} />{currentMeal.time}</span></div>
              </div>
              <section className="meal-menu-list-section" aria-label={`${currentMeal.name} menu`}>
                <div className="meal-menu-list-heading"><strong>On the menu</strong><span>{currentMeal.items.length} items</span></div>
                <ul className="meal-menu-bullets">{currentMeal.items.map(item => <li key={item}>{item}</li>)}</ul>
              </section>
              {canRateOpenMeal ? <>
              <section className="overall-rating-section" aria-labelledby="overall-rating-label">
                <h3 id="overall-rating-label">Overall rating</h3>
                <div className="meal-rating" aria-label="Overall meal rating">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button key={value} className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} stars`} type="button">★</button>
                  ))}
                </div>
                {rating > 0 && <span className="overall-rating-caption">{['', 'Poor', 'Could be better', 'Okay', 'Good', 'Excellent'][rating]}</span>}
              </section>
              <section className="individual-rating-section">
                <button className="individual-rating-toggle" type="button" aria-expanded={itemRatingsOpen} onClick={() => setItemRatingsOpen(open => !open)}>
                  <span><strong>Rate individual items</strong><small>Optional · rate any items you like</small></span>
                  <ChevronDown size={19} className={itemRatingsOpen ? 'expanded' : ''} />
                </button>
                {itemRatingsOpen && <div className="individual-rating-list">
                  {currentMeal.items.map(item => <div className="individual-rating-row" key={item}>
                    <span>{item}</span>
                    <div className="individual-rating-stars" role="group" aria-label={`Rate ${item}`}>
                      {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value} stars for ${item}`} className={value <= (itemRatings[item] || 0) ? 'selected' : ''} onClick={() => setItemRatings(previous => ({ ...previous, [item]: value }))}>★</button>)}
                    </div>
                  </div>)}
                </div>}
              </section>
              <label className="meal-comment-label" htmlFor="meal-comment">Additional feedback <span>(optional)</span></label>
              <textarea id="meal-comment" className="meal-comment-input" value={message} onChange={event => setMessage(event.target.value)} placeholder="Any specific comments about taste, quality or quantity?" rows="3" />
              </> : <div className="meal-window-notice"><Clock3 size={16}/><span>{activeMeal?.id === openMeal && todayMenu?.alreadyRated ? 'You have already submitted feedback for this meal today.' : `Feedback is available only during ${currentMeal.time}.`}</span></div>}
              {error && <p className="meal-feedback-status">{error}</p>}
            </div>
            {canRateOpenMeal && <footer className="meal-rating-footer">
              <button className="primary-button full meal-submit-button" onClick={submitFeedback} type="button">Submit feedback</button>
            </footer>}
          </section>
        </div>
      )}
    </main>
  );
}

export function StudentEntry({ App }) {
  const [session] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('messmate_session_both') || 'null');
      if (stored?.token && stored.user?.role !== 'student') {
        localStorage.removeItem('messmate_session_both');
        return null;
      }
      return stored;
    } catch {
      localStorage.removeItem('messmate_session_both');
      return null;
    }
  });

  return session?.token && session.user?.role === 'student' ? <StudentHomepage session={session} /> : <App />;
}
