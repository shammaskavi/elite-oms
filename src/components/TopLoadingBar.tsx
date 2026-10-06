import { useState, useEffect } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function TopLoadingBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isBusy = isFetching > 0 || isMutating > 0;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: any;

    if (isBusy) {
      setVisible(true);
      setProgress((prev) => (prev < 20 ? 25 : prev));

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) return prev;
          const increment = Math.max(1, (90 - prev) / 10);
          return Math.min(85, prev + increment);
        });
      }, 150);
    } else {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, [isBusy]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[3px] w-full overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_8px_rgba(var(--primary-rgb,59,130,246),0.8)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}

export default TopLoadingBar;
