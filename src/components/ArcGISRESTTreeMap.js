import React, { useState, useEffect, useCallback } from 'react';
import Console from './Console';
import ContextMenu from './ContextMenu';
import SearchBar from './SearchBar';
import LayerManager from './LayerManager';
import SidePanel from './SidePanel';
import LeafletMap from './LeafletMap';
import ErrorBoundary from './ErrorBoundary';

import { zoomToLayerExtent, getLink } from '../utils/mapUtils';
import { fetchServicesWithCache } from '../utils/api';
import { executeCommand } from '../utils/commandUtils';
import { filterTreeData, toggleNode } from '../utils/treeUtils';
import { handleDownloadLayer, handleDownloadShapefile } from '../utils/dlHelpers';
import useAddressSuggestions from '../hooks/useAddressSuggestions';
import useLayerManager from '../hooks/useLayerManager';
import useContextMenu from '../hooks/useContextMenu';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useMap } from '../contexts/MapContext';
import { initIndexedDB, getCacheStats } from '../utils/indexedDBUtils';

const WELCOME_NODE = {
  id: 'welcome',
  name: 'Select a server or enter a URL',
  type: 'folder',
  parent: null,
  children: []
};

const ArcGISRESTTreeMap = () => {
  const [url, setUrl] = useState('https://sampleserver6.arcgisonline.com/arcgis/rest/services/');
  const [treeData, setTreeData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasStoredData, setHasStoredData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [skipProperties, setSkipProperties] = useState(true);
  const [consoleMessages, setConsoleMessages] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['welcome']));
  const [filteredTreeData, setFilteredTreeData] = useState({});
  const [abortController, setAbortController] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showOnlyActiveLayers, setShowOnlyActiveLayers] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentCommand, setCurrentCommand] = useState('');
  const [isInitialState, setIsInitialState] = useState(true);

  const { darkMode, toggleDarkMode } = useDarkMode();
  const { basemap, handleBasemapChange, mapRef } = useMap();

  const {
    address,
    setAddress,
    suggestions,
    hasFocus,
    setHasFocus,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    handleAddressChange,
    handleSuggestionClick,
    handleAddressSubmit,
  } = useAddressSuggestions(mapRef);

  const {
    selectedLayers,
    setSelectedLayers,
    selectedLayerId,
    setSelectedLayerId,
    handleLayerColorChange,
    handleToggleLayer,
    handleRemoveLayer,
    handleReorderLayers,
    handleAddLayer,
    assignColorToLayer,
    handleApplyFilters,
    handleClearFilters,
    layerFilters
  } = useLayerManager(treeData, mapRef);

  const {
    contextMenu,
    handleContextMenuClick,
    closeContextMenu,
  } = useContextMenu();

  // Initialize IndexedDB on component mount
  useEffect(() => {
    const initDB = async () => {
      try {
        await initIndexedDB();
        const stats = await getCacheStats();
        console.log('Cache initialized:', stats);
      } catch (error) {
        console.error('Cache initialization failed:', error);
      }
    };
    initDB();
  }, []);

  // Handle tree data filtering and welcome state
  useEffect(() => {
    const displayData = isInitialState && Object.keys(treeData).length === 0
      ? { welcome: WELCOME_NODE }
      : treeData;

    setFilteredTreeData(filterTreeData(displayData, searchTerm));
  }, [treeData, searchTerm, isInitialState]);

  // Reset initial state when URL changes
  useEffect(() => {
    if (url) {
      setIsInitialState(false);
    }
  }, [url]);

  useEffect(() => {
    if (searchTerm && treeData) {
        // Get all folder and service IDs that should be expanded
        const nodesToExpand = Object.keys(treeData).filter(id => {
            const node = treeData[id];
            return node.hasChildren || 
                   node.type === 'MapServer' || 
                   node.type === 'FeatureServer' ||
                   node.type === 'folder';
        });
        
        // Add all these nodes to expanded set
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            nodesToExpand.forEach(id => newSet.add(id));
            return newSet;
        });
    }
}, [treeData, searchTerm]);

  useEffect(() => {
    addConsoleMessage("---AGS Multitool---\nUse the side panel to search and select a server.\nGenerate tree maps using Generate Tree Map, or load from cache using Load Tree Map.\nCommand input is similar to AutoCAD. Run 'help' for a list of commands.");
  }, []);

  const addConsoleMessage = useCallback((message) => {
    setConsoleMessages((prev) => [...prev, message]);
  }, []);

  const generateTreeMap = async (setHasStoredData) => {
    let controller = null;
    try {
        controller = new AbortController();
        setAbortController(controller);
        setLoading(true);
        setError(null);

        const result = await fetchServicesWithCache({
            url,
            signal: controller.signal,
            setTreeData,
            addConsoleMessage,
            skipProperties,
            assignColorToLayer,
            selectedLayers,
            expandedNodes,
            onCacheResult: (result) => {
                if (setHasStoredData) {
                    setHasStoredData(result === 'loaded' || result === 'saved');
                }
            }
        });

        // Add this check for successful generation
        if (result && Object.keys(result).length > 0 && setHasStoredData) {
            setHasStoredData(true);
        }

    } catch (error) {
        if (error.message !== 'Operation was cancelled') {
            console.error('Error:', error);
            setError(error.message);
            addConsoleMessage('Failed to generate tree map: ' + error.message);
            if (setHasStoredData) {
                setHasStoredData(false);
            }
        } else {
            addConsoleMessage('Operation cancelled by user');
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

  const handleCommand = useCallback(
    (command) => {
      executeCommand(command, mapRef.current, [], addConsoleMessage);
      setCurrentCommand('');
    },
    [addConsoleMessage, mapRef]
  );

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
          hasFocus={hasFocus}
          setHasFocus={setHasFocus}
          handleSuggestionClick={handleSuggestionClick}
          darkMode={darkMode}
          handleKeyDown={(key) => {
            switch (key) {
              case 'ArrowDown':
                setSelectedSuggestionIndex((prevIndex) =>
                  prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
                );
                break;
              case 'ArrowUp':
                setSelectedSuggestionIndex((prevIndex) =>
                  prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
                );
                break;
              default:
                break;
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
          setLoading={setLoading}
          generateTreeMap={generateTreeMap}
          handleStopProcessing={handleStopProcessing}
          treeData={treeData}
          setTreeData={setTreeData}
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
          hasStoredData={hasStoredData}
          setHasStoredData={setHasStoredData}
          isDownloading={isDownloading}
          selectedLayers={selectedLayers}
          setSelectedLayers={setSelectedLayers}
          handleContextMenu={handleContextMenuClick}
          map={mapRef.current}
          setIsDownloading={setIsDownloading}
          toggleNode={toggleNode}
          handleDownloadShapefile={handleDownloadShapefile}
          handleDownloadLayer={handleDownloadLayer}
          zoomToLayerExtent={(id) => zoomToLayerExtent(id, treeData, mapRef.current)}
          assignColorToLayer={assignColorToLayer}
          addConsoleMessage={addConsoleMessage}
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
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          layerFilters={layerFilters}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ArcGISRESTTreeMap;
