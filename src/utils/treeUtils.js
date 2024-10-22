// src/utils/treeUtils.js

import { v4 as uuidv4 } from 'uuid';

// Original ID generator for GIS layers
export const getNextId = (() => {
  let counter = 0;
  return () => {
    counter++;
    return `I${counter.toString().padStart(4, '0')}`;
  };
})();

// New UUID generator for custom layers
export const generateUniqueId = () => {
  return uuidv4();
};

// Function to add a tree node with either a sequential ID or a UUID
export const addTreeNode = (parent, text, type, url, id, currentTreeData) => {
  return {
    ...currentTreeData,
    [id]: { id, text, parent, type, url, hasChildren: false },
  };
};

// Function to toggle node expansion in the tree
export const toggleNode = (setExpandedNodes, nodeId) => {
  setExpandedNodes((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    return newSet;
  });
};

// Recursive function to determine if a node is visible based on search terms
export const isNodeVisible = (nodeId, treeData, searchTerm) => {
  const node = treeData[nodeId];
  if (!node) return false;
  if (node.text && node.text.toLowerCase().includes(searchTerm.toLowerCase())) return true;
  if (node.type === 'layer') return true;
  return Object.keys(treeData).some(
    (childId) => treeData[childId].parent === nodeId && isNodeVisible(childId, treeData, searchTerm)
  );
};

// Function to insert parent nodes into filtered data
export const insertParentChain = (id, filteredData, treeData) => {
  const node = treeData[id];
  if (!node) return;

  filteredData[id] = { ...node };

  if (node.parent) {
    insertParentChain(node.parent, filteredData, treeData);
  }
};

// Function to filter tree data based on search terms
export const filterTreeData = (treeData, searchTerm) => {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const newFilteredData = {};
  Object.entries(treeData).forEach(([id, node]) => {
    if (node.text && node.text.toLowerCase().includes(normalizedSearchTerm)) {
      insertParentChain(id, newFilteredData, treeData);
    }
  });
  return newFilteredData;
};

// Function to get visible nodes based on search and layer selection
export const getVisibleNodes = (treeData, searchTerm, showOnlyActiveLayers, selectedLayers) => {
  const visibleNodes = new Set();

  const isNodeVisibleRecursive = (nodeId) => {
    const node = treeData[nodeId];
    if (!node) return false;

    if (node.text && node.text.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    if (showOnlyActiveLayers && node.type === 'layer') {
      return selectedLayers.has(node.id); // Ensure correct ID referencing
    }

    return Object.keys(treeData)
      .filter((id) => treeData[id].parent === nodeId)
      .some(isNodeVisibleRecursive);
  };

  Object.keys(treeData).forEach((nodeId) => {
    if (isNodeVisibleRecursive(nodeId)) {
      visibleNodes.add(nodeId);
      let parentId = treeData[nodeId].parent;
      while (parentId) {
        visibleNodes.add(parentId);
        parentId = treeData[parentId]?.parent;
      }
    }
  });

  return visibleNodes;
};

// Function to export tree data to CSV
export const exportToCSV = (filteredTreeData) => {
  const csvRows = [['Layer', 'Path']];

  const traverseTree = (nodeId, path = '') => {
    const node = filteredTreeData[nodeId];
    if (!node) return;

    const newPath = path ? `${path}/${node.text || ''}` : node.text || '';

    if (node.type === 'layer') {
      csvRows.push([node.text || '', newPath]);
    }

    Object.entries(filteredTreeData)
      .filter(([_, data]) => data.parent === nodeId)
      .forEach(([childId, _]) => {
        traverseTree(childId, newPath);
      });
  };

  Object.keys(filteredTreeData)
    .filter((id) => !filteredTreeData[id].parent)
    .forEach((id) => traverseTree(id));

  return csvRows.map((row) => row.join(',')).join('\n');
};
