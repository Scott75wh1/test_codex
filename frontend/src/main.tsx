import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';


if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  }).catch(() => undefined);
}


document.title = 'SoundTouch Radio Bridge';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
