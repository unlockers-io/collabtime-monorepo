"use client";

import { createContext, useCallback, useContext, useState } from "react";

type DragContextValue = {
  isDragging: boolean;
  draggedMemberGroupId: string | undefined;
  startDrag: (groupId: string | undefined) => void;
  endDrag: () => void;
};

const DragContext = createContext<DragContextValue | null>(null);

type DragProviderProps = {
  children: React.ReactNode;
};

const DragProvider = ({ children }: DragProviderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMemberGroupId, setDraggedMemberGroupId] = useState<
    string | undefined
  >(undefined);

  const startDrag = useCallback((groupId: string | undefined) => {
    setIsDragging(true);
    setDraggedMemberGroupId(groupId);
  }, []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDraggedMemberGroupId(undefined);
  }, []);

  return (
    <DragContext.Provider
      value={{ isDragging, draggedMemberGroupId, startDrag, endDrag }}
    >
      {children}
    </DragContext.Provider>
  );
};

const useDrag = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error("useDrag must be used within a DragProvider");
  }
  return context;
};

export { DragProvider, useDrag };
