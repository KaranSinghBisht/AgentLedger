"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: (e: React.MouseEvent) => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("al-theme") as Theme;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('light', saved === 'light');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    const newTheme = theme === "dark" ? "light" : "dark";
    
    if (!document.startViewTransition) {
      setTheme(newTheme);
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      localStorage.setItem("al-theme", newTheme);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setTheme(newTheme);
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      localStorage.setItem("al-theme", newTheme);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 500,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  if (!mounted) return <div style={{ visibility: 'hidden' }}>{children}</div>;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 flex items-center justify-center text-[rgb(var(--text-muted))] hover:text-emerald-500 transition-all group relative"
      aria-label="Toggle Theme"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {/* Sun Icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={`w-5 h-5 absolute transition-all duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>

        {/* Moon Icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={`w-5 h-5 absolute transition-all duration-500 ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </div>
      
      {/* Subtle Underline on hover to match nav style */}
      <div className="absolute -bottom-1 left-0 w-full h-[1px] bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
    </button>
  );
}
