"use client";

import { createContext, useCallback, useContext, useState } from "react";

type DragContextValue = {
  isDragging: boolean;
  startDrag: () => void;
  endDrag: () => void;
};

const DragContext = createContext<DragContextValue | null>(null);

type DragProviderProps = {
  children: React.ReactNode;
};

const DragProvider = ({ children }: DragProviderProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback(() => {
    setIsDragging(true);
  }, []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <DragContext.Provider value={{ isDragging, startDrag, endDrag }}>
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
