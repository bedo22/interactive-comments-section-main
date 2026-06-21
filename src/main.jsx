import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CurrentUserProvider } from './context/CurrentUserContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CurrentUserProvider>
      <App />
    </CurrentUserProvider>
  </StrictMode>
);