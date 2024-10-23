import React, { useState, useEffect } from 'react';

const LayerFilterPopup = ({ layer, onSave, onClear, onCancel, darkMode }) => {
  const [filters, setFilters] = useState({});

  useEffect(() => {
    if (layer && layer.fields) {
      const initialFilters = {};
      layer.fields.forEach(field => {
        initialFilters[field.name] = layer.filters?.[field.name] || '';
      });
      setFilters(initialFilters);
    }
  }, [layer]);

  const handleFilterChange = (fieldName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [fieldName]: value
    }));
  };

  const handleSave = () => {
    onSave(filters);
  };

  const handleClear = () => {
    const clearedFilters = Object.keys(filters).reduce((acc, key) => {
      acc[key] = '';
      return acc;
    }, {});
    setFilters(clearedFilters);
    onClear();
  };

  if (!layer || !layer.fields) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className={`absolute inset-0 ${darkMode ? 'bg-black' : 'bg-gray-500'} opacity-50`} onClick={onCancel}></div>
      <div className={`relative w-full max-w-md ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'} rounded-lg shadow-xl`} style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold">Filter: {layer.name}</h2>
          <button
            onClick={onCancel}
            className={`text-gray-500 hover:text-gray-700 ${darkMode ? 'hover:text-gray-300' : ''}`}
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
          {layer.fields.map(field => (
            <div key={field.name} className="mb-3">
              <label className={`block mb-1 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} htmlFor={field.name}>
                {field.name}
                {filters[field.name] && (
                  <span className={`ml-2 px-1 py-0.5 text-xs rounded ${darkMode ? 'bg-blue-600' : 'bg-blue-100 text-blue-800'}`}>
                    Filtered
                  </span>
                )}
              </label>
              <input
                type="text"
                id={field.name}
                value={filters[field.name] || ''}
                onChange={(e) => handleFilterChange(field.name, e.target.value)}
                className={`w-full px-2 py-1 text-xs ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 border-gray-600' 
                    : 'bg-white text-gray-700 border-gray-300'
                } border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
                placeholder={`Filter ${field.name}...`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClear}
            className={`px-4 py-2 rounded text-xs mr-2 ${
              darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
            } text-white transition-colors duration-150`}
          >
            Clear Filters
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded text-xs mr-2 ${
              darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors duration-150`}
          >
            Save Filters
          </button>
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded text-xs ${
              darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-300 hover:bg-gray-400'
            } text-white transition-colors duration-150`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerFilterPopup;
