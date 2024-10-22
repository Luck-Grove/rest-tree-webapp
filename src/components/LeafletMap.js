import React, { useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'esri-leaflet';
import 'leaflet-draw';
import * as EsriLeaflet from 'esri-leaflet';
import { initializeMap, updateBasemap, createPopupContent } from '../utils/mapUtils';
import { executeCommand } from '../utils/commandUtils';

const LeafletMap = ({
  darkMode,
  basemap,
  layers,
  addConsoleMessage,
  handleCommand,
  mapRef,
  handleLayerUpdate
}) => {
  const drawControlRef = useRef(null);

  const handleMapKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        handleCommand('');
      } else if (/^[a-zA-Z0-9]$/.test(e.key)) {
        handleCommand(e.key);
      }
    },
    [handleCommand]
  );

  useEffect(() => {
    const mapInstance = initializeMap('map', darkMode);
    mapRef.current = mapInstance;
    
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        rectangle: {
          shapeOptions: {
            color: 'red',
            weight: 2,
            fillColor: 'red',
            className: 'bounding-box-rectangle',
          },
        },
        polyline: false,
        polygon: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: false,
    });
    mapInstance.addControl(drawControl);
    drawControlRef.current = drawControl;

    const rectangleButton = document.querySelector('.leaflet-draw-draw-rectangle');
    if (rectangleButton) {
      L.DomEvent.off(rectangleButton, 'click');
      L.DomEvent.on(rectangleButton, 'click', function (e) {
        L.DomEvent.stop(e);
        executeCommand('bbclear', mapInstance, [], addConsoleMessage);
        executeCommand('bbox', mapInstance, [], addConsoleMessage);
      });
    }

    mapInstance.on(L.Draw.Event.CREATED, (event) => {
      if (event.layerType === 'rectangle') {
        if (mapInstance.boundingBox) {
          mapInstance.removeLayer(mapInstance.boundingBox);
        }
        mapInstance.boundingBox = event.layer;
        event.layer.addTo(mapInstance);
      }
    });

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.tabIndex = 0;
      mapContainer.addEventListener('keydown', handleMapKeyDown);
    }

    return () => {
      if (mapContainer) {
        mapContainer.removeEventListener('keydown', handleMapKeyDown);
      }
      mapInstance.remove();
    };
  }, [darkMode, addConsoleMessage, handleMapKeyDown, mapRef]);

  useEffect(() => {
    if (mapRef.current) {
      updateBasemap(mapRef.current, basemap, darkMode);
    }
  }, [basemap, darkMode, mapRef]);

  useEffect(() => {
    if (!mapRef.current) return;
  
    // Handle existing layers
    layers.forEach(layer => {
      if (layer.visible) {
        // Only create new layer object if one doesn't exist
        if (!layer.layerObject) {
          let newLayerObject;
          if (layer.layerCategory === 'arcgis') {
            newLayerObject = EsriLeaflet.featureLayer({
              url: layer.datasource,
              style: () => ({ 
                color: layer.color,
                weight: 2,
                fillOpacity: 0.4 
              })
            });
          } else if (layer.geoJsonData) {
            newLayerObject = L.geoJSON(layer.geoJsonData, {
              style: {
                color: layer.color,
                weight: 2,
                fillColor: layer.color,
                fillOpacity: 0.4
              },
              pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                  radius: 6,
                  fillColor: layer.color,
                  color: layer.color,
                  weight: 1,
                  opacity: 1,
                  fillOpacity: 0.8,
                });
              }
            });
  
            // Add popup handling only once when creating the layer
            newLayerObject.on('click', (e) => {
              const properties = e.layer.feature ? e.layer.feature.properties : e.layer.properties;
              const popupContent = createPopupContent(properties, darkMode);
              L.popup({
                offset: L.point(0, -5),
                maxHeight: 300,
                maxWidth: 300,
                className: darkMode ? 'dark-popup' : 'light-popup',
                autoPan: false
              })
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(mapRef.current);
            });
  
            // Add the layer to the map and update the layer state
            newLayerObject.addTo(mapRef.current);
            handleLayerUpdate(layer.id, { layerObject: newLayerObject });
          }
        } else if (!mapRef.current.hasLayer(layer.layerObject)) {
          // If layer object exists but isn't on the map, add it
          layer.layerObject.addTo(mapRef.current);
        }
      } else if (layer.layerObject && mapRef.current.hasLayer(layer.layerObject)) {
        // Remove layer if it should be hidden
        mapRef.current.removeLayer(layer.layerObject);
      }
    });
  
    // Cleanup removed layers
    const currentLayerIds = new Set(layers.map(l => l.id));
    mapRef.current.eachLayer(mapLayer => {
      if (!(mapLayer instanceof L.TileLayer)) {
        const layerStillExists = layers.some(layer => layer.layerObject === mapLayer);
        if (!layerStillExists) {
          mapRef.current.removeLayer(mapLayer);
        }
      }
    });
  }, [layers, darkMode, mapRef, handleLayerUpdate]);

  return <div id="map" className="h-full w-full"></div>;
};

export default LeafletMap;
