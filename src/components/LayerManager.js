import React, { useState, useRef, memo, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { storeLayer, getLayers, deleteLayer, initDB, getLayerData } from '../utils/indexedDBUtils';
import LayerImportPopup from './LayerImportPopup';

const LayerManager = memo(({ layers = [], onToggleLayer, onRemoveLayer, onReorderLayers, onAddLayer, darkMode, selectedLayerId, setSelectedLayerId, onLayerColorChange }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const containerRef = useRef(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [colorPickerLayerId, setColorPickerLayerId] = useState(null);
  const [uploadedLayers, setUploadedLayers] = useState([]);

  // Color options for the color picker
  const colorGroups = {
    'Pastel Colors': ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3'],
    'Primary & Secondary Colors': ['#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#4B0082', '#EE82EE'],
    'Shades of Gray': ['#FFFFFF', '#C0C0C0', '#808080', '#404040', '#000000'],
    'Additional Colors': ['#800000', '#FF69B4', '#FFD700', '#00FF00', '#00FFFF', '#00008B', '#8A2BE2'],
  };

  // Initialize IndexedDB and fetch uploaded layers
  useEffect(() => {
    const initializeDB = async () => {
      try {
        await initDB();
        const fetchedLayers = await getLayers();
        setUploadedLayers(fetchedLayers);
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
      }
    };
    initializeDB();
  }, []);

  // Handle file upload
  const handleFileUpload = async (file, directory) => {
    try {
      const layer = await storeLayer(file, file.name.split('.').pop().toLowerCase(), directory);
      setUploadedLayers(prevLayers => [...prevLayers, layer]);
      onAddLayer({
        name: layer.name,
        layerCategory: 'uploaded',
        datasource: layer.id,
        directory: directory,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    }
  };

  // Handle color box click to open color picker
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

  // Handle color selection from color picker
  const handleColorSelect = (color) => {
    onLayerColorChange(colorPickerLayerId, color);
    setColorPickerVisible(false);
  };
  
  const colorPickerRef = useRef(null);

  // Handle drag end for reordering layers
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorderLayers(result.source.index, result.destination.index);
  };

  // Update layer manager position
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
  }, [layers]);

  // Handle click outside color picker to close it
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
  
  // Handle layer click to select it
  const handleLayerClick = (layerId) => {
    if (typeof setSelectedLayerId === 'function') {
      setSelectedLayerId(layerId);
    }
  };

  // Handle removing an uploaded layer
  const handleRemoveUploadedLayer = async (layerId) => {
    try {
      await deleteLayer(layerId);
      setUploadedLayers(prevLayers => prevLayers.filter(layer => layer.id !== layerId));
      onRemoveLayer(layerId);
    } catch (error) {
      console.error('Error removing uploaded layer:', error);
      alert('Error removing uploaded layer. Please try again.');
    }
  };

  const handleOpenPopup = () => {
    console.log("Opening Import/Create Layers popup");
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    console.log("Closing Import/Create Layers popup");
    setIsPopupOpen(false);
  };
  
  const handleAddSavedLayer = async (layer) => {
    try {
      const layerData = await getLayerData(layer.id);
      if (layerData && layerData.data) {
        onAddLayer({
          name: layer.name,
          layerCategory: 'saved',
          datasource: layer.id,
          directory: layer.directory,
          geoJsonData: layerData.data,
        });
      } else {
        console.error('Layer data not found or invalid');
      }
    } catch (error) {
      console.error('Error adding saved layer:', error);
    }
  };

  useEffect(() => {
    console.log("LayerManager rendered, isPopupOpen:", isPopupOpen);
  }, [isPopupOpen]);

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
        <h3 className="text-sm font-semibold mb-4">Layers</h3>
        {/* Layer list container */}
        <div className="layer-list-container" style={{ overflowY: 'auto', maxHeight: '300px' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="layers">
              {(provided) => (
                <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 mb-4">
                  {layers.map((layer, index) => (
                    <Draggable key={layer.id} draggableId={layer.id.toString()} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${selectedLayerId === layer.id ? 'border border-blue-500' : ''}`}
                          onClick={() => handleLayerClick(layer.id)}
                        >
                          <div className="flex items-center">
                            <span {...provided.dragHandleProps} className="mr-2 cursor-grab">
                              ☰
                            </span>
                            <input
                              type="checkbox"
                              checked={layer.visible}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleLayer(layer.id);
                              }}
                              className="mr-2"
                            />
                            <div
                              className="w-4 h-4 mr-2 rounded cursor-pointer"
                              style={{ backgroundColor: layer.color || '#000', minWidth: '16px', minHeight: '16px' }}
                              onClick={(e) => handleColorBoxClick(e, layer.id)}
                            ></div>
                            <span className="text-xs mr-2">{layer.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              layer.layerCategory === 'uploaded' ? handleRemoveUploadedLayer(layer.id) : onRemoveLayer(layer.id);
                            }}
                            className={`flex items-center justify-center px-2 py-1 rounded-md text-xs ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                            style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', padding: 0 }}
                          >
                            <span style={{ fontSize: '18px', lineHeight: '18px', transform: 'translate(-1px, -2px)' }}>×</span>
                          </button>
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
        {layers.length === 0 && (
          <div className="mb-4">No layers.</div>
        )}
        {/* Import/Create Layers button */}
        <div className="mt-4">
          <button
            onClick={handleOpenPopup}
            className={`w-2/3 px-4 py-1 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-md text-xs`}
          >
            Import/Create Layers
          </button>
        </div>
      </div>
      {/* Color picker popup */}
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
      {/* Layer import popup */}
      <LayerImportPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        onFileUpload={handleFileUpload}
        onAddCustomLayer={(name, directory) => onAddLayer({
          name,
          layerCategory: 'custom',
          directory,
        })}
        onAddSavedLayer={handleAddSavedLayer}
        darkMode={darkMode}
      />
    </>
  );
});

export default LayerManager;
