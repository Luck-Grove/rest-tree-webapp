import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import L from 'leaflet';
import * as EsriLeaflet from 'esri-leaflet';
import { kml } from '@tmcw/togeojson';

const useLayerManager = (mapRef) => {
  const [layers, setLayers] = useState([]);

  const assignColorToLayer = useCallback(() => {
    const pastelColors = [
      '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
      '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3',
    ];

    const allColors = [
      ...pastelColors,
      '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
      '#C0C0C0', '#808080', '#800000', '#808000', '#008000', '#800080',
    ];

    const assignedColors = layers.map(layer => layer.color).filter(Boolean);

    for (let color of pastelColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    for (let color of allColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }, [layers]);

  const handleLayerColorChange = useCallback((layerId, newColor) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          const updatedLayer = { ...layer, color: newColor };
          if (layer.layerObject) {
            let newStyle;
            if (layer.layerCategory === 'arcgis') {
              // For ArcGIS layers
              newStyle = () => ({
                color: newColor,
                weight: 2,
                fillColor: newColor,
                fillOpacity: 0.4
              });
              layer.layerObject.options.style = newStyle;
              layer.layerObject.setStyle(newStyle);
            } else {
              // For GeoJSON/KML layers
              newStyle = {
                color: newColor,
                weight: 2,
                fillColor: newColor,
                fillOpacity: 0.4
              };
              layer.layerObject.setStyle(newStyle);
              layer.layerObject.eachLayer((featureLayer) => {
                if (featureLayer instanceof L.CircleMarker) {
                  featureLayer.setStyle({
                    ...newStyle,
                    radius: 6,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
                }
              });
            }
          }
          return updatedLayer;
        }
        return layer;
      })
    );
  }, []);

  const handleToggleLayer = useCallback((layerId) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          const updatedLayer = { ...layer, visible: !layer.visible };
          if (updatedLayer.visible) {
            if (updatedLayer.layerObject && !mapRef.current.hasLayer(updatedLayer.layerObject)) {
              updatedLayer.layerObject.addTo(mapRef.current);
            }
          } else {
            if (updatedLayer.layerObject && mapRef.current.hasLayer(updatedLayer.layerObject)) {
              mapRef.current.removeLayer(updatedLayer.layerObject);
            }
          }
          return updatedLayer;
        }
        return layer;
      })
    );
  }, [mapRef]);

  const handleRemoveLayer = useCallback((layerId) => {
    setLayers(prevLayers => {
      const layerToRemove = prevLayers.find(layer => layer.id === layerId);
      if (layerToRemove && layerToRemove.layerObject && mapRef.current.hasLayer(layerToRemove.layerObject)) {
        mapRef.current.removeLayer(layerToRemove.layerObject);
      }
      return prevLayers.filter(layer => layer.id !== layerId);
    });
  }, [mapRef]);

  const handleReorderLayers = useCallback((startIndex, endIndex) => {
    setLayers(prevLayers => {
      const result = Array.from(prevLayers);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Reorder layers on the map
      result.forEach(layer => {
        if (layer.layerObject && layer.visible) {
          layer.layerObject.bringToFront();
        }
      });
      
      return result;
    });
  }, []);

  const convertKmlToGeoJson = useCallback((kmlString) => {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
    return kml(kmlDoc);
  }, []);

  const isValidGeoJSON = (data) => {
    try {
      const geoJSON = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!geoJSON || typeof geoJSON !== 'object') return false;
      
      const validTypes = [
        'Feature',
        'FeatureCollection',
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
        'Polygon',
        'MultiPolygon',
        'GeometryCollection'
      ];
      
      if (!validTypes.includes(geoJSON.type)) return false;
      
      if (geoJSON.type === 'FeatureCollection') {
        return Array.isArray(geoJSON.features);
      }
      
      return true;
    } catch (error) {
      console.warn('Error parsing GeoJSON:', error);
      return false;
    }
  };

  const createLayerObject = useCallback((layer) => {
    const layerStyle = {
      color: layer.color,
      weight: 2,
      fillColor: layer.color,
      fillOpacity: 0.4
    };

    const isKMLContent = (data) => {
      if (typeof data !== 'string') return false;
      const trimmed = data.trim();
      return trimmed.startsWith('<?xml') || 
             trimmed.startsWith('<kml') ||
             trimmed.includes('xmlns="http://www.opengis.net/kml/');
    };

    let layerObject = null;

    try {
      if (layer.layerCategory === 'custom') {
        layerObject = L.featureGroup();
      } else if (layer.layerCategory === 'arcgis') {
        layerObject = EsriLeaflet.featureLayer({
          url: layer.datasource,
          style: () => layerStyle
        });

        // Add load event handler for ArcGIS layers
        layerObject.on('load', () => {
          layerObject.setStyle(() => layerStyle);
        });
      } else if (layer.kmlData || (layer.geoJsonData && isKMLContent(layer.geoJsonData))) {
        const kmlString = layer.kmlData || layer.geoJsonData;
        const geoJsonData = convertKmlToGeoJson(kmlString);
        layerObject = L.geoJSON(geoJsonData, {
          style: layerStyle,
          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
              ...layerStyle,
              radius: 6,
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8,
            });
          }
        });
      } else if (layer.geoJsonData) {
        let geoJSON = layer.geoJsonData;
        if (typeof geoJSON === 'string' && !isKMLContent(geoJSON)) {
          geoJSON = JSON.parse(layer.geoJsonData);
        }

        if (!isValidGeoJSON(geoJSON)) {
          throw new Error('Invalid GeoJSON data structure');
        }

        layerObject = L.geoJSON(geoJSON, {
          style: layerStyle,
          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
              ...layerStyle,
              radius: 6,
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8,
            });
          }
        });
      }
    } catch (error) {
      console.error('Error creating layer object:', error);
      return null;
    }

    return layerObject;
  }, [convertKmlToGeoJson]);

  const handleAddLayer = useCallback((layerData) => {
    try {
      const newLayer = {
        id: uuidv4(),
        name: layerData.name,
        layerCategory: layerData.layerCategory || 'custom',
        datasource: layerData.datasource,
        color: assignColorToLayer(),
        visible: true,
        ...layerData
      };

      const layerObject = createLayerObject(newLayer);
      if (layerObject) {
        newLayer.layerObject = layerObject;
        if (newLayer.visible) {
          layerObject.addTo(mapRef.current);
        }
        setLayers(prevLayers => [...prevLayers, newLayer]);
        return newLayer.id;
      }
      throw new Error('Failed to create layer object');
    } catch (error) {
      console.error('Error adding layer:', error);
      throw error;
    }
  }, [assignColorToLayer, createLayerObject, mapRef]);

  const handleLayerUpdate = useCallback((layerId, updates) => {
    setLayers(prevLayers =>
      prevLayers.map(layer => {
        if (layer.id === layerId) {
          const updatedLayer = { ...layer };

          if (updates.layerObject && !updatedLayer.layerObject) {
            updatedLayer.layerObject = updates.layerObject;
          }

          return { ...updatedLayer, ...updates };
        }
        return layer;
      })
    );
  }, []);

  return {
    layers,
    handleLayerColorChange,
    handleToggleLayer,
    handleRemoveLayer,
    handleReorderLayers,
    handleAddLayer,
    handleLayerUpdate,
    assignColorToLayer,
  };
};

export default useLayerManager;