import React, { createContext, useState, useContext, useEffect } from 'react';
import { getOrSetCookie } from '../utils/cookieUtils';

const DarkModeContext = createContext();

export const DarkModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => getOrSetCookie('darkMode', 'true', 365) === 'true');

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark', 'bg-gray-900', 'text-gray-100');
    } else {
      document.body.classList.remove('dark', 'bg-gray-900', 'text-gray-100');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prevDarkMode) => {
      const newDarkMode = !prevDarkMode;
      document.cookie = `darkMode=${newDarkMode}; path=/; max-age=31536000`;
      return newDarkMode;
    });
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
