// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const { default: toPath } = require('stremio-router/toPath');
const { useGoBack } = require('stremio-router');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button, Image, MultiselectMenu, RangeSlider } = require('stremio/components');
const { useCore } = require('stremio/core');
const Stream = require('./Stream');
const styles = require('./styles');
const { usePlatform, useProfile } = require('stremio/common');
const { default: SeasonEpisodePicker } = require('../EpisodePicker');
const { ANY_KEY, MULTI_LANGUAGE_KEY, SIZE_STOPS, SEEDS_STOPS, boundsToStops, collectLanguages, countActiveFilters, languageOptionLabel, matchesFilters, stopsToBounds, useStreamFilters } = require('./streamFilters');

const ALL_ADDONS_KEY = 'ALL';

const StreamsList = ({ className, video, type, externalPlayerCallbackCanMarkWatched, onEpisodeSearch, ...props }) => {
    const { t } = useTranslation();
    const core = useCore();
    const platform = usePlatform();
    const profile = useProfile();
    const navigate = useNavigate();
    const goBack = useGoBack();
    const streamsContainerRef = React.useRef(null);
    const [selectedAddon, setSelectedAddon] = React.useState(ALL_ADDONS_KEY);
    const [streamFilters, updateStreamFilters] = useStreamFilters();
    const scrollToTop = React.useCallback(() => {
        streamsContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: platform.name === 'ios' ? 'smooth' : 'instant' });
    }, [platform]);
    const onAddonSelected = React.useCallback((value) => {
        scrollToTop();
        setSelectedAddon(value);
    }, [scrollToTop]);
    const onSizeChange = React.useCallback((range) => {
        const [sizeMin, sizeMax] = stopsToBounds(SIZE_STOPS, range);
        scrollToTop();
        updateStreamFilters({ sizeMin, sizeMax });
    }, [scrollToTop, updateStreamFilters]);
    const onSeedsChange = React.useCallback((range) => {
        const [seedsMin, seedsMax] = stopsToBounds(SEEDS_STOPS, range);
        scrollToTop();
        updateStreamFilters({ seedsMin, seedsMax });
    }, [scrollToTop, updateStreamFilters]);
    const toggleFiltersPanel = React.useCallback(() => {
        updateStreamFilters({ panelOpen: !streamFilters.panelOpen });
    }, [streamFilters.panelOpen, updateStreamFilters]);
    const onLanguageSelected = React.useCallback((value) => {
        scrollToTop();
        updateStreamFilters({ language: value });
    }, [scrollToTop, updateStreamFilters]);
    const showInstallAddonsButton = React.useMemo(() => {
        return !profile || profile.auth === null || profile.auth?.user?.isNewUser === true && !video?.upcoming;
    }, [profile, video]);
    const backButtonOnClick = React.useCallback(() => {
        if (video.deepLinks && typeof video.deepLinks.metaDetailsVideos === 'string') {
            const navigateTo = `${video.deepLinks.metaDetailsVideos}${
                typeof video.season === 'number'
                    ? `?${new URLSearchParams({ 'season': video.season })}`
                    : ''}`;
            navigate(toPath(navigateTo), { replace: true });
        } else {
            goBack();
        }
    }, [video, navigate, goBack]);
    const countLoadingAddons = React.useMemo(() => {
        return props.streams.filter((stream) => stream.content.type === 'Loading').length;
    }, [props.streams]);
    const streamsByAddon = React.useMemo(() => {
        return props.streams
            .filter((streams) => streams.content.type === 'Ready')
            .reduce((streamsByAddon, streams) => {
                streamsByAddon[streams.addon.transportUrl] = {
                    addon: streams.addon,
                    streams: streams.content.content.map((stream) => ({
                        ...stream,
                        onClick: () => {
                            core.transport.analytics({
                                event: 'StreamClicked',
                                args: {
                                    stream
                                }
                            });
                            if (profile.settings.playerType !== null) {
                                core.transport.dispatch({
                                    action: 'MetaDetails',
                                    args: {
                                        action: 'ExternalPlayerStreamOpened',
                                        args: stream
                                    }
                                });
                            }
                        },
                        addonName: streams.addon.manifest.name
                    }))
                };

                return streamsByAddon;
            }, {});
    }, [props.streams, profile.settings.playerType]);
    const effectiveSelectedAddon = Object.prototype.hasOwnProperty.call(streamsByAddon, selectedAddon) ? selectedAddon : ALL_ADDONS_KEY;
    const filteredStreams = React.useMemo(() => {
        return effectiveSelectedAddon === ALL_ADDONS_KEY ?
            Object.values(streamsByAddon).map(({ streams }) => streams).flat(1)
            :
            streamsByAddon[effectiveSelectedAddon].streams;
    }, [streamsByAddon, effectiveSelectedAddon]);
    const streamLanguages = React.useMemo(() => collectLanguages(filteredStreams), [filteredStreams]);
    const effectiveStreamFilters = React.useMemo(() => ({
        ...streamFilters,
        language: streamLanguages.includes(streamFilters.language) ? streamFilters.language : ANY_KEY
    }), [streamFilters, streamLanguages]);
    const visibleStreams = React.useMemo(() => {
        return filteredStreams.filter((stream) => matchesFilters(stream, effectiveStreamFilters));
    }, [filteredStreams, effectiveStreamFilters]);
    const hiddenStreamsCount = filteredStreams.length - visibleStreams.length;
    const activeFiltersCount = countActiveFilters(effectiveStreamFilters);
    const sizeRange = React.useMemo(() => {
        return boundsToStops(SIZE_STOPS, streamFilters.sizeMin, streamFilters.sizeMax);
    }, [streamFilters.sizeMin, streamFilters.sizeMax]);
    const seedsRange = React.useMemo(() => {
        return boundsToStops(SEEDS_STOPS, streamFilters.seedsMin, streamFilters.seedsMax);
    }, [streamFilters.seedsMin, streamFilters.seedsMax]);
    const formatSizeStop = React.useCallback((index) => {
        return SIZE_STOPS[index] === Infinity ? '∞' : `${SIZE_STOPS[index]} GB`;
    }, []);
    const formatSeedsStop = React.useCallback((index) => {
        return SEEDS_STOPS[index] === Infinity ? '∞' : `${SEEDS_STOPS[index]}`;
    }, []);
    const formatRange = React.useCallback((stops, [low, high], format) => {
        return low === 0 && high === stops.length - 1 ?
            t('STREAMS_FILTER_ANY', { defaultValue: 'Any' })
            :
            `${format(low)} – ${format(high)}`;
    }, [t]);
    const languageOptions = React.useMemo(() => ({
        options: [
            { value: ANY_KEY, label: t('STREAMS_FILTER_LANGUAGE_ANY', { defaultValue: 'Any language' }), title: t('STREAMS_FILTER_LANGUAGE_ANY', { defaultValue: 'Any language' }) },
            ...streamLanguages.map((language) => {
                const label = language === MULTI_LANGUAGE_KEY ?
                    `🌐 ${t('STREAMS_FILTER_LANGUAGE_MULTI', { defaultValue: 'Multi-language' })}`
                    :
                    languageOptionLabel(language);
                return { value: language, label, title: label };
            })
        ],
        value: effectiveStreamFilters.language,
        onSelect: onLanguageSelected
    }), [streamLanguages, effectiveStreamFilters.language, onLanguageSelected, t]);
    const selectableOptions = React.useMemo(() => {
        return {
            options: [
                {
                    value: ALL_ADDONS_KEY,
                    label: t('ALL_ADDONS'),
                    title: t('ALL_ADDONS')
                },
                ...Object.keys(streamsByAddon).map((transportUrl) => ({
                    value: transportUrl,
                    label: streamsByAddon[transportUrl].addon.manifest.name,
                    title: streamsByAddon[transportUrl].addon.manifest.name,
                }))
            ],
            value: effectiveSelectedAddon,
            onSelect: onAddonSelected
        };
    }, [streamsByAddon, effectiveSelectedAddon, onAddonSelected, t]);

    const handleEpisodePicker = React.useCallback((season, episode) => {
        onEpisodeSearch(season, episode);
    }, [onEpisodeSearch]);

    return (
        <div className={classnames(className, styles['streams-list-container'])}>
            <div className={styles['select-choices-wrapper']}>
                {
                    video ?
                        <React.Fragment>
                            <Button className={classnames(styles['button-container'], styles['back-button-container'])} tabIndex={0} onClick={backButtonOnClick}>
                                <Icon className={styles['icon']} name={'chevron-back'} />
                            </Button>
                            <div className={styles['episode-title']}>
                                {typeof video.season === 'number' && typeof video.episode === 'number'
                                    ? `S${video.season}E${video.episode}${video.title ? ` ${video.title}` : ''}`
                                    : (video.title ?? '')}
                            </div>
                        </React.Fragment>
                        :
                        null
                }
                {
                    Object.keys(streamsByAddon).length > 1 ?
                        <MultiselectMenu
                            {...selectableOptions}
                            className={styles['select-input-container']}
                        />
                        :
                        null
                }
                {
                    Object.keys(streamsByAddon).length > 0 ?
                        <Button className={classnames(styles['button-container'], styles['filters-button-container'], { 'active': streamFilters.panelOpen })} title={t('STREAMS_FILTERS', { defaultValue: 'Filters' })} tabIndex={0} onClick={toggleFiltersPanel}>
                            <Icon className={styles['icon']} name={'filters-outline'} />
                            {
                                activeFiltersCount > 0 ?
                                    <div className={styles['badge']}>{activeFiltersCount}</div>
                                    :
                                    null
                            }
                        </Button>
                        :
                        null
                }
            </div>
            {
                streamFilters.panelOpen && Object.keys(streamsByAddon).length > 0 ?
                    <div className={styles['filters-panel']}>
                        <div className={styles['filter-row']}>
                            <div className={styles['filter-label']}>{t('STREAMS_FILTER_SIZE', { defaultValue: 'Size' })}</div>
                            <RangeSlider
                                className={styles['filter-slider']}
                                min={0}
                                max={SIZE_STOPS.length - 1}
                                value={sizeRange}
                                formatValue={formatSizeStop}
                                onChange={onSizeChange}
                            />
                            <div className={styles['filter-value']}>{formatRange(SIZE_STOPS, sizeRange, formatSizeStop)}</div>
                        </div>
                        <div className={styles['filter-row']}>
                            <div className={styles['filter-label']}>{t('STREAMS_FILTER_SEEDS', { defaultValue: 'Seeds' })}</div>
                            <RangeSlider
                                className={styles['filter-slider']}
                                min={0}
                                max={SEEDS_STOPS.length - 1}
                                value={seedsRange}
                                formatValue={formatSeedsStop}
                                onChange={onSeedsChange}
                            />
                            <div className={styles['filter-value']}>{formatRange(SEEDS_STOPS, seedsRange, formatSeedsStop)}</div>
                        </div>
                        {
                            streamLanguages.length > 0 ?
                                <div className={styles['filter-row']}>
                                    <div className={styles['filter-label']}>{t('STREAMS_FILTER_LANGUAGE', { defaultValue: 'Language' })}</div>
                                    <MultiselectMenu
                                        {...languageOptions}
                                        className={styles['filter-input-container']}
                                    />
                                </div>
                                :
                                null
                        }
                    </div>
                    :
                    null
            }
            {
                props.streams.length === 0 ?
                    <div className={styles['message-container']}>
                        {
                            type === 'series' ?
                                <SeasonEpisodePicker className={styles['search']} onSubmit={handleEpisodePicker} />
                                : null
                        }
                        <Image className={styles['image']} src={require('/assets/images/empty.png')} alt={' '} />
                        <div className={styles['label']}>{t('ERR_NO_ADDONS_FOR_STREAMS')}</div>
                    </div>
                    :
                    props.streams.every((streams) => streams.content.type === 'Err') ?
                        <div className={styles['message-container']}>
                            {
                                type === 'series' ?
                                    <SeasonEpisodePicker className={styles['search']} onSubmit={handleEpisodePicker} />
                                    : null
                            }
                            {
                                video?.upcoming ?
                                    <div className={styles['label']}>{t('UPCOMING')}...</div>
                                    : null
                            }
                            <Image className={styles['image']} src={require('/assets/images/empty.png')} alt={' '} />
                            <div className={styles['label']}>{t('NO_STREAM')}</div>
                            {
                                showInstallAddonsButton ?
                                    <Button className={styles['install-button-container']} title={t('ADDON_CATALOGUE_MORE')} href={'#/addons'}>
                                        <Icon className={styles['icon']} name={'addons'} />
                                        <div className={styles['label']}>{t('ADDON_CATALOGUE_MORE')}</div>
                                    </Button>
                                    :
                                    null
                            }
                        </div>
                        :
                        filteredStreams.length === 0 ?
                            <div className={styles['streams-container']}>
                                <Stream.Placeholder />
                                <Stream.Placeholder />
                            </div>
                            :
                            <React.Fragment>
                                <div className={styles['streams-container']} ref={streamsContainerRef}>
                                    {visibleStreams.map((stream, index) => (
                                        <Stream
                                            key={index}
                                            videoId={video?.id}
                                            videoReleased={video?.released}
                                            addonName={stream.addonName}
                                            name={stream.name}
                                            description={stream.description}
                                            thumbnail={stream.thumbnail}
                                            progress={stream.progress}
                                            deepLinks={stream.deepLinks}
                                            externalPlayerCallbackCanMarkWatched={externalPlayerCallbackCanMarkWatched}
                                            onClick={stream.onClick}
                                        />
                                    ))}
                                    {
                                        showInstallAddonsButton ?
                                            <Button className={styles['install-button-container']} title={t('ADDON_CATALOGUE_MORE')} href={'#/addons'}>
                                                <Icon className={styles['icon']} name={'addons'} />
                                                <div className={styles['label']}>{t('ADDON_CATALOGUE_MORE')}</div>
                                            </Button>
                                            :
                                            null
                                    }
                                    {
                                        hiddenStreamsCount > 0 ?
                                            <div className={styles['hidden-streams']}>
                                                {t('STREAMS_FILTER_HIDDEN', { defaultValue: '{{count}} streams hidden by the filters', count: hiddenStreamsCount })}
                                            </div>
                                            :
                                            null
                                    }
                                </div>
                                {
                                    countLoadingAddons > 0 ?
                                        <div className={styles['addons-loading-container']}>
                                            <div className={styles['addons-loading']}>
                                                {countLoadingAddons} {t('MOBILE_ADDONS_LOADING')}
                                            </div>
                                            <span className={styles['addons-loading-bar']}></span>
                                        </div>
                                        :
                                        null
                                }
                            </React.Fragment>
            }
        </div>
    );
};

StreamsList.propTypes = {
    className: PropTypes.string,
    streams: PropTypes.arrayOf(PropTypes.object).isRequired,
    video: PropTypes.object,
    type: PropTypes.string,
    externalPlayerCallbackCanMarkWatched: PropTypes.bool,
    onEpisodeSearch: PropTypes.func
};

module.exports = StreamsList;
