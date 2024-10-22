// src/utils/layerFactory.js

import L from 'leaflet';
import 'esri-leaflet';

// Function to create a Leaflet layer based on layer type
export const createLeafletLayer = (layer) => {
  switch (layer.type) {
    case 'arcgis':
      if (L.esri) {
        return L.esri.tiledMapLayer({
          url: layer.url,
        });
      } else {
        console.error('esri-leaflet is not loaded.');
        return null;
      }

    case 'wms':
      return L.tileLayer.wms(layer.url, {
        layers: layer.wmsLayers, // e.g., 'layer1,layer2'
        format: 'image/png',
        transparent: true,
      });

    case 'custom':
    case 'saved':
      return L.geoJSON(layer.geoJsonData, {
        style: {
          color: layer.color,
        },
      });

    // Add more cases here for additional layer types (e.g., GeoJSON, Vector layers)

    default:
      console.warn(`Unsupported layer type: ${layer.type}`);
      return null;
  }
};
