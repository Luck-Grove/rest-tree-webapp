import React, { useState, useRef, memo, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import LayerFilterPopup from './LayerFilterPopup';
import { fetchLayerFields, applyFilters } from '../utils/layerFilterUtils';

const LayerManager = memo(({ 
  selectedLayers = [], 
  onToggleLayer, 
  onRemoveLayer, 
  onReorderLayers, 
  onAddLayer, 
  darkMode, 
  selectedLayerId, 
  setSelectedLayerId, 
  onLayerColorChange,
  onApplyFilters,
  onClearFilters
}) => {
  const [newLayerName, setNewLayerName] = useState('');
  const containerRef = useRef(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [colorPickerLayerId, setColorPickerLayerId] = useState(null);
  const [filterPopupVisible, setFilterPopupVisible] = useState(false);
  const [selectedFilterLayer, setSelectedFilterLayer] = useState(null);

  const colorGroups = {
    'Pastel Colors': ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3'],
    'Primary & Secondary Colors': ['#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#4B0082', '#EE82EE'],
    'Shades of Gray': ['#FFFFFF', '#C0C0C0', '#808080', '#404040', '#000000'],
    'Additional Colors': ['#800000', '#FF69B4', '#FFD700', '#00FF00', '#00FFFF', '#00008B', '#8A2BE2'],
  };

  const handleColorBoxClick = (e, layerId) => {
    e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    const pickerWidth = 200;
    const pickerHeight = 150;
    const x = rect.left - pickerWidth + window.scrollX;
    const y = rect.top - pickerHeight - 20 + window.scrollY;

    setColorPickerPosition({ x, y });
    setColorPickerLayerId(layerId);
    setColorPickerVisible(true);
  };

  const handleColorSelect = (color) => {
    onLayerColorChange(colorPickerLayerId, color);
    setColorPickerVisible(false);
  };
  
  const colorPickerRef = useRef(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorderLayers(result.source.index, result.destination.index);
  };

  useLayoutEffect(() => {
    if (containerRef.current) {
      const updatePosition = () => {
        const container = containerRef.current;
        const maxHeight = window.innerHeight * (2 / 3);
        const bottomMargin = 65;
        const minTopMargin = 120;

        let topPosition = window.innerHeight - container.offsetHeight - bottomMargin;
        topPosition = Math.max(topPosition, window.innerHeight - maxHeight);
        topPosition = Math.max(topPosition, minTopMargin);

        container.style.top = `${topPosition}px`;
        container.style.maxHeight = `${maxHeight - minTopMargin}px`;
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [selectedLayers]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        colorPickerVisible &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target) &&
        !containerRef.current.contains(e.target)
      ) {
        setColorPickerVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [colorPickerVisible]);
  
  const handleLayerClick = (layerId) => {
    setSelectedLayerId(layerId);
  };

  const handleQueryLayer = async (layer, filters) => {
    try {
      const filteredLayer = applyFilters(layer, filters);
      const where = filteredLayer.definitionExpression || '1=1';
      const url = `${layer.datasource}/query`;
  
      const params = new URLSearchParams({
        where: where,
        returnCountOnly: 'true',
        f: 'json'
      });
  
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET'
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data && data.count !== undefined) {
        return data.count;
      } else {
        throw new Error('Failed to get count from query response');
      }
    } catch (error) {
      console.error('Error querying layer:', error);
      throw error;
    }
  };

  const handleFilterClick = async (e, layer) => {
    e.stopPropagation();
    let layerWithFields = layer;

    if (!layer.fields && layer.type === 'arcgis') {
      try {
        const fields = await fetchLayerFields(layer.datasource);
        layerWithFields = { ...layer, fields };
      } catch (error) {
        console.error('Failed to fetch layer fields:', error);
        return;
      }
    }

    setSelectedFilterLayer(layerWithFields);
    setFilterPopupVisible(true);
  };

  const handleSaveFilters = (filters) => {
    onApplyFilters(selectedFilterLayer.id, filters);
    setFilterPopupVisible(false);
  };

  const handleClearFilters = () => {
    onClearFilters(selectedFilterLayer.id);
    setFilterPopupVisible(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`layer-manager ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'} p-4 rounded-md shadow-md fixed right-4`}
        style={{
          backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          fontSize: '0.875rem',
          maxWidth: '300px',
          width: '100%',
          zIndex: 1000,
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">Layers</h3>
          <button
            onClick={() => setFilterPopupVisible(true)}
            className={`flex items-center justify-center px-3 py-1 rounded-md text-xs ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
            style={{ width: '24px', height: '24px', padding: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
        <div className="layer-list-container" style={{ overflowY: 'auto', maxHeight: '300px' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="layers">
              {(provided) => (
                <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 mb-4">
                  {selectedLayers.map((layer, index) => (
                    <Draggable key={layer.id} draggableId={layer.id.toString()} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${selectedLayerId === layer.id ? 'border border-blue-500' : ''}`}
                          onClick={() => handleLayerClick(layer.id)}
                        >
                          <div className="flex items-center flex-grow mr-2 min-w-0">
                            <span {...provided.dragHandleProps} className="mr-2 cursor-grab flex-shrink-0">
                              ☰
                            </span>
                            <input
                              type="checkbox"
                              checked={layer.visible}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleLayer(layer.id);
                              }}
                              className="mr-2 flex-shrink-0"
                            />
                            <div
                              className="w-4 h-4 mr-2 rounded cursor-pointer flex-shrink-0"
                              style={{ backgroundColor: layer.color || '#000', minWidth: '16px', minHeight: '16px' }}
                              onClick={(e) => handleColorBoxClick(e, layer.id)}
                            ></div>
                            <span className="text-xs mr-2 truncate">{layer.name || layer.text}</span>
                          </div>
                          <div className="flex items-center flex-shrink-0">
                            <button
                              onClick={(e) => handleFilterClick(e, layer)}
                              className={`flex items-center justify-center px-2 py-1 rounded-md text-xs mr-1 ${
                                layer.filters && Object.keys(layer.filters).length > 0
                                  ? darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                                  : darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                              } text-white`}
                              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', padding: 0 }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveLayer(layer.id);
                              }}
                              className={`flex items-center justify-center px-2 py-1 rounded-md text-xs ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', padding: 0 }}
                            >
                              <span style={{ fontSize: '18px', lineHeight: '18px', transform: 'translate(-1px, -2px)' }}>×</span>
                            </button>
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>
        {selectedLayers.length === 0 && (
          <div className="mb-4">No layers.</div>
        )}
        <div className="mt-4 flex">
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="New custom layer..."
            className={`flex-grow px-2 py-1 rounded-md mr-2 text-sm ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'}`}
          />
          <button
            onClick={() => {
              if (newLayerName.trim()) {
                onAddLayer(newLayerName.trim());
                setNewLayerName('');
              }
            }}
            className={`px-4 py-1 rounded-md text-sm ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
          >
            Add
          </button>
        </div>
        {colorPickerVisible &&
          ReactDOM.createPortal(
            <div
              className="color-picker-popup p-2 rounded shadow-md"
              style={{
                position: 'absolute',
                top: colorPickerPosition.y,
                left: colorPickerPosition.x,
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                border: '1px solid #ccc',
                zIndex: 10000,
                width: '200px',
              }}
              ref={colorPickerRef}
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold" style={{ color: darkMode ? '#f0f0f0' : '#333' }}>Colors</h4>
                <button
                  onClick={() => setColorPickerVisible(false)}
                  className="text-xs p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                  ✕
                </button>
              </div>
              {Object.entries(colorGroups).map(([groupName, colors]) => (
                <div key={groupName} className="mb-2">
                  <h4 className="text-xs font-semibold mb-1" style={{ color: darkMode ? '#f0f0f0' : '#333' }}>{groupName}</h4>
                  <div className="grid grid-cols-6 gap-1">
                    {colors.map((colorOption) => (
                      <div
                        key={colorOption}
                        className="w-5 h-5 rounded cursor-pointer"
                        style={{ backgroundColor: colorOption, minWidth: '20px', minHeight: '20px' }}
                        onClick={() => handleColorSelect(colorOption)}
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )}
      </div>
      {filterPopupVisible && (
        <LayerFilterPopup
          layers={selectedLayers}
          selectedLayer={selectedFilterLayer}
          onSave={handleSaveFilters}
          onClear={handleClearFilters}
          onCancel={() => setFilterPopupVisible(false)}
          darkMode={darkMode}
          onQueryLayer={handleQueryLayer}
        />
      )}
    </>
  );
});

export default LayerManager;
