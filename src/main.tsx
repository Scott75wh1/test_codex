import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

document.title = 'SoundTouch Radio Bridge';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
