import React, { useState, useEffect, useRef, useCallback } from 'react';
import CommandBar from './CommandBar';
import { setCookie, getCookie } from '../utils/cookieUtils';

const Console = ({ consoleMessages, darkMode, onCommand, addConsoleMessage }) => {
    const defaultHeight = 96; // Default height in pixels
    const minHeight = 50; // Minimum height in pixels
    const maxHeight = 500; // Maximum height in pixels
    const bottomOffset = 40; // Offset from the bottom of the screen (adjust as needed)

    const [isVisible, setIsVisible] = useState(false);
    const [isCommandBarFocused, setIsCommandBarFocused] = useState(false);
    const [consoleHeight, setConsoleHeight] = useState(
        parseInt(getCookie('consoleHeight')) || defaultHeight
    );
    const consoleRef = useRef(null);
    const resizeRef = useRef(null);
    const timeoutRef = useRef(null);

    const handleResize = useCallback((e) => {
        const containerRect = resizeRef.current.getBoundingClientRect();
        const newHeight = window.innerHeight - e.clientY - bottomOffset;
        setConsoleHeight(prev => {
            const updatedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            if (updatedHeight !== prev) {
                setCookie('consoleHeight', updatedHeight.toString(), 365);
            }
            return updatedHeight;
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleResize]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', handleMouseUp);
    }, [handleResize, handleMouseUp]);

    useEffect(() => {
        const resizeHandle = resizeRef.current?.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', handleMouseDown);
        }

        return () => {
            if (resizeHandle) {
                resizeHandle.removeEventListener('mousedown', handleMouseDown);
            }
        };
    }, [handleMouseDown]);

    useEffect(() => {
        if (consoleMessages.length > 0) {
            setIsVisible(true);
            scrollToBottom();
            resetFadeTimer();
        }
    }, [consoleMessages]);

    const scrollToBottom = () => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    };

    const resetFadeTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false);
        }, 5000); // 5 seconds
    };

    const handleMouseEnter = () => {
        setIsVisible(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    const handleMouseLeave = () => {
        if (!isCommandBarFocused) {
            resetFadeTimer();
        }
    };

    const handleCommandBarFocus = (focused) => {
        setIsCommandBarFocused(focused);
        if (focused) {
            setIsVisible(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        } else {
            resetFadeTimer();
        }
    };

    return (
        <>
            <div
                ref={resizeRef}
                className={`fixed bottom-10 left-1/3 w-1/3 transition-opacity duration-300 z-[1000] ${
                    isVisible ? 'opacity-90' : 'opacity-0'
                } overflow-hidden`}
                style={{ height: `${consoleHeight}px` }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={`h-2 w-full cursor-ns-resize resize-handle ${
                        darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                ></div>
                <div
                    ref={consoleRef}
                    className={`h-[calc(100%-8px)] overflow-y-auto p-2 flex flex-col-reverse ${
                        darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800'
                    }`}
                >
                    <div>
                        {consoleMessages.map((message, index) => (
                            <div key={index} className="text-xs mb-1 whitespace-pre-wrap">
                                {typeof message === 'string' ? message : (
                                    <React.Fragment>{message}</React.Fragment>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <CommandBar
                darkMode={darkMode}
                onCommand={onCommand}
                onFocusChange={handleCommandBarFocus}
            />
        </>
    );
};

export default Console;
