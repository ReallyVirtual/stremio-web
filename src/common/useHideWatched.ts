// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useSyncExternalStore } from 'react';

// "Hide watched items" is a client preference: it hides items core marks as watched
// from the Board rows, Discover, Search and Library. It lives in localStorage rather
// than the profile settings so it needs no core change.
const STORAGE_KEY = 'hideWatched';

const listeners = new Set<() => void>();

const read = (): boolean => {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

let hideWatched = read();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = () => hideWatched;

const setHideWatched = (value: boolean) => {
    hideWatched = value;
    try {
        window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
        // Storage unavailable: the preference still applies for this session.
    }
    listeners.forEach((listener) => listener());
};

const useHideWatched = (): [boolean, (value: boolean) => void] => {
    const value = useSyncExternalStore(subscribe, getSnapshot);
    const update = useCallback((value: boolean) => setHideWatched(value), []);
    return [value, update];
};

export default useHideWatched;
