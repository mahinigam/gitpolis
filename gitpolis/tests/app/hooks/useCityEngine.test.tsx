import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCityEngine } from '../../../src/app/hooks/useCityEngine';
import type { CitySceneEngine } from '../../../src/engine/CityScene';

const engineMock = vi.hoisted(() => {
  const engine = {
    dispose: vi.fn(),
    setSelection: vi.fn(),
    setHighlightedLanguage: vi.fn(),
    setTimelineCursor: vi.fn(),
    setTimeOfDay: vi.fn(),
    setWeather: vi.fn(),
  };
  return {
    engine,
    constructor: vi.fn((_host: unknown, _callbacks: unknown) => engine),
    onHover: null as null | ((info: unknown) => void),
    onSelect: null as null | ((selection: unknown) => void),
  };
});

vi.mock('../../../src/engine/CityScene', () => ({
  CitySceneEngine: engineMock.constructor,
}));

function hostRef(): RefObject<HTMLDivElement | null> {
  return { current: document.createElement('div') };
}

beforeEach(() => {
  vi.clearAllMocks();
  engineMock.onHover = null;
  engineMock.onSelect = null;
  engineMock.constructor.mockImplementation(((
    _host: HTMLElement,
    callbacks: { onHover: (info: unknown) => void; onSelect: (selection: unknown) => void }
  ) => {
    engineMock.onHover = callbacks.onHover;
    engineMock.onSelect = callbacks.onSelect;
    return engineMock.engine;
  }) as never);
});

describe('useCityEngine', () => {
  it('constructs the engine with the host element and hover/select callbacks', () => {
    const ref = hostRef();

    renderHook(() => useCityEngine(ref));

    expect(engineMock.constructor).toHaveBeenCalledTimes(1);
    expect(engineMock.constructor.mock.calls[0][0]).toBe(ref.current);
    expect(typeof engineMock.onHover).toBe('function');
    expect(typeof engineMock.onSelect).toBe('function');
  });

  it('mirrors engine hover and selection events into state', () => {
    const ref = hostRef();
    const { result } = renderHook(() => useCityEngine(ref));

    act(() => engineMock.onHover?.({ districtName: 'canal' }));
    expect(result.current.hoverInfo).toEqual({ districtName: 'canal' });

    act(() => engineMock.onSelect?.({ districtName: 'canal' }));
    expect(result.current.selection).toEqual({ districtName: 'canal' });
  });

  it('selects and clears a district, forwarding both to the engine', () => {
    const ref = hostRef();
    const { result } = renderHook(() => useCityEngine(ref));

    act(() => result.current.select({ districtName: 'canal' } as never));
    expect(result.current.selection).toEqual({ districtName: 'canal' });
    expect(engineMock.engine.setSelection).toHaveBeenCalledWith({ districtName: 'canal' }, true);

    act(() => result.current.clearSelection());
    expect(result.current.selection).toBeNull();
    expect(engineMock.engine.setSelection).toHaveBeenLastCalledWith(null, true);
  });

  it('tracks and forwards the highlighted language', () => {
    const ref = hostRef();
    const { result } = renderHook(() => useCityEngine(ref));

    act(() => result.current.highlightLanguage('Rust'));
    expect(result.current.highlightedLanguage).toBe('Rust');
    expect(engineMock.engine.setHighlightedLanguage).toHaveBeenCalledWith('Rust');

    act(() => result.current.highlightLanguage(null));
    expect(result.current.highlightedLanguage).toBeNull();
    expect(engineMock.engine.setHighlightedLanguage).toHaveBeenLastCalledWith(null);
  });

  it('disposes the engine on unmount', () => {
    const ref = hostRef();
    const { unmount } = renderHook(() => useCityEngine(ref));

    unmount();

    expect(engineMock.engine.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not construct an engine without a host element', () => {
    const ref: RefObject<HTMLDivElement | null> = { current: null };

    const { result } = renderHook(() => useCityEngine(ref));

    expect(engineMock.constructor).not.toHaveBeenCalled();
    expect(result.current.engineRef.current).toBeNull();
  });

  it('keeps the engine ref pointed at the live instance', () => {
    const ref = hostRef();
    const { result } = renderHook(() => useCityEngine(ref));

    expect(result.current.engineRef.current).toBe(engineMock.engine as unknown as CitySceneEngine);
  });
});
