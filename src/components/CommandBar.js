import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCommandSuggestions } from '../utils/commandUtils';

const CommandBar = ({
  darkMode,
  onCommand,
  onFocusChange = () => {},
  initialCommand = '',
}) => {
  const [command, setCommand] = useState(initialCommand);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);
  const [isScrollingSuggestions, setIsScrollingSuggestions] = useState(false);
  const [lastExecutedCommand, setLastExecutedCommand] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setCommand(initialCommand);
  }, [initialCommand]);

  useEffect(() => {
    if (command && isFocused && !isNavigatingHistory && !isScrollingSuggestions) {
      setSuggestions(getCommandSuggestions(command));
      setSuggestionIndex(-1);
    } else if (!command) {
      setSuggestions([]);
      setSuggestionIndex(-1);
    }
  }, [command, isFocused, isNavigatingHistory, isScrollingSuggestions]);

  const executeCommand = useCallback((cmd) => {
    onCommand(cmd);
    setCommandHistory((prev) => {
      if (cmd === lastExecutedCommand && prev.length > 0) {
        // If the command is the same as the last executed command, update the last entry
        return [...prev.slice(0, -1), cmd];
      } else {
        // Otherwise, add a new entry
        return [...prev, cmd];
      }
    });
    setLastExecutedCommand(cmd);
    setCommand('');
    setHistoryIndex(-1);
    setSuggestionIndex(-1);
    setIsNavigatingHistory(false);
    setIsScrollingSuggestions(false);
  }, [onCommand, lastExecutedCommand]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9\s]*$/.test(value)) {
      setCommand(value);
      setHistoryIndex(-1);
      setSuggestionIndex(-1);
      setIsNavigatingHistory(false);
      setIsScrollingSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (suggestionIndex !== -1 && suggestions.length > 0) {
          executeCommand(suggestions[suggestionIndex]);
        } else if (command.trim()) {
          executeCommand(command.trim());
        }
        setIsNavigatingHistory(false);
        setIsScrollingSuggestions(false);
        break;
      case ' ':
        e.preventDefault();
        if (command.trim() === '' && commandHistory.length > 0) {
          const lastCommand = commandHistory[commandHistory.length - 1];
          executeCommand(lastCommand);
        } else if (command.trim()) {
          executeCommand(command.trim());
        }
        setIsNavigatingHistory(false);
        setIsScrollingSuggestions(false);
        break;
      case 'Escape':
        e.preventDefault();
        onCommand('');
        setCommand('');
        setHistoryIndex(-1);
        setSuggestionIndex(-1);
        setIsNavigatingHistory(false);
        setIsScrollingSuggestions(false);
        if (isFocused) {
          inputRef.current.blur();
        } else {
          inputRef.current.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (command === '' || isNavigatingHistory) {
          if (historyIndex < commandHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
            setIsNavigatingHistory(true);
            setIsScrollingSuggestions(false);
          }
        } else if (suggestions.length > 0) {
          setIsScrollingSuggestions(true);
          setSuggestionIndex((prevIndex) => 
            prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
          );
          setCommand(suggestions[suggestionIndex > 0 ? suggestionIndex - 1 : suggestions.length - 1]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (isNavigatingHistory) {
          if (historyIndex > -1) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCommand(
              newIndex === -1
                ? ''
                : commandHistory[commandHistory.length - 1 - newIndex]
            );
            if (newIndex === -1) {
              setIsNavigatingHistory(false);
            }
          }
        } else if (suggestions.length > 0) {
          setIsScrollingSuggestions(true);
          setSuggestionIndex((prevIndex) => 
            prevIndex < suggestions.length - 1 ? prevIndex + 1 : -1
          );
          setCommand(suggestions[suggestionIndex < suggestions.length - 1 ? suggestionIndex + 1 : -1] || '');
        }
        break;
      default:
        setIsNavigatingHistory(false);
        setIsScrollingSuggestions(false);
        break;
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange(false);
    setSuggestionIndex(-1);
    setIsNavigatingHistory(false);
    setIsScrollingSuggestions(false);
  };

  const handleSuggestionClick = (suggestion) => {
    executeCommand(suggestion);
  };

  // Update global key listener to handle initial key presses
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Check if the active element is an input field or contenteditable
      const isInputField = document.activeElement.matches(
        'input, textarea, [contenteditable="true"]'
      );

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isFocused) {
          inputRef.current.blur();
        } else {
          inputRef.current.focus();
        }
      } else if (e.key === ' ' && !isFocused && !isInputField && commandHistory.length > 0) {
        e.preventDefault();
        inputRef.current.focus();
        const lastCommand = commandHistory[commandHistory.length - 1];
        executeCommand(lastCommand);
      } else if (e.key === 'ArrowUp' && !isFocused && !isInputField && commandHistory.length > 0) {
        e.preventDefault();
        inputRef.current.focus();
        const lastCommand = commandHistory[commandHistory.length - 1];
        setCommand(lastCommand);
        setHistoryIndex(0);
        setIsNavigatingHistory(true);
      } else if (!isFocused && !isInputField) {
        const key = e.key;
        if (
          key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          inputRef.current.focus();
          setCommand(key);
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isFocused, commandHistory, executeCommand]);

  return (
    <div
      className={`fixed bottom-0 left-1/3 w-1/3 p-2 z-[1000] opacity-90 ${
        darkMode ? 'bg-gray-800' : 'bg-white'
      }`}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full p-1 rounded ${
            darkMode
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-black'
          }`}
          placeholder="Enter command..."
        />
        {suggestions.length > 0 && isFocused && !isNavigatingHistory && (
          <div
            className={`absolute bottom-full left-0 w-1/4 ${
              darkMode
                ? 'bg-gray-700 text-white'
                : 'bg-white text-black'
            } border rounded-t mb-1`}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`p-1 hover:bg-opacity-20 hover:bg-gray-500 ${
                  index === suggestionIndex ? 'bg-gray-500 bg-opacity-20' : ''
                } cursor-pointer`}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandBar;
