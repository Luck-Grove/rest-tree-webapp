const bbclearCommand = {
    execute: (map) => {
      if (map && map.boundingBox) {
        map.removeLayer(map.boundingBox);
        map.boundingBox = null;
        return ["Bounding box cleared."];
      }
      return ["No bounding box to clear."];
    },
    description: "Clear the current bounding box"
  };
  
  export default bbclearCommand;