import React, { useState, useEffect, useRef, useCallback } from 'react';
import Console from './Console';
import ContextMenu from './ContextMenu';
import SearchBar from './SearchBar';
import LayerManager from './LayerManager';
import SidePanel from './SidePanel';
import LeafletMap from './LeafletMap';
import ErrorBoundary from './ErrorBoundary';

import { zoomToLayerExtent, getLink } from '../utils/mapUtils';
import { fetchAndDisplayServices } from '../utils/api';
import { executeCommand } from '../utils/commandUtils';
import { filterTreeData, toggleNode } from '../utils/treeUtils';
import { handleDownloadLayer, handleDownloadShapefile } from '../utils/dlHelpers';
import useAddressSuggestions from '../hooks/useAddressSuggestions';
import useLayerManager from '../hooks/useLayerManager';
import useContextMenu from '../hooks/useContextMenu';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useMap } from '../contexts/MapContext';
import { initDB } from '../utils/indexedDBUtils';

const ArcGISRESTTreeMap = () => {
  const [url, setUrl] = useState('https://sampleserver6.arcgisonline.com/arcgis/rest/services/');
  const previousBaseUrlRef = useRef(null);
  const [treeData, setTreeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [skipProperties, setSkipProperties] = useState(true);
  const [processedUrls, setProcessedUrls] = useState(() => new Set());
  const [consoleMessages, setConsoleMessages] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [filteredTreeData, setFilteredTreeData] = useState({});
  const [abortController, setAbortController] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showOnlyActiveLayers, setShowOnlyActiveLayers] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentCommand, setCurrentCommand] = useState('');
  const [selectedLayerId, setSelectedLayerId] = useState(null);

  const { darkMode, toggleDarkMode } = useDarkMode();
  const { basemap, handleBasemapChange, mapRef } = useMap();

  const {
    address,
    setAddress,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    handleAddressChange,
    handleSuggestionClick,
    handleAddressSubmit,
  } = useAddressSuggestions(mapRef);

  const {
    layers,
    handleLayerColorChange,
    handleToggleLayer,
    handleRemoveLayer,
    handleReorderLayers,
    handleAddLayer,
    handleLayerUpdate,
  } = useLayerManager(mapRef);

  const {
    contextMenu,
    handleContextMenuClick,
    closeContextMenu,
  } = useContextMenu();

  useEffect(() => {
    initDB().catch(error => console.error('Failed to initialize IndexedDB:', error));
  }, []);

  useEffect(() => {
    setFilteredTreeData(filterTreeData(treeData, searchTerm));
  }, [treeData, searchTerm]);

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

  const handleCommand = useCallback(
    (command) => {
      executeCommand(command, mapRef.current, [], addConsoleMessage);
      setCurrentCommand('');
    },
    [addConsoleMessage, mapRef]
  );

  const handleFileUpload = async (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    try {
      let layerData;
      if (fileExtension === 'kml') {
        const kmlText = await file.text();
        layerData = {
          name: file.name,
          layerCategory: 'kml',
          kmlData: kmlText,
        };
      } else if (fileExtension === 'json' || fileExtension === 'geojson') {
        const fileContent = await file.text();
        try {
          const geoJsonData = JSON.parse(fileContent);
          layerData = {
            name: file.name,
            layerCategory: 'geojson',
            geoJsonData: geoJsonData,
          };
        } catch (parseError) {
          console.error('Error parsing GeoJSON:', parseError);
          throw new Error(`Invalid JSON in file: ${parseError.message}`);
        }
      } else {
        throw new Error('Unsupported file type');
      }

      const layerId = handleAddLayer(layerData);
      if (!layerId) {
        throw new Error(`Failed to add ${fileExtension.toUpperCase()} layer`);
      }
      addConsoleMessage(`Successfully added ${file.name}`);
    } catch (error) {
      console.error('Error adding layer:', error);
      addConsoleMessage(`Error adding ${file.name}: ${error.message}`);
    }
  };

  return (
    <ErrorBoundary>
      <div
        className={`h-screen ${
          darkMode ? 'bg-transparent text-gray-100' : 'bg-transparent text-gray-800'
        }`}
        onClick={closeContextMenu}
      >
        <LeafletMap
          darkMode={darkMode}
          basemap={basemap}
          layers={layers}
          addConsoleMessage={addConsoleMessage}
          currentCommand={currentCommand}
          handleCommand={handleCommand}
          mapRef={mapRef}
          handleLayerUpdate={handleLayerUpdate}
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
        />

        <div className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-gray-800 p-2 rounded shadow-md">
          <select
            value={basemap}
            onChange={(e) => handleBasemapChange(e.target.value)}
            className={`px-2 py-1 rounded ${
              darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'
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
          layers={layers}
          handleContextMenu={handleContextMenuClick}
          map={mapRef.current}
          setIsDownloading={setIsDownloading}
          toggleNode={toggleNode}
          handleDownloadShapefile={handleDownloadShapefile}
          handleDownloadLayer={handleDownloadLayer}
          zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, mapRef.current)}
          handleAddLayer={handleAddLayer}
          handleToggleLayer={handleToggleLayer}
          handleFileUpload={handleFileUpload}
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
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onRemoveLayer={handleRemoveLayer}
          onReorderLayers={handleReorderLayers}
          onAddLayer={handleAddLayer}
          darkMode={darkMode}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
          onLayerColorChange={handleLayerColorChange}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ArcGISRESTTreeMap;
