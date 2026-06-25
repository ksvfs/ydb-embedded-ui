import {EPathType} from '../../../../types/api/schema/schema';
import {describeOriginalTable} from '../utils';

describe('TableFormDialog utils', () => {
    test('describeOriginalTable exposes the current backend ttl column', () => {
        const rowTable = describeOriginalTable({
            PathDescription: {
                Self: {Name: 'orders', PathType: EPathType.EPathTypeTable},
                Table: {
                    Columns: [],
                    KeyColumnNames: [],
                    TTLSettings: {Enabled: {ColumnName: 'createdAt'}},
                },
            },
        } as never);

        const columnTable = describeOriginalTable({
            PathDescription: {
                Self: {Name: 'events', PathType: EPathType.EPathTypeColumnTable},
                ColumnTableDescription: {
                    Schema: {Columns: [], KeyColumnNames: []},
                    TtlSettings: {Enabled: {ColumnName: 'eventAt'}},
                },
            },
        } as never);

        expect(rowTable).toMatchObject({
            hasTtl: true,
            ttlColumn: 'createdAt',
        });
        expect(columnTable).toMatchObject({
            hasTtl: true,
            ttlColumn: 'eventAt',
        });
    });
});
