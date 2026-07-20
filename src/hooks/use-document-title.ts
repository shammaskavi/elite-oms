import { useEffect } from "react";

const APP_NAME = "Saree Palace Elite";

/**
 * Sets `document.title` for the current page. Restores the previous title on
 * unmount so transient routes don't leave the title stale.
 *
 * Usage:
 *   useDocumentTitle("Invoices");           // → "Invoices · Saree Palace Elite"
 *   useDocumentTitle("Order #1234", { suffix: false }); // → "Order #1234"
 */
export function useDocumentTitle(
  title: string,
  options: { suffix?: boolean } = { suffix: true }
) {
  useEffect(() => {
    const previous = document.title;
    document.title = options.suffix ? `${title} · ${APP_NAME}` : title;
    return () => {
      document.title = previous;
    };
  }, [title, options.suffix]);
}

export default useDocumentTitle;
