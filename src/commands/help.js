import { writeToConsole } from '../utils/api.js';

const helpCommand = {
  execute: (map, args, commandList, addConsoleMessage) => {
    const helpText = commandList
      .map(({ name, description }) => `${name}: ${description}`)
      .join('\n');
    writeToConsole("Available commands:", addConsoleMessage);
    writeToConsole(helpText, addConsoleMessage);
  },
  description: "List all available commands"
};

export default helpCommand;
