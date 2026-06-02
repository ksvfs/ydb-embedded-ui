import type {TEvDescribeSchemeResult} from '../../../../types/api/schema/schema';
import {
    buildCreateTableQuery,
    buildUpdateTableQuery,
    getTablePathInfoForUpdate,
    getUpdateTableSettings,
} from '../utils';

describe('table update settings helpers', () => {
    test('keeps create-time secondary index definitions unchanged', () => {
        const query = buildCreateTableQuery({
            tableName: '/Root/table',
            columns: [
                {name: 'id', type: 'Uint64', key: true, notNull: true},
                {name: 'value', type: 'Utf8', notNull: false},
            ],
            secondaryIndexes: [{name: 'value_idx', key: ['value']}],
            settings: {ttl: {status: 'disabled'}},
        });

        expect(query).toContain('INDEX `value_idx` GLOBAL ON (`value`)');
        expect(query).toContain('PRIMARY KEY (`id`)');
    });

    test('omits hidden settings from update queries when TTL was not edited', () => {
        const settings = {
            ttl: {status: 'disabled' as const},
            autoPartitionBySize: true,
            autoPartitionBySizeMb: 2,
            autoPartitionMinPartitions: 4,
            autoPartitionMaxPartitions: 8,
            keyBloomFilter: true,
        };

        const query = buildUpdateTableQuery({
            tableName: '/Root/table',
            settings: getUpdateTableSettings(settings, false),
        });

        expect(query).not.toContain('AUTO_PARTITIONING_PARTITION_SIZE_MB');
        expect(query).not.toContain('AUTO_PARTITIONING_MIN_PARTITIONS_COUNT');
        expect(query).not.toContain('AUTO_PARTITIONING_MAX_PARTITIONS_COUNT');
        expect(query).not.toContain('KEY_BLOOM_FILTER');
        expect(query).not.toContain('TTL =');
    });

    test('keeps TTL update settings and preserves raw epoch mode values', () => {
        const query = buildUpdateTableQuery({
            tableName: '/Root/table',
            settings: getUpdateTableSettings(
                {
                    ttl: {
                        status: 'enabled',
                        column: 'ttl_col',
                        columnWithEpochMode: true,
                        lifetime: 1,
                        epochMode: 'UNIT_CUSTOM_CYCLES',
                    },
                    autoPartitionBySize: true,
                    autoPartitionBySizeMb: 2,
                },
                true,
            ),
        });

        expect(query).toContain('SET TTL Interval("PT1S") ON `ttl_col` AS CUSTOM_CYCLES');
        expect(query).not.toContain('AUTO_PARTITIONING_PARTITION_SIZE_MB');
    });

    test('returns the renamed table path for update flows', () => {
        const originalTable = {
            Path: '/Root/dir/old_name',
            PathDescription: {
                Self: {
                    Name: 'old_name',
                },
            },
        } as TEvDescribeSchemeResult;

        expect(getTablePathInfoForUpdate(originalTable, 'new_name')).toEqual({
            originalName: 'old_name',
            tablePath: '/Root/dir/old_name',
            updatedTablePath: '/Root/dir/new_name',
        });
    });
});
