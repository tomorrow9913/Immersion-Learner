import { pdfjs } from 'react-pdf';

// Initialize PDF.js worker
// Using the worker file from the public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default pdfjs;
