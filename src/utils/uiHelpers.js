import React from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const renderTree = (treeData, nodeId, level = 0, expandedNodes, toggleNode, selectedLayers, setSelectedLayers, setContextMenu, darkMode, zoomToLayerExtent, map) => {
    const node = treeData[nodeId];
    if (!node) return null;

    const childNodes = Object.entries(treeData)
        .filter(([_, data]) => data.parent === nodeId)
        .map(([childId, _]) => renderTree(treeData, childId, level + 1, expandedNodes, toggleNode, selectedLayers, setSelectedLayers, setContextMenu, darkMode, zoomToLayerExtent, map))
        .filter(Boolean);

    const isExpanded = expandedNodes.has(nodeId);

    const getIcon = (type) => {
        switch (type) {
            case 'folder':
                return <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
            case 'layer':
                return <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
            case 'MapServer':
            case 'FeatureServer':
                return <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
            default:
                return <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
        }
    };

    const hasChildren = childNodes.length > 0 || node.hasChildren;
    const isLayer = node.type === 'layer';

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        if (isLayer) {
            setSelectedLayers(prev => {
                const newSet = new Set(prev);
                if (isChecked) {
                    newSet.add(nodeId);
                } else {
                    newSet.delete(nodeId);
                }
                return newSet;
            });
        } else {
            // If it's a folder, toggle all descendant layers
            const toggleDescendantLayers = (id, shouldAdd) => {
                const node = treeData[id];
                if (node.type === 'layer') {
                    setSelectedLayers(prev => {
                        const newSet = new Set(prev);
                        if (shouldAdd) {
                            newSet.add(id);
                        } else {
                            newSet.delete(id);
                        }
                        return newSet;
                    });
                }
                Object.entries(treeData)
                    .filter(([_, data]) => data.parent === id)
                    .forEach(([childId, _]) => toggleDescendantLayers(childId, shouldAdd));
            };
            toggleDescendantLayers(nodeId, isChecked);
        }
    };

    return (
        <div 
            key={nodeId} 
            className={`ml-${level * 4} ${level === 0 ? 'mt-2' : ''} fade-in`}
            onContextMenu={(e) => handleContextMenu(e, nodeId, setContextMenu)} // Pass setContextMenu here
        >
            <div className="flex items-center justify-between p-1 rounded-md tree-node">
                <div className="flex items-center">
                    {isLayer && (
                        <input
                            type="checkbox"
                            checked={selectedLayers.has(nodeId)}
                            onChange={handleCheckboxChange}
                            className="mr-2"
                        />
                    )}
                    {hasChildren && (
                        <button onClick={() => toggleNode(nodeId)} className="mr-2 text-xs">
                            {isExpanded ? '▼' : '▶'}
                        </button>
                    )}
                    <span className="mr-2">
                        {getIcon(node.type)}
                    </span>
                    <span className="font-medium text-sm">{node.text}</span>
                    <span className="ml-2 text-xs text-gray-500">({node.type})</span>
                </div>
                {node.type === 'layer' && (
                    <div className="flex items-center">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadShapefile(nodeId);
                            }}
                            className={`flex flex-col items-center p-1 ${darkMode ? 'text-gray-200 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
                            title="Download Shapefile"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 7h-2V3H9v4H7l3 3 3-3z"></path>
                                <path d="M5 13h10v2H5v-2z"></path>
                            </svg>
                            <span className="text-xs">SHP</span>
                        </button>
                    </div>
                )}
            </div>
            {isExpanded && childNodes}
        </div>
    );
};


export const expandAll = (setExpandedNodes, treeData) => {
    setExpandedNodes(new Set(Object.keys(treeData)));
};

export const collapseAll = (setExpandedNodes) => {
    setExpandedNodes(new Set());
};

export const handleContextMenu = (e, nodeId, setContextMenu) => {
    e.preventDefault();
    console.log('Context menu triggered for node:', nodeId);
    setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        nodeId: nodeId,
    });
};

export const handleDownloadLayer = async (nodeId, treeData, boundingBox, setIsDownloading, setStatusMessage) => {
    const node = treeData[nodeId];
    if (!node) return;

    setIsDownloading(true);
    setStatusMessage('Initializing download...');

    try {
        const response = await axios.get(`${node.url}?f=json`);
        const layerInfo = response.data;

        if (layerInfo.capabilities && layerInfo.capabilities.includes('Query')) {
            let allFeatures = [];
            let offset = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                let downloadUrl = `${node.url}/query?where=1%3D1&outFields=*&f=geojson&resultOffset=${offset}&resultRecordCount=${limit}`;
                
                if (boundingBox) {
                    const bounds = boundingBox.getBounds();
                    const bboxString = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
                    downloadUrl += `&geometry=${encodeURIComponent(bboxString)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326`;
                }

                const geojsonResponse = await fetch(downloadUrl);
                const geojsonData = await geojsonResponse.json();
                
                if (geojsonData.features && geojsonData.features.length > 0) {
                    allFeatures = allFeatures.concat(geojsonData.features);
                    offset += geojsonData.features.length;
                    hasMore = geojsonData.features.length === limit;
                } else {
                    hasMore = false;
                }

                setStatusMessage(`Downloaded ${allFeatures.length} features...`);
            }

            if (allFeatures.length === 0) {
                setStatusMessage('No features found within the bounding box.');
                return;
            }

            const completeGeojson = {
                type: "FeatureCollection",
                features: allFeatures
            };

            const blob = new Blob([JSON.stringify(completeGeojson)], { type: 'application/json' });
            saveAs(blob, `${node.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.geojson`);

            setStatusMessage(`Download completed for ${node.text}. ${allFeatures.length} features downloaded.`);
        } else {
            setStatusMessage('This layer does not support direct downloads.');
        }
    } catch (error) {
        console.error('Error fetching layer info:', error);
        setStatusMessage(`Error downloading layer: ${error.message}`);
    } finally {
        setTimeout(() => {
            setIsDownloading(false);
            setStatusMessage('');
        }, 5000);
    }
};

export const handleDownloadShapefile = async (nodeId, treeData, boundingBox, setIsDownloading, setStatusMessage) => {
    const node = treeData[nodeId];
    if (!node) return;

    setIsDownloading(true);
    setStatusMessage('Initializing Shapefile download...');

    try {
        const response = await axios.get(`${node.url}?f=json`);
        const layerInfo = response.data;

        if (layerInfo.capabilities && layerInfo.capabilities.includes('Query')) {
            let allFeatures = [];
            let offset = 0;
            const limit = 1000;
            let hasMore = true;

            while (hasMore) {
                let downloadUrl = `${node.url}/query?where=1%3D1&outFields=*&f=geojson&resultOffset=${offset}&resultRecordCount=${limit}`;
                
                if (boundingBox) {
                    const bounds = boundingBox.getBounds();
                    const bboxString = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
                    downloadUrl += `&geometry=${encodeURIComponent(bboxString)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326`;
                }

                const geojsonResponse = await fetch(downloadUrl);
                const geojsonData = await geojsonResponse.json();
                
                if (geojsonData.features && geojsonData.features.length > 0) {
                    allFeatures = allFeatures.concat(geojsonData.features);
                    offset += geojsonData.features.length;
                    hasMore = geojsonData.features.length === limit;
                } else {
                    hasMore = false;
                }

                setStatusMessage(`Downloaded ${allFeatures.length} features...`);
            }

            if (allFeatures.length === 0) {
                setStatusMessage('No features found within the bounding box.');
                return;
            }

            // Flatten geometries and validate features
            const flattenedFeatures = [];
            for (let feature of allFeatures) {
                if (feature.geometry && feature.geometry.type.startsWith('Multi')) {
                    const simpleType = feature.geometry.type.replace('Multi', '');
                    feature.geometry.coordinates.forEach(coords => {
                        flattenedFeatures.push({
                            type: 'Feature',
                            properties: feature.properties,
                            geometry: {
                                type: simpleType,
                                coordinates: coords
                            }
                        });
                    });
                } else {
                    flattenedFeatures.push(feature);
                }
            }

            setStatusMessage('Grouping features by geometry type...');
            const featuresByType = flattenedFeatures.reduce((acc, feature) => {
                const geomType = feature.geometry.type;
                if (!acc[geomType]) {
                    acc[geomType] = [];
                }
                acc[geomType].push(feature);
                return acc;
            }, {});

            const baseFileName = node.text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const zip = new JSZip();
            const compressionLevel = getCompressionLevel(flattenedFeatures.length);

            for (const [geomType, features] of Object.entries(featuresByType)) {
                setStatusMessage(`Processing ${geomType} features...`);
                
                // Fix field names
                fixFieldNames(features);

                const geojson = { type: "FeatureCollection", features };
                const options = { types: {} };

                // Map geometry type to shpwrite types
                switch (geomType) {
                    case 'Point': options.types.point = 'Point'; break;
                    case 'LineString': options.types.line = 'LineString'; break;
                    case 'Polygon': options.types.polygon = 'Polygon'; break;
                    default:
                        console.warn(`Unsupported geometry type: ${geomType}`);
                        continue;
                }

                // Convert to Shapefile using shpwrite
                try {
                    const content = await window.shpwrite.zip(geojson, options);
                    const binaryString = window.atob(content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const arrayBuffer = bytes.buffer;
                    const geomZip = await JSZip.loadAsync(arrayBuffer);

                    // Add to the main zip
                    for (let fileName in geomZip.files) {
                        const fileContent = await geomZip.files[fileName].async('uint8array');
                        zip.file(`${baseFileName}_${geomType.toLowerCase()}.${fileName.split('.').pop()}`, fileContent, { compression: "DEFLATE", compressionOptions: { level: compressionLevel } });
                    }
                } catch (zipError) {
                    console.error(`Error generating Shapefile for ${geomType}:`, zipError);
                }
            }

            // Final zip generation
            setStatusMessage('Compressing files...');
            const finalZip = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: compressionLevel } });
            saveAs(finalZip, `${baseFileName}.zip`);

            setStatusMessage(`Shapefile download completed. Total features included: ${flattenedFeatures.length}.`);
        } else {
            setStatusMessage('This layer does not support querying features.');
        }
    } catch (error) {
        console.error('Error in shapefile generation:', error);
        setStatusMessage(`Error downloading Shapefile: ${error.message}`);
    } finally {
        setIsDownloading(false);
        setTimeout(() => setStatusMessage(''), 5000);
    }
};

// Helper function to fix field names
const fixFieldNames = (features) => {
    const fieldNameMap = {};
    const usedNames = new Set();

    features.forEach(feature => {
        for (let fieldName in feature.properties) {
            if (!fieldNameMap[fieldName]) {
                let truncated = fieldName.substring(0, 10);
                let uniqueName = truncated;
                let counter = 1;
                while (usedNames.has(uniqueName.toUpperCase())) {
                    let suffix = '' + counter;
                    uniqueName = truncated.substring(0, 10 - suffix.length) + suffix;
                    counter++;
                }
                usedNames.add(uniqueName.toUpperCase());
                fieldNameMap[fieldName] = uniqueName;
            }
        }
    });

    features.forEach(feature => {
        const newProperties = {};
        for (let fieldName in feature.properties) {
            let newFieldName = fieldNameMap[fieldName];
            newProperties[newFieldName] = feature.properties[fieldName];
        }
        feature.properties = newProperties;
    });
};


// Compression level function
const getCompressionLevel = (featureCount) => {
    if (featureCount > 50000) {
        return 1;
    } else if (featureCount > 20000) {
        return 1;
    } else if (featureCount > 10000) {
        return 2;
    } else if (featureCount > 5000) {
        return 3;
    } else if (featureCount > 2500) {
        return 4;
    } else if (featureCount > 1000) {
        return 4;
    } else if (featureCount > 500) {
        return 5;
    } else if (featureCount > 100) {
        return 5;
    } else {
        return 6;
    }
};

export const handleKeyDown = (e, showPresetDropdown, showSuggestions, setHighlightedIndex, setShowPresetDropdown, filteredPresets, highlightedIndex, setSelectedSuggestionIndex, selectedSuggestionIndex, suggestions, handlePresetSelect, handleSuggestionClick, setShowSuggestions) => {
    if (showPresetDropdown) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prevIndex => 
                    prevIndex < filteredPresets.length - 1 ? prevIndex + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prevIndex => 
                    prevIndex > 0 ? prevIndex - 1 : filteredPresets.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex !== -1) {
                    handlePresetSelect(filteredPresets[highlightedIndex]);
                }
                break;
            case 'Escape':
                setShowPresetDropdown(false);
                setHighlightedIndex(-1);
                break;
            default:
                break;
        }
    } else if (showSuggestions) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prevIndex =>
                    prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prevIndex =>
                    prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                if (selectedSuggestionIndex !== -1) {
                    e.preventDefault();
                    handleSuggestionClick(suggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedSuggestionIndex(-1);
                break;
            default:
                break;
        }
    }
};


export const handleBasemapChange = (e, map, darkMode, setBasemap, updateBasemap) => {
    const selectedBasemap = e.target.value;
    setBasemap(selectedBasemap);
    updateBasemap(map, selectedBasemap, darkMode);
    
    // Save basemap choice in a cookie
    document.cookie = `basemap=${encodeURIComponent(selectedBasemap)}; path=/; max-age=31536000`; // 1 year
};

export const handlePresetInputChange = (e, setSelectedPreset, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex) => {
    const input = e.target.value;
    setSelectedPreset(input);
    
    if (input.length > 0) {
        const words = input.split(/\s+/);
        const expandedWords = words.map(word => {
            if (word.length === 2 && word === word.toUpperCase() && stateAbbreviations[word]) {
                return stateAbbreviations[word];
            }
            return word;
        });
        const expandedInput = expandedWords.join(' ');
        const normalizedInput = normalizeString(expandedInput);
        
        const filtered = presets.filter(preset => 
            normalizeString(preset.name).includes(normalizedInput) ||
            normalizeString(preset.url).includes(normalizedInput)
        );
        setFilteredPresets(filtered);
    } else {
        setFilteredPresets(presets);
    }
    setShowPresetDropdown(true);
    setHighlightedIndex(-1);
};

export const handlePresetSelect = (preset, setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex) => {
    setSelectedPreset(preset.name);
    setUrl(preset.url);
    setShowPresetDropdown(false);
    setHighlightedIndex(-1);
};

export const handlePresetInputFocus = (setFilteredPresets, presets, setShowPresetDropdown, setHighlightedIndex) => {
    setFilteredPresets(presets);
    setShowPresetDropdown(true);
    setHighlightedIndex(-1);
};

const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const stateAbbreviations = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};
