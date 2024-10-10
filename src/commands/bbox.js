import L from 'leaflet';
import { writeToConsole } from '../utils/api';

let activeBBoxTool = null;
export let lastBoundingBoxCoordinates = null;

const bboxCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    if (!map) {
      writeToConsole("Map not available. Unable to activate bounding box tool.", addConsoleMessage);
      return;
    }

    if (activeBBoxTool) {
      map.fire('draw:cancel');
      writeToConsole("Bounding box tool deactivated.", addConsoleMessage);
      return;
    }

    try {
      activeBBoxTool = new L.Draw.Rectangle(map, {
        shapeOptions: {
          color: 'red',
          weight: 2,
          fillColor: 'red',
          className: 'bounding-box-rectangle'
        }
      });

      activeBBoxTool.enable();

      const drawCreatedListener = (event) => {
        if (event.layerType === 'rectangle') {
          if (map.boundingBox) {
            map.removeLayer(map.boundingBox);
          }

          map.boundingBox = event.layer;
          event.layer.addTo(map);

          const bounds = map.boundingBox.getBounds();
          lastBoundingBoxCoordinates = {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth()
          };

          const boundingBoxInfo = bboxCommand.getBoundingBoxCoordinates(map);
          writeToConsole(`Bounding box set: ${boundingBoxInfo}`, addConsoleMessage);

          deactivateTool();
        }
      };

      const drawStopListener = () => {
        deactivateTool();
      };

      const drawCancelListener = () => {
        deactivateTool();
      };

      map.on(L.Draw.Event.CREATED, drawCreatedListener);
      map.on('draw:drawstop', drawStopListener);
      map.on('draw:cancel', drawCancelListener);

      const escapeHandler = (evt) => {
        if (evt.key === 'Escape' && activeBBoxTool) {
          map.fire('draw:cancel');
        }
      };

      document.addEventListener('keydown', escapeHandler);

      function deactivateTool() {
        if (activeBBoxTool) {
          activeBBoxTool.disable();
          activeBBoxTool = null;
          map.off(L.Draw.Event.CREATED, drawCreatedListener);
          map.off('draw:drawstop', drawStopListener);
          map.off('draw:cancel', drawCancelListener);
          document.removeEventListener('keydown', escapeHandler);
        }
      }

      writeToConsole("Bounding box tool activated. Click and drag on the map to draw a rectangle. Press Escape to cancel.", addConsoleMessage);
    } catch (error) {
      writeToConsole(`Error activating bounding box tool: ${error.message}`, addConsoleMessage);
    }
  },

  description: "Toggle the bounding box drawing tool",

  getBoundingBox: (map) => {
    return map && map.boundingBox;
  },

  clearBoundingBox: (map) => {
    if (map && map.boundingBox) {
      map.removeLayer(map.boundingBox);
      map.boundingBox = null;
      lastBoundingBoxCoordinates = null;
      return true;
    }
    return false;
  },

  getBoundingBoxCoordinates: (map) => {
    if (lastBoundingBoxCoordinates) {
      const { west, south, east, north } = lastBoundingBoxCoordinates;
      return `${west.toFixed(6)},${south.toFixed(6)},${east.toFixed(6)},${north.toFixed(6)}`;
    }
    return null;
  }
};

export default bboxCommand;
