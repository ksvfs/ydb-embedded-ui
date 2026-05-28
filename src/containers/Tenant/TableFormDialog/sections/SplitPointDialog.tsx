import React from 'react';

import {Dialog, TextInput} from '@gravity-ui/uikit';

import type {ColumnValueField} from '../../../../store/reducers/table/types';
import {cn} from '../../../../utils/cn';
import i18n from '../i18n';
import type {Column, ColumnField} from '../types';
import {generateColumnId} from '../utils';

const b = cn('ydb-table-form-dialog');

export interface SplitPointDialogState {
    open: boolean;
    index: number;
    columns: Column[];
    values: Array<{
        column: Column;
        id: string;
        value: string;
    }>;
}

interface SplitPointDialogProps {
    state: SplitPointDialogState;
    onClose: () => void;
    onSubmit: (index: number, values: ColumnValueField[]) => void;
}

export function SplitPointDialog({state, onClose, onSubmit}: SplitPointDialogProps) {
    const [draftValues, setDraftValues] = React.useState(state.values);

    React.useEffect(() => {
        setDraftValues(state.values);
    }, [state.values]);

    const handleChange = (id: string, value: string) => {
        setDraftValues((prev) => prev.map((row) => (row.id === id ? {...row, value} : row)));
    };

    const handleSubmit = () => {
        onSubmit(
            state.index,
            draftValues.map((row) => ({
                id: row.id,
                isDefined: Boolean(row.value),
                value: row.value === '' ? null : row.value,
                name: row.column.name,
                type: row.column.type,
                notNull: row.column.notNull,
            })),
        );
        onClose();
    };

    return (
        <Dialog open={state.open} onClose={onClose} size="s">
            <Dialog.Header caption={i18n('title_split-point')} />
            <Dialog.Body className={b('split-point-body')}>
                {draftValues.map((row) => (
                    <div key={row.id} className={b('split-point-row')}>
                        <div className={b('split-point-label')}>
                            {row.column.name}
                            <span className={b('split-point-type')}> ({row.column.type})</span>
                        </div>
                        <TextInput
                            className={b('control')}
                            value={row.value}
                            onUpdate={(value) => handleChange(row.id, value)}
                        />
                    </div>
                ))}
            </Dialog.Body>
            <Dialog.Footer
                textButtonApply={i18n('action_update')}
                textButtonCancel={i18n('action_cancel')}
                onClickButtonApply={handleSubmit}
                onClickButtonCancel={onClose}
            />
        </Dialog>
    );
}

export function buildSplitPointEntries(
    pkColumns: ColumnField[],
    storedValues: ColumnValueField[] | undefined,
) {
    return pkColumns.map((column, idx) => {
        const stored = storedValues?.[idx];
        return {
            column: {
                name: column.name,
                type: column.type,
                notNull: column.notNull,
            },
            id: stored?.id ?? generateColumnId(),
            value:
                stored?.value === null || stored?.value === undefined ? '' : String(stored.value),
        };
    });
}
