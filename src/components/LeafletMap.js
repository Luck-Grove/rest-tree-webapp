// src/components/LeafletMap.js

import React, { useEffect, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'esri-leaflet';
import 'leaflet-draw';

import { initializeMap, updateMapLayers, updateBasemap } from '../utils/mapUtils';
import { executeCommand } from '../utils/commandUtils';

const LeafletMap = ({
  darkMode,
  basemap,
  selectedLayers,
  addConsoleMessage,
  currentCommand,
  handleCommand,
  mapRef,
}) => {
  const [isMapReady, setIsMapReady] = useState(false);

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

    updateBasemap(mapInstance, basemap, darkMode);

    // Add draw controls and other map setups
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

    // Custom rectangle draw handler
    const rectangleButton = document.querySelector('.leaflet-draw-draw-rectangle');
    if (rectangleButton) {
      L.DomEvent.off(rectangleButton, 'click');
      L.DomEvent.on(rectangleButton, 'click', function (e) {
        L.DomEvent.stop(e);
        executeCommand('bbclear', mapInstance, [], addConsoleMessage);
        executeCommand('bbox', mapInstance, [], addConsoleMessage);
      });
    }

    // Handle rectangle creation
    mapInstance.on(L.Draw.Event.CREATED, (event) => {
      if (event.layerType === 'rectangle') {
        if (mapInstance.boundingBox) {
          mapInstance.removeLayer(mapInstance.boundingBox);
        }
        mapInstance.boundingBox = event.layer;
        event.layer.addTo(mapInstance);
      }
    });

    // Map keydown events
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.tabIndex = 0;
      mapContainer.addEventListener('keydown', handleMapKeyDown);
    }

    mapInstance.whenReady(() => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.remove();
      if (mapContainer) {
        mapContainer.removeEventListener('keydown', handleMapKeyDown);
      }
    };
  }, [basemap, darkMode, addConsoleMessage, handleMapKeyDown, mapRef]);

  useEffect(() => {
    if (mapRef.current && isMapReady) {
      updateMapLayers(mapRef.current, selectedLayers, darkMode);
    }
  }, [selectedLayers, darkMode, isMapReady, mapRef]);

  return <div id="map" className="h-full w-full"></div>;
};

export default LeafletMap;
