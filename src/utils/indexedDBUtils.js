// src/utils/indexedDBUtils.js

const CURRENT_CACHE_VERSION = 1;
const DB_VERSION = 1;
let dbInstance = null;

export const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error('IndexedDB not supported');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open('ArcGISTreeMap', DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('Database upgrade needed');
      const db = event.target.result;
      
      // Handle store creation/upgrade
      if (!db.objectStoreNames.contains('treeMaps')) {
        console.log('Creating treeMaps store');
        const store = db.createObjectStore('treeMaps', { keyPath: 'url' });
        store.createIndex('version', 'version', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('Database initialized successfully');
      resolve(dbInstance);
    };
  });
};

export const getDB = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  return initIndexedDB();
};

export const saveTreeMap = async (url, treeData, expandedNodes) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        reject(new Error('Database not properly initialized'));
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      
      const dataToStore = {
        url: url,
        treeData: treeData,
        expandedNodes: Array.from(expandedNodes),
        timestamp: Date.now(),
        version: CURRENT_CACHE_VERSION
      };

      console.log('Saving tree map data:', {
        url,
        dataSize: Object.keys(treeData).length,
        expandedNodesSize: expandedNodes.size
      });

      const request = store.put(dataToStore);
      
      request.onerror = (event) => {
        console.error('Error saving data:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        console.log('Successfully saved tree map data');
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error in saveTreeMap:', error);
    throw error;
  }
};

export const loadTreeMap = async (url) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        reject(new Error('Database not properly initialized'));
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(url);
      
      request.onerror = () => {
        console.error('Error loading tree map:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.version === CURRENT_CACHE_VERSION) {
          resolve({
            treeData: result.treeData,
            expandedNodes: new Set(result.expandedNodes),
            timestamp: result.timestamp,
            version: result.version
          });
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('Error in loadTreeMap:', error);
    throw error;
  }
};

export const checkTreeMapExists = async (url) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        resolve(false);
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(url);
      
      request.onerror = () => {
        console.error('Error checking tree map:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        const result = request.result;
        const exists = Boolean(result && result.version === CURRENT_CACHE_VERSION);
        console.log(`Cache check for ${url}: ${exists ? 'Found' : 'Not found'}`);
        resolve(exists);
      };
    });
  } catch (error) {
    console.error('Error in checkTreeMapExists:', error);
    return false;
  }
};

export const clearOutdatedCache = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        resolve(true);
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (!entry.version || entry.version !== CURRENT_CACHE_VERSION) {
            store.delete(cursor.key);
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log('Finished clearing outdated cache entries');
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error in clearOutdatedCache:', error);
    return false;
  }
};

export const getCacheStats = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        resolve({ totalEntries: 0, currentVersion: CURRENT_CACHE_VERSION });
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve({
          totalEntries: countRequest.result,
          currentVersion: CURRENT_CACHE_VERSION
        });
      };
    });
  } catch (error) {
    console.error('Error in getCacheStats:', error);
    return { totalEntries: 0, currentVersion: CURRENT_CACHE_VERSION };
  }
};

export const clearAllCache = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        resolve(true);
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('Successfully cleared all tree map data');
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error clearing tree map data:', error);
    return false;
  }
};