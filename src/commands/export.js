import { writeToConsole } from '../utils/api.js';

const exportCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    const [layer, format = 'shp'] = args;
    // This is a placeholder. You'll need to implement the actual export functionality.
    writeToConsole(`Exporting ${layer} as ${format}...`, addConsoleMessage);
  },
  description: "Export a layer (Usage: export <layer> [format])"
};

export default exportCommand;
