import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns: string[] | number;
  rows?: number;
  showHeader?: boolean;
}

export function TableSkeleton({
  columns,
  rows = 6,
  showHeader = true,
}: TableSkeletonProps) {
  const columnCount = Array.isArray(columns) ? columns.length : columns;
  const columnHeaders = Array.isArray(columns) ? columns : null;

  return (
    <Table>
      {showHeader && columnHeaders && (
        <TableHeader>
          <TableRow>
            {columnHeaders.map((header, idx) => (
              <TableHead key={idx}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <TableRow key={rowIdx} className="hover:bg-transparent">
            {Array.from({ length: columnCount }).map((_, colIdx) => {
              // Staggered width for natural look
              const widths = ["w-16", "w-24", "w-32", "w-20", "w-28", "w-12"];
              const randomWidth = widths[(rowIdx + colIdx) % widths.length];

              return (
                <TableCell key={colIdx} className="py-3.5">
                  <Skeleton className={`h-4 ${randomWidth} max-w-full`} />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default TableSkeleton;
