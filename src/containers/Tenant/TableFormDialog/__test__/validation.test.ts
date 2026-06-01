import {buildTableValidationSchema} from '../validation';

describe('buildTableValidationSchema', () => {
    test('ignores hidden settings validation in update mode', () => {
        const schema = buildTableValidationSchema({mode: 'update'});

        expect(() =>
            schema.parse({
                name: 'table',
                type: 'row',
                columns: [],
                secondaryIndexes: [],
                deletedColumns: [],
                updatedSecondaryIndexes: [],
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
        ).not.toThrow();
    });
});
