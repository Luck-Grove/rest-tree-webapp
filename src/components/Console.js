import React, { useState, useEffect, useRef } from 'react';

const Console = ({ consoleMessages, darkMode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const consoleRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (consoleMessages.length > 0) {
            setHasNewMessages(true);
            setIsVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setIsVisible(false);
            }, 5000);
        }
    }, [consoleMessages]);

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleMessages, isVisible]);

    const handleMouseEnter = () => {
        setIsVisible(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 1000);
    };

    return (
        <div
        className={`fixed bottom-0 left-1/3 w-1/3 transition-opacity duration-300 z-[1000] ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className={`h-1 w-full ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-300'
                } ${hasNewMessages ? 'animate-pulse' : ''}`}
            ></div>
            <div
                ref={consoleRef}
                className={`h-32 overflow-y-auto p-2 ${
                    darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'
                }`}
            >
                {consoleMessages.map((message, index) => (
                    <div key={index} className="text-sm mb-1">
                        {typeof message === 'string' ? message : (
                            <React.Fragment>{message}</React.Fragment>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Console;