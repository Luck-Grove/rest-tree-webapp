import { writeToConsole } from '../utils/api.js';
import bboxCommand from './bbox.js';

const bbclearCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    if (bboxCommand.clearBoundingBox(map)) {
      writeToConsole("Bounding box cleared.", addConsoleMessage);
    } else {
      writeToConsole("No bounding box to clear.", addConsoleMessage);
    }
  },
  description: "Clear the current bounding box"
};

export default bbclearCommand;
