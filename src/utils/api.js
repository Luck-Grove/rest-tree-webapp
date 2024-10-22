import axios from 'axios';
import { addTreeNode, getNextId } from './treeUtils';
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

    enqueue(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    },

    process() {
        if (!this.interval) {
            this.interval = setInterval(() => {
                const item = this.queue.shift();
                if (item) {
                    item.fn().then(item.resolve).catch(item.reject);
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
export const fetchWithCache = async (url, params = {}, useCache = true) => {
    const cacheKey = `${url}${JSON.stringify(params)}`;
    if (useCache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const fetchData = async () => {
        const response = await api.get(url, { params });
        if (useCache) {
            cache.set(cacheKey, response.data);
        }
        return response.data;
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
    processedUrls,
    treeData
  ) => {
    if (signal.aborted) {
      throw new Error('Operation was cancelled');
    }
  
    // Ensure processedUrls is a Set
    let urlSet = processedUrls instanceof Set ? processedUrls : new Set(processedUrls);
  
    // Check if the URL has already been processed
    if (urlSet.has(url)) {
      return;
    }
  
    // Add the URL to the processed set
    urlSet.add(url);

    // Truncate URL for display
    const truncateUrl = (url) => {
        const baseUrlPattern = /\/services\/?/;
        const match = url.match(baseUrlPattern);
        if (match) {
          const truncatedPart = url.split(baseUrlPattern)[1];
          if (truncatedPart && truncatedPart.trim().length > 0) {
            return truncatedPart; 
          }
        }
        return url;
      };
      
    // Output console message only for new content
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
          await processService(
            parent,
            service,
            url,
            signal,
            setTreeData,
            addConsoleMessage,
            skipProperties,
            urlSet,
            treeData
          );
        }
      }
  
      // Process layers
      if (data.layers) {
        const serviceId = parent;
        for (const layer of data.layers) {
          if (signal.aborted) throw new Error('Operation was cancelled');
  
          // Check if the layer already exists in treeData
          const existingLayer = Object.values(treeData).find(
            (node) => node.url === `${url}/${layer.id}`
          );
          if (existingLayer) {
            continue;
          }
  
          const layerId = getNextId();
          const layerName = `${layer.name} (ID: ${layer.id})`;
          const layerUrl = `${url}/${layer.id}`;
  
          setTreeData((prevData) => {
            return addTreeNode(serviceId, layerName, 'layer', layerUrl, layerId, prevData);
          });
  
          // Update treeData with the new data for recursive calls
          treeData = {
            ...treeData,
            [layerId]: {
              text: layerName,
              parent: serviceId,
              type: 'layer',
              url: layerUrl,
              hasChildren: false,
            },
          };
        }
        setTreeData((prevData) => ({
          ...prevData,
          [parent]: { ...prevData[parent], hasChildren: true },
        }));
  
        // Update treeData with the updated parent
        treeData = {
          ...treeData,
          [parent]: { ...treeData[parent], hasChildren: true },
        };
      }
  
      // Process folders
      if (data.folders) {
        for (const folder of data.folders) {
          if (signal.aborted) throw new Error('Operation was cancelled');
  
          const folderUrl = new URL(folder, url).href;
          const existingFolder = Object.values(treeData).find((node) => node.url === folderUrl);
          if (existingFolder) {
            continue;
          }
  
          const folderId = getNextId();
  
          setTreeData((prevData) => addTreeNode(parent, folder, 'folder', folderUrl, folderId, prevData));
  
          // Update treeData with the new folder for recursive calls
          treeData = {
            ...treeData,
            [folderId]: {
              text: folder,
              parent: parent,
              type: 'folder',
              url: folderUrl,
              hasChildren: false,
            },
          };
  
          await fetchAndDisplayServices(
            folderUrl,
            folderId,
            signal,
            setTreeData,
            addConsoleMessage,
            skipProperties,
            urlSet,
            treeData
          );
        }
      }
  
      // Process properties
      if (!skipProperties) {
        for (const [key, value] of Object.entries(data)) {
          if (['string', 'number', 'boolean'].includes(typeof value)) {
            const propText = `${key}: ${value}`;
            const existingProp = Object.values(treeData).find(
              (node) => node.text === propText && node.parent === parent
            );
            if (existingProp) {
              continue;
            }
  
            const propId = getNextId();
  
            setTreeData((prevData) => addTreeNode(parent, propText, 'property', 'N/A', propId, prevData));
  
            // Update treeData with the new property
            treeData = {
              ...treeData,
              [propId]: {
                text: propText,
                parent: parent,
                type: 'property',
                url: 'N/A',
                hasChildren: false,
              },
            };
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Operation was cancelled') {
        throw new Error('Operation was cancelled');
      }
      writeToConsole(`Error fetching services: ${error.message}`, addConsoleMessage);
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
