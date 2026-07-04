import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// TonConnectUIProvider намеренно НЕ здесь: он тяжёлый (~200KB) и нужен
// только секции кошелька в Профиле — живёт внутри lazy-чанка WalletLink.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
