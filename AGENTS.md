# Agent Development Guide (AGENTS.md)

This document provides essential information for AI agents and developers working on the **Immersion Learner** Chrome Extension.

## 1. Project Overview & Architecture
Immersion Learner is a Chrome Extension designed to help users learn languages while reading PDFs or browsing the web.
- **Tech Stack**: React 19, TypeScript, Vite, CRXJS (Manifest V3), Tailwind CSS.
- **Core Features**:
  - **PDF Reader**: A specialized page (`newtab.html`) for distraction-free reading with integrated translation.
  - **Wordbook**: A vocabulary management system stored in `chrome.storage.local`.
  - **Contextual Translation**: Chrome context menu and in-page popups for instant lookups.
- **Communication**:
  - Components use React state and hooks for local state.
  - Cross-context communication (Content Script <-> Background <-> NewTab) is handled via `chrome.runtime.sendMessage`.

## 2. Directory Structure Explanation
```
src/
├── background/       # Service worker: Context menus, API proxying (Translation/Dictionary)
├── content/          # Content scripts: Mounts React app in Shadow DOM on web pages
├── components/       # UI components
│   ├── ui/           # Atomic UI components (shadcn/ui style)
│   └── PDF*.tsx      # PDF reader specific components
├── hooks/            # Custom hooks (e.g., usePDFStorage, useTranslation)
├── pages/            # Entry points for Extension pages (Popup, NewTab)
├── utils/            # Pure functions and database helpers (IndexedDB)
├── types/            # Centralized TypeScript interfaces
└── config/           # Constants and configuration
```

## 3. Coding Standards & Conventions
- **Naming**: 
  - Components: `PascalCase.tsx`
  - Hooks: `useCamelCase.ts`
  - Utils/Types: `camelCase.ts`
  - Constants: `UPPER_SNAKE_CASE`
- **Functional Components**: Use `const Component: React.FC<Props> = ...` or `function Component({ props })`.
- **Absolute Imports**: Always use `@/` aliases defined in `vite.config.ts`.
- **Logic Separation**: Move complex logic from components into custom hooks or utility functions.

## 4. Development Workflow
- **Setup**: `npm install`
- **Development**: `npm run dev` (Vite + CRXJS provides HMR for most extension parts).
- **Chrome Integration**: Load the `dist` folder as an unpacked extension in `chrome://extensions`.
- **Git**: Follow the project's commit style: `feat:`, `fix:`, `docs:`, `refactor:`.

## 5. Testing Strategy
- **Unit Tests**: Place `.test.ts(x)` files adjacent to the implementation.
- **Focus**: Test utility functions (pure logic) and complex hooks.
- **Tools**: Vitest/Jest and React Testing Library (configured in project).

## 6. Build & Deployment
- **Build**: `npm run build` generates a production-ready `dist` folder.
- **Manifest**: Managed via `manifest.json` and processed by CRXJS in `vite.config.ts`.
- **Static Assets**: Large static assets should be in `public/` or `src/assets/`.

## 7. Chrome Extension Specifics
- **Manifest V3**: No remote code execution. All logic must be bundled.
- **Service Worker**: `background/index.ts` is ephemeral; do not rely on global state.
- **Shadow DOM**: Content scripts must mount React apps inside a Shadow Root to prevent CSS leakage from/to the host page.
- **Permissions**: Request minimal permissions in `manifest.json`.

## 8. Component Guidelines
- **Props**: Use interfaces for prop definitions.
- **Structure**:
  1. Hooks (useState, useEffect, custom hooks)
  2. Derived values (memoized with useMemo if expensive)
  3. Event handlers (useCallback)
  4. Early returns (for loading/error states)
  5. JSX
- **Styles**: Use Tailwind CSS classes exclusively.

## 9. Hook Guidelines
- **Single Responsibility**: Each hook should manage one logical feature (e.g., `useTranslation`).
- **Composition**: Use smaller hooks to build larger, feature-rich hooks (see `usePDFStorage.ts`).
- **External APIs**: Wrap Chrome API calls in hooks to simplify component usage.

## 10. Import/Path Alias Usage
Configured aliases in `vite.config.ts`:
- `@/components/*`: UI parts
- `@/hooks/*`: Logic
- `@/utils/*`: Helpers
- `@/types`: Shared types
- `@/pages/*`: Entry points

## 11. Error Handling & Debugging
- **Async Operations**: Always use `try/catch` for IndexedDB and Chrome Storage operations.
- **UI Feedback**: Use local state to show error messages to users.
- **Debugging**:
  - Background: Inspect via `chrome://extensions` -> Service Worker.
  - Popup/NewTab: Right-click -> Inspect.
  - Content Script: Inspect the web page console.

## 12. Performance Considerations
- **PDF Loading**: `react-pdf` uses web workers; ensure `pdf.worker.min.mjs` is correctly referenced in `public/`.
- **Storage**: Use `IndexedDB` via `utils/pdfStorage.ts` for large binary data (PDFs). Do NOT store large files in `chrome.storage`.
- **Memoization**: Use `useMemo` and `useCallback` for stable references passed to heavy components like `PDFViewer`.

## 13. Security Best Practices
- **Data Sanitization**: Sanitize any text before displaying it in the UI.
- **CSP**: Adhere to Content Security Policy; no `eval()` or inline scripts.
- **Storage**: Sensitive data should be handled with care, though this extension primarily stores user learning data.
- **External APIs**: Use the background script to proxy external API calls to avoid CORS issues and protect API keys (if any).
