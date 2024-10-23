import axios from 'axios';
import { addTreeNode, getNextId } from './treeUtils';
import { loadTreeMap, saveTreeMap } from './indexedDBUtils';
import React from 'react';

// Create an axios instance with default config
const api = axios.create({
    timeout: 10000, // 10 seconds timeout
});

// Simple in-memory cache
const cache = new Map();

// Rate limiting
const rateLimiter = {
  queue: [],
  maxRequestsPerSecond: 10,
  interval: null,

  enqueue(fn, signal) {  // Add signal parameter
      return new Promise((resolve, reject) => {
          // Check if already aborted
          if (signal?.aborted) {
              reject(new Error('Operation was cancelled'));
              return;
          }

          const queueItem = { fn, resolve, reject, signal };
          this.queue.push(queueItem);
          
          // Add abort handler
          if (signal) {
              signal.addEventListener('abort', () => {
                  // Remove item from queue if it hasn't been processed
                  const index = this.queue.indexOf(queueItem);
                  if (index > -1) {
                      this.queue.splice(index, 1);
                      reject(new Error('Operation was cancelled'));
                  }
              });
          }

          this.process();
      });
    },

    process() {
        if (!this.interval) {
            this.interval = setInterval(() => {
                const item = this.queue.shift();
                if (item) {
                    // Check if aborted before processing
                    if (item.signal?.aborted) {
                        item.reject(new Error('Operation was cancelled'));
                        return;
                    }
                    
                    item.fn()
                        .then(item.resolve)
                        .catch(item.reject);
                }
                if (this.queue.length === 0) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
            }, 1000 / this.maxRequestsPerSecond);
        }
    }
};

// Generic fetch function with caching and rate limiting
export const fetchWithCache = async (url, params = {}, useCache = true, signal = null) => {
  const cacheKey = `${url}${JSON.stringify(params)}`;
  if (useCache && cache.has(cacheKey)) {
      return cache.get(cacheKey);
  }

  const fetchData = async () => {
      if (signal?.aborted) {
          throw new Error('Operation was cancelled');
      }

      try {
          const response = await api.get(url, { 
              params,
              signal
          });
          
          if (useCache) {
              cache.set(cacheKey, response.data);
          }
          return response.data;
      } catch (error) {
          if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
              // Convert timeout to a custom error type
              throw new Error('TIMEOUT');
          }
          throw error;
      }
  };

  return rateLimiter.enqueue(fetchData);
};

export const fetchAndDisplayServices = async (
  url,
  parent,
  signal,
  setTreeData,
  addConsoleMessage,
  skipProperties,
  assignColorToLayer,
  selectedLayers,
  processedUrls,
  treeData
) => {
  if (signal.aborted) {
      throw new Error('Operation was cancelled');
  }

  let urlSet = processedUrls instanceof Set ? processedUrls : new Set(processedUrls || []);
  let newTreeData = { ...treeData };
  
  if (urlSet.has(url)) {
      return newTreeData;
  }
  
  urlSet.add(url);

  const truncateUrl = (url) => {
      const match = url.match(/.*\/services\/(.*)/);
      return match && match[1] ? match[1] : url;
  };

  const truncatedUrl = truncateUrl(url);
  writeToConsole(
      <React.Fragment>
          Processing:{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              {truncatedUrl}
          </a>
      </React.Fragment>,
      addConsoleMessage
  );

  try {
      const data = await fetchWithCache(url, { f: 'json' });

    // Process services
    if (data.services) {
      for (const service of data.services) {
          if (signal.aborted) throw new Error('Operation was cancelled');
          
          try {
              const serviceResult = await processService(
                  parent,
                  service,
                  url,
                  signal,
                  (updatedData) => {
                      newTreeData = { ...newTreeData, ...updatedData };
                      setTreeData(newTreeData);
                  },
                  addConsoleMessage,
                  skipProperties,
                  assignColorToLayer,
                  selectedLayers,
                  urlSet,
                  newTreeData
              );
              
              if (serviceResult) {
                  newTreeData = { ...newTreeData, ...serviceResult };
                  setTreeData(newTreeData);
              }
          } catch (error) {
              if (error.message === 'TIMEOUT') {
                  writeToConsole(
                      `Timeout processing service ${service.name} - skipping and continuing...`,
                      addConsoleMessage
                  );
                  continue;
              }
              if (error.message === 'Operation was cancelled') {
                  throw error;
              }
              // Log other errors but continue processing
              writeToConsole(
                  `Error processing service ${service.name}: ${error.message} - continuing with next service`,
                  addConsoleMessage
              );
          }
      }
  }

    // Process layers
        if (data.layers) {
          for (const layer of data.layers) {
              if (signal.aborted) throw new Error('Operation was cancelled');

              try {
                  const existingLayer = Object.values(newTreeData).find(
                      node => node.url === `${url}/${layer.id}`
                  );
                  
                  if (!existingLayer) {
                      const layerId = getNextId();
                      const layerText = `${layer.name} (ID: ${layer.id})`;
                      const layerUrl = `${url}/${layer.id}`;
                      const layerColor = typeof assignColorToLayer === 'function' ?
                          assignColorToLayer(layerId, selectedLayers) : null;

                      newTreeData = addTreeNode(parent, layerText, 'layer', layerUrl, layerId, newTreeData);
                      if (layerColor) {
                          newTreeData[layerId].color = layerColor;
                      }
                      
                      setTreeData(newTreeData);
                  }
              } catch (error) {
                  if (error.message === 'TIMEOUT') {
                      writeToConsole(
                          `Timeout processing layer ${layer.name} - skipping and continuing...`,
                          addConsoleMessage
                      );
                      continue;
                  }
                  if (error.message === 'Operation was cancelled') {
                      throw error;
                  }
                  writeToConsole(
                      `Error processing layer ${layer.name}: ${error.message} - continuing with next layer`,
                      addConsoleMessage
                  );
              }
          }
      }

    // Process folders with immediate updates
    if (data.folders) {
      for (const folder of data.folders) {
        if (signal.aborted) throw new Error('Operation was cancelled');

        const folderUrl = new URL(folder, url).href;
        const existingFolder = Object.values(newTreeData).find(
          node => node.url === folderUrl
        );

        if (!existingFolder) {
          const folderId = getNextId();
          newTreeData = addTreeNode(parent, folder, 'folder', folderUrl, folderId, newTreeData);
          setTreeData(newTreeData);

          const folderResult = await fetchAndDisplayServices(
            folderUrl,
            folderId,
            signal,
            setTreeData,
            addConsoleMessage,
            skipProperties,
            assignColorToLayer,
            selectedLayers,
            urlSet,
            newTreeData
          );
          
          if (folderResult) {
            newTreeData = { ...folderResult };
            setTreeData(newTreeData);
          }
        }
      }
    }

    // Process properties if needed
    if (!skipProperties) {
      for (const [key, value] of Object.entries(data)) {
        if (signal.aborted) throw new Error('Operation was cancelled');
        
        if (['string', 'number', 'boolean'].includes(typeof value)) {
          const propText = `${key}: ${value}`;
          const existingProp = Object.values(newTreeData).find(
            node => node.text === propText && node.parent === parent
          );

          if (!existingProp) {
            const propId = getNextId();
            newTreeData = addTreeNode(parent, propText, 'property', 'N/A', propId, newTreeData);
            setTreeData(newTreeData);
          }
        }
      }
    }

    return newTreeData;

  } catch (error) {
      if (error.message === 'Operation was cancelled') {
          throw error;
      }
      if (error.message === 'TIMEOUT') {
          writeToConsole(
              `Timeout fetching services from ${truncatedUrl} - skipping and continuing...`,
              addConsoleMessage
          );
          return newTreeData;
      }
      writeToConsole(`Error fetching services: ${error.message}`, addConsoleMessage);
      return newTreeData;
  }
};


export const fetchServicesWithCache = async ({
  url,
  signal,
  setTreeData,
  addConsoleMessage,
  skipProperties,
  assignColorToLayer,
  selectedLayers,
  expandedNodes,  // Add this parameter
  onCacheResult
}) => {
  try {
      // Try to load from cache first
      try {
          const cachedData = await loadTreeMap(url);
          if (cachedData) {
              // Verify cache is still valid
              const rootCheck = await fetchWithCache(url, { f: 'json' });
              const cachedServiceCount = Object.values(cachedData.treeData)
                  .filter(node => !node.parent && 
                          (node.type === 'MapServer' || node.type === 'FeatureServer'))
                  .length;
                  
              if (rootCheck.services?.length === cachedServiceCount) {
                  setTreeData(cachedData.treeData);
                  addConsoleMessage('Loaded verified cache data');
                  onCacheResult?.('loaded');
                  return cachedData.treeData;
              }
              addConsoleMessage('Cache data outdated, refreshing...');
          }
      } catch (error) {
          console.error('Cache check error:', error);
          addConsoleMessage('Cache validation failed, fetching fresh data...');
      }

      // Fetch fresh data
      const result = await fetchAndDisplayServices(
          url,
          '',
          signal,
          setTreeData,
          addConsoleMessage,
          skipProperties,
          assignColorToLayer,
          selectedLayers,
          new Set(),
          {}
      );

      // Save to cache
      try {
          await saveTreeMap(url, result, expandedNodes);
          onCacheResult?.('saved');
          addConsoleMessage('Tree map saved to cache.');
      } catch (error) {
          console.error('Cache save error:', error);
          onCacheResult?.('error');
          addConsoleMessage('Failed to save to cache');
      }

      return result;
  } catch (error) {
      onCacheResult?.('error');
      if (error.name === 'AbortError' || error.message === 'Operation was cancelled') {
          throw new Error('Operation was cancelled');
      }
      console.error('Error in fetchServicesWithCache:', error);
      throw error;
  }
};
  
export const processService = async (
    parent,
    service,
    baseUrl,
    signal,
    setTreeData,
    addConsoleMessage,
    skipProperties,
    assignColorToLayer,
    selectedLayers,
    urlSet,
    treeData
  ) => {
    if (signal.aborted) {
      throw new Error('Operation was cancelled');
    }
  
    const serviceUrl = new URL(`${service.name}/${service.type}`, baseUrl).href;
  
    // Check if service already exists in treeData
    const existingService = Object.values(treeData).find((node) => node.url === serviceUrl);
    if (existingService) {
      return; // Skip processing
    }
  
    const serviceText = `${service.name} (${service.type})`;
    const serviceId = getNextId();
  
    setTreeData((prevData) => addTreeNode(parent, serviceText, service.type, serviceUrl, serviceId, prevData));
  
    // Update treeData with the new service for recursive calls
    treeData = {
      ...treeData,
      [serviceId]: {
        text: serviceText,
        parent: parent,
        type: service.type,
        url: serviceUrl,
        hasChildren: false,
      },
    };
  
    if (service.type === 'MapServer' || service.type === 'FeatureServer') {
      await fetchAndDisplayServices(
        serviceUrl,
        serviceId,
        signal,
        setTreeData,
        addConsoleMessage,
        skipProperties,
        assignColorToLayer,
        selectedLayers,
        urlSet,
        treeData
      );
    }
  };

// Function to write to the console
export const writeToConsole = (message, addConsoleMessage) => {
    if (typeof addConsoleMessage === 'function') {
        addConsoleMessage(message);
    } else {
        console.warn('Console writing function not provided');
    }
};

// Function to clear the cache
export const clearCache = () => {
    cache.clear();
    writeToConsole('Cache cleared', console.log);
};

// Function to set rate limit
export const setRateLimit = (requestsPerSecond) => {
    rateLimiter.maxRequestsPerSecond = requestsPerSecond;
    writeToConsole(`Rate limit set to ${requestsPerSecond} requests per second`, console.log);
};

// Function to fetch metadata for a specific service
export const fetchServiceMetadata = async (serviceUrl) => {
    try {
        const metadata = await fetchWithCache(`${serviceUrl}/info/metadata`, { f: 'json' });
        return metadata;
    } catch (error) {
        writeToConsole(`Error fetching service metadata: ${error.message}`, console.error);
        throw error;
    }
};

// Function to fetch and process feature data
export const fetchFeatureData = async (featureLayerUrl, where = '1=1', outFields = '*', returnGeometry = true) => {
    try {
        const data = await fetchWithCache(`${featureLayerUrl}/query`, {
            where,
            outFields,
            returnGeometry,
            f: 'geojson'
        });
        return data;
    } catch (error) {
        writeToConsole(`Error fetching feature data: ${error.message}`, console.error);
        throw error;
    }
};

// Function to check service status
export const checkServiceStatus = async (serviceUrl) => {
    try {
        const status = await fetchWithCache(`${serviceUrl}/info`, { f: 'json' });
        return status.status === 'success';
    } catch (error) {
        writeToConsole(`Error checking service status: ${error.message}`, console.error);
        return false;
    }
};
