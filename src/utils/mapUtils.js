// mapUtils.js

import L from 'leaflet';
import * as EsriLeaflet from 'esri-leaflet';
import 'leaflet-kml';
import { kml } from '@tmcw/togeojson';
import JSZip from 'jszip';

// Managed layers are stored in a Map with layer IDs as keys
const managedLayers = new Map();

// Fix Leaflet's default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export const initializeMap = (mapId, darkMode) => {
    const mapElement = document.getElementById(mapId);
    if (mapElement._leaflet_id) {
        return L.map(mapElement);
    }

    const mapState = getCookie('mapState');
    let initialView = [0, 0];
    let initialZoom = 2;

    if (mapState) {
        try {
            const { lat, lng, zoom } = JSON.parse(mapState);
            initialView = [lat, lng];
            initialZoom = zoom;
        } catch (e) {
            console.warn('Failed to parse map state from cookie');
        }
    }

    const mapInstance = L.map(mapId, {
        center: initialView,
        zoom: initialZoom,
        zoomControl: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        maxZoom: 23,
        wheelPxPerZoomLevel: 100,
        worldCopyJump: true,
        keyboard: false
    });
    
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    mapInstance.on('moveend', () => {
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();
        const mapState = JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: zoom
        });
        setCookie('mapState', mapState, 365);
    });

    return mapInstance;
};
    

/**
 * Updates the layers on the map based on the selectedLayers array.
 * @param {L.Map} map - The Leaflet map instance.
 * @param {Array} selectedLayers - Array of selected layer objects.
 * @param {boolean} darkMode - Flag indicating if dark mode is enabled.
 */
export const updateMapLayers = async (map, selectedLayers, darkMode, layersRef) => {
    if (!map || !map.getZoom) {
      console.warn('Map is not initialized properly');
      return;
    }
  
    try {
      // Keep track of currently active layers
      const activeLayerIds = new Set(selectedLayers.filter(l => l.visible).map(l => l.id));
      
      // Remove layers that are no longer selected
      layersRef.forEach((layer, id) => {
        if (!activeLayerIds.has(id)) {
          map.removeLayer(layer);
          layersRef.delete(id);
        }
      });
  
      // Add or update selected layers in reverse order
      for (const layer of selectedLayers.slice().reverse()) {
        if (layer && layer.visible && !layersRef.has(layer.id)) {
          let newLayer;
          
          if (layer.type === 'uploaded') {
            newLayer = await addUploadedLayer(map, layer, darkMode);
          } else if (layer.datasource) {
            newLayer = addArcGISLayer(map, layer, darkMode);
          }
  
          if (newLayer) {
            layersRef.set(layer.id, newLayer);
          }
        }
      }
    } catch (error) {
      console.error('Error updating map layers:', error);
    }
  };
  
  const addArcGISLayer = (map, layer, darkMode) => {
    const color = layer.color || '#3388ff';
  
    const featureLayer = EsriLeaflet.featureLayer({
      url: layer.datasource,
      cacheLayers: false,
      where: '1=1',
      style: function () {
        return { color: color };
      }
    }).addTo(map);
  
    addClickEventToLayer(featureLayer, map, darkMode);
    return featureLayer;
  };
  
  const addUploadedLayer = async (map, layer, darkMode) => {
    const color = layer.color || '#3388ff';
  
    try {
      let geoJsonLayer;
  
      if (layer.type === 'kml') {
        const kmlString = await layer.data;
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
        const geojson = kml(kmlDoc);
        geoJsonLayer = L.geoJSON(geojson, { style: { color: color } });
      } else if (layer.type === 'kmz') {
        const kmzArrayBuffer = await layer.data;
        const zip = await JSZip.loadAsync(kmzArrayBuffer);
        const kmlFile = Object.values(zip.files).find(file => file.name.toLowerCase().endsWith('.kml'));
        if (kmlFile) {
          const kmlString = await kmlFile.async('string');
          const parser = new DOMParser();
          const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
          const geojson = kml(kmlDoc);
          geoJsonLayer = L.geoJSON(geojson, { style: { color: color } });
        } else {
          throw new Error('No KML file found in KMZ');
        }
      } else if (layer.type === 'geojson') {
        const geojson = typeof layer.data === 'string' ? JSON.parse(await layer.data) : await layer.data;
        geoJsonLayer = L.geoJSON(geojson, { style: { color: color } });
      } else {
        throw new Error('Unsupported layer type');
      }
  
      if (geoJsonLayer) {
        geoJsonLayer.addTo(map);
        addClickEventToLayer(geoJsonLayer, map, darkMode);
        return geoJsonLayer;
      }
    } catch (error) {
      console.error('Error adding uploaded layer:', error);
      return null;
    }
  };

/**
 * Adds a click event to a layer to display a styled popup.
 * @param {L.Layer} layer - The Leaflet layer instance.
 * @param {L.Map} map - The Leaflet map instance.
 * @param {boolean} darkMode - Flag indicating if dark mode is enabled.
 */
const addClickEventToLayer = (layer, map, darkMode) => {
    layer.on('click', function(e) {
        const properties = e.layer.feature.properties || {};
        const popupContent = '<div class="custom-popup ' + (darkMode ? 'dark' : 'light') + '">' +
            Object.entries(properties)
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join('<br>') +
            '</div>';

        L.popup({
            offset: L.point(0, -5),
            maxHeight: 300,
            maxWidth: 300,
            className: darkMode ? 'dark-popup' : 'light-popup',
            autoPan: false
        })
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(map);
    });
};

/**
 * Updates the page's background color based on the selected basemap.
 * @param {string} basemap - The identifier for the selected basemap.
 */
const updatePageBackgroundColor = (basemap) => {
    const body = document.body;
    switch (basemap) {
        case 'esriAerial':
            body.style.backgroundColor = '#1a3d17'; // Dark green
            break;
        case 'googleHybrid':
            body.style.backgroundColor = '#31492f'; // Slightly lighter dark green
            break;
        default:
            body.style.backgroundColor = '#f2efe9'; // Off white (OSM default)
    }
};

export const updateBasemap = (map, basemap, darkMode) => {
    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    const basemaps = {
        default: {
            light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxNativeZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        },
        esriAerial: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maxNativeZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        },
        googleHybrid: {
            url: 'https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
            maxNativeZoom: 22,
            attribution: '&copy; Google Maps'
        }
    };

    const selectedBasemap = basemaps[basemap] || basemaps.default;
    const tileUrl = basemap === 'default'
        ? (darkMode ? selectedBasemap.dark : selectedBasemap.light)
        : selectedBasemap.url;

    if (basemap === 'esriAerial') {
        EsriLeaflet.tiledMapLayer({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
            maxZoom: 23,
            maxNativeZoom: selectedBasemap.maxNativeZoom
        }).addTo(map);
    } else {
        L.tileLayer(tileUrl, {
            attribution: selectedBasemap.attribution,
            maxZoom: 23,
            maxNativeZoom: selectedBasemap.maxNativeZoom
        }).addTo(map);
    }
};

/**
 * Zooms the map to the extent of a specified layer.
 * @param {string|number} layerId - The unique identifier of the layer.
 * @param {Object} treeData - The data structure containing layer information.
 * @param {L.Map} map - The Leaflet map instance.
 */
export const zoomToLayerExtent = async (layerId, treeData, map) => {
    try {
        const layer = treeData[layerId];
        if (layer && layer.url && map) {
            const query = EsriLeaflet.query({ url: layer.url });

            const latLngBounds = await new Promise((resolve, reject) => {
                query.run((error, featureCollection) => {
                    if (error) {
                        console.error('Error getting layer extent:', error);
                        reject(error);
                    } else if (featureCollection && featureCollection.features.length > 0) {
                        const bounds = L.geoJSON(featureCollection).getBounds();
                        resolve(bounds);
                    } else {
                        reject('No features found for layer.');
                    }
                });
            });

            if (latLngBounds.isValid()) {
                map.fitBounds(latLngBounds);
            } else {
                console.warn('No valid bounds found for layer:', layerId);
            }
        } else {
            console.warn('Invalid layer or map instance. Cannot zoom to extent.');
        }
    } catch (error) {
        console.error('Failed to zoom to layer extent:', error);
    }
};

/**
 * Opens a link associated with a layer in a new browser tab.
 * @param {string|number} layerId - The unique identifier of the layer.
 * @param {Object} treeData - The data structure containing layer information.
 */
export const getLink = (layerId, treeData) => {
    const layer = treeData[layerId];
    if (layer && layer.url) {
        window.open(layer.url, '_blank');
    } else {
        console.warn('Invalid layer or no URL found for layer:', layerId);
    }
};

// Cookie utilities
const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
};

const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
};

export const createPopupContent = (properties, darkMode) => {
    return '<div class="custom-popup ' + (darkMode ? 'dark' : 'light') + '">' +
        Object.entries(properties)
            .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
            .join('<br>') +
        '</div>';
};