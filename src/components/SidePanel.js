import React, { useState, useRef, useEffect } from 'react';
import { fetchXMLPresets, handlePresetInputChange, handlePresetInputFocus, handlePresetSelect } from '../utils/presetUtils';
import { expandAll, collapseAll } from '../utils/uiHelpers';
import { exportToCSV } from '../utils/treeUtils';
import { getDB, checkTreeMapExists, loadTreeMap, saveTreeMap, clearOutdatedCache, getCacheStats } from '../utils/indexedDBUtils';
import TreeNode from './TreeNode';

const SidePanel = ({ 
    darkMode, 
    toggleDarkMode, 
    url, 
    setUrl, 
    skipProperties, 
    setSkipProperties, 
    loading,
    setLoading, 
    generateTreeMap, 
    handleStopProcessing, 
    treeData,
    setTreeData,
    filteredTreeData,
    expandedNodes,
    setExpandedNodes,
    searchTerm,
    setSearchTerm,
    showOnlyActiveLayers,
    setShowOnlyActiveLayers,
    error,
    setError,
    statusMessage,
    setStatusMessage,
    isDownloading,
    selectedLayers,
    setSelectedLayers,
    handleContextMenu,
    map,
    setIsDownloading,
    assignColorToLayer,
    toggleNode,
    handleDownloadShapefile,
    handleDownloadLayer,
    zoomToLayerExtent,
    addConsoleMessage
}) => {
    const [selectedPreset, setSelectedPreset] = useState('');
    const [presets, setPresets] = useState([]);
    const [filteredPresets, setFilteredPresets] = useState([]);
    const [showPresetDropdown, setShowPresetDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [hasStoredData, setHasStoredData] = useState(false);

    const presetInputRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (presetInputRef.current && 
                !presetInputRef.current.contains(event.target) && 
                showPresetDropdown) {
                setShowPresetDropdown(false);
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPresetDropdown]);

    useEffect(() => {
        const initializeDB = async () => {
            try {
                await getDB();
                await clearOutdatedCache();
                const stats = await getCacheStats();
                console.log('Cache statistics:', stats);
                const exists = await checkTreeMapExists(url);
                setHasStoredData(exists);
            } catch (error) {
                console.error('Error during initialization:', error);
            }
        };
    
        initializeDB();
    }, []);

    useEffect(() => {
        fetchXMLPresets().then(setPresets).catch(error => {
            console.error('Error loading XML presets:', error.message);
        });
    }, []);

    useEffect(() => {
        const checkStoredData = async () => {
            const exists = await checkTreeMapExists(url);
            setHasStoredData(exists);
        };
        checkStoredData();
    }, [url]);

    const handleGenerateTreeMap = async () => {
        try {
            setLoading(true);
            await generateTreeMap();
            await new Promise(resolve => setTimeout(resolve, 100));
    
            if (treeData && Object.keys(treeData).length > 0) {
                await saveTreeMap(url, treeData, expandedNodes);
                addConsoleMessage('Tree map saved to browser cache.');
                setHasStoredData(true);
            }
        } catch (error) {
            console.error('Error:', error);
            addConsoleMessage('Failed to generate or cache tree map');
        } finally {
            setLoading(false);
        }
    };
    
    const handleLoadTreeMap = async () => {
        try {
            setLoading(true);
    
            const data = await loadTreeMap(url);
            if (data && data.treeData) {
                setTreeData(data.treeData);
                setExpandedNodes(data.expandedNodes);
    
                const ageInSeconds = Math.round((Date.now() - data.timestamp) / 1000);
                let ageMessage;
    
                const millennia = Math.floor(ageInSeconds / (60 * 60 * 24 * 365 * 1000));
                const remainingAfterMillennia = ageInSeconds % (60 * 60 * 24 * 365 * 1000);
                const years = Math.floor(remainingAfterMillennia / (60 * 60 * 24 * 365));
                const remainingAfterYears = remainingAfterMillennia % (60 * 60 * 24 * 365);
                const weeks = Math.floor(remainingAfterYears / (60 * 60 * 24 * 7));
                const remainingAfterWeeks = remainingAfterYears % (60 * 60 * 24 * 7);
                const days = Math.floor(remainingAfterWeeks / (60 * 60 * 24));
                const remainingAfterDays = remainingAfterWeeks % (60 * 60 * 24);
                const hours = Math.floor(remainingAfterDays / (60 * 60));
                const remainingAfterHours = remainingAfterDays % (60 * 60);
                const minutes = Math.floor(remainingAfterHours / 60);
                const seconds = remainingAfterHours % 60;
    
                const pad = (value) => value.toString().padStart(2, '0');
    
                if (millennia > 0) {
                    ageMessage = `${millennia} millenium${millennia === 1 ? '' : 's'}, ${years} year${years === 1 ? '' : 's'} ago (${pad(millennia)}:${pad(years)}:${pad(weeks)}:${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)})`;
                } else if (years > 0) {
                    ageMessage = `${years} year${years === 1 ? '' : 's'}, ${weeks} week${weeks === 1 ? '' : 's'} ago (${pad(years)}:${pad(weeks)}:${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)})`;
                } else if (weeks > 0) {
                    ageMessage = `${weeks} week${weeks === 1 ? '' : 's'}, ${days} day${days === 1 ? '' : 's'} ago (${pad(weeks * 7 + days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)})`;
                } else if (days > 0) {
                    ageMessage = `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}, ${seconds} second${seconds === 1 ? '' : 's'} ago`;
                } else if (hours > 0) {
                    ageMessage = `${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}, ${seconds} second${seconds === 1 ? '' : 's'} ago`;
                } else if (minutes > 0) {
                    ageMessage = `${minutes} minute${minutes === 1 ? '' : 's'}, ${seconds} second${seconds === 1 ? '' : 's'} ago`;
                } else {
                    ageMessage = `${seconds} second${seconds === 1 ? '' : 's'} ago`;
                }
    
                addConsoleMessage(`Loaded cached tree map from ${ageMessage}.`);
            } else {
                throw new Error('No cached data found');
            }
        } catch (error) {
            console.error('Error:', error);
            addConsoleMessage('Failed to load cached tree map');
            setHasStoredData(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        const searchTerm = e.target.value;
        setSearchTerm(searchTerm);
        if (searchTerm !== '') {
            expandAll(setExpandedNodes, treeData);
        }
    };

    const handleKeyDown = (e) => {
        if (showPresetDropdown) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex(prevIndex => {
                        const newIndex = prevIndex < filteredPresets.length - 1 ? prevIndex + 1 : 0;
                        scrollHighlightedItemIntoView(newIndex);
                        return newIndex;
                    });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex(prevIndex => {
                        const newIndex = prevIndex > 0 ? prevIndex - 1 : filteredPresets.length - 1;
                        scrollHighlightedItemIntoView(newIndex);
                        return newIndex;
                    });
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (highlightedIndex !== -1) {
                        handlePresetSelect(filteredPresets[highlightedIndex], setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex);
                    }
                    break;
                case 'Escape':
                    setShowPresetDropdown(false);
                    setHighlightedIndex(-1);
                    break;
                default:
                    break;
            }
        }
    };

    const scrollHighlightedItemIntoView = (index) => {
        if (dropdownRef.current) {
            const highlightedItem = dropdownRef.current.children[index];
            if (highlightedItem) {
                highlightedItem.scrollIntoView({
                    block: 'nearest',
                });
            }
        }
    };

    const renderTreeMap = () => {
        const rootNodes = Object.keys(filteredTreeData).filter(id => !filteredTreeData[id].parent);
        return rootNodes.map(nodeId => 
            <TreeNode
                key={nodeId}
                nodeId={nodeId}
                treeData={filteredTreeData}
                expandedNodes={expandedNodes}
                toggleNode={(id) => toggleNode(setExpandedNodes, id)}
                selectedLayers={selectedLayers}
                setSelectedLayers={setSelectedLayers}
                handleContextMenu={handleContextMenu}
                darkMode={darkMode}
                showOnlyActiveLayers={showOnlyActiveLayers}
                handleDownloadShapefile={(node) => handleDownloadShapefile(
                    node,
                    setIsDownloading,
                    setStatusMessage
                )}
                handleDownloadGeoJSON={(node) => handleDownloadLayer(
                    node,
                    setIsDownloading,
                    setStatusMessage
                )}
                map={map}
                zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, map)}
                level={0}
                setIsDownloading={setIsDownloading}
                setStatusMessage={setStatusMessage}
                assignColorToLayer={assignColorToLayer}
            />
        );
    };

    return (
        <div className={`floating-panel p-3 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`}>
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-lg font-bold">AGS Multitool</h1>
                <button 
                    onClick={toggleDarkMode} 
                    className={`px-2 py-1 rounded-md ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} text-xs hover:bg-opacity-80 transition duration-300 ease-in-out`}
                >
                    {darkMode ? 'Light' : 'Dark'}
                </button>
            </div>
            <div className="mb-3 relative" ref={presetInputRef}>
                <label className={`block mb-1 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select or search for a server:
                    <input
                        type="text"
                        value={selectedPreset}
                        onChange={(e) => handlePresetInputChange(e, setSelectedPreset, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex)}
                        onFocus={() => handlePresetInputFocus(setFilteredPresets, presets, setShowPresetDropdown, setHighlightedIndex)}
                        onKeyDown={handleKeyDown}
                        className={`w-full px-2 py-1 mt-1 text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        placeholder="Type to search or select a server..."
                    />
                </label>
                {showPresetDropdown && (
                    <ul 
                        ref={dropdownRef}
                        className={`absolute z-10 w-full mt-1 max-h-48 overflow-auto rounded-md shadow-lg ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'}`}
                    >
                        {filteredPresets.map((preset, index) => (
                            <li
                                key={index}
                                onClick={() => handlePresetSelect(preset, setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex)}
                                className={`px-2 py-1 cursor-pointer text-xs ${
                                    index === highlightedIndex
                                        ? (darkMode ? 'bg-gray-600' : 'bg-gray-100')
                                        : (darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100')
                                    }`}
                            >
                                {preset.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="mb-3">
                <label className={`block mb-1 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    ArcGIS REST Services URL:
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className={`w-full px-2 py-1 mt-1 text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    />
                </label>
            </div>
            <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={skipProperties}
                            onChange={(e) => setSkipProperties(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-7 h-4 ${darkMode ? 'bg-gray-500' : 'bg-gray-300'} rounded-full shadow-inner`}></div>
                        <div className={`absolute w-2 h-2 bg-white rounded-full shadow inset-y-1 left-1 transition-transform duration-300 ease-in-out ${skipProperties ? 'transform translate-x-3' : ''}`}></div>
                    </div>
                    <div className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-xs font-medium`}>
                        Skip Layer Properties
                    </div>
                </label>
            </div>
            <div className="flex space-x-2 mb-3">
                <button
                    onClick={handleLoadTreeMap}
                    disabled={loading || !hasStoredData}
                    className={`flex-1 ${
                        darkMode ? 'bg-green-600' : 'bg-green-500'
                    } text-white px-2 py-1 rounded-md text-xs hover:bg-opacity-90 focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-opacity-50 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                >
                    Load Tree Map
                </button>
                <button
                    onClick={handleGenerateTreeMap}
                    disabled={loading}
                    className={`flex-1 ${
                        darkMode ? 'bg-blue-600' : 'bg-blue-500'
                    } text-white px-2 py-1 rounded-md text-xs hover:bg-opacity-90 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                >
                    {loading ? (
                        <div className="flex items-center">
                            <span>Processing...</span>
                            <div className="loading-swirl"></div>
                        </div>
                    ) : (
                        hasStoredData ? 'Regenerate Tree Map' : 'Generate Tree Map'
                    )}
                </button>
                {loading && (
                    <button
                        onClick={handleStopProcessing}
                        className="flex-1 bg-red-500 text-white px-2 py-1 rounded-md text-xs hover:bg-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
                    >
                        Stop
                    </button>
                )}
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
                <button onClick={() => expandAll(setExpandedNodes, treeData)} className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded-md text-xs hover:bg-opacity-80 focus:outline-none focus:ring-1 focus:ring-opacity-50 transition duration-300 ease-in-out`}>
                    Expand All
                </button>
                <button onClick={() => collapseAll(setExpandedNodes)} className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded-md text-xs hover:bg-opacity-80 focus:outline-none focus:ring-1 focus:ring-opacity-50 transition duration-300 ease-in-out`}>
                    Collapse All
                </button>
                <button onClick={() => {
                    const csvContent = exportToCSV(filteredTreeData);
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    if (link.download !== undefined) {
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', 'arcgis_tree_map.csv');
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                }} className="bg-green-500 text-white px-2 py-1 rounded-md text-xs hover:bg-green-600 focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-opacity-50 transition duration-300 ease-in-out">
                    Export CSV
                </button>
            </div>
            <div className="mb-3">
                <label className={`block mb-1 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Search:
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className={`w-full px-2 py-1 mt-1 text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    />
                </label>
            </div>
            <div className="mb-3">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showOnlyActiveLayers}
                        onChange={(e) => setShowOnlyActiveLayers(e.target.checked)}
                        className="form-checkbox h-3 w-3 text-blue-600 transition duration-150 ease-in-out"
                    />
                    <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-xs`}>Show only active layers</span>
                </label>
            </div>
            
            {/* Unified status area for errors, tips, and download status */}
            {(error || statusMessage) && (
                <div className={`mt-3 p-2 rounded-md text-xs flex items-center ${
                    error ? 'bg-red-100 text-red-500' : 
                    isDownloading ? 'bg-blue-100 text-blue-500' : 
                    'bg-green-100 text-green-500'
                }`}>
                    {isDownloading && (
                        <div className="message-loading-swirl mr-2"></div>
                    )}
                    <span>{error || statusMessage}</span>
                </div>
            )}

            <div className={`tree-container mt-3 border p-3 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} overflow-auto`} style={{ maxHeight: 'calc(100vh - 25rem)' }}>
                {renderTreeMap()}
            </div>
        </div>
    );
};

export default SidePanel;
