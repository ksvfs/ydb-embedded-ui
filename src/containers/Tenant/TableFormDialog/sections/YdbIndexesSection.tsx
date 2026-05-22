import React from 'react';

import {ArrowUturnCcwLeft, Plus, TrashBin} from '@gravity-ui/icons';
import {Button, HelpMark, Icon, Text, TextInput} from '@gravity-ui/uikit';
import {Controller, useFieldArray, useFormContext, useWatch} from 'react-hook-form';

import {cn} from '../../../../utils/cn';
import {ColumnSelectorField} from '../components/ColumnSelectorField';
import {FormSection} from '../components/layout';
import {YDB_PK_TYPES} from '../constants';
import i18n from '../i18n';
import type {Column, FormMode, FormValues, OriginalTableInfo} from '../types';

const b = cn('ydb-table-form-dialog');

interface YdbIndexesSectionProps {
    mode: FormMode;
    originalInfo?: OriginalTableInfo;
}

export function YdbIndexesSection({mode, originalInfo}: YdbIndexesSectionProps) {
    const {control, setValue, formState} = useFormContext<FormValues>();
    const {
        fields: newIndexFields,
        append,
        remove,
    } = useFieldArray({
        control,
        name: 'secondaryIndexes',
    });
    const {fields: updatedIndexFields} = useFieldArray({
        control,
        name: 'updatedSecondaryIndexes',
    });
    const formColumns = useWatch({control, name: 'columns'});
    const deletedColumns = useWatch({control, name: 'deletedColumns'});

    const availableColumns = React.useMemo<Column[]>(() => {
        const deletedNames = new Set(deletedColumns.map(({name}) => name));
        const merged: Column[] = [];
        if (originalInfo) {
            originalInfo.columns.forEach((column) => {
                if (!deletedNames.has(column.name)) {
                    merged.push(column);
                }
            });
        }
        formColumns.forEach((column) => {
            if (column.name) {
                merged.push(column);
            }
        });
        return merged.filter(({type}) => YDB_PK_TYPES.has(type));
    }, [originalInfo, formColumns, deletedColumns]);

    const hasAnyIndex = newIndexFields.length > 0 || updatedIndexFields.length > 0;

    const handleAddIndex = React.useCallback(() => {
        append({name: '', key: []});
    }, [append]);

    return (
        <FormSection title={i18n('label_indexes')}>
            <div className={b('indexes-table')}>
                {hasAnyIndex ? (
                    <div className={b('indexes-head')}>
                        <div>{i18n('column_name')}</div>
                        <div className={b('columns-head-cell')}>
                            {i18n('column_index-key')}
                            <HelpMark
                                className={b('help-mark')}
                                popoverProps={{placement: ['bottom', 'top']}}
                            >
                                {i18n('tooltip_index-key')}
                            </HelpMark>
                        </div>
                        <div />
                    </div>
                ) : null}

                {mode === 'update' && updatedIndexFields.length > 0 ? (
                    <React.Fragment>
                        {updatedIndexFields.map((field, index) => (
                            <UpdatedIndexRow
                                key={field.id}
                                index={index}
                                originalInfo={originalInfo}
                                onMarkDeleted={() =>
                                    setValue(`updatedSecondaryIndexes.${index}.isDeleted`, true, {
                                        shouldValidate: true,
                                    })
                                }
                                onUndoDeleted={() =>
                                    setValue(`updatedSecondaryIndexes.${index}.isDeleted`, false, {
                                        shouldValidate: true,
                                    })
                                }
                            />
                        ))}
                        {newIndexFields.length > 0 ? (
                            <hr className={b('columns-separator')} />
                        ) : null}
                    </React.Fragment>
                ) : null}

                {newIndexFields.map((field, index) => {
                    const nameError = formState.errors.secondaryIndexes?.[index]?.name?.message;
                    const keyError = formState.errors.secondaryIndexes?.[index]?.key?.message;
                    return (
                        <div key={field.id} className={b('indexes-row')}>
                            <div className={b('indexes-cell', {name: true})}>
                                <Controller
                                    control={control}
                                    name={`secondaryIndexes.${index}.name`}
                                    render={({field: nameField}) => (
                                        <TextInput
                                            value={nameField.value ?? ''}
                                            onUpdate={nameField.onChange}
                                            validationState={nameError ? 'invalid' : undefined}
                                            errorMessage={nameError}
                                        />
                                    )}
                                />
                            </div>
                            <div className={b('indexes-cell', {key: true})}>
                                <Controller
                                    control={control}
                                    name={`secondaryIndexes.${index}.key`}
                                    render={({field: keyField}) => (
                                        <React.Fragment>
                                            <ColumnSelectorField
                                                value={keyField.value ?? []}
                                                onChange={keyField.onChange}
                                                columns={availableColumns}
                                                invalid={Boolean(keyError)}
                                            />
                                            {keyError ? (
                                                <Text color="danger" variant="body-1">
                                                    {keyError}
                                                </Text>
                                            ) : null}
                                        </React.Fragment>
                                    )}
                                />
                            </div>
                            <div className={b('indexes-cell', {action: true})}>
                                <Button
                                    view="flat"
                                    size="m"
                                    onClick={() => remove(index)}
                                    title={i18n('action_delete')}
                                >
                                    <Icon data={TrashBin} size={16} />
                                </Button>
                            </div>
                        </div>
                    );
                })}

                <div className={b('columns-actions')}>
                    <Button onClick={handleAddIndex}>
                        <Icon data={Plus} size={16} />
                        {i18n('button_add-index')}
                    </Button>
                </div>
            </div>
        </FormSection>
    );
}

interface UpdatedIndexRowProps {
    index: number;
    originalInfo?: OriginalTableInfo;
    onMarkDeleted: () => void;
    onUndoDeleted: () => void;
}

function UpdatedIndexRow({
    index,
    originalInfo,
    onMarkDeleted,
    onUndoDeleted,
}: UpdatedIndexRowProps) {
    const {control, formState} = useFormContext<FormValues>();
    const item = useWatch({control, name: `updatedSecondaryIndexes.${index}`});
    const keyColumns = originalInfo?.indexes.find(({name}) => name === item.name)?.columns ?? [];
    const nameError = formState.errors.updatedSecondaryIndexes?.[index]?.newName?.message;

    return (
        <div className={b('indexes-row', {deleting: item.isDeleted})}>
            <div className={b('indexes-cell', {name: true})}>
                {item.isDeleted ? (
                    <Text className={b('readonly-text')}>{item.name}</Text>
                ) : (
                    <Controller
                        control={control}
                        name={`updatedSecondaryIndexes.${index}.newName`}
                        render={({field}) => (
                            <TextInput
                                value={field.value ?? ''}
                                onUpdate={field.onChange}
                                validationState={nameError ? 'invalid' : undefined}
                                errorMessage={nameError}
                            />
                        )}
                    />
                )}
            </div>
            <div className={b('indexes-cell', {key: true})}>
                <Text className={b('readonly-text')}>{keyColumns.join(', ')}</Text>
            </div>
            <div className={b('indexes-cell', {action: true})}>
                {item.isDeleted ? (
                    <Button
                        view="flat"
                        size="m"
                        onClick={onUndoDeleted}
                        title={i18n('action_undo')}
                    >
                        <Icon data={ArrowUturnCcwLeft} size={16} />
                    </Button>
                ) : (
                    <Button
                        view="flat"
                        size="m"
                        onClick={onMarkDeleted}
                        title={i18n('action_delete')}
                    >
                        <Icon data={TrashBin} size={16} />
                    </Button>
                )}
            </div>
        </div>
    );
}
