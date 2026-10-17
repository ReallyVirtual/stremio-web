// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useSyncExternalStore } from 'react';

// A boolean client preference kept in localStorage, shared by every component that
// reads the same key. Preferences that need no core change live here rather than in
// the profile settings.
type Store = {
    value: boolean;
    listeners: Set<() => void>;
};

const stores = new Map<string, Store>();

const read = (key: string): boolean => {
    try {
        return window.localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
};

const getStore = (key: string): Store => {
    let store = stores.get(key);
    if (!store) {
        store = { value: read(key), listeners: new Set() };
        stores.set(key, store);
    }

    return store;
};

const setFlag = (key: string, value: boolean) => {
    const store = getStore(key);
    store.value = value;
    try {
        window.localStorage.setItem(key, String(value));
    } catch {
        // Storage unavailable: the preference still applies for this session.
    }
    store.listeners.forEach((listener) => listener());
};

const useStoredFlag = (key: string): [boolean, (value: boolean) => void] => {
    const store = getStore(key);
    const subscribe = useCallback((listener: () => void) => {
        store.listeners.add(listener);
        return () => {
            store.listeners.delete(listener);
        };
    }, [store]);
    const getSnapshot = useCallback(() => store.value, [store]);
    const value = useSyncExternalStore(subscribe, getSnapshot);
    const update = useCallback((value: boolean) => setFlag(key, value), [key]);
    return [value, update];
};

export default useStoredFlag;
