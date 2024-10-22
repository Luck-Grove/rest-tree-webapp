// src/utils/indexedDBUtils.js

const CURRENT_CACHE_VERSION = 1;

export const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ArcGISTreeMap', 1);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('treeMaps')) {
        const store = db.createObjectStore('treeMaps', { keyPath: 'url' });
        // Add an index for the version
        store.createIndex('version', 'version', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
};

export const saveTreeMap = async (url, treeData, expandedNodes) => {
  if (!treeData || Object.keys(treeData).length === 0) {
    console.error('Attempted to save empty tree data');
    return false;
  }

  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      
      // First try to get existing data
      const getRequest = store.get(url);
      
      getRequest.onsuccess = () => {
        const existingData = getRequest.result;
        let dataToStore = {
          url: url,
          treeData: treeData,
          expandedNodes: Array.from(expandedNodes),
          timestamp: Date.now(),
          version: CURRENT_CACHE_VERSION
        };

        // If we have existing data and new data is partial, merge them
        if (existingData && Object.keys(treeData).length < Object.keys(existingData.treeData).length) {
          dataToStore = {
            ...dataToStore,
            treeData: {
              ...existingData.treeData,
              ...treeData
            },
            expandedNodes: Array.from(new Set([
              ...existingData.expandedNodes,
              ...Array.from(expandedNodes)
            ]))
          };
        }

        console.log('Saving tree map data:', {
          url,
          dataSize: Object.keys(dataToStore.treeData).length,
          expandedNodesSize: dataToStore.expandedNodes.length
        });

        const putRequest = store.put(dataToStore);
        
        putRequest.onerror = (event) => {
          console.error('Error saving data:', event.target.error);
          reject(event.target.error);
        };
      };

      getRequest.onerror = (event) => {
        console.error('Error checking existing data:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        console.log('Successfully saved tree map data');
        resolve(true);
      };

      transaction.onerror = (event) => {
        console.error('Transaction error:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error in saveTreeMap:', error);
    return false;
  }
};

export const loadTreeMap = async (url) => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(url);
      
      request.onerror = () => {
        console.error('Error loading tree map:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Check version
          if (!result.version || result.version !== CURRENT_CACHE_VERSION) {
            console.log(`Outdated cache version (${result.version || 'none'}) detected. Current version: ${CURRENT_CACHE_VERSION}`);
            // Delete the outdated entry
            const deleteTransaction = db.transaction(['treeMaps'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('treeMaps');
            deleteStore.delete(url);
            resolve(null);
            return;
          }

          console.log('Loaded tree map data:', result);
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
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(url);
      
      request.onerror = () => {
        console.error('Error checking tree map:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        // Safely check if result exists and has the correct version
        const result = request.result;
        const exists = Boolean(result && result.version === CURRENT_CACHE_VERSION);
        console.log(`Cache check for ${url}: ${exists ? 'Found' : 'Not found'}`);
        resolve(exists);
      };
    });
  } catch (error) {
    console.error('Error in checkTreeMapExists:', error);
    // Return false instead of throwing on error
    return false;
  }
};

export const clearOutdatedCache = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      const index = store.index('version');
      
      // Get all entries
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (!entry.version || entry.version !== CURRENT_CACHE_VERSION) {
            // Delete outdated entry
            store.delete(cursor.key);
            console.log(`Deleted outdated cache entry for URL: ${entry.url}`);
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log('Finished clearing outdated cache entries');
        resolve(true);
      };

      transaction.onerror = (event) => {
        console.error('Error clearing outdated cache:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error in clearOutdatedCache:', error);
    throw error;
  }
};

// Utility function to clear all data (useful for debugging)
export const clearAllCache = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('Successfully cleared all tree map data');
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error clearing tree map data:', error);
    throw error;
  }
};

// Utility function to get cache statistics
export const getCacheStats = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve({
          totalEntries: countRequest.result,
          currentVersion: CURRENT_CACHE_VERSION
        });
      };
      
      countRequest.onerror = (event) => {
        console.error('Error getting cache stats:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error in getCacheStats:', error);
    throw error;
  }
};