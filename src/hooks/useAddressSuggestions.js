// useAddressSuggestions.js
import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const useAddressSuggestions = (mapRef) => {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionTimeoutRef = useRef(null);

  const clearSuggestionTimeout = () => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
  };

  const handleAddressChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    setSelectedSuggestionIndex(-1);
    clearSuggestionTimeout();
    
    if (value.length > 2) {
      suggestionTimeoutRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const fetchSuggestions = async (query) => {
    try {
      const usResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'json',
          q: query,
          limit: 5,
          countrycodes: 'us',
        },
      });
      const usResults = usResponse.data;
      setSuggestions(usResults);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSuggestionClick = useCallback((suggestion) => {
    clearSuggestionTimeout();
    setAddress(suggestion.display_name);
    setShowSuggestions(false);
    if (mapRef.current) {
      const { lat, lon, boundingbox } = suggestion;
      if (boundingbox) {
        mapRef.current.fitBounds([
          [boundingbox[0], boundingbox[2]],
          [boundingbox[1], boundingbox[3]],
        ]);
      } else {
        mapRef.current.setView([lat, lon], 13);
      }
    }
  }, [mapRef]);

  const handleAddressSubmit = useCallback((e, inputRef) => {
    e.preventDefault();
    clearSuggestionTimeout();
    setShowSuggestions(false);
    setSuggestions([]);
    
    if (inputRef && inputRef.current) {
      inputRef.current.blur();
    }
    
    if (mapRef.current && address) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      )
        .then((response) => response.json())
        .then((data) => {
          if (data && data.length > 0) {
            const { lat, lon, boundingbox } = data[0];
            if (boundingbox) {
              mapRef.current.fitBounds([
                [boundingbox[0], boundingbox[2]],
                [boundingbox[1], boundingbox[3]],
              ]);
            } else {
              mapRef.current.setView([lat, lon], 13);
            }
          } else {
            alert('Address not found');
          }
        })
        .catch((error) => {
          console.error('Error in geocoding:', error);
          alert('Error in geocoding. Please try again.');
        });
    }
  }, [address, mapRef]);

  // Cleanup function to be used in useEffect
  const cleanup = () => {
    clearSuggestionTimeout();
  };

  return {
    address,
    setAddress,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    handleAddressChange,
    handleSuggestionClick,
    handleAddressSubmit,
    cleanup,
  };
};

export default useAddressSuggestions;