import React from 'react';

import {ItemSelector} from '@gravity-ui/components';
import {ChevronDown} from '@gravity-ui/icons';
import {Button, Icon, Popup} from '@gravity-ui/uikit';

import {cn} from '../../../../utils/cn';
import i18n from '../i18n';
import type {Column} from '../types';

import './ColumnSelectorField.scss';

interface ColumnSelectorFieldProps {
    value: string[];
    onChange: (value: string[]) => void;
    columns: Column[];
    invalid?: boolean;
}

const b = cn('ydb-table-form-column-selector');

const getColumnId = (item: Column) => item.name;

function renderColumnLabel(item: Column) {
    return (
        <span>
            {item.name}
            <span className={b('type')}> ({item.type})</span>
        </span>
    );
}

const filterColumnItem = (filter: string) => (item: Column) => {
    const lower = filter.toLowerCase();
    return item.name.toLowerCase().includes(lower) || item.type.toLowerCase().includes(lower);
};

export function ColumnSelectorField({value, onChange, columns, invalid}: ColumnSelectorFieldProps) {
    const [open, setOpen] = React.useState(false);
    const [currentValue, setCurrentValue] = React.useState<string[] | undefined>(undefined);
    const controlRef = React.useRef<HTMLButtonElement>(null);

    const items = React.useMemo(() => columns.filter(({name}) => Boolean(name)), [columns]);

    React.useEffect(() => {
        setCurrentValue(undefined);
    }, [value, columns]);

    const handleToggle = React.useCallback(() => {
        setOpen((prev) => !prev);
        setCurrentValue(undefined);
    }, []);

    const handleApply = React.useCallback(() => {
        setOpen(false);
        if (currentValue !== undefined) {
            onChange(currentValue);
        }
        setCurrentValue(undefined);
    }, [currentValue, onChange]);

    const handleCancel = React.useCallback(() => {
        setOpen(false);
        setCurrentValue(undefined);
    }, []);

    return (
        <div className={b()}>
            <button
                ref={controlRef}
                type="button"
                className={b('control', {open, invalid})}
                onClick={handleToggle}
            >
                {value.length > 0 ? (
                    <span className={b('value')}>{value.join(', ')}</span>
                ) : (
                    <span className={b('placeholder')}>{i18n('label_select-columns')}</span>
                )}
                {value.length > 1 && <span className={b('badge')}>{value.length}</span>}
                <Icon data={ChevronDown} className={b('chevron', {open})} size={16} />
            </button>
            <Popup
                anchorElement={controlRef.current}
                placement={['bottom-start', 'bottom-end', 'top-start', 'top-end']}
                open={open}
                onOutsideClick={handleCancel}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        handleCancel();
                    }
                }}
            >
                <ItemSelector
                    items={items}
                    value={currentValue ?? value}
                    onUpdate={setCurrentValue}
                    getItemId={getColumnId}
                    renderItem={renderColumnLabel}
                    renderItemValue={renderColumnLabel}
                    filterItem={filterColumnItem}
                    hideSelected
                    hideSelectAllButton
                />
                <div className={b('popup-controls')}>
                    <Button view="flat" onClick={handleCancel}>
                        {i18n('action_cancel')}
                    </Button>
                    <Button view="action" onClick={handleApply}>
                        {i18n('action_apply')}
                    </Button>
                </div>
            </Popup>
        </div>
    );
}
