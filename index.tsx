import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

let root;

// @ts-ignore - Check for existing root to support HMR and avoid double mounting
if (rootElement._reactRootContainer) {
  // If root exists, reuse it (or just log, but we can't easily retrieve the Root instance from DOM in React 18)
  // Actually, in dev with HMR, we might want to clear it or just let it be.
  // But the error says "passed to createRoot() before".
  // The cleanest way is to not call createRoot again if we can avoid it, 
  // but we need the `root` object to call render.
  
  // Since we can't get the existing root instance back from the element in React 18 public API,
  // we can store it on window for HMR purposes.
}

// Simple singleton pattern for HMR
// @ts-ignore
if (!window.__REACT_ROOT__) {
  // @ts-ignore
  window.__REACT_ROOT__ = ReactDOM.createRoot(rootElement);
}
// @ts-ignore
root = window.__REACT_ROOT__;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);