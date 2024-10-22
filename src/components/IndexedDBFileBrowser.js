import React, { useState, useEffect } from 'react';
import { getLayers, deleteLayer, getLayerData, createNewFolder, deleteFolder } from '../utils/indexedDBUtils';

const IndexedDBFileBrowser = ({
  currentDirectory,
  setCurrentDirectory,
  darkMode,
  onAddLayer,
  fileUploadTrigger,
}) => {
  const [files, setFiles] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    fetchFiles(currentDirectory);
  }, [currentDirectory, fileUploadTrigger]);

  const fetchFiles = async (directory) => {
    try {
      const layers = await getLayers(directory);
      setFiles(layers);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleDeleteFile = async (file) => {
    if (file.type === 'directory') {
      try {
        const itemsInFolder = await getLayers(file.fullPath);
        if (itemsInFolder.length > 0) {
          const confirmDelete = window.confirm(
            'This folder is not empty. Deleting it will remove all its contents. Do you want to proceed?'
          );
          if (!confirmDelete) return;
        }
        await deleteFolder(file.fullPath);
        fetchFiles(currentDirectory);
      } catch (error) {
        console.error('Error deleting folder:', error);
        alert('Error deleting folder. Please try again.');
      }
    } else {
      // Existing code for deleting a file
      try {
        await deleteLayer(file.id);
        fetchFiles(currentDirectory);
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Error deleting file. Please try again.');
      }
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const data = await getLayerData(file.id);
      const blob = new Blob([data.data], { type: 'application/octet-stream' }); // Access the 'data' field of the object
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  const handleNavigate = (directory) => {
    setCurrentDirectory(directory);
  };

  const handleCreateNewFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createNewFolder(currentDirectory, newFolderName.trim());
      setNewFolderName('');
      fetchFiles(currentDirectory);
    } catch (error) {
      console.error('Error creating new folder:', error);
      alert('Error creating new folder. Please try again.');
    }
  };

  const getParentDirectory = (directory) => {
    const parts = directory.split('/');
    return parts.slice(0, -1).join('/') || '/';
  };

  return (
    <div className="mb-4">
      <div className="mb-2">
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New folder name"
          className={`w-full px-2 py-1 rounded-md text-sm ${
            darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'
          } border`}
        />
        <button
          onClick={handleCreateNewFolder}
          className={`px-4 py-2 mt-2 ${
            darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
          } text-white rounded-md text-sm`}
        >
          Create New Folder
        </button>
      </div>
      <h4 className="text-md font-semibold mb-2">Saved Layers</h4>
      <div
        className={`${
          darkMode ? 'bg-gray-700' : 'bg-gray-100'
        } p-2 rounded-md max-h-60 overflow-y-auto`}
      >
        {currentDirectory !== '/' && (
          <div
            className="flex items-center mb-2 cursor-pointer text-blue-500 hover:text-blue-600"
            onClick={() => handleNavigate(getParentDirectory(currentDirectory))}
          >
            <span className="mr-2">↩</span>
            <span>Go Up...</span>
          </div>
        )}
        {files.map((file) => (
          <div key={file.id} className="flex justify-between items-center mb-2">
            {file.type === 'directory' ? (
              <span
                className="cursor-pointer text-blue-500 hover:text-blue-600"
                onClick={() => handleNavigate(file.fullPath)}
              >
                📁 {file.name}
              </span>
            ) : (
              <span>📄 {file.name}</span>
            )}
            <div>
              {file.type !== 'directory' && (
                <>
                  <button
                    onClick={() => onAddLayer(file)}
                    className={`px-2 py-1 rounded-md text-xs ${
                      darkMode
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white mr-2`}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => handleDownloadFile(file)}
                    className={`px-2 py-1 rounded-md text-xs ${
                      darkMode
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-gray-400 hover:bg-gray-500'
                    } text-white mr-2`}
                  >
                    Download
                  </button>
                </>
              )}
              <button
                onClick={() => handleDeleteFile(file)}
                className={`px-2 py-1 rounded-md text-xs ${
                  darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                } text-white`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexedDBFileBrowser;
