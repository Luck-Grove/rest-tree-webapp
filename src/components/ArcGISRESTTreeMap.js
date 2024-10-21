import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Console from './Console';
import ContextMenu from './ContextMenu';
import SearchBar from './SearchBar';
import LayerManager from './LayerManager';
import SidePanel from './SidePanel';

import { updateBasemap, zoomToLayerExtent, getLink } from '../utils/mapUtils';
import { fetchAndDisplayServices } from '../utils/api';
import { executeCommand } from '../utils/commandUtils';
import { filterTreeData, toggleNode } from '../utils/treeUtils';
import { handleDownloadLayer, handleDownloadShapefile } from '../utils/dlHelpers';
import LeafletMap from './LeafletMap'; // Import the new LeafletMap component

const ArcGISRESTTreeMap = () => {
  const [url, setUrl] = useState('https://sampleserver6.arcgisonline.com/arcgis/rest/services/');
  const previousBaseUrlRef = useRef(null);
  const [treeData, setTreeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [skipProperties, setSkipProperties] = useState(true);
  const [processedUrls, setProcessedUrls] = useState(new Set());
  const [consoleMessages, setConsoleMessages] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [filteredTreeData, setFilteredTreeData] = useState({});
  const [abortController, setAbortController] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedDarkMode = getCookie('darkMode');
    return savedDarkMode !== null ? savedDarkMode === 'true' : true;
  });
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showOnlyActiveLayers, setShowOnlyActiveLayers] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [basemap, setBasemap] = useState(() => {
    const savedBasemap = getCookie('basemap');
    return savedBasemap || 'default';
  });
  const suggestionTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
  const lastContextMenuTrigger = useRef(null);
  const [currentCommand, setCurrentCommand] = useState('');
  const mapRef = useRef(null); // Reference to the map instance

  useEffect(() => {
    setFilteredTreeData(filterTreeData(treeData, searchTerm));
  }, [treeData, searchTerm]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark', 'bg-gray-900', 'text-gray-100');
    } else {
      document.body.classList.remove('dark', 'bg-gray-900', 'text-gray-100');
    }
  }, [darkMode]);

  const handleBasemapChange = (e) => {
    const selectedBasemap = e.target.value;
    setBasemap(selectedBasemap);
    if (mapRef.current) {
      updateBasemap(mapRef.current, selectedBasemap, darkMode);
    }
    document.cookie = `basemap=${encodeURIComponent(selectedBasemap)}; path=/; max-age=31536000`;
  };

  const addConsoleMessage = useCallback((message) => {
    setConsoleMessages((prev) => [...prev, message]);
  }, []);

  const generateTreeMap = async () => {
    setLoading(true);
    setError(null);

    const baseUrl = url.trim();

    if (previousBaseUrlRef.current !== baseUrl) {
      setTreeData({});
      setExpandedNodes(new Set());
      setProcessedUrls(new Set());
      previousBaseUrlRef.current = baseUrl;
    }

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await fetchAndDisplayServices(
        baseUrl,
        '',
        controller.signal,
        setTreeData,
        addConsoleMessage,
        skipProperties,
        assignColorToLayer,
        selectedLayers,
        processedUrls,
        treeData
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setAbortController(null);
      addConsoleMessage('Operation complete.');
    }
  };

  const handleStopProcessing = () => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
    }
  };

  const pastelColors = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3',
];
  
const allColors = [
    ...pastelColors,
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#C0C0C0', '#808080', '#800000', '#808000', '#008000', '#800080',
];

  const assignColorToLayer = (layerId, prevLayers) => {
    const assignedColors = prevLayers.map((layer) => layer.color).filter(Boolean);

    for (let color of pastelColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    for (let color of allColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  };

  const handleLayerColorChange = (layerId, newColor) => {
    setSelectedLayers((prevLayers) =>
      prevLayers.map((layer) => (layer.id === layerId ? { ...layer, color: newColor } : layer))
    );
    setTreeData((prevData) => ({
      ...prevData,
      [layerId]: { ...prevData[layerId], color: newColor },
    }));
  };

  const handleToggleLayer = (layerId) => {
    setSelectedLayers((prevLayers) => {
      const layerIndex = prevLayers.findIndex((layer) => layer.id === layerId);
      if (layerIndex !== -1) {
        return prevLayers.map((layer) =>
          layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
        );
      } else if (treeData[layerId]) {
        return addLayerToSelected(layerId, prevLayers);
      }
      return prevLayers;
    });
  };

  const addLayerToSelected = (layerId, prevLayers) => {
    addConsoleMessage('addLayerToSelected');
    if (treeData[layerId]) {
      const newLayer = {
        id: layerId,
        name: treeData[layerId].text || 'Unknown Layer',
        visible: true,
        type: 'arcgis',
        datasource: treeData[layerId].url || '',
        color: treeData[layerId].color || assignColorToLayer(layerId, prevLayers),
      };
      return [newLayer, ...prevLayers];
    }
    return prevLayers;
  };

  const handleRemoveLayer = (layerId) => {
    setSelectedLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== layerId));
  };

  const handleReorderLayers = (startIndex, endIndex) => {
    setSelectedLayers((prevLayers) => {
      const result = Array.from(prevLayers);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const handleAddLayer = (layerName) => {
    const newLayerId = `custom-${Date.now()}`;
    setSelectedLayers((prevLayers) => {
      const newLayer = {
        id: newLayerId,
        name: layerName,
        visible: true,
        type: 'custom',
        datasource: '',
        color: assignColorToLayer(newLayerId, prevLayers),
      };
      return [newLayer, ...prevLayers];
    });
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
        },
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
    if (mapRef.current) {
      const { lat, lon, boundingbox } = suggestion;
      if (boundingbox) {
        mapRef.current.fitBounds([
          [boundingbox[0], boundingbox[2]],
          [boundingbox[1], boundingbox[3]],
        ]);
      } else {
        mapRef.current.setView([lat, lon], 13);
      }
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (mapRef.current && address) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      )
        .then((response) => response.json())
        .then((data) => {
          if (data && data.length > 0) {
            const { lat, lon, boundingbox } = data[0];
            if (boundingbox) {
              mapRef.current.fitBounds([
                [boundingbox[0], boundingbox[2]],
                [boundingbox[1], boundingbox[3]],
              ]);
            } else {
              mapRef.current.setView([lat, lon], 13);
            }
          } else {
            alert('Address not found');
          }
        })
        .catch((error) => {
          console.error('Error in geocoding:', error);
          alert('Error in geocoding. Please try again.');
        });
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((prevDarkMode) => {
      const newDarkMode = !prevDarkMode;
      setCookie('darkMode', newDarkMode, 365);
      if (mapRef.current) {
        updateBasemap(mapRef.current, basemap, newDarkMode);
      }
      return newDarkMode;
    });
  };

  const handleContextMenuClick = (e, nodeId, isLayer = false) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (lastContextMenuTrigger.current && now - lastContextMenuTrigger.current < 100) {
      return;
    }
    lastContextMenuTrigger.current = now;

    const node = treeData[nodeId];
    if (node && node.type === 'layer') {
      const { pageX, pageY } = e;

      setContextMenu({
        visible: true,
        x: pageX,
        y: pageY,
        nodeId: nodeId,
        isLayer: isLayer,
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null, isLayer: false });
  };

  const handleCommand = useCallback(
    (command) => {
      executeCommand(command, mapRef.current, [], addConsoleMessage);
      setCurrentCommand('');
    },
    [addConsoleMessage]
  );

  return (
    <div
      className={`h-screen ${
        darkMode ? 'bg-transparent text-gray-100' : 'bg-transparent text-gray-800'
      }`}
      onClick={closeContextMenu}
    >
      <LeafletMap
        darkMode={darkMode}
        basemap={basemap}
        selectedLayers={selectedLayers}
        addConsoleMessage={addConsoleMessage}
        currentCommand={currentCommand}
        handleCommand={handleCommand}
        mapRef={mapRef}
      />

      <SearchBar
        address={address}
        setAddress={setAddress}
        handleAddressSubmit={handleAddressSubmit}
        handleAddressChange={handleAddressChange}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        handleSuggestionClick={handleSuggestionClick}
        darkMode={darkMode}
        handleKeyDown={(e) => {
          if (showSuggestions) {
            switch (e.key) {
              case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex((prevIndex) =>
                  prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
                );
                break;
              case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex((prevIndex) =>
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
        }}
        selectedSuggestionIndex={selectedSuggestionIndex}
        suggestionsRef={suggestionsRef}
      />

      <div className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-gray-800 p-2 rounded shadow-md">
        <select
          value={basemap}
          onChange={handleBasemapChange}
          className={`px-2 py-1 rounded ${
            darkMode ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-800'
          }`}
        >
          <option value="default">Default OSM</option>
          <option value="esriAerial">ESRI Aerial</option>
          <option value="googleHybrid">Google Hybrid</option>
        </select>
      </div>

      <SidePanel
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        url={url}
        setUrl={setUrl}
        skipProperties={skipProperties}
        setSkipProperties={setSkipProperties}
        loading={loading}
        generateTreeMap={generateTreeMap}
        handleStopProcessing={handleStopProcessing}
        treeData={treeData}
        filteredTreeData={filteredTreeData}
        expandedNodes={expandedNodes}
        setExpandedNodes={setExpandedNodes}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showOnlyActiveLayers={showOnlyActiveLayers}
        setShowOnlyActiveLayers={setShowOnlyActiveLayers}
        error={error}
        setError={setError}
        statusMessage={statusMessage}
        setStatusMessage={setStatusMessage}
        isDownloading={isDownloading}
        selectedLayers={selectedLayers}
        setSelectedLayers={setSelectedLayers}
        handleContextMenu={handleContextMenuClick}
        map={mapRef.current} // Pass the map instance
        setIsDownloading={setIsDownloading}
        assignColorToLayer={assignColorToLayer}
        toggleNode={toggleNode}
        handleDownloadShapefile={handleDownloadShapefile}
        handleDownloadLayer={handleDownloadLayer}
        zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, mapRef.current)}
      />

      <ContextMenu
        contextMenu={contextMenu}
        handleDownloadLayer={() =>
          handleDownloadLayer(treeData[contextMenu.nodeId], setIsDownloading, setStatusMessage)
        }
        handleDownloadShapefile={() =>
          handleDownloadShapefile(treeData[contextMenu.nodeId], setIsDownloading, setStatusMessage)
        }
        darkMode={darkMode}
        onClose={closeContextMenu}
        isLayer={contextMenu.isLayer}
        zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, mapRef.current)}
        getLink={(id) => getLink(id, treeData)}
      />

      <Console
        consoleMessages={consoleMessages}
        darkMode={darkMode}
        onCommand={handleCommand}
        addConsoleMessage={addConsoleMessage}
        currentCommand={currentCommand}
      />

      <LayerManager
        selectedLayers={selectedLayers}
        onToggleLayer={handleToggleLayer}
        onRemoveLayer={handleRemoveLayer}
        onReorderLayers={handleReorderLayers}
        onAddLayer={handleAddLayer}
        darkMode={darkMode}
        selectedLayerId={selectedLayerId}
        setSelectedLayerId={setSelectedLayerId}
        onLayerColorChange={handleLayerColorChange}
      />

      <style jsx global>{`
        .floating-panel {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 360px;
          z-index: 1000;
          background-color: ${darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
          border-radius: 4px;
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.65);
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
        .layer-manager {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 300px;
          z-index: 1000;
          max-height: calc(100vh - 24px);
          overflow-y: auto;
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
