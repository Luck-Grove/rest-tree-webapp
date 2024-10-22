import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'LayerStorage';
const STORE_NAME = 'layers';

let db;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, 2);

    request.onerror = (event) => reject('IndexedDB error: ' + event.target.error);

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('directory', 'directory', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
        objectStore.createIndex('fullPath', 'fullPath', { unique: true });
      }
    };
  });
};

const getDB = async () => {
  if (!db) {
    await initDB();
  }
  return db;
};

export const storeLayer = async (file, fileType, directory) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const fullPath = directory === '/' ? `/${file.name}` : `${directory}/${file.name}`;
      const layer = {
        id: uuidv4(),
        name: file.name,
        type: fileType,
        data: e.target.result,
        directory,
        fullPath,
        dateAdded: new Date().toISOString(),
      };

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(layer);

      request.onerror = () => reject('Error storing layer');
      request.onsuccess = () => resolve(layer);
    };

    reader.onerror = () => reject('Error reading file');
    reader.readAsText(file);
  });
};

export const getLayers = async (directory = '/') => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('directory');
    const request = index.getAll(IDBKeyRange.only(directory));

    request.onerror = () => reject('Error fetching layers');
    request.onsuccess = () => resolve(request.result);
  });
};

export const getLayerData = async (layerId) => {
  const db = await getDB(); // Use getDB() instead of opening the database directly
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const getRequest = objectStore.get(layerId);

    getRequest.onerror = () => reject('Error fetching layer data');
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        resolve(getRequest.result); // Return the entire layer object
      } else {
        reject('Layer not found.');
      }
    };
  });
};

export const createNewFolder = async (parentDirectory, folderName) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const fullPath = parentDirectory === '/' ? `/${folderName}` : `${parentDirectory}/${folderName}`;

    const newFolder = {
      id: fullPath, // Use fullPath as the id for folders
      name: folderName,
      directory: parentDirectory,
      type: 'directory',
      fullPath,
      dateAdded: new Date().toISOString(),
    };

    const addRequest = store.add(newFolder);

    addRequest.onerror = () => reject('Error creating new folder');
    addRequest.onsuccess = () => resolve(newFolder);
  });
};

export const deleteLayer = async (id) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject('Error deleting layer');
    request.onsuccess = () => resolve();
  });
};

export const deleteFolder = async (folderPath) => {
  const db = await getDB();
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('directory');

    // Get all items in the folder
    const getRequest = index.getAll(IDBKeyRange.only(folderPath));

    getRequest.onerror = () => reject('Error fetching folder contents');

    getRequest.onsuccess = async () => {
      const items = getRequest.result;
      try {
        for (const item of items) {
          if (item.type === 'directory') {
            // Recursively delete subfolders
            await deleteFolder(item.fullPath);
          } else {
            // Delete file
            store.delete(item.id);
          }
        }
        // Delete the folder itself
        const deleteFolderRequest = store.delete(folderPath);
        deleteFolderRequest.onerror = () => reject('Error deleting folder');
        deleteFolderRequest.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    };
  });
};