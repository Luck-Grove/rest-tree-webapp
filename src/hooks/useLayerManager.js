import { useState, useCallback } from 'react';

const useLayerManager = (treeData, mapRef) => {
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);

  const assignColorToLayer = useCallback((layerId, prevLayers) => {
    const pastelColors = [
      '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
      '#C9C9FF', '#FFB3FF', '#BFFFFF', '#FFFFB3', '#B3FFB3',
    ];
    
    const allColors = [
      ...pastelColors,
      '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
      '#C0C0C0', '#808080', '#800000', '#808000', '#008000', '#800080',
    ];

    const assignedColors = prevLayers.map((layer) => layer.color).filter(Boolean);

    for (let color of pastelColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    for (let color of allColors) {
      if (!assignedColors.includes(color)) {
        return color;
      }
    }

    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }, []);

  const addLayerToSelected = useCallback((layerId, prevLayers) => {
    if (treeData[layerId]) {
      const newLayer = {
        id: layerId,
        name: treeData[layerId].text || 'Unknown Layer',
        visible: true,
        type: 'arcgis',
        datasource: treeData[layerId].url || '',
        color: treeData[layerId].color || assignColorToLayer(layerId, prevLayers),
      };
      return [newLayer, ...prevLayers];
    }
    return prevLayers;
  }, [treeData, assignColorToLayer]);

  const handleLayerColorChange = useCallback((layerId, newColor) => {
    setSelectedLayers((prevLayers) =>
      prevLayers.map((layer) => (layer.id === layerId ? { ...layer, color: newColor } : layer))
    );
  }, []);

  const handleToggleLayer = useCallback((layerId) => {
    setSelectedLayers((prevLayers) => {
      const layerIndex = prevLayers.findIndex((layer) => layer.id === layerId);
      if (layerIndex !== -1) {
        return prevLayers.map((layer) =>
          layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
        );
      } else if (treeData[layerId]) {
        return addLayerToSelected(layerId, prevLayers);
      }
      return prevLayers;
    });
  }, [treeData, addLayerToSelected]);

  const handleRemoveLayer = useCallback((layerId) => {
    setSelectedLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== layerId));
  }, []);

  const handleReorderLayers = useCallback((startIndex, endIndex) => {
    setSelectedLayers((prevLayers) => {
      const result = Array.from(prevLayers);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const handleAddLayer = useCallback((layerName) => {
    const newLayerId = `custom-${Date.now()}`;
    setSelectedLayers((prevLayers) => {
      const newLayer = {
        id: newLayerId,
        name: layerName,
        visible: true,
        type: 'custom',
        datasource: '',
        color: assignColorToLayer(newLayerId, prevLayers),
      };
      return [newLayer, ...prevLayers];
    });
  }, [assignColorToLayer]);

  return {
    selectedLayers,
    setSelectedLayers,
    selectedLayerId,
    setSelectedLayerId,
    handleLayerColorChange,
    handleToggleLayer,
    handleRemoveLayer,
    handleReorderLayers,
    handleAddLayer,
    assignColorToLayer,
  };
};

export default useLayerManager;
