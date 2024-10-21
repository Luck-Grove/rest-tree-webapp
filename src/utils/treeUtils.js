export const addTreeNode = (parent, text, type, url, id, currentTreeData) => {
    return {
        ...currentTreeData,
        [id]: { text, parent, type, url, hasChildren: false }
    };
};

export const getNextId = (() => {
    let counter = 0;
    return () => {
        counter++;
        return `I${counter.toString().padStart(4, '0')}`;
    };
})();

export const toggleNode = (setExpandedNodes, nodeId) => {
    setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        return newSet;
    });
};

export const isNodeVisible = (nodeId, treeData, searchTerm) => {
    const node = treeData[nodeId];
    if (!node) return false;
    if (node.text && node.text.toLowerCase().includes(searchTerm.toLowerCase())) return true;
    if (node.type === 'layer') return true;
    return Object.keys(treeData).some(childId => 
        treeData[childId].parent === nodeId && isNodeVisible(childId, treeData, searchTerm)
    );
};

export const insertParentChain = (id, filteredData, treeData) => {
    const node = treeData[id];
    if (!node) return;

    filteredData[id] = { ...node };

    if (node.parent) {
        insertParentChain(node.parent, filteredData, treeData);
    }
};

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

export const getVisibleNodes = (treeData, searchTerm, showOnlyActiveLayers, selectedLayers) => {
    const visibleNodes = new Set();
    
    const isNodeVisible = (nodeId) => {
        const node = treeData[nodeId];
        if (!node) return false;
        
        if (node.text && node.text.toLowerCase().includes(searchTerm.toLowerCase())) {
            return true;
        }
        
        if (showOnlyActiveLayers && node.type === 'layer') {
            return selectedLayers.has(nodeId);
        }
        
        return Object.keys(treeData)
            .filter(id => treeData[id].parent === nodeId)
            .some(isNodeVisible);
    };
    
    Object.keys(treeData).forEach(nodeId => {
        if (isNodeVisible(nodeId)) {
            visibleNodes.add(nodeId);
            let parentId = treeData[nodeId].parent;
            while (parentId) {
                visibleNodes.add(parentId);
                parentId = treeData[parentId].parent;
            }
        }
    });
    
    return visibleNodes;
};

export const exportToCSV = (filteredTreeData) => {
    const csvRows = [['Layer', 'Path']];
    
    const traverseTree = (nodeId, path = '') => {
        const node = filteredTreeData[nodeId];
        if (!node) return;

        if (node.type === 'layer') {
            csvRows.push([node.text || '', path]);
        }

        Object.entries(filteredTreeData)
            .filter(([_, data]) => data.parent === nodeId)
            .forEach(([childId, _]) => {
                const newPath = path ? `${path}/${node.text || ''}` : (node.text || '');
                traverseTree(childId, newPath);
            });
    };

    Object.keys(filteredTreeData)
        .filter(id => filteredTreeData[id].parent === '')
        .forEach(id => traverseTree(id));

    return csvRows.map(row => row.join(',')).join('\n');
};
