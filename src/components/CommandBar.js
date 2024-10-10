import React, { useState, useEffect, useRef } from 'react';
import { getCommandSuggestions } from '../utils/commandUtils';

const CommandBar = ({ darkMode, onCommand, onFocusChange = () => {}, initialCommand = '' }) => {
    const [command, setCommand] = useState(initialCommand);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [suggestions, setSuggestions] = useState([]);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        setCommand(initialCommand);
    }, [initialCommand]);

    useEffect(() => {
        if (command && isFocused) {
            setSuggestions(getCommandSuggestions(command));
        } else {
            setSuggestions([]);
        }
    }, [command, isFocused]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        if (/^[a-zA-Z0-9\s]*$/.test(value)) {
            setCommand(value);
            setHistoryIndex(-1);
        }
    };

    const handleKeyDown = (e) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (command.trim()) {
                    onCommand(command.trim());
                    setCommandHistory(prev => [...prev, command.trim()]);
                    setCommand('');
                    setHistoryIndex(-1);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onCommand('');
                setCommand('');
                setHistoryIndex(-1);
                if (isFocused) {
                    inputRef.current.blur();
                } else {
                    inputRef.current.focus();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    const newIndex = historyIndex + 1;
                    setHistoryIndex(newIndex);
                    setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (historyIndex > -1) {
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    setCommand(newIndex === -1 ? '' : commandHistory[commandHistory.length - 1 - newIndex]);
                }
                break;
            default:
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
    };

    // Add global key listener for Escape
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (isFocused) {
                    inputRef.current.blur();
                } else {
                    inputRef.current.focus();
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isFocused]);

    return (
        <div className={`fixed bottom-0 left-1/3 w-1/3 p-2 z-[1000] opacity-90 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
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
                        darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-black'
                    }`}
                    placeholder="Enter command..."
                />
                {suggestions.length > 0 && isFocused && (
                    <div className={`absolute bottom-full right-0 w-1/3 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-black'} border rounded-t mb-1`}>
                        {suggestions.map((suggestion, index) => (
                            <div key={index} className="p-1 hover:bg-opacity-20 hover:bg-gray-500">
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