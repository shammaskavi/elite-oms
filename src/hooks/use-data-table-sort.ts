import { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface UseDataTableSortOptions<TKey extends string> {
  defaultKey?: TKey | null;
  defaultDirection?: SortDirection;
}

export function useDataTableSort<TKey extends string>(
  options: UseDataTableSortOptions<TKey> = {}
) {
  const [sortKey, setSortKey] = useState<TKey | null>(
    options.defaultKey ?? null
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    options.defaultDirection ?? null
  );

  /**
   * 3-state sort cycle:
   * 1st click: asc
   * 2nd click: desc
   * 3rd click: null (cleared / default order)
   */
  const handleSort = useCallback((key: TKey) => {
    setSortKey((currentKey) => {
      if (currentKey !== key) {
        setSortDirection("asc");
        return key;
      }

      setSortDirection((currentDir) => {
        if (currentDir === "asc") return "desc";
        if (currentDir === "desc") {
          // Clear sort on 3rd click
          return null;
        }
        return "asc";
      });

      return currentKey;
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortKey(null);
    setSortDirection(null);
  }, []);

  const getSortDirection = useCallback(
    (key: TKey): SortDirection => {
      return sortKey === key ? sortDirection : null;
    },
    [sortKey, sortDirection]
  );

  return {
    sortKey: sortDirection === null ? null : sortKey,
    sortDirection,
    handleSort,
    clearSort,
    getSortDirection,
    isSorted: useMemo(
      () => (key: TKey) => sortKey === key && sortDirection !== null,
      [sortKey, sortDirection]
    ),
  };
}

export default useDataTableSort;
