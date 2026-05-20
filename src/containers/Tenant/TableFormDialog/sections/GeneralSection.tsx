import React from 'react';

import {SegmentedRadioGroup, Text, TextInput} from '@gravity-ui/uikit';
import {Controller, useFormContext, useWatch} from 'react-hook-form';

import {cn} from '../../../../utils/cn';
import {FormRow, FormSection} from '../components/layout';
import i18n from '../i18n';
import type {FormMode, FormValues, TableType} from '../types';

const b = cn('ydb-table-form-dialog');

interface GeneralSectionProps {
    mode: FormMode;
}

const tableTypeInfo: Record<TableType, string> = {
    row: i18n('label_info-table-type_row'),
    column: i18n('label_info-table-type_column'),
    document: '',
};

export function GeneralSection({mode}: GeneralSectionProps) {
    const {control, formState} = useFormContext<FormValues>();
    const type = useWatch({control, name: 'type'});

    const typeOptions = React.useMemo(
        () => [
            {value: 'row' as const, content: i18n('label_row-table')},
            {value: 'column' as const, content: i18n('label_column-table')},
        ],
        [],
    );

    const nameError = formState.errors.name?.message;
    const nameDisabled = mode === 'update' && type === 'column';
    const typeDisabled = mode === 'update';

    return (
        <FormSection title={i18n('label_section-general')}>
            <FormRow title={i18n('field_name')} required htmlFor="table-form-name">
                <Controller
                    control={control}
                    name="name"
                    render={({field}) => (
                        <TextInput
                            id="table-form-name"
                            value={field.value ?? ''}
                            onUpdate={field.onChange}
                            autoComplete={false}
                            disabled={nameDisabled}
                            validationState={nameError ? 'invalid' : undefined}
                            errorMessage={nameError}
                            autoFocus={mode === 'create'}
                        />
                    )}
                />
            </FormRow>
            <FormRow title={i18n('field_type')}>
                <div className={b('control-stack')}>
                    <Controller
                        control={control}
                        name="type"
                        render={({field}) => (
                            <SegmentedRadioGroup
                                value={field.value}
                                onUpdate={field.onChange}
                                disabled={typeDisabled}
                            >
                                {typeOptions.map((option) => (
                                    <SegmentedRadioGroup.Option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.content}
                                    </SegmentedRadioGroup.Option>
                                ))}
                            </SegmentedRadioGroup>
                        )}
                    />
                    {mode === 'create' && type && tableTypeInfo[type] ? (
                        <Text as="div" color="secondary" className={b('table-type-info')}>
                            {tableTypeInfo[type]}
                        </Text>
                    ) : null}
                </div>
            </FormRow>
        </FormSection>
    );
}
