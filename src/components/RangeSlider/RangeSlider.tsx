// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import styles from './RangeSlider.less';

type Range = [number, number];

type Props = {
    className?: string;
    min: number;
    max: number;
    step?: number;
    value: Range;
    disabled?: boolean;
    formatValue?: (value: number) => string;
    onChange: (value: Range) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const RangeSlider = ({ className, min, max, step = 1, value, disabled, formatValue, onChange }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeThumbRef = useRef<0 | 1 | null>(null);
    const [low, high] = [clamp(Math.min(...value), min, max), clamp(Math.max(...value), min, max)];
    const span = Math.max(max - min, 1);

    const valueForClientX = useCallback((clientX: number) => {
        if (containerRef.current === null) {
            return min;
        }

        const { x, width } = containerRef.current.getBoundingClientRect();
        const ratio = clamp((clientX - x) / Math.max(width, 1), 0, 1);
        return clamp(Math.round((ratio * span + min) / step) * step, min, max);
    }, [min, max, step, span]);

    const update = useCallback((thumb: 0 | 1, next: number) => {
        if (thumb === 0) {
            onChange([Math.min(next, high), high]);
        } else {
            onChange([low, Math.max(next, low)]);
        }
    }, [low, high, onChange]);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0) {
            return;
        }

        const next = valueForClientX(event.clientX);
        const thumb: 0 | 1 = Math.abs(next - low) <= Math.abs(next - high) && !(next > high) ? 0 : 1;
        activeThumbRef.current = thumb;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(thumb, next);
        event.preventDefault();
    }, [disabled, low, high, valueForClientX, update]);

    const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (activeThumbRef.current === null) {
            return;
        }

        update(activeThumbRef.current, valueForClientX(event.clientX));
    }, [valueForClientX, update]);

    const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (activeThumbRef.current === null) {
            return;
        }

        activeThumbRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);

    const onThumbKeyDown = useCallback((thumb: 0 | 1) => (event: React.KeyboardEvent<HTMLDivElement>) => {
        const current = thumb === 0 ? low : high;
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? step
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step
                : event.key === 'Home' ? min - current
                    : event.key === 'End' ? max - current
                        : null;
        if (delta === null) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        update(thumb, clamp(current + delta, min, max));
    }, [low, high, min, max, step, update]);

    const lowPosition = ((low - min) / span) * 100;
    const highPosition = ((high - min) / span) * 100;
    const format = formatValue ?? String;

    return (
        <div
            ref={containerRef}
            className={classnames(className, styles['range-slider'], { [styles['disabled']]: disabled })}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div className={styles['track']} />
            <div className={styles['track-selected']} style={{ left: `${lowPosition}%`, width: `${highPosition - lowPosition}%` }} />
            {
                ([[0, low, lowPosition], [1, high, highPosition]] as [0 | 1, number, number][]).map(([thumb, thumbValue, position]) => (
                    <div
                        key={thumb}
                        className={styles['thumb']}
                        style={{ left: `${position}%` }}
                        role={'slider'}
                        tabIndex={disabled ? -1 : 0}
                        aria-valuemin={min}
                        aria-valuemax={max}
                        aria-valuenow={thumbValue}
                        aria-valuetext={format(thumbValue)}
                        onKeyDown={onThumbKeyDown(thumb)}
                    />
                ))
            }
        </div>
    );
};

export default RangeSlider;
