// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useNavigate } = require('react-router');
const { default: toPath } = require('stremio-router/toPath');
const { useGoBack } = require('stremio-router');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button, Image, MultiselectMenu } = require('stremio/components');
const { useCore } = require('stremio/core');
const Stream = require('./Stream');
const styles = require('./styles');
const { usePlatform, useProfile } = require('stremio/common');
const { default: SeasonEpisodePicker } = require('../EpisodePicker');
const { ANY_KEY, MULTI_LANGUAGE_KEY, SIZE_OPTIONS, SEEDS_OPTIONS, collectLanguages, languageOptionLabel, matchesFilters, useStreamFilters } = require('./streamFilters');

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
    const onSizeSelected = React.useCallback((value) => {
        scrollToTop();
        updateStreamFilters({ size: value });
    }, [scrollToTop, updateStreamFilters]);
    const onSeedsSelected = React.useCallback((value) => {
        scrollToTop();
        updateStreamFilters({ seeds: value });
    }, [scrollToTop, updateStreamFilters]);
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
    const filterOptions = React.useCallback((options) => {
        return options.map(({ value, labelKey, labelDefault, labelValues }) => {
            const label = t(labelKey, { defaultValue: labelDefault, ...labelValues });
            return { value, label, title: label };
        });
    }, [t]);
    const sizeOptions = React.useMemo(() => ({
        options: filterOptions(SIZE_OPTIONS),
        value: streamFilters.size,
        onSelect: onSizeSelected
    }), [filterOptions, streamFilters.size, onSizeSelected]);
    const seedsOptions = React.useMemo(() => ({
        options: filterOptions(SEEDS_OPTIONS),
        value: streamFilters.seeds,
        onSelect: onSeedsSelected
    }), [filterOptions, streamFilters.seeds, onSeedsSelected]);
    const languageOptions = React.useMemo(() => ({
        options: [
            ...filterOptions([{ value: ANY_KEY, labelKey: 'STREAMS_FILTER_LANGUAGE_ANY', labelDefault: 'Any language' }]),
            ...streamLanguages.map((language) => {
                const label = language === MULTI_LANGUAGE_KEY ?
                    t('STREAMS_FILTER_LANGUAGE_MULTI', { defaultValue: 'Multi-language' })
                    :
                    languageOptionLabel(language);
                return { value: language, label, title: label };
            })
        ],
        value: effectiveStreamFilters.language,
        onSelect: onLanguageSelected
    }), [filterOptions, streamLanguages, effectiveStreamFilters.language, onLanguageSelected, t]);
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
            </div>
            {
                Object.keys(streamsByAddon).length > 0 ?
                    <div className={styles['filters-wrapper']}>
                        <MultiselectMenu
                            {...sizeOptions}
                            className={styles['filter-input-container']}
                        />
                        <MultiselectMenu
                            {...seedsOptions}
                            className={styles['filter-input-container']}
                        />
                        {
                            streamLanguages.length > 0 ?
                                <MultiselectMenu
                                    {...languageOptions}
                                    className={styles['filter-input-container']}
                                />
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
