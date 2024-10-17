import React, { useState, useRef, memo, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const LayerManager = memo(({ selectedLayers = [], onToggleLayer, onRemoveLayer, onReorderLayers, onAddLayer, darkMode, selectedLayerId, setSelectedLayerId, onLayerColorChange }) => {
  const [newLayerName, setNewLayerName] = useState('');
  const containerRef = useRef(null);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [colorPickerLayerId, setColorPickerLayerId] = useState(null);

  const basicColorPalette = [
    // Pastel Colors
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3',
    // Primary and Secondary Colors
    '#FF0000', '#FFA500', '#FFFF00', '#008000', '#0000FF', '#4B0082', '#EE82EE',
    // Shades of Gray
    '#FFFFFF', '#C0C0C0', '#808080', '#404040', '#000000',
    // Additional Colors
    '#800000', '#FF69B4', '#FFD700', '#00FF00', '#00FFFF', '#00008B', '#8A2BE2',
    // Add more colors as desired
  ];

  const handleColorBoxClick = (e, layerId) => {
    e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    const pickerWidth = 150; // Approximate width of the color picker
    const pickerHeight = 100; // Approximate height of the color picker
    const spaceOnLeft = rect.left;
    const spaceOnRight = window.innerWidth - rect.right;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
  
    let x = rect.right + window.scrollX; // Default position to the right
    let y = rect.top + window.scrollY;   // Align with the top of the color box
  
    if (spaceOnRight < pickerWidth && spaceOnLeft >= pickerWidth) {
      // Not enough space on the right, but enough on the left
      x = rect.left - pickerWidth + window.scrollX;
    }
  
    if (spaceBelow < pickerHeight && spaceAbove >= pickerHeight) {
      // Not enough space below, but enough above
      y = rect.top - pickerHeight + window.scrollY;
    }
  
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

  return (
    <div
      ref={containerRef}
      className={`layer-manager ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'} p-4 rounded-md shadow-md fixed right-4 overflow-y-auto`}
      style={{
        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        fontSize: '0.875rem',
        maxWidth: '300px',
        width: '100%',
        zIndex: 1000,
      }}
    >
      <h3 className="text-base font-semibold mb-4">Layer Manager</h3>
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
                          style={{ backgroundColor: layer.color || '#000' }}
                          onClick={(e) => handleColorBoxClick(e, layer.id)}
                        ></div>
                        <span className="text-sm mr-2">{layer.name || layer.text}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveLayer(layer.id);
                        }}
                        className={`flex items-center justify-center px-2 py-1 rounded-md text-xs ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                        style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', padding: 0 }}
                      >
                        <span style={{ fontSize: '16px', lineHeight: '16px' }}>×</span>
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
      {selectedLayers.length === 0 && (
        <div className="mb-4">No layers available.</div>
      )}
      <div className="mt-4 flex">
        <input
          type="text"
          value={newLayerName}
          onChange={(e) => setNewLayerName(e.target.value)}
          placeholder="New layer name"
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
            className="color-picker-popup grid grid-cols-6 gap-1 p-2 rounded shadow-md"
            style={{
              position: 'absolute',
              top: colorPickerPosition.y,
              left: colorPickerPosition.x,
              backgroundColor: darkMode ? '#1f2937' : '#ffffff',
              border: '1px solid #ccc',
              zIndex: 10000,
            }}
            ref={colorPickerRef}
          >
            {basicColorPalette.map((colorOption) => (
              <div
                key={colorOption}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ backgroundColor: colorOption }}
                onClick={() => handleColorSelect(colorOption)}
              ></div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
});

export default LayerManager;
