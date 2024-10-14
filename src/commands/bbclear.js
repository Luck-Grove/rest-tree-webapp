import { writeToConsole } from '../utils/api.js';
import { lastBoundingBoxCoordinates } from './bbox.js';

const bbclearCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    if (map && map.boundingBox) {
      map.removeLayer(map.boundingBox);
      map.boundingBox = null;
      lastBoundingBoxCoordinates = null;
      writeToConsole("Bounding box cleared.", addConsoleMessage);
    } else {
      writeToConsole("No bounding box to clear.", addConsoleMessage);
    }
  },
  description: "Clear the current bounding box"
};

export default bbclearCommand;
