const helpCommand = {
    execute: (_, __, commandList) => {
      const helpText = commandList
        .map(({ name, description }) => `${name}: ${description}`)
        .join('\n');
      return ["Available commands:", helpText];
    },
    description: "List all available commands"
  };
  
  export default helpCommand;