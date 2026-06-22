"use client";

import { create } from "zustand";

/** The well the user has selected on the /map page (decoded for the assistant). */
export interface MapWellContext {
  api: number;
  district: number | null;
  county: string | null;
  oilGas: string | null; // "Oil" | "Gas" | null
  totalDepth: number | null;
  plugged: boolean | null;
  nFormations: number | null;
  operatorName: string | null;
  operatorNumber: number | null;
  operatorStatus: string | null; // human-readable P-5 status
  officerCount: number | null;
}

/** A summary of the active map filters. */
export interface MapFilterContext {
  oilGas: string; // "all" | "Oil" | "Gas"
  status: string; // "all" | "active" | "plugged"
  district: string; // "all" or a number
  county: string; // county name or "all"
  operator: string | null;
}

interface MapAiState {
  well: MapWellContext | null;
  filters: MapFilterContext | null;
  setWell: (well: MapWellContext | null) => void;
  setFilters: (filters: MapFilterContext | null) => void;
}

/**
 * Map-page context for the Archon drawer: the selected well (with its operator)
 * and the active filters. The map publishes here; `buildPageContext` reads it so
 * the assistant can answer "this well" and questions about what's on screen.
 */
export const useMapAiContext = create<MapAiState>((set) => ({
  well: null,
  filters: null,
  setWell: (well) => set({ well }),
  setFilters: (filters) => set({ filters }),
}));
