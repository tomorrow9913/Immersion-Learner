import React from 'react';
import ReactDOM from 'react-dom/client';
import ContentApp from './ContentApp';
import css from '@/index.css?inline';

const rootId = 'immersion-learner-root';

// Function to mount the app
function mount() {
    const existingRoot = document.getElementById(rootId);
    if (existingRoot) return; // Already mounted

    const rootDiv = document.createElement('div');
    rootDiv.id = rootId;
    // Make sure it doesn't affect page layout
    rootDiv.style.position = 'absolute';
    rootDiv.style.top = '0';
    rootDiv.style.left = '0';
    rootDiv.style.zIndex = '2147483647';
    rootDiv.style.pointerEvents = 'none'; // Let events pass through wrapper
    
    document.body.appendChild(rootDiv);

    const shadowRoot = rootDiv.attachShadow({ mode: 'open' });

    // Inject styles
    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    shadowRoot.appendChild(styleElement);

    // Container for React app inside shadow DOM
    // We need pointer-events: auto on this container so button is clickable
    const appContainer = document.createElement('div');
    appContainer.style.pointerEvents = 'auto';
    shadowRoot.appendChild(appContainer);

    ReactDOM.createRoot(appContainer).render(
      <React.StrictMode>
        <ContentApp />
      </React.StrictMode>
    );
}

// Mount immediately
mount();

// Also observe body for changes in case it's a SPA or body is replaced? 
// Usually content script runs at 'document_idle' by default, so body exists.
