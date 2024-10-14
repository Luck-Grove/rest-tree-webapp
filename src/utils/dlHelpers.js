import axios from 'axios';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { lastBoundingBoxCoordinates } from '../commands/bbox';

const fetchFeatures = async (node, setStatusMessage) => {
    let allFeatures = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        let downloadUrl = `${node.url}/query?where=1%3D1&outFields=*&f=geojson&resultOffset=${offset}&resultRecordCount=${limit}`;
        
        console.log('lastBoundingBoxCoordinates:', lastBoundingBoxCoordinates);

        if (lastBoundingBoxCoordinates) {
            const { west, south, east, north } = lastBoundingBoxCoordinates;
            const bboxString = `${west},${south},${east},${north}`;
            console.log('Using bounding box:', bboxString);
            downloadUrl += `&geometry=${encodeURIComponent(bboxString)}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326`;
        } else {
            console.log('No bounding box applied.');
        }

        console.log('Final downloadUrl:', downloadUrl);

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

    return allFeatures;
};

export const handleDownloadLayer = async (nodeId, treeData, setIsDownloading, setStatusMessage) => {
    const node = treeData[nodeId];
    if (!node) return;

    setIsDownloading(true);
    setStatusMessage('Initializing download...');

    try {
        const response = await axios.get(`${node.url}?f=json`);
        const layerInfo = response.data;

        if (layerInfo.capabilities && layerInfo.capabilities.includes('Query')) {
            const allFeatures = await fetchFeatures(node, setStatusMessage);

            if (allFeatures.length === 0) {
                setStatusMessage('No features found within the specified area.');
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
        setIsDownloading(false);
    }
};

export const handleDownloadShapefile = async (nodeId, treeData, setIsDownloading, setStatusMessage) => {
    const node = treeData[nodeId];
    if (!node) return;

    setIsDownloading(true);
    setStatusMessage('Initializing Shapefile download...');

    try {
        const response = await axios.get(`${node.url}?f=json`);
        const layerInfo = response.data;

        if (layerInfo.capabilities && layerInfo.capabilities.includes('Query')) {
            const allFeatures = await fetchFeatures(node, setStatusMessage);

            if (allFeatures.length === 0) {
                setStatusMessage('No features found within the specified area.');
                return;
            }

            console.log(`Total features fetched: ${allFeatures.length}`);

            // Flatten geometries and validate features
            const flattenedFeatures = [];
            let invalidFeatureCount = 0;

            for (let i = 0; i < allFeatures.length; i++) {
                const feature = allFeatures[i];
                
                if (!feature.geometry || !feature.geometry.type) {
                    invalidFeatureCount++;
                    continue;
                }

                if (feature.geometry.type.startsWith('Multi')) {
                    const simpleType = feature.geometry.type.replace('Multi', '');
                    feature.geometry.coordinates.forEach((coords) => {
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

            console.log(`Total flattened features: ${flattenedFeatures.length}`);
            if (invalidFeatureCount > 0) {
                console.warn(`Skipped ${invalidFeatureCount} invalid features`);
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

            console.log('Features grouped by type:', Object.keys(featuresByType).map(type => `${type}: ${featuresByType[type].length}`));

            const baseFileName = node.text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const zip = new JSZip();
            const compressionLevel = getCompressionLevel(flattenedFeatures.length);

            for (const [geomType, features] of Object.entries(featuresByType)) {
                setStatusMessage(`Processing ${geomType} features...`);
                
                // Fix field names
                fixFieldNames(features);

                // Validate and filter features
                const validFeatures = features.filter((feature) => {
                    return feature.geometry && 
                           feature.geometry.coordinates && 
                           feature.geometry.coordinates.length > 0 && 
                           (geomType !== 'Polygon' || (Array.isArray(feature.geometry.coordinates[0]) && feature.geometry.coordinates[0].length >= 3));
                });

                if (validFeatures.length < features.length) {
                    console.warn(`Skipped ${features.length - validFeatures.length} invalid ${geomType} features`);
                }

                const geojson = { type: "FeatureCollection", features: validFeatures };
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
                    setStatusMessage(`Error generating Shapefile for ${geomType}: ${zipError.message}`);
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
