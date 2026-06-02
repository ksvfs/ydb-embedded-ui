import {buildTableValidationSchema} from '../validation';

describe('buildTableValidationSchema', () => {
    test('validates visible row table settings in update mode', () => {
        const schema = buildTableValidationSchema({mode: 'update'});

        expect(() =>
            schema.parse({
                name: 'table',
                type: 'row',
                columns: [],
                secondaryIndexes: [],
                deletedColumns: [],
                partitionKey: [],
                partitionCount: 0,
                settings: {
                    autoPartitionBySize: true,
                    autoPartitionBySizeMb: 0,
                    autoPartitionMinPartitions: 0,
                    autoPartitionMaxPartitions: 0,
                    ttl: {status: 'disabled'},
                },
            }),
        ).toThrow();
    });

    test('ignores create-only partition policy validation in update mode', () => {
        const schema = buildTableValidationSchema({mode: 'update'});

        expect(() =>
            schema.parse({
                name: 'table',
                type: 'row',
                columns: [],
                secondaryIndexes: [],
                deletedColumns: [],
                partitionKey: [],
                partitionCount: 0,
                settings: {
                    partitionsType: 'uniform',
                    uniformPartitions: 0,
                    autoPartitionBySize: false,
                    ttl: {status: 'disabled'},
                },
            }),
        ).not.toThrow();
    });

    test('ignores row-only settings validation for column-table create mode', () => {
        const schema = buildTableValidationSchema({mode: 'create'});

        expect(() =>
            schema.parse({
                name: 'table',
                type: 'column',
                columns: [
                    {
                        _id: 'col_1',
                        name: 'id',
                        type: 'Int64',
                        key: true,
                        notNull: true,
                        defaultValue: '',
                        withDefaultValue: false,
                    },
                ],
                secondaryIndexes: [],
                deletedColumns: [],
                partitionKey: ['id'],
                partitionCount: 1,
                settings: {
                    partitionsType: 'uniform',
                    uniformPartitions: 0,
                    autoPartitionBySize: true,
                    autoPartitionBySizeMb: 0,
                    autoPartitionMinPartitions: 0,
                    autoPartitionMaxPartitions: 0,
                    ttl: {status: 'disabled'},
                },
            }),
        ).not.toThrow();
    });
});
