import type {SelectOption} from '@gravity-ui/uikit';

import {SERIAL_TYPES_MAP} from '../../../store/reducers/table/constants';
import {prepareFormValues} from '../../../store/reducers/table/utils';
import type {TEvDescribeSchemeResult} from '../../../types/api/schema/schema';
import {EPathType} from '../../../types/api/schema/schema';

import i18n from './i18n';
import type {ColumnField, FormValues, OriginalTableInfo, TableType} from './types';
import {PartitionsType} from './types';

const TTL_VALID_TYPES = new Set([
    'Date',
    'Date32',
    'Datetime',
    'Datetime64',
    'Timestamp',
    'Timestamp64',
    'Uint32',
    'Uint64',
]);

const TTL_NUM_TYPES = new Set(['Uint32', 'Uint64']);

export function isValidTtlType(type: string | undefined) {
    return Boolean(type && TTL_VALID_TYPES.has(type));
}

export function isValidTtlNumType(type: string | undefined) {
    return Boolean(type && TTL_NUM_TYPES.has(type));
}

export const epochModeOptions: SelectOption[] = [
    {value: 'seconds', content: i18n('value_epoch-seconds')},
    {value: 'milliseconds', content: i18n('value_epoch-milliseconds')},
    {value: 'microseconds', content: i18n('value_epoch-microseconds')},
    {value: 'nanoseconds', content: i18n('value_epoch-nanoseconds')},
];

export const lifetimeUnitOptions: SelectOption[] = [
    {value: 'seconds', content: i18n('value_seconds')},
    {value: 'minutes', content: i18n('value_minutes')},
    {value: 'hours', content: i18n('value_hours')},
    {value: 'days', content: i18n('value_days')},
];

export const ttlStatusOptions = [
    {value: 'disabled', content: i18n('value_disabled')},
    {value: 'enabled', content: i18n('value_enabled')},
];

export const partitionsTypeOptions = [
    {value: PartitionsType.None, content: i18n('value_partitions-none')},
    {value: PartitionsType.Uniform, content: i18n('value_partitions-uniform')},
    {value: PartitionsType.Explicit, content: i18n('value_partitions-explicit')},
];

const RANDOM_SUFFIX_LEN = 6;
export function generateTableName(prefix = 'table') {
    const random = Math.random()
        .toString(36)
        .slice(2, 2 + RANDOM_SUFFIX_LEN);
    return `${prefix}_${random}`;
}

let columnIdCounter = 0;
export function generateColumnId() {
    columnIdCounter += 1;
    return `col_${Date.now().toString(36)}_${columnIdCounter}`;
}

export function getInitialColumns(type: TableType): ColumnField[] {
    return [
        {
            _id: generateColumnId(),
            name: 'id',
            type: 'Int64',
            key: true,
            notNull: type === 'column',
            defaultValue: '',
            withDefaultValue: false,
        },
    ];
}

export function getCreateInitialValues(initialType: TableType = 'row'): FormValues {
    const columns = getInitialColumns(initialType);
    const firstName = columns[0]?.name ?? '';

    return {
        name: generateTableName('table'),
        type: initialType,
        columns,
        documentColumns: [],
        secondaryIndexes: [],
        documentSecondaryIndexes: [],
        deletedColumns: [],
        updatedSecondaryIndexes: [],
        partitionKey: firstName ? [firstName] : [],
        partitionCount: 64,
        settings: {
            partitionsType: PartitionsType.None,
            uniformPartitions: undefined,
            partitionsAtKeys: [],
            autoPartitionBySize: true,
            autoPartitionByLoad: false,
            autoPartitionBySizeMb: 2048,
            keyBloomFilter: false,
            ttl: {status: 'disabled'},
        },
    };
}

export function getUpdateInitialValues(table: TEvDescribeSchemeResult): FormValues {
    const values = prepareFormValues(table);
    const updatedSecondaryIndexes = values.secondaryIndexes.map(({name}) => ({
        name,
        newName: name,
        isDeleted: false,
    }));

    return {
        ...values,
        secondaryIndexes: [],
        updatedSecondaryIndexes,
    };
}

function sortColumnsByKeyOrder<T extends {key?: boolean; keyOrder?: number}>(columns: T[]): T[] {
    const keys = columns.filter((c) => c.key);
    const others = columns.filter((c) => !c.key);
    keys.sort((a, b) => {
        const ao = a.keyOrder ?? 0;
        const bo = b.keyOrder ?? 0;
        return ao - bo;
    });
    return [...keys, ...others];
}

export function describeOriginalTable(
    table: TEvDescribeSchemeResult | undefined,
): OriginalTableInfo | undefined {
    if (!table) {
        return undefined;
    }
    const pathDesc = table.PathDescription;
    const name = pathDesc?.Self?.Name ?? '';
    const pathType = pathDesc?.Self?.PathType;

    if (pathType === EPathType.EPathTypeColumnTable && pathDesc?.ColumnTableDescription) {
        const desc = pathDesc.ColumnTableDescription;
        const keyColumnNames = desc.Schema?.KeyColumnNames ?? [];
        const columns = sortColumnsByKeyOrder(
            (desc.Schema?.Columns ?? []).map((col) => {
                const keyOrder = keyColumnNames.indexOf(col.Name ?? '');
                return {
                    name: col.Name ?? '',
                    type: col.Type ?? '',
                    notNull: col.NotNull ?? false,
                    key: keyOrder >= 0,
                    keyOrder: keyOrder >= 0 ? keyOrder : undefined,
                };
            }),
        );
        return {
            name,
            type: 'column',
            columns,
            indexes: [],
            hasTtl: Boolean(desc.TtlSettings?.Enabled),
            hasMinPartitions: false,
            hasMaxPartitions: false,
        };
    }

    const desc = pathDesc?.Table;
    const keyColumnNames = desc?.KeyColumnNames ?? [];
    const columns = sortColumnsByKeyOrder(
        (desc?.Columns ?? []).map((col) => {
            const keyOrder = keyColumnNames.indexOf(col.Name ?? '');
            return {
                name: col.Name ?? '',
                type: col.Type ?? '',
                notNull: col.NotNull ?? false,
                key: keyOrder >= 0,
                keyOrder: keyOrder >= 0 ? keyOrder : undefined,
            };
        }),
    );

    const indexes = (desc?.TableIndexes ?? []).map((idx) => ({
        name: idx.Name ?? '',
        columns: idx.KeyColumnNames ?? [],
    }));

    return {
        name,
        type: 'row',
        columns,
        indexes,
        hasTtl: Boolean(desc?.TTLSettings?.Enabled),
        hasMinPartitions:
            typeof desc?.PartitionConfig?.PartitioningPolicy?.MinPartitionsCount !== 'undefined',
        hasMaxPartitions:
            typeof desc?.PartitionConfig?.PartitioningPolicy?.MaxPartitionsCount !== 'undefined',
    };
}

export function getNotNullDisabledMessage(
    column: ColumnField,
    keyNullable: boolean,
): string | undefined {
    if (!keyNullable && column.key) {
        return i18n('label_not-null-note-key');
    }
    if (column.autoincrement) {
        return i18n('label_not-null-note-autoincrement');
    }
    return undefined;
}

export function getAutoincrementDisabledMessage(column: ColumnField): string | undefined {
    if (!column.key || (column.type && !Object.keys(SERIAL_TYPES_MAP).includes(column.type))) {
        return i18n('label_autoincrement-note-type');
    }
    return undefined;
}

export function isSerialCompatible(type: string | undefined) {
    return Boolean(type && Object.keys(SERIAL_TYPES_MAP).includes(type));
}

export function acceptIntegerInput(value: string) {
    return value === '' || /^(0|[1-9][0-9]*)$/.test(value);
}
