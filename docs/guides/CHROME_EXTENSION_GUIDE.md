# Chrome Extension Development Guide

## Quick Start

1. **Development Mode**:
   ```bash
   npm run dev
   ```
   Load the `dist` folder in Chrome at `chrome://extensions` with "Load unpacked".

2. **Build for Production**:
   ```bash
   npm run build
   ```
   The built extension will be in the `dist` folder.

3. **Testing**:
   ```bash
   npm test                 # Run all tests
   npm run test:watch       # Watch mode
   npm run test:coverage    # With coverage report
   npm run test:ui          # Visual test interface
   ```

## Extension Architecture

### Entry Points
- **Popup**: `src/pages/Popup.tsx` - Extension popup UI
- **New Tab**: `src/pages/NewTab.tsx` - PDF reader interface
- **Background**: `src/background/index.ts` - Service worker
- **Content Script**: `src/content/index.tsx` - Web page interaction

### Key Features
- **PDF Reading**: Full-screen PDF viewer with translation tools
- **Wordbook**: Store and manage vocabulary
- **Context Menu**: Right-click translation on any page
- **Chrome Storage**: Sync data across devices

## Development Workflow

### File Structure
```
src/
├── components/       # React components
│   ├── ui/          # Basic UI components (shadcn/ui)
│   └── *.tsx        # Feature components
├── hooks/           # Custom React hooks
├── pages/           # Extension entry points
├── utils/           # Helper functions
├── types/           # TypeScript definitions
├── config/          # Configuration files
└── background/      # Service worker
```

### Path Aliases
Use `@/` prefix for all internal imports:
```typescript
import { useTranslation } from '@/hooks/useTranslation';
import { PDFViewer } from '@/components/PDFViewer';
```

### Chrome APIs
All Chrome APIs are mocked in tests via `src/test/setup.ts`.

### PDF Worker
The PDF.js worker is initialized in `src/config/pdfWorker.ts` and imported in entry points.

## Testing Strategy

- **Unit Tests**: Test hooks and utility functions
- **Component Tests**: Test React components with Testing Library
- **Integration Tests**: Test Chrome extension interactions
- **Coverage**: Target 80%+ coverage for critical paths

## Chrome Extension Debugging

1. **Service Worker**: `chrome://extensions` → Service Worker → inspect
2. **Popup/New Tab**: Right-click → Inspect
3. **Content Script**: Regular browser dev tools on target page
4. **Errors**: Check `chrome://extensions` for extension errors

## Build Process

- **Vite**: Handles bundling and development server
- **CRXJS**: Converts Vite build to Chrome extension format
- **TypeScript**: Strict type checking enabled
- **Manifest V3**: Uses latest Chrome extension standards

## Common Issues

### PDF Not Loading
- Ensure `pdf.worker.min.mjs` is in `public/`
- Check worker initialization in `src/config/pdfWorker.ts`
- Verify content security policy allows loading workers

### Chrome API Not Available
- Use proper manifest permissions
- Check if code runs in extension context
- Mock Chrome APIs in tests

### Build Errors
- Run `npm run typecheck` for TypeScript errors
- Check import paths use `@/` aliases
- Ensure all dependencies are installed

## Performance Optimization

- **PDF Loading**: Use IndexedDB for large files
- **Memory**: Clean up observers and event listeners
- **Bundle Size**: Code splitting and tree shaking
- **Chrome Storage**: Minimize storage usage

## Security

- **CSP**: Follow Content Security Policy
- **Permissions**: Request minimal permissions only
- **Data**: No sensitive data in localStorage
- **External APIs**: Proxy through background script