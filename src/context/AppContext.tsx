import { createContext, useContext, useState, type ReactNode } from "react";
import type { Style } from "@/hooks/useStyles";

type Ctx = {
  selectedStyleId: string | null;
  openStyle: (id: string | null) => void;
  setActiveCategory: (c: string) => void;
  activeCategory: string;
  styles: Style[];
  setStyles: (styles: Style[]) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [styles, setStyles] = useState<Style[]>([]);

  return (
    <AppCtx.Provider value={{
      selectedStyleId, 
      openStyle: setSelectedStyleId,
      activeCategory, 
      setActiveCategory,
      styles, 
      setStyles,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
