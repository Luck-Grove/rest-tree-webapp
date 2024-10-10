import bboxCommand from '../commands/bbox.js';
import bbclearCommand from '../commands/bbclear.js';
import helpCommand from '../commands/help.js';
import exportCommand from '../commands/export.js';
import { writeToConsole } from './api.js';

const commands = {
  bbox: bboxCommand,
  bbclear: bbclearCommand,
  help: helpCommand,
  export: exportCommand,
};

export const executeCommand = (command, map, args = [], addConsoleMessage) => {
  writeToConsole(`Command: ${command}`, addConsoleMessage);
  
  if (command.trim() !== '') {
    const [commandName, ...commandArgs] = command.toLowerCase().split(' ');
    
    if (commands[commandName]) {
      commands[commandName].execute(map, [...args, ...commandArgs], getCommandList(), addConsoleMessage);
    } else {
      writeToConsole(`Unknown command: ${commandName}. Run 'help' to view a list of commands.`, addConsoleMessage);
    }
  }
};

export const getCommandSuggestions = (partialCommand) => {
  const lowercasePartial = partialCommand.toLowerCase();
  return Object.keys(commands).filter(cmd => cmd.startsWith(lowercasePartial));
};

export const getCommandList = () => {
  return Object.entries(commands).map(([name, { description }]) => ({ name, description }));
};
