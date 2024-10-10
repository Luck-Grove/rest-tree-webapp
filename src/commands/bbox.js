import L from 'leaflet';

let activeBBoxTool = null;
let lastBoundingBoxCoordinates = null; // Store the latest bounding box coordinates

const bboxCommand = {
  execute: (map) => {
    if (!map) {
      return ["Map not available. Unable to activate bounding box tool."];
    }

    if (activeBBoxTool) {
      // Deactivate the tool if it's already active
      map.fire('draw:cancel');
      return ["Bounding box tool deactivated."];
    }

    // Activate the tool
    activeBBoxTool = new L.Draw.Rectangle(map, {
      shapeOptions: {
        color: 'red',
        weight: 2,
        fillColor: 'red',
        className: 'bounding-box-rectangle'
      }
    });

    activeBBoxTool.enable();

    // Set up listeners for the drawing events
    const drawCreatedListener = (event) => {
      if (event.layerType === 'rectangle') {
        if (map.boundingBox) {
          map.removeLayer(map.boundingBox);
        }

        map.boundingBox = event.layer;
        event.layer.addTo(map);

        // Store the bounding box coordinates after it's created
        const bounds = map.boundingBox.getBounds();
        lastBoundingBoxCoordinates = {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth()
        };

        // Output the bounding box info to the console UI
        const boundingBoxInfo = bboxCommand.getBoundingBoxCoordinates(map);
        console.log(`Bounding box set: ${boundingBoxInfo}`);

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

    // Set up the Escape key listener
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

    return ["Bounding box tool activated. Click and drag on the map to draw a rectangle. Press Escape to cancel."];
  },

  description: "Toggle the bounding box drawing tool",

  getBoundingBox: (map) => {
    return map && map.boundingBox;
  },

  clearBoundingBox: (map) => {
    if (map && map.boundingBox) {
      map.removeLayer(map.boundingBox);
      map.boundingBox = null;
      lastBoundingBoxCoordinates = null; // Clear stored coordinates
      return true;
    }
    return false;
  },

  getBoundingBoxCoordinates: (map) => {
    if (map && lastBoundingBoxCoordinates) {
      const { west, south, east, north } = lastBoundingBoxCoordinates;
      return `${west.toFixed(6)},${south.toFixed(6)},${east.toFixed(6)},${north.toFixed(6)}`;
    }
    return null;
  }
};

export default bboxCommand;