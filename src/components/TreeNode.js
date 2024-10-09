import React from 'react';

const TreeNode = ({
  nodeId, treeData, expandedNodes, toggleNode, selectedLayers, setSelectedLayers,
  handleContextMenu, zoomToLayerExtent, darkMode, showOnlyActiveLayers,
  handleDownloadShapefile, handleDownloadGeoJSON, setContextMenu, level = 0,
}) => {
  const node = treeData[nodeId];
  if (!node) return null;
  if (showOnlyActiveLayers && !selectedLayers.has(nodeId) && node.type === 'layer') return null;

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

  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    const toggleDescendantLayers = (id, shouldAdd) => {
      const node = treeData[id];
      if (node.type === 'layer') {
        setSelectedLayers(prev => {
          const newSet = new Set(prev);
          shouldAdd ? newSet.add(id) : newSet.delete(id);
          return newSet;
        });
      }
      Object.entries(treeData)
        .filter(([_, data]) => data.parent === id)
        .forEach(([childId, _]) => toggleDescendantLayers(childId, shouldAdd));
    };
    isLayer ? setSelectedLayers(prev => {
      const newSet = new Set(prev);
      isChecked ? newSet.add(nodeId) : newSet.delete(nodeId);
      return newSet;
    }) : toggleDescendantLayers(nodeId, isChecked);
  };

  return (
    <div className="flex flex-col" style={{ marginLeft: `${level * 20}px` }}
      onContextMenu={(e) => !e.target.closest('.download-button') && handleContextMenu(e, nodeId, setContextMenu)}>
      <div className="flex items-center justify-between p-1 rounded-md tree-node fade-in">
        <div className="flex items-center">
          {(isLayer || childNodes.length > 0) && (
            <input type="checkbox" checked={isLayer ? selectedLayers.has(nodeId) : childNodes.some(child => child && selectedLayers.has(child.props.nodeId))}
              onChange={handleCheckboxChange} className="mr-2" />
          )}
          {hasChildren && (
            <button onClick={() => toggleNode(nodeId)} className="mr-2 text-xs">{isExpanded ? '▼' : '▶'}</button>
          )}
          <span className="mr-2">{getIcon(node.type)}</span>
          <span className="font-medium text-sm">{node.text}</span>
          <span className="ml-2 text-xs text-gray-500">({node.type})</span>
        </div>
        {isLayer && (
          <button onClick={(e) => { e.stopPropagation(); handleDownloadShapefile(nodeId); }}
            className={`download-button flex flex-col items-center p-1 ${darkMode ? 'text-gray-200 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
            title="Download Shapefile">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7h-2V3H9v4H7l3 3 3-3z"></path>
              <path d="M5 13h10v2H5v-2z"></path>
            </svg>
            <span className="text-xs">SHP</span>
          </button>
        )}
      </div>
      {isExpanded && (
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-screen fade-in' : 'max-h-0'}`}>
          {childNodes}
        </div>
      )}
    </div>
  );
};

export default TreeNode;