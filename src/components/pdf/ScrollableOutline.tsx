import React from 'react';

interface OutlineItem {
  title: string;
  dest: any;
  items?: OutlineItem[];
  pageNumber?: number;
}

interface ScrollableOutlineProps {
  outline: OutlineItem[];
  onItemClick: (dest: any, title: string, pageNumber?: number) => void;
  totalPages?: number;
}

const OutlineItemNode: React.FC<{ item: OutlineItem; onItemClick: (dest: any, title: string, pageNumber?: number) => void; level: number }> = ({ item, onItemClick, level }) => {
  const handleItemClick = () => {
    onItemClick(item.dest, item.title, item.pageNumber);
  };

  return (
    <div>
      <div
        className="px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={handleItemClick}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        title={item.title}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 hover:text-gray-900 truncate block">
            {item.title}
          </span>
          {item.pageNumber && (
            <span className="text-xs text-blue-500 ml-auto">
              ({item.pageNumber})
            </span>
          )}
        </div>
      </div>
      {item.items && item.items.length > 0 && (
        <div style={{ paddingLeft: '16px' }}>
          {item.items.map((child, index) => (
            <OutlineItemNode key={index} item={child} onItemClick={onItemClick} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const ScrollableOutline: React.FC<ScrollableOutlineProps> = ({ outline, onItemClick }) => {
  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="space-y-1">
        {outline.map((item, index) => (
          <OutlineItemNode key={index} item={item} onItemClick={onItemClick} level={0} />
        ))}
      </div>
    </div>
  );
};

export default ScrollableOutline;
