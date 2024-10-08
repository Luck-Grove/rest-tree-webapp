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

import { initializeMap, updateMapLayers, updateBasemap, zoomToLayerExtent } from '../utils/mapUtils';
import { fetchXMLPresets, handlePresetInputChange, handlePresetSelect, handlePresetInputFocus } from '../utils/presetUtils';
import { toggleNode, filterTreeData, exportToCSV } from '../utils/treeUtils';
import { expandAll, collapseAll, handleDownloadLayer, handleDownloadShapefile } from '../utils/uiHelpers';
import { fetchAndDisplayServices } from '../utils/api';

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

    const consoleRef = useRef(null);
    const suggestionTimeoutRef = useRef(null);
    const suggestionsRef = useRef(null);
    const presetInputRef = useRef(null);
    const dropdownRef = useRef(null);
	const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
    const lastContextMenuTrigger = useRef(null);
    const sidePanelRef = useRef(null);

    useEffect(() => {
        fetchXMLPresets().then(setPresets).catch(error => {
            setError(error.message);
            addConsoleMessage(`Error loading XML presets: ${error.message}`);
        });
    }, []);

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleMessages]);

    useEffect(() => {
        setFilteredTreeData(treeData);
    }, [treeData]);

    useEffect(() => {
        const mapInstance = initializeMap('map', darkMode);
        setMap(mapInstance);

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
        
        // Event listener for when the rectangle draw button is clicked
        mapInstance.on('draw:drawstart', (e) => {
            if (e.layerType === 'rectangle') {
                // Remove all existing rectangles
                mapInstance.eachLayer((layer) => {
                    if (layer instanceof L.Rectangle) {
                        mapInstance.removeLayer(layer);
                    }
                });
                setBoundingBox(null);
            }
        });

        mapInstance.on(L.Draw.Event.CREATED, (event) => {
            if (event.layerType === 'rectangle') {
                if (boundingBox) {
                    mapInstance.removeLayer(boundingBox);
                }
                setBoundingBox(event.layer);
                event.layer.addTo(mapInstance);
            }
        });

        return () => mapInstance.remove();
    }, [basemap, darkMode]);

    useEffect(() => {
        if (map) {
            updateMapLayers(map, selectedLayers, treeData, darkMode);
        }
    }, [selectedLayers, map, darkMode, treeData]);

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

    const handleDownloadGeoJSON = async (nodeId) => {
        const node = treeData[nodeId];
        if (!node) return;

        setIsDownloading(true);
        setStatusMessage('Initializing GeoJSON download...');

        try {
            const response = await axios.get(`${node.url}?f=json`);
            const layerInfo = response.data;

            if (layerInfo.capabilities && layerInfo.capabilities.includes('Query')) {
                let allFeatures = [];
                let offset = 0;
                const limit = 1000;
                let hasMore = true;

                while (hasMore) {
                    let downloadUrl = `${node.url}/query?where=1%3D1&outFields=*&f=geojson&resultOffset=${offset}&resultRecordCount=${limit}`;
                    
                    if (boundingBox) {
                        const bounds = boundingBox.getBounds();
                        const bboxString = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
                        downloadUrl += `&geometry=${encodeURIComponent(bboxString)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326`;
                    }

                    const geojsonResponse = await fetch(downloadUrl);
                    const geojsonData = await geojsonResponse.json();
                    
                    if (geojsonData.features && geojsonData.features.length > 0) {
                        allFeatures = allFeatures.concat(geojsonData.features);
                        offset += geojsonData.features.length;
                        hasMore = geojsonData.features.length === limit;
                    } else {
                        hasMore = false;
                    }

                    setStatusMessage(`Downloaded ${allFeatures.length} features...`);
                }

                if (allFeatures.length === 0) {
                    setStatusMessage('No features found within the bounding box.');
                    return;
                }

                const completeGeojson = {
                    type: "FeatureCollection",
                    features: allFeatures
                };

                const blob = new Blob([JSON.stringify(completeGeojson)], { type: 'application/json' });
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = `${node.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.geojson`;
                
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                setStatusMessage(`GeoJSON download completed for ${node.text}. ${allFeatures.length} features downloaded.`);
            } else {
                setStatusMessage('This layer does not support direct downloads.');
            }
        } catch (error) {
            console.error('Error fetching layer info:', error);
            setStatusMessage(`Error downloading GeoJSON: ${error.message}`);
        } finally {
            setTimeout(() => {
                setIsDownloading(false);
                setStatusMessage('');
            }, 5000);
        }
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
            setCookie('darkMode', newDarkMode, 365); // Save for 1 year
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

    // Render functions
    const renderContextMenu = () => {
        return (
            <ContextMenu 
                contextMenu={contextMenu}
                handleDownloadLayer={() => handleDownloadLayer(contextMenu.nodeId, treeData, boundingBox, setIsDownloading, setStatusMessage)}
                handleDownloadShapefile={() => handleDownloadShapefile(contextMenu.nodeId, treeData, boundingBox, setIsDownloading, setStatusMessage)}
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
                handleDownloadShapefile={(id) => handleDownloadShapefile(id, treeData, boundingBox, setIsDownloading, setStatusMessage)}
                handleDownloadGeoJSON={handleDownloadGeoJSON}
                map={map}
                zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, map)}
                level={0}
            />
        );
    };
    

    const renderSidePanel = () => {
        return (
            <div ref={sidePanelRef} className={`floating-panel p-4 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">AGS Multitool</h1>
                    <button 
                        onClick={toggleDarkMode} 
                        className={`px-3 py-1 rounded-md ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} text-sm hover:bg-opacity-80 transition duration-300 ease-in-out`}
                    >
                        {darkMode ? 'Light' : 'Dark'}
                    </button>
                </div>
                <div className="mb-4 relative" ref={presetInputRef}>
                    <label className={`block mb-2 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Select or search for a server:
                        <input
                            type="text"
                            value={selectedPreset}
                            onChange={(e) => handlePresetInputChange(e, setSelectedPreset, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex)}
                            onFocus={() => handlePresetInputFocus(setFilteredPresets, presets, setShowPresetDropdown, setHighlightedIndex)}
                            onKeyDown={(e) => handleKeyDown(e, showPresetDropdown, showSuggestions, setHighlightedIndex, setShowPresetDropdown, filteredPresets, highlightedIndex, setSelectedSuggestionIndex, selectedSuggestionIndex, suggestions, handlePresetSelect, handleSuggestionClick)}
                            className={`w-full px-3 py-2 mt-1 text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="Type to search or select a server..."
                            />
                    </label>
                    {showPresetDropdown && (
                        <ul 
                            ref={dropdownRef}
                            className={`absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-md shadow-lg ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'}`}
                        >
                            {filteredPresets.map((preset, index) => (
                                <li
                                    key={index}
                                    onClick={() => handlePresetSelect(preset, setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex)}
                                    className={`px-3 py-2 cursor-pointer ${
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
                    <div className="mb-4">
                        <label className={`block mb-2 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            ArcGIS REST Services URL:
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className={`w-full px-3 py-2 mt-1 text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                        </label>
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={skipProperties}
                                    onChange={(e) => setSkipProperties(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-8 h-5 ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded-full shadow-inner`}></div>
                                <div className={`absolute w-3 h-3 bg-white rounded-full shadow inset-y-1 left-1 transition-transform duration-300 ease-in-out ${skipProperties ? 'transform translate-x-3' : ''}`}></div>
                            </div>
                            <div className={`ml-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm font-medium`}>
                                Skip Layer Properties
                            </div>
                        </label>
                    </div>
                    <div className="flex space-x-2 mb-4">
                        <button
                            onClick={generateTreeMap}
                            disabled={loading}
                            className={`flex-1 ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white px-3 py-1 rounded-md text-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
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
                                className="flex-1 bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
                            >
                                Stop
                            </button>
                        )}
                    </div>
                    <div className="mb-4 flex justify-between">
                        <button onClick={() => expandAll(setExpandedNodes, treeData)} className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded-md text-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition duration-300 ease-in-out`}>
                            Expand All
                        </button>
                        <button onClick={() => collapseAll(setExpandedNodes)} className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} px-2 py-1 rounded-md text-sm hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition duration-300 ease-in-out`}>
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
                        }} className="bg-green-500 text-white px-2 py-1 rounded-md text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-300 ease-in-out">
                            Export CSV
                        </button>
                    </div>
                    <div className="mb-4">
                        <label className={`block mb-2 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Search:
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className={`w-full px-3 py-2 mt-1 text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700'} border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                        </label>
                    </div>
                    <div className="mb-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showOnlyActiveLayers}
                                onChange={(e) => setShowOnlyActiveLayers(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                            />
                            <span className={`ml-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm`}>Show only active layers</span>
                        </label>
                    </div>
                    
                    {/* Bounding box info */}
                    {boundingBox && (
                        <div className="mt-4 p-2 bg-blue-100 text-blue-800 rounded-md">
                            Bounding box set. Downloads will be filtered to the highlighted area.
                        </div>
                    )}
                    
                    {/* Unified status area for errors, tips, and download status */}
                    {(error || statusMessage) && (
                        <div className={`mt-4 p-3 rounded-md text-sm flex items-center ${
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
    
					<div className={`tree-container mt-4 border p-4 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} overflow-auto`} style={{maxHeight: 'calc(100vh - 26rem)'}}>
						{renderTreeMap()}
					</div>
                    
                    {/* Console */}
                    <Console 
                        consoleRef={consoleRef}
                        consoleMessages={consoleMessages}
                        darkMode={darkMode}
                    />
                </div>
            );
        };

        const handleKeyDown = (e) => {
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

    return (
        <div className={`h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}
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

            <style jsx global>{`
                    .floating-panel {
                        position: absolute;
                        top: 16px;
                        left: 16px;
                        width: 384px;
                        z-index: 1000;
                        background-color: ${darkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
                        border-radius: 4px;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.65);
                        max-height: calc(100vh - 32px);
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
                    .tree-container, .leaflet-popup-content, #consoleRef {
                        overflow-y: auto;
                        overflow-x: hidden;
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