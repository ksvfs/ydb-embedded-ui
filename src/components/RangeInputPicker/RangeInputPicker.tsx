import React from 'react';

import {Slider, TextInput} from '@gravity-ui/uikit';

import {cn} from '../../utils/cn';

import './RangeInputPicker.scss';

const b = cn('ydb-range-input-picker');

type RangeInputPickerStyle = React.CSSProperties & {
    '--ydb-range-input-picker-input-width'?: string;
    '--ydb-range-input-picker-slider-min-width'?: string;
};

export interface RangeInputPickerProps {
    value?: number;
    min: number;
    max: number;
    step?: number;
    marks?: number[];
    markFormat?: (value: number) => string;
    onUpdate: (value: number | undefined) => void;
    acceptInputValue?: (value: string) => boolean;
    parseInputValue?: (value: string) => number | undefined;
    formatInputValue?: (value: number) => string;
    emptyValue?: number | undefined;
    disabled?: boolean;
    errorMessage?: string;
    endContent?: React.ReactNode;
    className?: string;
    inputWidth?: number | string;
    sliderMinWidth?: number | string;
}

function toDimensionValue(value: number | string | undefined) {
    if (typeof value === 'number') {
        return `${value}px`;
    }

    return value;
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
    emptyValue,
    disabled,
    errorMessage,
    endContent,
    className,
    inputWidth,
    sliderMinWidth,
}: RangeInputPickerProps) {
    const hasNumericValue = typeof value === 'number' && !Number.isNaN(value);

    const rootStyle = React.useMemo<RangeInputPickerStyle>(
        () => ({
            '--ydb-range-input-picker-input-width': toDimensionValue(inputWidth),
            '--ydb-range-input-picker-slider-min-width': toDimensionValue(sliderMinWidth),
        }),
        [inputWidth, sliderMinWidth],
    );

    const handleSliderUpdate = React.useCallback(
        (nextValue: number | number[]) => {
            onUpdate(Array.isArray(nextValue) ? nextValue[0] : nextValue);
        },
        [onUpdate],
    );

    const handleInputUpdate = React.useCallback(
        (nextValue: string) => {
            if (!acceptInputValue(nextValue)) {
                return;
            }

            onUpdate(nextValue === '' ? emptyValue : parseInputValue(nextValue));
        },
        [acceptInputValue, emptyValue, onUpdate, parseInputValue],
    );

    return (
        <div className={b(null, className)} style={rootStyle}>
            <Slider
                value={hasNumericValue ? value : min}
                min={min}
                max={max}
                step={step}
                marks={marks}
                markFormat={markFormat}
                onUpdate={handleSliderUpdate}
                disabled={disabled}
                className={b('slider')}
            />
            <TextInput
                value={hasNumericValue ? formatInputValue(value) : ''}
                onUpdate={handleInputUpdate}
                disabled={disabled}
                validationState={errorMessage ? 'invalid' : undefined}
                errorMessage={errorMessage}
                endContent={endContent}
                className={b('input')}
            />
        </div>
    );
}
