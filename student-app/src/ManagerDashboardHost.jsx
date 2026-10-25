import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ManagerApp from '../../manager-web/src/App.jsx';
import managerStyles from '../../manager-web/src/styles.css?inline';

/** Render the manager portal inside an isolated shadow root to keep its CSS separate. */
export default function ManagerDashboardHost({ session, onLogout }) {
  const hostRef = useRef(null);
  const [shadowRoot, setShadowRoot] = useState(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = managerStyles
      .replace(/:root(?=\s*\{|\s*\[)/g, ':host')
      .replace(/:host\[data-theme=dark\]/g, ':host([data-theme="dark"])');
    shadow.prepend(style);
    setShadowRoot(shadow);

    const syncTheme = () => {
      host.dataset.theme = document.documentElement.dataset.theme || 'light';
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      style.remove();
    };
  }, []);

  return (
    <>
      <div ref={hostRef} style={{ display: 'block', minHeight: '100vh' }} />
      {shadowRoot && createPortal(
        <ManagerApp embeddedSession={session} onEmbeddedLogout={() => onLogoutRef.current()} />,
        shadowRoot,
      )}
    </>
  );
}
