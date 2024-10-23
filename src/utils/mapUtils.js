import L from 'leaflet';
import * as EsriLeaflet from 'esri-leaflet';

const managedLayers = new Map();

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
        const { lat, lng, zoom } = JSON.parse(mapState);
        initialView = [lat, lng];
        initialZoom = zoom;
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
        keyboard:false
    });
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // Add event listener to save map state
    mapInstance.on('moveend', () => {
        const center = mapInstance.getCenter();
        const zoom = mapInstance.getZoom();
        const mapState = JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: zoom
        });
        setCookie('mapState', mapState, 365); // Save for 1 year
    });

    updateBasemap(mapInstance, 'default', darkMode);

    return mapInstance;
};

export const updateMapLayers = (map, selectedLayers, darkMode) => {
    if (!map || !map.getZoom) {
      console.warn('Map is not initialized properly');
      return;
    }
  
    try {
      // Remove all non-base layers
      map.eachLayer(layer => {
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      });
  
      // Clear our managed layers
      managedLayers.clear();
  
      // Add selected layers in reverse order
      selectedLayers.slice().reverse().forEach((layer) => {
        if (layer && layer.visible && layer.datasource) {
          // Ensure layer.color is assigned
          const color = layer.color || '#3388ff';
  
          // Create the where clause from the filters
          let whereClause = '1=1';
          if (layer.filters) {
            const filterClauses = Object.entries(layer.filters)
              .filter(([_, value]) => value !== '')
              .map(([field, value]) => `UPPER(${field}) LIKE UPPER('%${value}%')`);
            if (filterClauses.length > 0) {
              whereClause = filterClauses.join(' AND ');
            }
          }          
  
          const featureLayer = EsriLeaflet.featureLayer({
            url: layer.datasource,
            cacheLayers: false,
            where: whereClause,
            style: function () {
              return { color: color };
            }
          }).addTo(map);
  
          addClickEventToLayer(featureLayer, map, darkMode);
          managedLayers.set(layer.id, featureLayer);
        }
      });
    } catch (error) {
      console.error('Error updating map layers:', error);
    }
};

const addClickEventToLayer = (layer, map, darkMode) => {
    layer.on('click', function(e) {
        const popupContent = '<div class="custom-popup ' + (darkMode ? 'dark' : 'light') + '">' +
            Object.entries(e.layer.feature.properties)
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

    let selectedBasemap = basemaps[basemap] || basemaps.default;
    let tileUrl = basemap === 'default'
        ? (darkMode ? selectedBasemap.dark : selectedBasemap.light)
        : selectedBasemap.url;

    let maxNativeZoom = selectedBasemap.maxNativeZoom;
    let attribution = selectedBasemap.attribution;

    if (basemap === 'esriAerial') {
        EsriLeaflet.tiledMapLayer({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
            maxZoom: 23,
            maxNativeZoom: maxNativeZoom
        }).addTo(map);
    } else {
        L.tileLayer(tileUrl, {
            attribution: attribution,
            maxZoom: 23,
            maxNativeZoom: maxNativeZoom
        }).addTo(map);
    }

    updatePageBackgroundColor(basemap);
};

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

export const getLink = (layerId, treeData) => {
    const layer = treeData[layerId];
    if (layer && layer.url) {
        window.open(layer.url, '_blank');
    } else {
        console.warn('Invalid layer or no URL found for layer:', layerId);
    }
};

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
