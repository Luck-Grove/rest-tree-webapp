// SearchBar.js
import React, { useRef, useEffect } from 'react';

const SearchBar = ({
  address,
  setAddress,
  handleAddressSubmit,
  handleAddressChange,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  handleSuggestionClick,
  darkMode,
  handleKeyDown,
  selectedSuggestionIndex
}) => {
  const addressInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const isSubmitting = useRef(false);

  // Handle clicks outside the search bar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowSuggestions]);

  const handleInputKeyDown = (e) => {
    // First let the suggestion navigation logic handle its cases
    handleKeyDown(e);
    
    // Then handle the Enter case for direct address submission
    if (e.key === 'Enter') {
      isSubmitting.current = true;
      if (!showSuggestions || selectedSuggestionIndex === -1) {
        // Only handle direct submission if no suggestion is selected
        handleAddressSubmit(e, addressInputRef);
      }
      addressInputRef.current?.blur();
    }
  };

  const handleFormSubmit = (e) => {
    isSubmitting.current = true;
    handleAddressSubmit(e, addressInputRef);
    addressInputRef.current?.blur();
  };

  // Reset submission state when focus is lost
  const handleBlur = () => {
    if (isSubmitting.current) {
      setShowSuggestions(false);
      isSubmitting.current = false;
    }
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
            onBlur={handleBlur}
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
        {showSuggestions && suggestions.length > 0 && (
          <ul ref={suggestionsRef} className={`mt-1 border rounded-md shadow-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} max-h-60 overflow-auto`}>
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
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