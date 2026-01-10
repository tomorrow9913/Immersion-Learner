import React from 'react';
import type { OutlineItem } from '@/types';
import ScrollableOutline from './ScrollableOutline';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  outline: OutlineItem[];
  totalPages: number;
  onToggleSidebar: () => void;
  onOutlineItemClick: (dest: any, title: string, pageNumber?: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  outline,
  totalPages,
  onToggleSidebar,
  onOutlineItemClick,
}) => {
  const handleOutlineClick = (dest: any, title: string, pageNumber?: number) => {
    onOutlineItemClick(dest, title, pageNumber);
  };

  return (
    <div className={`${isSidebarOpen ? 'w-80' : 'w-12'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-end flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="p-2"
        >
          {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {isSidebarOpen && (
        <div className="flex-1 min-h-0">
          {outline.length > 0 ? (
            <ScrollableOutline
              outline={outline}
              onItemClick={handleOutlineClick}
              totalPages={totalPages}
            />
          ) : (
            <div className="text-gray-500 text-sm text-center py-4">
              목차가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;