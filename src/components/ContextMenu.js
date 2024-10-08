import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const ContextMenu = ({ contextMenu, handleDownloadLayer, handleDownloadShapefile, darkMode, onClose }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    if (!contextMenu.visible) return null;

    const menuContent = (
        <div 
            ref={menuRef}
            className={`fixed ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-black'} border shadow-md rounded-md py-2`}
            style={{ 
                top: `${contextMenu.y}px`, 
                left: `${contextMenu.x}px`,
                zIndex: 9999
            }}
        >
            <button 
                className={`block w-full text-left px-4 py-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                onClick={() => {
                    handleDownloadLayer(contextMenu.nodeId);
                    onClose();
                }}
            >
                Download GeoJSON
            </button>
            <button 
                className={`block w-full text-left px-4 py-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                onClick={() => {
                    handleDownloadShapefile(contextMenu.nodeId);
                    onClose();
                }}
            >
                Download Shapefile
            </button>
        </div>
    );

    return ReactDOM.createPortal(
        menuContent,
        document.body
    );
};

export default ContextMenu;