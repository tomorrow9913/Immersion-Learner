import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PDFControls from './PDFControls';

describe('PDFControls', () => {
  const defaultProps = {
    pageNumber: 1,
    numPages: 10,
    onPageChange: vi.fn(),
    onFileSelect: vi.fn(),
  };

  it('renders page numbers correctly', () => {
    render(<PDFControls {...defaultProps} />);
    expect(screen.getByText('of 10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('calls onPageChange when Next button is clicked', () => {
    render(<PDFControls {...defaultProps} />);
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when Prev button is clicked', () => {
    render(<PDFControls {...defaultProps} pageNumber={2} />);
    const prevButton = screen.getByText('Prev');
    fireEvent.click(prevButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Prev button on first page', () => {
    render(<PDFControls {...defaultProps} pageNumber={1} />);
    const prevButton = screen.getByText('Prev');
    expect(prevButton).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<PDFControls {...defaultProps} pageNumber={10} />);
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('calls onFileSelect when a file is selected', () => {
    render(<PDFControls {...defaultProps} />);
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('controls-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    expect(defaultProps.onFileSelect).toHaveBeenCalledWith(file);
  });
});
