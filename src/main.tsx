import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  console.error("Main execution failed:", e);
}

