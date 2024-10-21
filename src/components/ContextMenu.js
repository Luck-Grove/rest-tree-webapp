import React from 'react';

const ContextMenu = ({ contextMenu, handleDownloadLayer, handleDownloadShapefile, darkMode, onClose, isLayer, zoomToLayerExtent, getLink }) => {
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
    try {
        if (typeof action === 'function') {
            action(contextMenu.node);
        }
    } catch (error) {
        console.error('Error executing context menu action:', error);
    } finally {
        onClose();
    }
};

return (
  <div
      className={`context-menu rounded-md shadow-lg ${
          darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
      }`}
      style={menuStyle}
  >
          {isLayer && (
          <div 
              className={menuItemClass} 
              onClick={() => handleMenuItemClick(() => zoomToLayerExtent(contextMenu.nodeId, contextMenu.treeData, contextMenu.map))}
          >
              Zoom to Layer Extent
          </div>
      )}
        <div 
            className={menuItemClass} 
            onClick={() => handleMenuItemClick(() => getLink(contextMenu.nodeId, contextMenu.treeData))}
        >
            View Details
        </div>
      {isLayer && (
      <div 
          className={menuItemClass} 
          onClick={() => handleMenuItemClick(handleDownloadLayer)}
      >
          Download as GeoJSON
      </div>
      )}
      {isLayer && (
      <div 
          className={menuItemClass} 
          onClick={() => handleMenuItemClick(handleDownloadShapefile)}
      >
          Download as Shapefile
      </div>
      )}
  </div>
);
};

export default ContextMenu;
