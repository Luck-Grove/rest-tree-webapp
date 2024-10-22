// SearchBar.js
import React, { useRef, useEffect } from 'react';

const SearchBar = ({
  address,
  setAddress,
  handleAddressSubmit,
  handleAddressChange,
  suggestions,
  hasFocus,
  setHasFocus,
  handleSuggestionClick,
  darkMode,
  handleKeyDown,
  selectedSuggestionIndex
}) => {
  const addressInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const handleInputKeyDown = (e) => {
    if (hasFocus && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          handleKeyDown('ArrowDown');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleKeyDown('ArrowUp');
          break;
        case 'Enter':
          if (selectedSuggestionIndex !== -1) {
            e.preventDefault();
            handleSuggestionClick(suggestions[selectedSuggestionIndex]);
            addressInputRef.current?.blur();
          } else {
            handleAddressSubmit(e, addressInputRef);
            addressInputRef.current?.blur();
          }
          break;
        case 'Escape':
          e.preventDefault();
          addressInputRef.current?.blur();
          break;
        default:
          break;
      }
    } else if (e.key === 'Enter') {
      handleAddressSubmit(e, addressInputRef);
      addressInputRef.current?.blur();
    }
  };

  const handleFormSubmit = (e) => {
    handleAddressSubmit(e, addressInputRef);
    addressInputRef.current?.blur();
  };

  useEffect(() => {
    if (suggestionsRef.current && selectedSuggestionIndex !== -1) {
      const selectedElement = suggestionsRef.current.children[selectedSuggestionIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedSuggestionIndex]);

  return (
    <div className="absolute top-4 left-1/3 z-[1001] w-1/3">
      <form onSubmit={handleFormSubmit} className="flex flex-col">
        <div className="relative">
          <input
            type="text"
            value={address}
            onChange={handleAddressChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            placeholder="Enter an address..."
            ref={addressInputRef}
            className={`w-full px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <button 
            type="submit" 
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-md`}
          >
            Go
          </button>
        </div>
        {hasFocus && suggestions.length > 0 && (
          <ul ref={suggestionsRef} className={`mt-1 border rounded-md shadow-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} max-h-60 overflow-auto`}>
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  handleSuggestionClick(suggestion);
                  addressInputRef.current?.blur();
                }}
                className={`px-3 py-2 cursor-pointer ${
                  index === selectedSuggestionIndex
                    ? (darkMode ? 'bg-gray-600' : 'bg-gray-100')
                    : (darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100')
                }`}
              >
                {suggestion.display_name}
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
};

export default SearchBar;