// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useState } from 'react';
import langs from 'langs';
import { toCode as toLanguageCode, label as languageLabel } from 'stremio/common/languages';

type FilterableStream = {
    name?: string | null;
    description?: string | null;
    behaviorHints?: { videoSize?: number | null } | null;
};

export type StreamFilters = {
    size: string;
    seeds: string;
    language: string;
};

export type StreamFilterOption = {
    value: string;
    labelKey: string;
    labelDefault: string;
    labelValues?: Record<string, number>;
};

export const ANY_KEY = 'ANY';
export const MULTI_LANGUAGE_KEY = 'MULTI';

const STORAGE_KEY = 'streamsListFilters';
const GB = 1024 * 1024 * 1024;
const SIZE_UNITS: Record<string, number> = {
    kb: 1024,
    mb: 1024 * 1024,
    gb: GB,
    tb: GB * 1024,
};

const DEFAULT_FILTERS: StreamFilters = { size: ANY_KEY, seeds: ANY_KEY, language: ANY_KEY };

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

// Languages: addons tag them as flag emojis (Torrentio: 🇬🇧 / 🇮🇹), as names (MediaFusion,
// Comet: "Hindi", "Multi") or as "Dual Audio". Values are ISO 639-2 codes from `langs`, so
// labels come from the same table the player settings use. Untagged streams (most English-only
// torrents) have no language and are hidden once a specific language is chosen.
const FLAG_LANGUAGES: Record<string, string> = {
    GB: 'en', US: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es',
    PT: 'pt', BR: 'pt',
    DE: 'de', AT: 'de',
    CN: 'zh', TW: 'zh', HK: 'zh',
    SA: 'ar', AE: 'ar', EG: 'ar',
    IT: 'it', FR: 'fr', RU: 'ru', IN: 'hi', JP: 'ja', KR: 'ko', NL: 'nl', PL: 'pl', TR: 'tr',
    SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', GR: 'el', CZ: 'cs', HU: 'hu', RO: 'ro', UA: 'uk',
    IL: 'he', IR: 'fa', TH: 'th', VN: 'vi', ID: 'id', MY: 'ms', PK: 'ur', BD: 'bn', BG: 'bg',
    HR: 'hr', RS: 'sr', SK: 'sk', SI: 'sl', LT: 'lt', LV: 'lv', EE: 'et',
};
const FLAG_PATTERN = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const REGIONAL_INDICATOR_BASE = 0x1F1E6;
const SHORT_NAMES_ALLOWED = ['Thai', 'Urdu', 'Zulu'];
const MULTI_PATTERN = /\bmulti(?:[ -]?(?:audio|lang(?:uage)?s?|sub(?:s|titles)?))?\b|\bdual[ -]?audio\b/i;
const LANGUAGE_ALIASES: [RegExp, string][] = [
    [/\blatino\b|\bcastellano\b/i, 'es'],
    [/\bbrazilian\b/i, 'pt'],
    [/\bmandarin\b|\bcantonese\b/i, 'zh'],
];
const LANGUAGE_NAMES: [RegExp, string][] = [
    ...LANGUAGE_ALIASES,
    ...langs.all()
        .filter((lang) => !lang.name.includes('(') && (lang.name.length > 4 || SHORT_NAMES_ALLOWED.includes(lang.name)))
        .map((lang): [RegExp, string] => [new RegExp(`\\b${lang.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), lang['2']]),
];

const flagToCountry = (flag: string): string => {
    return Array.from(flag)
        .map((char) => String.fromCharCode((char.codePointAt(0) ?? 0) - REGIONAL_INDICATOR_BASE + 65))
        .join('');
};

const streamText = (stream: FilterableStream): string => {
    return `${stream.description ?? ''}\n${stream.name ?? ''}`;
};

export const parseLanguages = (stream: FilterableStream): string[] => {
    const text = streamText(stream);
    const languages = new Set<string>();

    for (const flag of text.match(FLAG_PATTERN) ?? []) {
        const language = FLAG_LANGUAGES[flagToCountry(flag)];
        if (language) {
            languages.add(toLanguageCode(language));
        }
    }

    for (const [pattern, language] of LANGUAGE_NAMES) {
        if (pattern.test(text)) {
            languages.add(toLanguageCode(language));
        }
    }

    if (MULTI_PATTERN.test(text)) {
        languages.add(MULTI_LANGUAGE_KEY);
    }

    return Array.from(languages);
};

export const collectLanguages = (streams: FilterableStream[]): string[] => {
    const languages = new Set<string>();
    streams.forEach((stream) => parseLanguages(stream).forEach((language) => languages.add(language)));
    return Array.from(languages).sort((a, b) => {
        return a === MULTI_LANGUAGE_KEY ? -1 : b === MULTI_LANGUAGE_KEY ? 1 : languageLabel(a).localeCompare(languageLabel(b));
    });
};

export const languageOptionLabel = (language: string): string => {
    return languageLabel(language);
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

    if (filters.language !== ANY_KEY && !parseLanguages(stream).includes(filters.language)) {
        return false;
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
            language: typeof stored.language === 'string' ? stored.language : ANY_KEY,
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
