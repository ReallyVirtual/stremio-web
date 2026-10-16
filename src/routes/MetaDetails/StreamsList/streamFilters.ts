// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useState } from 'react';
import langs from 'langs';
import { toCode as toLanguageCode, label as languageLabel } from 'stremio/common/languages';

type FilterableStream = {
    name?: string | null;
    description?: string | null;
    behaviorHints?: { videoSize?: number | null } | null;
};

// Bounds are in GB and seeds; null means unbounded.
export type StreamFilters = {
    sizeMin: number | null;
    sizeMax: number | null;
    seedsMin: number | null;
    seedsMax: number | null;
    language: string;
    panelOpen: boolean;
};

export const ANY_KEY = 'ANY';
export const MULTI_LANGUAGE_KEY = 'MULTI';

// Stops of the two range sliders; the last one stands for "no limit".
export const SIZE_STOPS = [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, Infinity];
export const SEEDS_STOPS = [0, 5, 10, 20, 50, 100, 200, 500, 1000, Infinity];

const STORAGE_KEY = 'streamsListFilters';
const GB = 1024 * 1024 * 1024;
const SIZE_UNITS: Record<string, number> = {
    kb: 1024,
    mb: 1024 * 1024,
    gb: GB,
    tb: GB * 1024,
};

export const DEFAULT_FILTERS: StreamFilters = {
    sizeMin: null,
    sizeMax: null,
    seedsMin: null,
    seedsMax: null,
    language: ANY_KEY,
    panelOpen: false,
};

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
// labels come from the same table the player settings use. Streams without any tag are
// never hidden by the language filter.
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
// Flag shown next to a language in the dropdown: the first country listed for it above,
// plus the Indian languages that have no country of their own in that table.
const LANGUAGE_COUNTRIES: Record<string, string> = Object.entries(FLAG_LANGUAGES)
    .reduce((countries, [country, language]) => ({ [language]: country, ...countries }), {
        ta: 'IN', te: 'IN', ml: 'IN', kn: 'IN', mr: 'IN', pa: 'IN',
    });
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

const countryToFlag = (country: string): string => {
    return Array.from(country)
        .map((char) => String.fromCodePoint(char.charCodeAt(0) - 65 + REGIONAL_INDICATOR_BASE))
        .join('');
};

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

export const languageFlag = (language: string): string | null => {
    const country = Object.entries(LANGUAGE_COUNTRIES)
        .find(([alpha2]) => toLanguageCode(alpha2) === language)?.[1];
    return country ? countryToFlag(country) : null;
};

export const languageOptionLabel = (language: string): string => {
    const flag = languageFlag(language);
    return flag ? `${flag} ${languageLabel(language)}` : languageLabel(language);
};

const withinBounds = (value: number | null, min: number | null, max: number | null): boolean => {
    // Streams whose value cannot be determined are kept: the filters only drop
    // streams known to fall outside the chosen range.
    return value === null || ((min === null || value >= min) && (max === null || value <= max));
};

export const matchesFilters = (stream: FilterableStream, filters: StreamFilters): boolean => {
    if ((filters.sizeMin !== null || filters.sizeMax !== null) &&
        !withinBounds(parseSize(stream), filters.sizeMin === null ? null : filters.sizeMin * GB, filters.sizeMax === null ? null : filters.sizeMax * GB)) {
        return false;
    }

    if ((filters.seedsMin !== null || filters.seedsMax !== null) &&
        !withinBounds(parseSeeds(stream), filters.seedsMin, filters.seedsMax)) {
        return false;
    }

    if (filters.language !== ANY_KEY) {
        const languages = parseLanguages(stream);
        if (languages.length > 0 && !languages.includes(filters.language)) {
            return false;
        }
    }

    return true;
};

export const countActiveFilters = (filters: StreamFilters): number => {
    return [
        filters.sizeMin !== null || filters.sizeMax !== null,
        filters.seedsMin !== null || filters.seedsMax !== null,
        filters.language !== ANY_KEY,
    ].filter(Boolean).length;
};

// Slider positions are stop indexes; the bounds are stored as values so the stops can change.
export const boundsToStops = (stops: number[], min: number | null, max: number | null): [number, number] => {
    const indexOf = (value: number | null, fallback: number) => {
        if (value === null) {
            return fallback;
        }

        const index = stops.findIndex((stop) => stop >= value);
        return index === -1 ? stops.length - 1 : index;
    };

    return [indexOf(min, 0), indexOf(max, stops.length - 1)];
};

export const stopsToBounds = (stops: number[], [low, high]: [number, number]): [number | null, number | null] => {
    return [
        low <= 0 ? null : stops[low],
        high >= stops.length - 1 ? null : stops[high],
    ];
};

const readNumber = (value: unknown): number | null => {
    return typeof value === 'number' && isFinite(value) && value >= 0 ? value : null;
};

const readStoredFilters = (): StreamFilters => {
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
        return {
            sizeMin: readNumber(stored.sizeMin),
            sizeMax: readNumber(stored.sizeMax),
            seedsMin: readNumber(stored.seedsMin),
            seedsMax: readNumber(stored.seedsMax),
            language: typeof stored.language === 'string' ? stored.language : ANY_KEY,
            panelOpen: stored.panelOpen === true,
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
