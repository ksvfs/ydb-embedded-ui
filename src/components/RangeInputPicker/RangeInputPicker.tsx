import React from 'react';

import {Slider, TextInput} from '@gravity-ui/uikit';

import {cn} from '../../utils/cn';

import './RangeInputPicker.scss';

const b = cn('ydb-range-input-picker');

export interface RangeInputPickerProps {
    value?: number;
    min: number;
    max: number;
    step?: number;
    marks?: number[];
    markFormat?: (value: number) => string;
    onUpdate: (value: number) => void;
    acceptInputValue?: (value: string) => boolean;
    parseInputValue?: (value: string) => number | undefined;
    formatInputValue?: (value: number) => string;
    disabled?: boolean;
    endContent?: React.ReactNode;
    className?: string;
}

function defaultAcceptInputValue(value: string) {
    return /^\d*$/.test(value);
}

function defaultParseInputValue(value: string) {
    return Number.parseInt(value, 10);
}

function defaultFormatInputValue(value: number) {
    return String(value);
}

export function RangeInputPicker({
    value,
    min,
    max,
    step = 1,
    marks,
    markFormat,
    onUpdate,
    acceptInputValue = defaultAcceptInputValue,
    parseInputValue = defaultParseInputValue,
    formatInputValue = defaultFormatInputValue,
    disabled,
    endContent,
    className,
}: RangeInputPickerProps) {
    const hasNumericValue = typeof value === 'number' && Number.isFinite(value);
    const displayValue = hasNumericValue ? formatInputValue(value) : '';
    const [inputValue, setInputValue] = React.useState(displayValue);
    const [isInputFocused, setIsInputFocused] = React.useState(false);

    const sliderValue = hasNumericValue ? value : min;

    React.useEffect(() => {
        if (!isInputFocused) {
            setInputValue(displayValue);
        }
    }, [displayValue, isInputFocused]);

    const normalizeInputValue = React.useCallback(
        (nextValue: string) => {
            if (nextValue === '') {
                return hasNumericValue ? Math.min(Math.max(value, min), max) : min;
            }

            const parsedValue = parseInputValue(nextValue);

            if (typeof parsedValue !== 'number' || Number.isNaN(parsedValue)) {
                return hasNumericValue ? Math.min(Math.max(value, min), max) : min;
            }

            if (parsedValue < min) {
                return min;
            }

            if (parsedValue > max) {
                return max;
            }

            return parsedValue;
        },
        [hasNumericValue, max, min, parseInputValue, value],
    );

    const handleSliderUpdate = React.useCallback(
        (nextValue: number | number[]) => {
            const normalizedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;

            setInputValue(formatInputValue(normalizedValue));
            onUpdate(normalizedValue);
        },
        [formatInputValue, onUpdate],
    );

    const handleInputUpdate = React.useCallback(
        (nextValue: string) => {
            if (!acceptInputValue(nextValue)) {
                return;
            }

            setInputValue(nextValue);

            const parsedValue = parseInputValue(nextValue);
            if (
                typeof parsedValue === 'number' &&
                !Number.isNaN(parsedValue) &&
                parsedValue >= min &&
                parsedValue <= max
            ) {
                onUpdate(parsedValue);
            }
        },
        [acceptInputValue, max, min, onUpdate, parseInputValue],
    );

    const handleInputFocus = React.useCallback(() => {
        setIsInputFocused(true);
    }, []);

    const handleInputBlur = React.useCallback(() => {
        const normalizedValue = normalizeInputValue(inputValue);

        setIsInputFocused(false);
        setInputValue(formatInputValue(normalizedValue));
        onUpdate(normalizedValue);
    }, [formatInputValue, inputValue, normalizeInputValue, onUpdate]);

    return (
        <div className={b(null, className)}>
            <TextInput
                value={inputValue}
                onUpdate={handleInputUpdate}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                disabled={disabled}
                endContent={endContent}
                className={b('input')}
            />
            <Slider
                value={sliderValue}
                min={min}
                max={max}
                step={step}
                marks={marks}
                markFormat={markFormat}
                onUpdate={handleSliderUpdate}
                disabled={disabled}
                className={b('slider')}
            />
        </div>
    );
}
