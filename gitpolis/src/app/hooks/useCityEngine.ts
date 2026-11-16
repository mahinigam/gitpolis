import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { HoverInfo, SelectionState } from '../../domain/city/types';
import { CitySceneEngine } from '../../engine/CityScene';

export interface CityEngineController {
  engineRef: RefObject<CitySceneEngine | null>;
  hoverInfo: HoverInfo | null;
  selection: SelectionState | null;
  highlightedLanguage: string | null;
  select: (selection: SelectionState | null) => void;
  highlightLanguage: (language: string | null) => void;
  clearSelection: () => void;
}

/**
 * Owns the Three.js engine lifecycle and the selection/hover UI state that is
 * driven by it. Mounting and disposal are tied to the host element.
 */
export function useCityEngine(hostRef: RefObject<HTMLDivElement | null>): CityEngineController {
  const engineRef = useRef<CitySceneEngine | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [highlightedLanguage, setHighlightedLanguage] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new CitySceneEngine(hostRef.current, {
      onHover: setHoverInfo,
      onSelect: setSelection,
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [hostRef]);

  const select = useCallback((next: SelectionState | null) => {
    setSelection(next);
    engineRef.current?.setSelection(next, true);
  }, []);

  const highlightLanguage = useCallback((language: string | null) => {
    setHighlightedLanguage(language);
    engineRef.current?.setHighlightedLanguage(language);
  }, []);

  const clearSelection = useCallback(() => select(null), [select]);

  return {
    engineRef,
    hoverInfo,
    selection,
    highlightedLanguage,
    select,
    highlightLanguage,
    clearSelection,
  };
}
