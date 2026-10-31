import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { AlertCircle, ChevronRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, Moon, RefreshCw, ShieldCheck, Sun, Utensils, UserRound } from 'lucide-react';
import { auth } from './firebase.js';

function Brand() {
  return <div className="brand"><div className="brand-mark"><Utensils size={21} /></div><div><div className="brand-name">MessMate<span>.</span></div><div className="brand-tag">Better food. Happier campus.</div></div></div>;
}

function ThemeButton({ theme, onClick }) {
  return <button className="icon-button" onClick={onClick} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

function readableAuthError(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email and password sign-in is disabled in Firebase Authentication settings.',
  };
  return messages[error.code] || error.message || 'Sign-in failed. Please try again.';
}

export default function FirebaseLogin({ theme, onTheme }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isRegistering = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (isRegistering) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        await sendEmailVerification(credential.user);
        await signOut(auth);
        setNotice('Account created. Verify your email using the link we sent, then sign in.');
        return;
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (authError) {
      setError(readableAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-photo">
        <div className="photo-overlay" />
        <div className="photo-top"><Brand /></div>
        <div className="photo-copy">
          <div className="photo-emblem"><GraduationCap size={29} /></div>
          <h1>Good food.<br />A better campus.</h1>
          <p>Your voice makes every meal better.</p>
        </div>
        <div className="photo-bottom"><span><ShieldCheck size={15} /> Student-first. Always.</span><span>MESSMATE / 001</span></div>
      </div>
      <div className="login-side">
        <div className="login-top"><span className="eyebrow">CAMPUS DINING, REIMAGINED</span><ThemeButton theme={theme} onClick={onTheme} /></div>
        <div className="login-form-wrap">
          <div className="login-symbol"><GraduationCap size={29} /></div>
          <h2>{isRegistering ? 'Create your account.' : 'Welcome back.'}</h2>
          <p className="muted">{isRegistering ? 'Create a student account with Firebase Authentication.' : 'Sign in securely with your campus email.'}</p>
          <form onSubmit={submit} className="login-form">
            {isRegistering && <>
              <label htmlFor="firebase-name">Your name</label>
              <div className="input-wrap"><UserRound size={17} /><input id="firebase-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Full name" required /></div>
            </>}
            <label htmlFor="firebase-email">Campus email</label>
            <div className="input-wrap"><Mail size={17} /><input id="firebase-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.edu" required /></div>
            <label htmlFor="firebase-password">Password</label>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="firebase-password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={isRegistering ? 'At least 6 characters' : 'Enter your password'} minLength={isRegistering ? 6 : undefined} required /><button type="button" className="input-action" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <div className="error-message"><AlertCircle size={16} />{error}</div>}
            {notice && <div className="success-notice">{notice}</div>}
            <button className="primary-button login-submit" disabled={busy}>{busy && <RefreshCw className="spin" size={17} />}{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}<ChevronRight size={18} /></button>
          </form>
          <div className="login-help"><LockKeyhole size={14} /> Secured by Firebase Authentication</div>
          <button type="button" className="text-action" onClick={() => { setError(''); setMode(isRegistering ? 'signin' : 'register'); }}>
            {isRegistering ? 'Already have an account? Sign in' : 'New student? Create an account'}
          </button>
        </div>
        <div className="login-footer">Made for a happier campus <span>·</span> MessMate</div>
      </div>
    </div>
  );
}
