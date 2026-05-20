import React from 'react';

import {ItemSelector} from '@gravity-ui/components';

import {cn} from '../../../../utils/cn';
import type {Column} from '../types';

import './SecondaryKeyField.scss';

interface SecondaryKeyFieldProps {
    value: string[];
    onChange: (value: string[]) => void;
    columns: Column[];
    invalid?: boolean;
    disabled?: boolean;
}

const b = cn('ydb-table-form-secondary-key');

const getColumnId = (item: Column) => item.name;

function renderColumnLabel(item: Column) {
    return (
        <span>
            {item.name}
            <span className={b('type')}> ({item.type})</span>
        </span>
    );
}

export function SecondaryKeyField({
    value,
    onChange,
    columns,
    invalid,
    disabled,
}: SecondaryKeyFieldProps) {
    const items = React.useMemo(() => columns.filter(({name}) => Boolean(name)), [columns]);

    React.useEffect(() => {
        if (!value.length) {
            return;
        }
        const available = new Set(items.map(getColumnId));
        const allPresent = value.every((id) => available.has(id));
        if (!allPresent) {
            onChange(value.filter((id) => available.has(id)));
        }
    }, [items, value, onChange]);

    return (
        <div className={b({invalid})}>
            <ItemSelector
                items={items}
                value={value}
                onUpdate={onChange}
                getItemId={getColumnId}
                renderItemValue={renderColumnLabel}
                renderItem={renderColumnLabel}
                hideSelected
                hideSelectAllButton
            />
            {disabled ? <div className={b('overlay')} /> : null}
        </div>
    );
}
