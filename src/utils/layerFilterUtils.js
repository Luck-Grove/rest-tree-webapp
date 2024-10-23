// Function to apply filters to a layer
export const applyFilters = (layer, filters) => {
  if (!layer || !filters) return layer;

  // Create a new definition expression based on the filters
  const definitionExpression = Object.entries(filters)
    .filter(([_, value]) => value !== '')
    .map(([field, value]) => `UPPER(${field}) LIKE UPPER('%${value}%')`)
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

// Function to fetch layer fields from ArcGIS REST API
export const fetchLayerFields = async (layerUrl) => {
  try {
    const response = await fetch(`${layerUrl}?f=json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (!data.fields) {
      throw new Error('No fields found in the layer data');
    }

    // Extract relevant field information
    return data.fields.map(field => ({
      name: field.name,
      type: field.type,
      alias: field.alias
    }));
  } catch (error) {
    console.error('Error fetching layer fields:', error);
    throw error;
  }
};
