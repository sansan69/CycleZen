import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface AppState {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
}

function getInitialTheme(): { theme: Theme; isDarkMode: boolean } {
  if (typeof window === 'undefined') return { theme: 'system', isDarkMode: false };
  const stored = localStorage.getItem('cyclezen-theme') as Theme | null;
  const theme = stored || 'system';
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) document.documentElement.classList.add('dark');
  return { theme, isDarkMode: isDark };
}

export const useAppStore = create<AppState>((set) => {
  const initial = getInitialTheme();
  return {
    ...initial,
    setTheme: (theme) => {
      localStorage.setItem('cyclezen-theme', theme);
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      set({ theme, isDarkMode: isDark });
    },
    toggleDarkMode: () => {
      const state = useAppStore.getState();
      const newIsDark = !state.isDarkMode;
      const newTheme: Theme = newIsDark ? 'dark' : 'light';
      localStorage.setItem('cyclezen-theme', newTheme);
      document.documentElement.classList.toggle('dark', newIsDark);
      set({ theme: newTheme, isDarkMode: newIsDark });
    },
  };
});
