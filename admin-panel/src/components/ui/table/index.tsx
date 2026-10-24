import React, { ReactNode } from "react";

// Props for Table
interface TableProps {
  children: ReactNode; // Table content (thead, tbody, etc.)
  className?: string; // Optional className for styling
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode; // Header row(s)
  className?: string; // Optional className for styling
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode; // Body row(s)
  className?: string; // Optional className for styling
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode; // Cells (th or td)
  className?: string; // Optional className for styling
  onClick?: () => void; // Optional click handler for clickable rows
}

// Props for TableCell
interface TableCellProps {
  children: ReactNode; // Cell content
  isHeader?: boolean; // If true, renders as <th>, otherwise <td>
  className?: string; // Optional className for styling
  colSpan?: number; // Optional colSpan
}

// Table Component
const Table: React.FC<TableProps> = ({ children, className = "" }) => {
  return <table className={`min-w-full text-left text-sm ${className}`}>{children}</table>;
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className = "" }) => {
  return <thead className={`border-b bg-gray-50 text-xs uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400 ${className}`}>{children}</thead>;
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className = "" }) => {
  return <tbody className={`divide-y divide-gray-100 dark:divide-gray-800 ${className}`}>{children}</tbody>;
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className = "", onClick }) => {
  return (
    <tr
      className={`transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

// TableCell Component
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className = "",
  colSpan,
}) => {
  const CellTag = isHeader ? "th" : "td";
  const baseClasses = isHeader 
    ? "px-4 py-3 font-semibold tracking-wide text-left" 
    : "px-4 py-3 align-middle";
    
  return <CellTag colSpan={colSpan} className={`${baseClasses} ${className}`}>{children}</CellTag>;
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
