import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'esri-leaflet';
import 'leaflet-draw';
import axios from 'axios';
import Console from './Console';
import ContextMenu from './ContextMenu';
import SearchBar from './SearchBar';
import TreeNode from './TreeNode';
import CommandBar from './CommandBar';

import { initializeMap, updateMapLayers, updateBasemap, zoomToLayerExtent } from '../utils/mapUtils';
import { fetchXMLPresets, handlePresetInputChange, handlePresetSelect, handlePresetInputFocus } from '../utils/presetUtils';
import { toggleNode, filterTreeData, exportToCSV } from '../utils/treeUtils';
import { expandAll, collapseAll } from '../utils/uiHelpers';
import { handleDownloadLayer, handleDownloadShapefile } from '../utils/dlHelpers';
import { fetchAndDisplayServices, writeToConsole } from '../utils/api';
import { executeCommand } from '../utils/commandUtils';
import bboxCommand from '../commands/bbox';

const ArcGISRESTTreeMap = () => {
    const [url, setUrl] = useState('https://sampleserver6.arcgisonline.com/arcgis/rest/services/');
    const [treeData, setTreeData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [skipProperties, setSkipProperties] = useState(true);
    const [consoleMessages, setConsoleMessages] = useState([]);
    const [selectedPreset, setSelectedPreset] = useState('');
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [presets, setPresets] = useState([]);
    const [filteredTreeData, setFilteredTreeData] = useState({});
    const [abortController, setAbortController] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [map, setMap] = useState(null);
    const [selectedLayers, setSelectedLayers] = useState(new Set());
    const [address, setAddress] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showOnlyActiveLayers, setShowOnlyActiveLayers] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [filteredPresets, setFilteredPresets] = useState([]);
    const [showPresetDropdown, setShowPresetDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [basemap, setBasemap] = useState(() => {
        const savedBasemap = getCookie('basemap');
        return savedBasemap || 'default';
    });
    const [boundingBox, setBoundingBox] = useState(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

    const suggestionTimeoutRef = useRef(null);
    const suggestionsRef = useRef(null);
    const presetInputRef = useRef(null);
    const dropdownRef = useRef(null);
	const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
    const lastContextMenuTrigger = useRef(null);
    const sidePanelRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);

    const [currentCommand, setCurrentCommand] = useState('');
    const mapRef = useRef(null);

    useEffect(() => {
        fetchXMLPresets().then(setPresets).catch(error => {
            setError(error.message);
            addConsoleMessage(`Error loading XML presets: ${error.message}`);
        });
    }, []);

    useEffect(() => {
        setFilteredTreeData(treeData);
    }, [treeData]);

    useEffect(() => {
        const mapInstance = initializeMap('map', darkMode);
        setMap(mapInstance);
        mapRef.current = mapInstance;

        // Apply the initial basemap
        updateBasemap(mapInstance, basemap, darkMode);

        // Add rectangle draw control
        const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polyline: false,
                polygon: false,
                circle: false,
                marker: false,
                circlemarker: false,
                rectangle: {
                    shapeOptions: {
                        color: 'red',
                        weight: 2,
                        fillColor: 'red',
                        className: 'bounding-box-rectangle'
                    }
                }
            },
            edit: false
        });
        mapInstance.addControl(drawControl);

        // Override the rectangle button behavior
        const rectangleButton = document.querySelector('.leaflet-draw-draw-rectangle');
        if (rectangleButton) {
            L.DomEvent.off(rectangleButton, 'click');
            L.DomEvent.on(rectangleButton, 'click', function(e) {
                L.DomEvent.stop(e);
                // Execute the bbox command and log the results
                executeCommand('bbclear', mapInstance, [], addConsoleMessage);
                executeCommand('bbox', mapInstance, [], addConsoleMessage);
            });
        }

        // Event listeners for drawing
        mapInstance.on(L.Draw.Event.CREATED, (event) => {
            if (event.layerType === 'rectangle') {
                if (mapInstance.boundingBox) {
                    mapInstance.removeLayer(mapInstance.boundingBox);
                }
                mapInstance.boundingBox = event.layer;
                event.layer.addTo(mapInstance);
            }
        });

        // Add keydown event listener to the map container
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.tabIndex = 0;
            mapContainer.addEventListener('keydown', handleMapKeyDown);
        }

        mapInstance.whenReady(() => {
            setIsMapReady(true);
        });
    
        return () => {
            mapInstance.remove();
            if (mapContainer) {
                mapContainer.removeEventListener('keydown', handleMapKeyDown);
            }
        };
    }, [basemap, darkMode]);

    useEffect(() => {
        if (map && isMapReady) {
          updateMapLayers(map, selectedLayers, treeData, darkMode);
        }
    }, [selectedLayers, map, darkMode, treeData, isMapReady]);

    useEffect(() => {
        const savedDarkMode = getCookie('darkMode');
        if (savedDarkMode !== null) {
            setDarkMode(savedDarkMode === 'true');
        }
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark', 'bg-gray-900', 'text-gray-100');
        } else {
            document.body.classList.remove('dark', 'bg-gray-900', 'text-gray-100');
        }
    }, [darkMode]);

    useEffect(() => {
        const lastBasemap = document.cookie.split('; ').find(row => row.startsWith('basemap='));
        if (lastBasemap) {
            const value = lastBasemap.split('=')[1];
            setBasemap(decodeURIComponent(value));
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (presetInputRef.current && !presetInputRef.current.contains(event.target)) {
                setShowPresetDropdown(false);
            }
            if (!event.target.closest('.search-bar')) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (suggestionsRef.current && selectedSuggestionIndex !== -1) {
            const selectedElement = suggestionsRef.current.children[selectedSuggestionIndex];
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            }
        }
    }, [selectedSuggestionIndex]);

        // Handler functions
    const handleMapKeyDown = (e) => {
        if (e.key === 'Escape') {
            setCurrentCommand('');
        } else if (/^[a-zA-Z0-9]$/.test(e.key)) {
            setCurrentCommand(e.key);
        }
    };
    const handleBasemapChange = (e) => {
        const selectedBasemap = e.target.value;
        setBasemap(selectedBasemap);
        if (map) {
            updateBasemap(map, selectedBasemap, darkMode);
        }
        
        // Save basemap choice in a cookie
        document.cookie = `basemap=${encodeURIComponent(selectedBasemap)}; path=/; max-age=31536000`; // 1 year
    };

    const addConsoleMessage = (message) => {
        setConsoleMessages(prev => [...prev, message]);
    };

    const handleSearchChange = (e) => {
        const searchTerm = e.target.value;
        setSearchTerm(searchTerm);
        setFilteredTreeData(filterTreeData(treeData, searchTerm));
        if (searchTerm !== '') {
            expandAll(setExpandedNodes, treeData);
        }
    };

    const generateTreeMap = async () => {
        setLoading(true);
        setError(null);
        setTreeData({});
        setConsoleMessages([]);
        setExpandedNodes(new Set());
        
        const controller = new AbortController();
        setAbortController(controller);
    
        try {
            await fetchAndDisplayServices(url, '', controller.signal, setTreeData, addConsoleMessage, skipProperties);
        } catch (err) {
            if (!controller.signal.aborted) {
                setError(err.message);
                addConsoleMessage(`An error occurred: ${err.message}`);
            }
        } finally {
            setLoading(false);
            setAbortController(null);
        }
    };
    
    const handleStopProcessing = () => {
        if (abortController) {
            abortController.abort();
            setLoading(false);
        }
    };

    const handleAddressChange = (e) => {
        const value = e.target.value;
        setAddress(value);
        setSelectedSuggestionIndex(-1);

        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        if (value.length > 2) {
            suggestionTimeoutRef.current = setTimeout(() => {
                fetchSuggestions(value);
            }, 300);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const fetchSuggestions = async (query) => {
        try {
            const usResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    format: 'json',
                    q: query,
                    limit: 5,
                    countrycodes: 'us',
                }
            });
    
            const usResults = usResponse.data;
    
            setSuggestions(usResults);
            setShowSuggestions(true);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };    

    const handleSuggestionClick = (suggestion) => {
        setAddress(suggestion.display_name);
        setShowSuggestions(false);
        if (map) {
            const { lat, lon, boundingbox } = suggestion;
            if (boundingbox) {
                map.fitBounds([
                    [boundingbox[0], boundingbox[2]],
                    [boundingbox[1], boundingbox[3]]
                ]);
            } else {
                map.setView([lat, lon], 13);
            }
        }
    };

    const handleAddressSubmit = (e) => {
        e.preventDefault();
        if (map && address) {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const { lat, lon, boundingbox } = data[0];
                        if (boundingbox) {
                            map.fitBounds([
                                [boundingbox[0], boundingbox[2]],
                                [boundingbox[1], boundingbox[3]]
                            ]);
                        } else {
                            map.setView([lat, lon], 13);
                        }
                    } else {
                        alert('Address not found');
                    }
                })
                .catch(error => {
                    console.error('Error in geocoding:', error);
                    alert('Error in geocoding. Please try again.');
                });
        }
    };

    const toggleDarkMode = () => {
        setDarkMode((prevDarkMode) => {
            const newDarkMode = !prevDarkMode;
            setCookie('darkMode', newDarkMode, 365);
            if (map && isMapReady) {
                updateBasemap(map, basemap, newDarkMode);
            }
            return newDarkMode;
        });
    };

    const handleContextMenuClick = (e, nodeId) => {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        if (lastContextMenuTrigger.current && now - lastContextMenuTrigger.current < 100) {
            return; // Prevent double triggering
        }
        lastContextMenuTrigger.current = now;

        const node = treeData[nodeId];
        if (node && node.type === 'layer') {
            const { pageX, pageY } = e;

            setContextMenu({
                visible: true,
                x: pageX,
                y: pageY,
                nodeId: nodeId
            });
        } else {
        }
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0, nodeId: null });
    };

    const handleCommand = (command) => {
        executeCommand(command, mapRef.current, [], addConsoleMessage);
        setCurrentCommand('');
    };

    // Render functions
    const renderContextMenu = () => {
        return (
            <ContextMenu 
                contextMenu={contextMenu}
                handleDownloadLayer={() => handleDownloadLayer(contextMenu.nodeId, treeData, setIsDownloading, setStatusMessage)}
                handleDownloadShapefile={() => handleDownloadShapefile(contextMenu.nodeId, treeData, setIsDownloading, setStatusMessage)}
                darkMode={darkMode}
                onClose={closeContextMenu}
            />
        );
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
                handleContextMenu={handleContextMenuClick}
                darkMode={darkMode}
                showOnlyActiveLayers={showOnlyActiveLayers}
                handleDownloadShapefile={(id) => handleDownloadShapefile(id, treeData, setIsDownloading, setStatusMessage)}
                handleDownloadGeoJSON={(id) => handleDownloadLayer(id, treeData, setIsDownloading, setStatusMessage)}
                map={map}
                zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, map)}
                level={0}
                setIsDownloading={setIsDownloading}
                setStatusMessage={setStatusMessage}
            />
        );
    };
    

    const renderSidePanel = () => {
        return (
            <div ref={sidePanelRef} className={`floating-panel p-3 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`}>
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
                            onKeyDown={(e) => handleKeyDown(e, showPresetDropdown, showSuggestions, setHighlightedIndex, setShowPresetDropdown, filteredPresets, highlightedIndex, setSelectedSuggestionIndex, selectedSuggestionIndex, suggestions, handlePresetSelect, handleSuggestionClick)}
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
                                <div className={`w-7 h-4 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded-full shadow-inner`}></div>
                                <div className={`absolute w-2 h-2 bg-white rounded-full shadow inset-y-1 left-1 transition-transform duration-300 ease-in-out ${skipProperties ? 'transform translate-x-3' : ''}`}></div>
                            </div>
                            <div className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-xs font-medium`}>
                                Skip Layer Properties
                            </div>
                        </label>
                    </div>
                    <div className="flex space-x-2 mb-3">
                        <button
                            onClick={generateTreeMap}
                            disabled={loading}
                            className={`flex-1 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white px-2 py-1 rounded-md text-xs hover:bg-opacity-90 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                        >
                            {loading ? (
                                <div className="flex items-center">
                                    <span>Generating...</span>
                                    <div className="loading-swirl"></div>
                                </div>
                            ) : (
                                'Generate Tree Map'
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
                    
                    {/* Bounding box info */}
                    {map && bboxCommand.getBoundingBox(map) && (
                        <div className="mt-3 p-2 bg-blue-100 text-blue-800 rounded-md text-xs">
                            Bounding box set. Downloads will be filtered to the highlighted area.
                        </div>
                    )}
                    
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
    
                    <div className={`tree-container mt-3 border p-3 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} overflow-auto`} style={{maxHeight: 'calc(100vh - 24rem)'}}>
                        {renderTreeMap()}
                    </div>
                </div>
            );
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

    return (
        <div className={`h-screen ${darkMode ? 'bg-transparent text-gray-100' : 'bg-transparent text-gray-800'}`}
             onClick={closeContextMenu}>
            <div id="map" className="h-full w-full"></div>
            
            <SearchBar 
                address={address}
                setAddress={setAddress}
                handleAddressSubmit={handleAddressSubmit}
                handleAddressChange={handleAddressChange}
                suggestions={suggestions}
                showSuggestions={showSuggestions}
                handleSuggestionClick={handleSuggestionClick}
                darkMode={darkMode}
                handleKeyDown={handleKeyDown}
                selectedSuggestionIndex={selectedSuggestionIndex}
                suggestionsRef={suggestionsRef}
            />

            {/* Basemap selector */}
            <div className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-gray-800 p-2 rounded shadow-md">
                <select 
                    value={basemap} 
                    onChange={handleBasemapChange}
                    className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'}`}
                >
                    <option value="default">Default OSM</option>
                    <option value="esriAerial">ESRI Aerial</option>
                    <option value="googleHybrid">Google Hybrid</option>
                </select>
            </div>

            {renderSidePanel()}
            {renderContextMenu()}
            
            <Console 
                consoleMessages={consoleMessages}
                darkMode={darkMode}
                onCommand={handleCommand}
                addConsoleMessage={addConsoleMessage}
                currentCommand={currentCommand}
            />

            <style jsx global>{`
                    .floating-panel {
                        position: absolute;
                        top: 12px;
                        left: 12px;
                        width: 360px;
                        z-index: 1000;
                        background-color: ${darkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
                        border-radius: 4px;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.65);
                        max-height: calc(100vh - 24px);
                        overflow-y: auto;
                    }
                    .leaflet-popup-content-wrapper {
                        padding: 0;
                    }
                    .leaflet-popup-content {
                        margin: 0;
                        max-height: 300px;
                        max-width: 300px;
                        overflow: auto;
                    }
                    .custom-popup {
                        padding: 10px;
                    }
                    .custom-popup.dark {
                        background-color: #1f2937;
                        color: #f3f4f6;
                    }
                    .custom-popup.light {
                        background-color: #ffffff;
                        color: #1f2937;
                    }
                    .dark-popup .leaflet-popup-content-wrapper,
                    .dark-popup .leaflet-popup-tip {
                        background-color: #1f2937;
                        color: #f3f4f6;
                    }
                    .light-popup .leaflet-popup-content-wrapper,
                    .light-popup .leaflet-popup-tip {
                        background-color: #ffffff;
                        color: #1f2937;
                    }
                `}</style>
            </div>
        );
    };

const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
};

const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
};

export default ArcGISRESTTreeMap;