// Function to apply filters to a layer
export const applyFilters = (layer, filters) => {
  if (!layer || !filters) return layer;

  // Create a new definition expression based on the filters
  const definitionExpression = Object.entries(filters)
    .filter(([_, value]) => value !== '')
    .map(([field, value]) => `${field} LIKE '%${value}%'`)
    .join(' AND ');

  // Apply the definition expression to the layer
  if (definitionExpression) {
    layer.definitionExpression = definitionExpression;
  } else {
    // If no filters are applied, remove the definition expression
    layer.definitionExpression = null;
  }

  return layer;
};

// Function to clear filters from a layer
export const clearFilters = (layer) => {
  if (!layer) return layer;

  // Remove the definition expression from the layer
  layer.definitionExpression = null;

  return layer;
};
