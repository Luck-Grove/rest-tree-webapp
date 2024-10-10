import React from 'react';
import { handleDownloadShapefile } from './dlHelpers';
import bboxCommand from '../commands/bbox';

export const renderTree = (treeData, nodeId, level = 0, expandedNodes, toggleNode, selectedLayers, setSelectedLayers, setContextMenu, darkMode, zoomToLayerExtent, map, setIsDownloading, setStatusMessage) => {
    const node = treeData[nodeId];
    if (!node) return null;

    const childNodes = Object.entries(treeData)
        .filter(([_, data]) => data.parent === nodeId)
        .map(([childId, _]) => renderTree(treeData, childId, level + 1, expandedNodes, toggleNode, selectedLayers, setSelectedLayers, setContextMenu, darkMode, zoomToLayerExtent, map, setIsDownloading, setStatusMessage))
        .filter(Boolean);

    const isExpanded = expandedNodes.has(nodeId);

    const getIcon = (type) => {
        switch (type) {
            case 'folder':
                return <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
            case 'layer':
                return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
            case 'MapServer':
            case 'FeatureServer':
                return <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
            default:
                return <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
        }
    };

    const hasChildren = childNodes.length > 0 || node.hasChildren;
    const isLayer = node.type === 'layer';

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        if (isLayer) {
            setSelectedLayers(prev => {
                const newSet = new Set(prev);
                if (isChecked) {
                    newSet.add(nodeId);
                } else {
                    newSet.delete(nodeId);
                }
                return newSet;
            });
        } else {
            // If it's a folder, toggle all descendant layers
            const toggleDescendantLayers = (id, shouldAdd) => {
                const node = treeData[id];
                if (node.type === 'layer') {
                    setSelectedLayers(prev => {
                        const newSet = new Set(prev);
                        if (shouldAdd) {
                            newSet.add(id);
                        } else {
                            newSet.delete(id);
                        }
                        return newSet;
                    });
                }
                Object.entries(treeData)
                    .filter(([_, data]) => data.parent === id)
                    .forEach(([childId, _]) => toggleDescendantLayers(childId, shouldAdd));
            };
            toggleDescendantLayers(nodeId, isChecked);
        }
    };

    return (
        <div 
            key={nodeId} 
            className={`ml-${level * 4} ${level === 0 ? 'mt-2' : ''} fade-in`}
            onContextMenu={(e) => handleContextMenu(e, nodeId, setContextMenu)}
        >
            <div className="flex items-center justify-between p-1 rounded-md tree-node">
                <div className="flex items-center">
                    {isLayer && (
                        <input
                            type="checkbox"
                            checked={selectedLayers.has(nodeId)}
                            onChange={handleCheckboxChange}
                            className="mr-2"
                        />
                    )}
                    {hasChildren && (
                        <button onClick={() => toggleNode(nodeId)} className="mr-2 text-xs">
                            {isExpanded ? '▼' : '▶'}
                        </button>
                    )}
                    <span className="mr-2">
                        {getIcon(node.type)}
                    </span>
                    <span className="font-medium text-sm">{node.text}</span>
                    <span className="ml-2 text-xs text-gray-500">({node.type})</span>
                </div>
                {node.type === 'layer' && (
                    <div className="flex items-center">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                const boundingBox = bboxCommand.getBoundingBoxCoordinates(map);
                                handleDownloadShapefile(nodeId, treeData, boundingBox, setIsDownloading, setStatusMessage, map);
                            }}
                            className={`flex flex-col items-center p-1 ${darkMode ? 'text-gray-200 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
                            title="Download Shapefile"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 7h-2V3H9v4H7l3 3 3-3z"></path>
                                <path d="M5 13h10v2H5v-2z"></path>
                            </svg>
                            <span className="text-xs">SHP</span>
                        </button>
                    </div>
                )}
            </div>
            {isExpanded && childNodes}
        </div>
    );
};


export const expandAll = (setExpandedNodes, treeData) => {
    setExpandedNodes(new Set(Object.keys(treeData)));
};

export const collapseAll = (setExpandedNodes) => {
    setExpandedNodes(new Set());
};

export const handleContextMenu = (e, nodeId, setContextMenu) => {
    e.preventDefault();
    console.log('Context menu triggered for node:', nodeId);
    setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        nodeId: nodeId,
    });
};

export const handleKeyDown = (e, showPresetDropdown, showSuggestions, setHighlightedIndex, setShowPresetDropdown, filteredPresets, highlightedIndex, setSelectedSuggestionIndex, selectedSuggestionIndex, suggestions, handlePresetSelect, handleSuggestionClick, setShowSuggestions) => {
    if (showPresetDropdown) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prevIndex => 
                    prevIndex < filteredPresets.length - 1 ? prevIndex + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prevIndex => 
                    prevIndex > 0 ? prevIndex - 1 : filteredPresets.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex !== -1) {
                    handlePresetSelect(filteredPresets[highlightedIndex]);
                }
                break;
            case 'Escape':
                setShowPresetDropdown(false);
                setHighlightedIndex(-1);
                break;
            default:
                break;
        }
    } else if (showSuggestions) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prevIndex =>
                    prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prevIndex =>
                    prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                if (selectedSuggestionIndex !== -1) {
                    e.preventDefault();
                    handleSuggestionClick(suggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedSuggestionIndex(-1);
                break;
            default:
                break;
        }
    }
};


export const handleBasemapChange = (e, map, darkMode, setBasemap, updateBasemap) => {
    const selectedBasemap = e.target.value;
    setBasemap(selectedBasemap);
    updateBasemap(map, selectedBasemap, darkMode);
    
    // Save basemap choice in a cookie
    document.cookie = `basemap=${encodeURIComponent(selectedBasemap)}; path=/; max-age=31536000`; // 1 year
};
