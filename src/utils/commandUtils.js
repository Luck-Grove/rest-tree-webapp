import bboxCommand from '../commands/bbox.js';
import bbclearCommand from '../commands/bbclear.js';
import helpCommand from '../commands/help.js';
import exportCommand from '../commands/export.js';

const commands = {
  bbox: bboxCommand,
  bbclear: bbclearCommand,
  help: helpCommand,
  export: exportCommand,
};

export const executeCommand = (command, map, args = []) => {
  const results = [`Command: ${command}`];
  
  if (command.trim() !== '') {
    const [commandName, ...commandArgs] = command.toLowerCase().split(' ');
    
    if (commands[commandName]) {
      const commandResults = commands[commandName].execute(map, [...args, ...commandArgs], getCommandList());
      results.push(...commandResults);
    } else {
      results.push(`Unknown command: ${commandName}. Run 'help' to view a list of commands.`);
    }
  }
  
  return results;
};

export const getCommandSuggestions = (partialCommand) => {
  const lowercasePartial = partialCommand.toLowerCase();
  return Object.keys(commands).filter(cmd => cmd.startsWith(lowercasePartial));
};

export const getCommandList = () => {
  return Object.entries(commands).map(([name, { description }]) => ({ name, description }));
};