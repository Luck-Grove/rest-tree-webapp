import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const LayerManager = ({ layers, onToggleLayer, onRemoveLayer, onReorderLayers, onAddLayer, onContextMenu, darkMode }) => {
  const [newLayerName, setNewLayerName] = useState('');
  const containerRef = useRef(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorderLayers(result.source.index, result.destination.index);
  };

  useEffect(() => {
    if (containerRef.current) {
      const updatePosition = () => {
        const container = containerRef.current;
        const maxHeight = window.innerHeight * (2/3);
        const bottomMargin = 65; // Distance from the bottom of the drawn box
        const minTopMargin = 120; // Minimum distance from the top of the screen
        
        // Calculate the initial position (starting from the bottom)
        let topPosition = window.innerHeight - container.offsetHeight - bottomMargin;
        
        // Ensure it doesn't go below the bottom margin
        topPosition = Math.max(topPosition, window.innerHeight - maxHeight);
        
        // Ensure it doesn't go above the minimum top margin
        topPosition = Math.max(topPosition, minTopMargin);
        
        container.style.top = `${topPosition}px`;
        container.style.maxHeight = `${maxHeight - minTopMargin}px`; // Subtracting minimum top margin
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [layers]);

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
            <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {layers.map((layer, index) => (
                <Draggable key={layer.id} draggableId={layer.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center justify-between p-2 rounded-md ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
                      onContextMenu={(e) => onContextMenu(e, layer.id, true)}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={() => onToggleLayer(layer.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{layer.name}</span>
                      </div>
                      <button
                        onClick={() => onRemoveLayer(layer.id)}
                        className={`px-2 py-1 rounded-md text-xs ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                      >
                        Remove
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
    </div>
  );
};

export default LayerManager;