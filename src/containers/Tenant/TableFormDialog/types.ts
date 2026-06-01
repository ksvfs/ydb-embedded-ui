import type {
    Column,
    ColumnField,
    FormValues,
    SecondaryIndex,
    TTLSettings,
    TableSettings,
    UpdatedSecondaryIndex,
} from '../../../store/reducers/table/types';
import {PartitionsType} from '../../../store/reducers/table/types';
import type {TEvDescribeSchemeResult} from '../../../types/api/schema/schema';

export type FormMode = 'create' | 'update';
export type TableType = FormValues['type'];

export type {
    Column,
    ColumnField,
    FormValues,
    SecondaryIndex,
    TTLSettings,
    TableSettings,
    UpdatedSecondaryIndex,
};
export {PartitionsType};

export interface OriginalTableInfo {
    name: string;
    type: 'row' | 'column';
    columns: Column[];
    partitionKey: string[];
    indexes: Array<{name: string; columns: string[]}>;
    hasTtl: boolean;
    hasMinPartitions: boolean;
    hasMaxPartitions: boolean;
}

export interface TableFormSharedProps {
    mode: FormMode;
    originalTable?: TEvDescribeSchemeResult;
    originalInfo?: OriginalTableInfo;
}
