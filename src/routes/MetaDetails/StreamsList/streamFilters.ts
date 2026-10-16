// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useState } from 'react';

type FilterableStream = {
    name?: string | null;
    description?: string | null;
    behaviorHints?: { videoSize?: number | null } | null;
};

export type StreamFilters = {
    size: string;
    seeds: string;
};

export type StreamFilterOption = {
    value: string;
    labelKey: string;
    labelDefault: string;
    labelValues?: Record<string, number>;
};

export const ANY_KEY = 'ANY';

const STORAGE_KEY = 'streamsListFilters';
const GB = 1024 * 1024 * 1024;
const SIZE_UNITS: Record<string, number> = {
    kb: 1024,
    mb: 1024 * 1024,
    gb: GB,
    tb: GB * 1024,
};

const DEFAULT_FILTERS: StreamFilters = { size: ANY_KEY, seeds: ANY_KEY };

export const SIZE_OPTIONS: StreamFilterOption[] = [
    { value: ANY_KEY, labelKey: 'STREAMS_FILTER_SIZE_ANY', labelDefault: 'Any size' },
    ...[1, 2, 4, 8].map((size) => ({
        value: `MAX_${size}`,
        labelKey: 'STREAMS_FILTER_SIZE_MAX',
        labelDefault: 'Under {{size}} GB',
        labelValues: { size },
    })),
    ...[4, 8].map((size) => ({
        value: `MIN_${size}`,
        labelKey: 'STREAMS_FILTER_SIZE_MIN',
        labelDefault: 'Over {{size}} GB',
        labelValues: { size },
    })),
];

export const SEEDS_OPTIONS: StreamFilterOption[] = [
    { value: ANY_KEY, labelKey: 'STREAMS_FILTER_SEEDS_ANY', labelDefault: 'Any seeds' },
    ...[5, 20, 50, 100].map((count) => ({
        value: `MIN_${count}`,
        labelKey: 'STREAMS_FILTER_SEEDS_MIN',
        labelDefault: '{{count}}+ seeds',
        labelValues: { count },
    })),
];

// Addons have no structured seed field and most skip behaviorHints.videoSize,
// so both values are taken from the description text when needed.
const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*([kmgt])i?b\b/i;
const SEEDS_PATTERNS = [
    /(?:👤|👥|🌱)\s*(\d+)/u,
    /\bseed(?:er)?s?\s*[:=]?\s*(\d+)/i,
    /(\d+)\s*seed(?:er)?s?\b/i,
    /\bS\s*[:=]\s*(\d+)/,
];

const streamText = (stream: FilterableStream): string => {
    return `${stream.description ?? ''}\n${stream.name ?? ''}`;
};

export const parseSize = (stream: FilterableStream): number | null => {
    const hinted = stream.behaviorHints?.videoSize;
    if (typeof hinted === 'number' && hinted > 0) {
        return hinted;
    }

    const match = streamText(stream).match(SIZE_PATTERN);
    if (!match) {
        return null;
    }

    const value = parseFloat(match[1].replace(',', '.'));
    const unit = SIZE_UNITS[`${match[2].toLowerCase()}b`];
    return isNaN(value) ? null : value * unit;
};

export const parseSeeds = (stream: FilterableStream): number | null => {
    const text = streamText(stream);
    for (const pattern of SEEDS_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    return null;
};

const parseThreshold = (value: string): [string, number] | null => {
    const match = value.match(/^(MIN|MAX)_(\d+)$/);
    return match ? [match[1], parseInt(match[2], 10)] : null;
};

// Streams whose size or seeds cannot be determined are kept: the filters
// only drop streams known to fall outside the chosen range.
export const matchesFilters = (stream: FilterableStream, filters: StreamFilters): boolean => {
    const sizeThreshold = parseThreshold(filters.size);
    if (sizeThreshold) {
        const size = parseSize(stream);
        const [kind, gigabytes] = sizeThreshold;
        if (size !== null && (kind === 'MAX' ? size > gigabytes * GB : size < gigabytes * GB)) {
            return false;
        }
    }

    const seedsThreshold = parseThreshold(filters.seeds);
    if (seedsThreshold) {
        const seeds = parseSeeds(stream);
        if (seeds !== null && seeds < seedsThreshold[1]) {
            return false;
        }
    }

    return true;
};

const isOption = (options: StreamFilterOption[], value: unknown): value is string => {
    return options.some((option) => option.value === value);
};

const readStoredFilters = (): StreamFilters => {
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
        return {
            size: isOption(SIZE_OPTIONS, stored.size) ? stored.size : ANY_KEY,
            seeds: isOption(SEEDS_OPTIONS, stored.seeds) ? stored.seeds : ANY_KEY,
        };
    } catch {
        return DEFAULT_FILTERS;
    }
};

export const useStreamFilters = (): [StreamFilters, (filters: Partial<StreamFilters>) => void] => {
    const [filters, setFilters] = useState<StreamFilters>(readStoredFilters);

    const updateFilters = useCallback((update: Partial<StreamFilters>) => {
        setFilters((filters) => {
            const next = { ...filters, ...update };
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Storage unavailable: the filters still apply for this session.
            }
            return next;
        });
    }, []);

    return [filters, updateFilters];
};
