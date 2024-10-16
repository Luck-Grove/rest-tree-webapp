import React from 'react';

const TreeNode = ({
  nodeId, treeData, expandedNodes, toggleNode, selectedLayers = [], setSelectedLayers,
  handleContextMenu, zoomToLayerExtent, darkMode, showOnlyActiveLayers,
  handleDownloadShapefile, handleDownloadGeoJSON, setContextMenu, level = 0,
}) => {
  const node = treeData[nodeId];
  if (!node) return null;
  
  const selectedLayer = Array.isArray(selectedLayers) 
    ? selectedLayers.find(layer => layer.id === nodeId)
    : null;
  const isVisible = selectedLayer ? selectedLayer.visible : false;
  
  if (showOnlyActiveLayers && !isVisible && node.type === 'layer') return null;

  const childNodes = Object.entries(treeData)
    .filter(([_, data]) => data.parent === nodeId)
    .map(([childId, _]) => (
      <TreeNode key={childId} nodeId={childId} treeData={treeData} expandedNodes={expandedNodes}
        toggleNode={toggleNode} selectedLayers={selectedLayers} setSelectedLayers={setSelectedLayers}
        handleContextMenu={handleContextMenu} zoomToLayerExtent={zoomToLayerExtent}
        darkMode={darkMode} showOnlyActiveLayers={showOnlyActiveLayers}
        handleDownloadShapefile={handleDownloadShapefile} handleDownloadGeoJSON={handleDownloadGeoJSON}
        setContextMenu={setContextMenu} level={level + 1}
      />
    ))
    .filter(Boolean);

  if (showOnlyActiveLayers && childNodes.length === 0 && node.type !== 'layer') return null;

  const isExpanded = expandedNodes.has(nodeId);
  const hasChildren = childNodes.length > 0 || node.hasChildren;
  const isLayer = node.type === 'layer';

  const getIcon = (type) => {
    const iconProps = {
      className: `w-5 h-5 ${type === 'folder' ? 'text-yellow-500' : type === 'layer' ? 'text-green-500' : type === 'MapServer' || type === 'FeatureServer' ? 'text-blue-500' : 'text-gray-500'}`,
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      xmlns: "http://www.w3.org/2000/svg"
    };
    const pathProps = {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2
    };
    return (
      <svg {...iconProps}>
        <path {...pathProps} d={
          type === 'folder' ? "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" :
          type === 'layer' || type === 'MapServer' || type === 'FeatureServer' ? "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" :
          "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        } />
      </svg>
    );
  };

  const handleCheckboxChange = () => {
    if (isLayer) {
      setSelectedLayers(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        const existingLayer = prevArray.find(layer => layer.id === nodeId);
        if (existingLayer) {
          return prevArray.map(layer => 
            layer.id === nodeId ? { ...layer, visible: !layer.visible } : layer
          );
        } else {
          return [...prevArray, {
            id: nodeId,
            name: node.text,
            visible: true,
            type: 'arcgis',
            datasource: node.url || ''
          }];
        }
      });
    }
  };

  const getBackgroundColor = (level) => {
    if (darkMode) {
      const baseColor = 40;
      const shade = Math.min(baseColor + level * 5, 50);
      return `rgb(${shade}, ${shade + 5}, ${shade + 20})`;
    } else {
      const baseGray = 250;
      const shade = Math.max(baseGray - level * 10, 200);
      return `rgb(${shade}, ${shade}, ${shade})`;
    }
  };

  return (
    <div className="flex flex-col" style={{ marginLeft: `${level * 20}px` }}
      onContextMenu={(e) => !e.target.closest('.download-button') && handleContextMenu(e, nodeId, setContextMenu)}>
      <div className={`flex items-start justify-between p-1 rounded-md tree-node fade-in ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}>
        <div className="flex items-start flex-grow min-w-0">
          <div className="flex items-center flex-shrink-0 mr-2">
            {isLayer && (
              <input
                type="checkbox"
                checked={isVisible}
                onChange={handleCheckboxChange}
                className="mr-2"
              />
            )}
            {hasChildren && (
              <button onClick={() => toggleNode(nodeId)} className="mr-2 text-xs">{isExpanded ? '▼' : '▶'}</button>
            )}
            <span className="mr-2">{getIcon(node.type)}</span>
          </div>
          <div className="flex flex-col min-w-0 flex-grow">
            <span className="font-medium text-xs break-words">{node.text}</span>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} break-words`}>({node.type})</span>
          </div>
        </div>
        {isLayer && (
          <button onClick={(e) => { e.stopPropagation(); handleDownloadShapefile(nodeId); }}
            className={`download-button flex flex-col items-center p-1 ml-2 flex-shrink-0 rounded-md ${
              darkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
            }`}
            style={{ padding: '4px 6px' }}
            title="Download Shapefile">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7h-2V3H9v4H7l3 3 3-3z"></path>
              <path d="M5 13h10v2H5v-2z"></path>
            </svg>
            <span className="text-2xs">SHP</span>
          </button>
        )}
      </div>
      {isExpanded && childNodes.length > 0 && (
        <div 
          className={`overflow-y-auto transition-all duration-300 ease-in-out rounded-md ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}
          style={{
            maxHeight: '500px',
            backgroundColor: getBackgroundColor(level + 1),
            marginTop: '4px',
            marginBottom: '4px',
          }}
        >
          {childNodes}
        </div>
      )}
    </div>
  );
};

export default TreeNode;