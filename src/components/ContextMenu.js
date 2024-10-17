import React from 'react';

const ContextMenu = ({ contextMenu, handleDownloadLayer, handleDownloadShapefile, darkMode, onClose, isLayer, zoomToLayerExtent }) => {
  if (!contextMenu.visible) return null;

  const menuStyle = {
    position: 'fixed',
    top: `${contextMenu.y}px`,
    left: `${contextMenu.x}px`,
    zIndex: 1000,
  };

  const menuItemClass = `px-4 py-2 hover:bg-opacity-80 cursor-pointer ${
    darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
  }`;

  const handleMenuItemClick = (action) => {
    action(contextMenu.node);
    onClose();
  };

  return (
    <div
      className={`context-menu rounded-md shadow-lg ${
        darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
      }`}
      style={menuStyle}
    >
      <div 
        className={menuItemClass} 
        onClick={() => handleMenuItemClick(handleDownloadLayer)}
      >
        Download as GeoJSON
      </div>
      <div 
        className={menuItemClass} 
        onClick={() => handleMenuItemClick(handleDownloadShapefile)}
      >
        Download as Shapefile
      </div>
      {isLayer && (
        <div 
          className={menuItemClass} 
          onClick={() => handleMenuItemClick(() => zoomToLayerExtent(contextMenu.node.id))}
        >
          Zoom to Layer Extent
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
