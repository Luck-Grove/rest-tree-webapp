import React, { createContext, useState, useContext, useRef } from 'react';
import { getOrSetCookie } from '../utils/cookieUtils';
import { updateBasemap } from '../utils/mapUtils';

const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [basemap, setBasemap] = useState(() => getOrSetCookie('basemap', 'default', 365));
  const mapRef = useRef(null);

  const handleBasemapChange = (selectedBasemap) => {
    setBasemap(selectedBasemap);
    if (mapRef.current) {
      updateBasemap(mapRef.current, selectedBasemap, false); // Assuming darkMode is handled separately
    }
    document.cookie = `basemap=${encodeURIComponent(selectedBasemap)}; path=/; max-age=31536000`;
  };

  return (
    <MapContext.Provider value={{ basemap, handleBasemapChange, mapRef }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => useContext(MapContext);
