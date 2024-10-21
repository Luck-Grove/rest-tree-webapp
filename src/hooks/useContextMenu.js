import { useState, useRef, useCallback } from 'react';

const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
  const lastContextMenuTrigger = useRef(null);

  const handleContextMenuClick = useCallback((e, nodeId, isLayer = false) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (lastContextMenuTrigger.current && now - lastContextMenuTrigger.current < 100) {
      return;
    }
    lastContextMenuTrigger.current = now;

    const { pageX, pageY } = e;

    setContextMenu({
      visible: true,
      x: pageX,
      y: pageY,
      nodeId: nodeId,
      isLayer: isLayer,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: null, isLayer: false });
  }, []);

  return {
    contextMenu,
    handleContextMenuClick,
    closeContextMenu,
  };
};

export default useContextMenu;
