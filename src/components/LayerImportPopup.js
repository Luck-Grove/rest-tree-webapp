import React, { useState, useEffect } from 'react';
import IndexedDBFileBrowser from './IndexedDBFileBrowser';
import { storeLayer } from '../utils/indexedDBUtils';

const LayerImportPopup = ({ isOpen, onClose, onFileUpload, onAddCustomLayer, onAddSavedLayer, darkMode }) => {
  const [newLayerName, setNewLayerName] = useState('');
  const [currentDirectory, setCurrentDirectory] = useState('/');
  const [fileUploadTrigger, setFileUploadTrigger] = useState(0);

  useEffect(() => {
    console.log('LayerImportPopup rendered, isOpen:', isOpen);
  }, [isOpen]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      const fileType = file.name.split('.').pop().toLowerCase();
      if (!['kml', 'kmz', 'geojson'].includes(fileType)) {
        alert('Please upload KML, KMZ, or GeoJSON files.');
        continue;
      }

      try {
        await storeLayer(file, fileType, currentDirectory);
        onFileUpload(file, currentDirectory);
        setFileUploadTrigger((prev) => prev + 1);
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Error uploading file. Please try again.');
      }
    }
  };

  const handleAddCustomLayer = () => {
    if (newLayerName.trim()) {
      onAddCustomLayer(newLayerName.trim(), currentDirectory);
      setNewLayerName('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div
        className={`${
          darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'
        } p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 relative z-[10000]`}
      >
        <h3 className="text-lg font-semibold mb-4">Import/Create Layers</h3>
        <div className="mb-4">
          <input
            type="file"
            accept=".kml,.kmz,.geojson"
            onChange={handleFileUpload}
            multiple
            className="mb-2 text-sm"
          />
        </div>
        <IndexedDBFileBrowser
          currentDirectory={currentDirectory}
          setCurrentDirectory={setCurrentDirectory}
          darkMode={darkMode}
          onAddLayer={onAddSavedLayer}
          fileUploadTrigger={fileUploadTrigger}
        />
        <div className="mb-4 mt-4">
          <input
            type="text"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            placeholder="New custom layer..."
            className={`w-full px-2 py-1 rounded-md text-sm ${
              darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'
            } border`}
          />
        </div>
        <div className="flex justify-between">
          <button
            onClick={handleAddCustomLayer}
            className={`px-4 py-2 ${
              darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white rounded-md text-sm`}
          >
            Add Custom Layer
          </button>
          <button
            onClick={onClose}
            className={`px-4 py-2 ${
              darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-300 hover:bg-gray-400'
            } text-white rounded-md text-sm`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerImportPopup;
