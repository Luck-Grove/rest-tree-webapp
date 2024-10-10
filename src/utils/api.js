import axios from 'axios';
import { addTreeNode, getNextId } from './treeUtils';
import React from 'react';

export const fetchAndDisplayServices = async (url, parent, signal, setTreeData, addConsoleMessage, skipProperties) => {
    if (signal.aborted) {
        throw new Error('Operation was cancelled');
    }
    
    addConsoleMessage(<React.Fragment>Processing content for <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{url}</a></React.Fragment>);
    try {
        const response = await axios.get(url, { 
            params: { f: 'json' },
            signal: signal
        });
        const data = response.data;

        if (data.services) {
            for (const service of data.services) {
                if (signal.aborted) throw new Error('Operation was cancelled');
                await processService(parent, service, url, signal, setTreeData, addConsoleMessage, skipProperties);
            }
        }

        if (data.layers) {
            const serviceId = parent;
            for (const layer of data.layers) {
                if (signal.aborted) throw new Error('Operation was cancelled');
                const layerId = getNextId();
                const layerText = `${layer.name} (ID: ${layer.id})`;
                const layerUrl = `${url}/${layer.id}`;
                setTreeData(prevData => addTreeNode(serviceId, layerText, 'layer', layerUrl, layerId, prevData));
            }
            setTreeData(prevData => ({
                ...prevData,
                [parent]: { ...prevData[parent], hasChildren: true }
            }));
        }

        if (data.folders) {
            for (const folder of data.folders) {
                if (signal.aborted) throw new Error('Operation was cancelled');
                const folderId = getNextId();
                const folderUrl = new URL(folder, url).href;
                setTreeData(prevData => addTreeNode(parent, folder, 'folder', folderUrl, folderId, prevData));
                await fetchAndDisplayServices(folderUrl, folderId, signal, setTreeData, addConsoleMessage, skipProperties);
            }
        }

        if (!skipProperties) {
            for (const [key, value] of Object.entries(data)) {
                if (['string', 'number', 'boolean'].includes(typeof value)) {
                    const propId = getNextId();
                    const propText = `${key}: ${value}`;
                    setTreeData(prevData => addTreeNode(parent, propText, 'property', 'N/A', propId, prevData));
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError' || error.message === 'Operation was cancelled') {
            throw new Error('Operation was cancelled');
        }
        addConsoleMessage(`Error fetching services: ${error.message}`);
        throw error;
    }
};

export const processService = async (parent, service, baseUrl, signal, setTreeData, addConsoleMessage, skipProperties) => {
    if (signal.aborted) {
        throw new Error('Operation was cancelled');
    }

    const serviceUrl = new URL(`${service.name}/${service.type}`, baseUrl).href;
    const serviceText = `${service.name} (${service.type})`;
    const serviceId = getNextId();
    setTreeData(prevData => addTreeNode(parent, serviceText, service.type, serviceUrl, serviceId, prevData));
    
    if (service.type === 'MapServer' || service.type === 'FeatureServer') {
        await fetchAndDisplayServices(serviceUrl, serviceId, signal, setTreeData, addConsoleMessage, skipProperties);
    }
};

// New function to write to the console
export const writeToConsole = (message, addConsoleMessage) => {
    if (typeof addConsoleMessage === 'function') {
        addConsoleMessage(message);
    } else {
        console.warn('Console writing function not provided');
    }
};
