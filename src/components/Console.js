import React from 'react';

const Console = ({ consoleRef, consoleMessages, darkMode }) => {
    return (
        <div 
            ref={consoleRef} 
            className={`mt-4 h-40 overflow-auto p-2 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
        >
            {consoleMessages.map((message, index) => (
                <div key={index} className="text-sm">
                    {typeof message === 'string' ? message : (
                        <React.Fragment>{message}</React.Fragment>
                    )}
                </div>
            ))}
        </div>
    );
};

export default Console;