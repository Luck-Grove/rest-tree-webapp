import React, { useState, useEffect } from 'react';

const LayerFilterPopup = ({ layer, onSave, onClear, onCancel, darkMode, onQueryLayer }) => {
  const [filters, setFilters] = useState({});
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (layer && layer.fields) {
      const initialFilters = {};
      const initialSelectedFields = [];
      const initialAvailableFields = [];
      layer.fields.forEach(field => {
        if (layer.filters?.[field.name]) {
          initialFilters[field.name] = layer.filters[field.name];
          initialSelectedFields.push(field.name);
        } else {
          initialAvailableFields.push(field.name);
        }
      });
      setFilters(initialFilters);
      setSelectedFields(initialSelectedFields);
      setAvailableFields(initialAvailableFields);
    }
  }, [layer]);

  const handleFilterChange = (fieldName, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [fieldName]: value
    }));
  };

  const handleAddField = (fieldName) => {
    setSelectedFields(prev => [...prev, fieldName]);
    setAvailableFields(prev => prev.filter(f => f !== fieldName));
    setFilters(prev => ({ ...prev, [fieldName]: '' }));
  };

  const handleRemoveField = (fieldName) => {
    setSelectedFields(prev => prev.filter(f => f !== fieldName));
    setAvailableFields(prev => [...prev, fieldName]);
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[fieldName];
      return newFilters;
    });
  };

  const handleSave = () => {
    onSave(filters);
  };

  const handleClear = () => {
    setFilters({});
    setSelectedFields([]);
    setAvailableFields(layer.fields.map(f => f.name));
    onClear();
  };

  const handleTest = async () => {
    setTestResult('Testing...');
    try {
      if (!onQueryLayer) {
        throw new Error('Query function not provided');
      }
      const count = await onQueryLayer(layer, filters);
      if (count > 500) {
        setTestResult('> 500 objects returned');
      } else {
        setTestResult(`${count} object${count !== 1 ? 's' : ''} returned`);
      }
    } catch (error) {
      console.error('Error testing filters:', error);
      setTestResult('Error testing filters: ' + error.message);
    }
  };

  const filteredAvailableFields = availableFields.filter(f => 
    f.toLowerCase().includes(leftSearch.toLowerCase())
  );

  const filteredSelectedFields = selectedFields.filter(f => 
    f.toLowerCase().includes(rightSearch.toLowerCase())
  );

  if (!layer || !layer.fields) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className={`absolute inset-0 ${darkMode ? 'bg-black' : 'bg-gray-500'} opacity-50`} onClick={onCancel}></div>
      <div className={`relative w-full max-w-4xl ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'} rounded-lg shadow-xl`} style={{ height: 'calc(100vh - 4rem)' }}>
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
        <div className="flex h-full" style={{ height: 'calc(100% - 8rem)' }}>
          <div className="w-1/2 p-4 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              {filteredAvailableFields.map((field, index) => (
                <div key={field} className={`flex items-center p-2 ${index % 2 === 0 ? darkMode ? 'bg-gray-700' : 'bg-gray-100' : ''}`}>
                  <span className={`flex-grow ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{field}</span>
                  <button
                    onClick={() => handleAddField(field)}
                    className={`w-6 h-6 flex items-center justify-center rounded text-lg ${
                      darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                    } text-white transition-colors duration-150`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
            <input
              type="text"
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
              placeholder="Search available fields..."
              className={`w-full px-2 py-1 mt-2 text-xs ${
                darkMode 
                  ? 'bg-gray-700 text-gray-300 border-gray-600' 
                  : 'bg-white text-gray-700 border-gray-300'
              } border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
            />
          </div>
          <div className="w-1/2 p-4 flex flex-col">
            <div className="flex-grow overflow-y-auto">
              {filteredSelectedFields.map((field, index) => (
                <div key={field} className={`mb-3 p-2 ${index % 2 === 0 ? darkMode ? 'bg-gray-700' : 'bg-gray-100' : ''}`}>
                  <div className="flex items-center mb-1">
                    <span className={`flex-grow ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{field}</span>
                    <button
                      onClick={() => handleRemoveField(field)}
                      className={`w-6 h-6 flex items-center justify-center rounded text-lg ${
                        darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                      } text-white transition-colors duration-150`}
                    >
                      -
                    </button>
                  </div>
                  <input
                    type="text"
                    value={filters[field] || ''}
                    onChange={(e) => handleFilterChange(field, e.target.value)}
                    className={`w-full px-2 py-1 text-xs ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-300 border-gray-600' 
                        : 'bg-white text-gray-700 border-gray-300'
                    } border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    placeholder={`Filter ${field}...`}
                  />
                </div>
              ))}
            </div>
            <input
              type="text"
              value={rightSearch}
              onChange={(e) => setRightSearch(e.target.value)}
              placeholder="Search selected fields..."
              className={`w-full px-2 py-1 mt-2 text-xs ${
                darkMode 
                  ? 'bg-gray-700 text-gray-300 border-gray-600' 
                  : 'bg-white text-gray-700 border-gray-300'
              } border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
            />
          </div>
        </div>
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <button
              onClick={handleTest}
              className={`px-4 py-2 rounded text-xs mr-2 ${
                darkMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-yellow-500 hover:bg-yellow-600'
              } text-white transition-colors duration-150`}
            >
              Test Filters
            </button>
            <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{testResult}</span>
          </div>
          <div>
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
    </div>
  );
};

export default LayerFilterPopup;
