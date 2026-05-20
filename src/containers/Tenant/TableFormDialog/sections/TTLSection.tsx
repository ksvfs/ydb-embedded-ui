import React from 'react';

import type {SelectOption} from '@gravity-ui/uikit';
import {SegmentedRadioGroup, Select, TextInput} from '@gravity-ui/uikit';
import {Controller, useFormContext, useWatch} from 'react-hook-form';

import {cn} from '../../../../utils/cn';
import {FormRow, FormSection} from '../components/layout';
import i18n from '../i18n';
import type {FormValues, OriginalTableInfo} from '../types';
import {
    acceptIntegerInput,
    epochModeOptions,
    isValidTtlNumType,
    isValidTtlType,
    lifetimeUnitOptions,
    ttlStatusOptions,
} from '../utils';

const b = cn('ydb-table-form-dialog');

interface TTLSectionProps {
    originalInfo?: OriginalTableInfo;
}

export function TTLSection({originalInfo}: TTLSectionProps) {
    const {control, setValue, formState} = useFormContext<FormValues>();

    const status = useWatch({control, name: 'settings.ttl.status'});
    const column = useWatch({control, name: 'settings.ttl.column'});
    const columnWithEpochMode = useWatch({control, name: 'settings.ttl.columnWithEpochMode'});
    const formColumns = useWatch({control, name: 'columns'});
    const deletedColumns = useWatch({control, name: 'deletedColumns'});

    const enabled = status === 'enabled';
    const isEpochMode = Boolean(columnWithEpochMode);

    const ttlColumns = React.useMemo(() => {
        const deletedNames = new Set(deletedColumns.map(({name}) => name));
        const combined = [...(originalInfo?.columns ?? []), ...formColumns];
        return combined.filter(
            ({name, type}) => name && isValidTtlType(type) && !deletedNames.has(name),
        );
    }, [originalInfo, formColumns, deletedColumns]);

    const columnOptions = React.useMemo<SelectOption[]>(() => {
        if (ttlColumns.length === 0) {
            return [
                {
                    value: '',
                    content: i18n('label_ttl-warning'),
                    disabled: true,
                },
            ];
        }
        return ttlColumns.map(({name}) => ({value: name, content: name}));
    }, [ttlColumns]);

    React.useEffect(() => {
        if (!enabled) {
            return;
        }
        const matchedType = ttlColumns.find(({name}) => name === column)?.type;
        const withEpochMode = Boolean(matchedType && isValidTtlNumType(matchedType));
        setValue('settings.ttl.columnWithEpochMode', withEpochMode, {shouldValidate: false});
        if (!withEpochMode) {
            setValue('settings.ttl.epochMode', undefined, {shouldValidate: false});
        }
    }, [enabled, column, ttlColumns, setValue]);

    React.useEffect(() => {
        if (!enabled) {
            return;
        }
        if (!column) {
            return;
        }
        if (!ttlColumns.some(({name}) => name === column)) {
            setValue('settings.ttl.column', undefined, {shouldValidate: false});
        }
    }, [enabled, column, ttlColumns, setValue]);

    const columnError = formState.errors.settings?.ttl?.column?.message;
    const epochError = formState.errors.settings?.ttl?.epochMode?.message;
    const lifetimeError = formState.errors.settings?.ttl?.lifetime?.message;

    return (
        <FormSection title={i18n('label_section-ttl')} note={i18n('tooltip_section-ttl')}>
            <FormRow title={i18n('field_ttl-status')}>
                <Controller
                    control={control}
                    name="settings.ttl.status"
                    render={({field}) => (
                        <SegmentedRadioGroup
                            value={field.value}
                            onUpdate={(value) => field.onChange(value)}
                        >
                            {ttlStatusOptions.map((option) => (
                                <SegmentedRadioGroup.Option key={option.value} value={option.value}>
                                    {option.content}
                                </SegmentedRadioGroup.Option>
                            ))}
                        </SegmentedRadioGroup>
                    )}
                />
            </FormRow>
            {enabled ? (
                <React.Fragment>
                    <FormRow
                        title={i18n('field_ttl-column')}
                        note={i18n('tooltip_ttl-column')}
                        required
                    >
                        <Controller
                            control={control}
                            name="settings.ttl.column"
                            render={({field}) => (
                                <Select
                                    value={field.value ? [field.value] : []}
                                    options={columnOptions}
                                    onUpdate={([value]) => field.onChange(value)}
                                    width="max"
                                    validationState={columnError ? 'invalid' : undefined}
                                />
                            )}
                        />
                        {columnError ? <div className={b('field-error')}>{columnError}</div> : null}
                    </FormRow>
                    {isEpochMode ? (
                        <FormRow
                            title={i18n('field_ttl-unit')}
                            note={i18n('tooltip_ttl-unit')}
                            required
                        >
                            <Controller
                                control={control}
                                name="settings.ttl.epochMode"
                                render={({field}) => (
                                    <Select
                                        value={field.value ? [field.value] : []}
                                        options={epochModeOptions}
                                        onUpdate={([value]) => field.onChange(value)}
                                        width="max"
                                        validationState={epochError ? 'invalid' : undefined}
                                    />
                                )}
                            />
                            {epochError ? (
                                <div className={b('field-error')}>{epochError}</div>
                            ) : null}
                        </FormRow>
                    ) : null}
                    <FormRow
                        title={i18n('field_ttl-lifetime')}
                        note={i18n('tooltip_ttl-lifetime')}
                        required
                    >
                        <div className={b('ttl-lifetime')}>
                            <Controller
                                control={control}
                                name="settings.ttl.lifetime"
                                render={({field}) => (
                                    <TextInput
                                        className={b('ttl-lifetime-input')}
                                        value={
                                            field.value === undefined || field.value === null
                                                ? ''
                                                : String(field.value)
                                        }
                                        onUpdate={(value) => {
                                            if (!acceptIntegerInput(value)) {
                                                return;
                                            }
                                            field.onChange(
                                                value === '' ? undefined : Number(value),
                                            );
                                        }}
                                        validationState={lifetimeError ? 'invalid' : undefined}
                                    />
                                )}
                            />
                            <Controller
                                control={control}
                                name="settings.ttl.unit"
                                render={({field}) => (
                                    <Select
                                        className={b('ttl-lifetime-select')}
                                        value={field.value ? [field.value] : ['seconds']}
                                        options={lifetimeUnitOptions}
                                        onUpdate={([value]) => field.onChange(value)}
                                    />
                                )}
                            />
                        </div>
                        {lifetimeError ? (
                            <div className={b('field-error')}>{lifetimeError}</div>
                        ) : null}
                    </FormRow>
                </React.Fragment>
            ) : null}
        </FormSection>
    );
}
