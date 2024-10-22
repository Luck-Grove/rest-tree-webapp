const CURRENT_CACHE_VERSION = 3; // Increment version
const DB_VERSION = 2;
let dbInstance = null;
let initializationPromise = null;

// Add URL normalization
const normalizeUrl = (url) => {
  try {
    // Remove trailing slashes and normalize to lowercase
    return url.replace(/\/+$/, '').toLowerCase();
  } catch (e) {
    console.error('URL normalization error:', e);
    return url;
  }
};

export const initIndexedDB = () => {
  // Ensure we only initialize once
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error('IndexedDB not supported');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open('ArcGISTreeMap', DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      initializationPromise = null; // Reset on error
      reject(event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('Database upgrade needed');
      const db = event.target.result;
      
      // Delete and recreate store on version change
      if (db.objectStoreNames.contains('treeMaps')) {
        db.deleteObjectStore('treeMaps');
      }
      
      const store = db.createObjectStore('treeMaps', { keyPath: 'url' });
      store.createIndex('version', 'version', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('Database initialized successfully');
      resolve(dbInstance);
    };
  });

  return initializationPromise;
};

export const getDB = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  return initIndexedDB();
};

export const saveTreeMap = async (url, treeData, expandedNodes, currentGeneration = true) => {
  try {
    const db = await getDB();
    const normalizedUrl = url.replace(/\/+$/, '').toLowerCase();
    
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        reject(new Error('Database not properly initialized'));
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readwrite');
      const store = transaction.objectStore('treeMaps');
      
      const dataToStore = {
        url: normalizedUrl,
        treeData: treeData,
        expandedNodes: Array.from(expandedNodes),
        timestamp: Date.now(),
        version: CURRENT_CACHE_VERSION,
        generation: currentGeneration ? 'current' : 'previous'
      };

      console.log('Saving tree map data:', {
        url: normalizedUrl,
        dataSize: Object.keys(treeData).length,
        expandedNodesSize: expandedNodes.size,
        generation: dataToStore.generation,
        timestamp: dataToStore.timestamp
      });

      // First, check if we need to update the previous generation
      const getExistingRequest = store.get(normalizedUrl);
      
      getExistingRequest.onsuccess = () => {
        const existingData = getExistingRequest.result;
        
        // If saving current generation and there's existing data, save it as previous
        if (currentGeneration && existingData) {
          const previousData = {
            ...existingData,
            generation: 'previous',
            timestamp: Date.now() - 1 // Ensure proper ordering
          };
          store.put(previousData);
        }
        
        // Save the new data
        const saveRequest = store.put(dataToStore);
        
        saveRequest.onerror = (event) => {
          console.error('Error saving data:', event.target.error);
          reject(event.target.error);
        };
      };

      transaction.oncomplete = () => {
        console.log(`Successfully saved tree map data (${dataToStore.generation} generation)`);
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Error in saveTreeMap:', error);
    throw error;
  }
};

export const loadTreeMap = async (url, preferredGeneration = 'current') => {
  try {
    const db = await getDB();
    const normalizedUrl = url.replace(/\/+$/, '').toLowerCase();

    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        reject(new Error('Database not properly initialized'));
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(normalizedUrl);
      
      request.onerror = () => {
        console.error('Error loading tree map:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.version === CURRENT_CACHE_VERSION) {
          if (result.generation === preferredGeneration || !result.generation) {
            console.log(`Successfully loaded ${preferredGeneration} generation cache for ${normalizedUrl}`);
            resolve({
              treeData: result.treeData,
              expandedNodes: new Set(result.expandedNodes),
              timestamp: result.timestamp,
              version: result.version,
              generation: result.generation || 'current'
            });
          } else {
            console.log(`No ${preferredGeneration} generation cache found for ${normalizedUrl}`);
            resolve(null);
          }
        } else {
          console.log(`No valid cache found for ${normalizedUrl}`);
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
    const normalizedUrl = normalizeUrl(url);

    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('treeMaps')) {
        resolve(false);
        return;
      }

      const transaction = db.transaction(['treeMaps'], 'readonly');
      const store = transaction.objectStore('treeMaps');
      const request = store.get(normalizedUrl);
      
      request.onerror = () => {
        console.error('Error checking tree map:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        const result = request.result;
        const exists = Boolean(result && result.version === CURRENT_CACHE_VERSION);
        console.log(`Cache check for ${normalizedUrl}: ${exists ? 'Found' : 'Not found'}`);
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