import React, { useState, useEffect } from 'react';

const LayerFilterPopup = ({ layer, onSave, onClear, onCancel, darkMode }) => {
  const [filters, setFilters] = useState({});

  useEffect(() => {
    // Initialize filters with existing values or empty strings for each field
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${darkMode ? 'bg-gray-900 bg-opacity-50' : 'bg-gray-200 bg-opacity-50'}`}>
      <div className={`relative w-full max-w-md p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg shadow-xl`}>
        <h2 className="text-xl font-bold mb-4">Filter: {layer.name}</h2>
        <div className="max-h-96 overflow-y-auto">
          {layer.fields.map(field => (
            <div key={field.name} className="mb-4">
              <label className="block text-sm font-medium mb-1" htmlFor={field.name}>
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
                className={`w-full px-3 py-2 border rounded-md ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 focus:border-blue-500' 
                    : 'bg-white border-gray-300 focus:border-blue-500'
                } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                placeholder={`Filter ${field.name}...`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6 space-x-2">
          <button
            onClick={handleClear}
            className={`px-4 py-2 rounded ${
              darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
            } text-white transition-colors duration-150`}
          >
            Clear Filters
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded ${
              darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white transition-colors duration-150`}
          >
            Save Filters
          </button>
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded ${
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
