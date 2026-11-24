import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileRouter } from './shim';
import { App } from './app/App';
import './shim.css';
import './app/style.css';
import './app/overview.css';
import './app/playanalysis.css';
import './app/compact.css';
import './app/polish.css';
import './app/premium.css';

createRoot(document.getElementById('root')!).render(<FileRouter><App /></FileRouter>);
