import { writeToConsole } from '../utils/api.js';

const bbclearCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    if (map && map.boundingBox) {
      map.removeLayer(map.boundingBox);
      map.boundingBox = null;
      writeToConsole("Bounding box cleared.", addConsoleMessage);
    } else {
      writeToConsole("No bounding box to clear.", addConsoleMessage);
    }
  },
  description: "Clear the current bounding box"
};

export default bbclearCommand;
