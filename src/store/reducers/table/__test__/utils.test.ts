import type {TEvDescribeSchemeResult} from '../../../../types/api/schema/schema';
import {PartitionsType} from '../types';
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

    test('omits unchanged settings from update queries when nothing was edited', () => {
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
            settings: getUpdateTableSettings(settings, undefined),
        });

        expect(query).not.toContain('AUTO_PARTITIONING_PARTITION_SIZE_MB');
        expect(query).not.toContain('AUTO_PARTITIONING_MIN_PARTITIONS_COUNT');
        expect(query).not.toContain('AUTO_PARTITIONING_MAX_PARTITIONS_COUNT');
        expect(query).not.toContain('KEY_BLOOM_FILTER');
        expect(query).not.toContain('TTL =');
    });

    test('updates only dirty row settings and keeps hidden partition policy fields out', () => {
        const query = buildUpdateTableQuery({
            tableName: '/Root/table',
            settings: getUpdateTableSettings(
                {
                    ttl: {status: 'disabled'},
                    autoPartitionBySize: true,
                    autoPartitionBySizeMb: 2,
                    autoPartitionByLoad: true,
                    autoPartitionMinPartitions: 4,
                    autoPartitionMaxPartitions: 8,
                    keyBloomFilter: true,
                    partitionsType: PartitionsType.Uniform,
                    uniformPartitions: 32,
                },
                {
                    autoPartitionBySizeMb: true,
                    keyBloomFilter: true,
                    partitionsType: true,
                    uniformPartitions: true,
                },
            ),
        });

        expect(query).toContain('SET AUTO_PARTITIONING_BY_SIZE ENABLED');
        expect(query).toContain('SET AUTO_PARTITIONING_PARTITION_SIZE_MB 2');
        expect(query).toContain('SET KEY_BLOOM_FILTER ENABLED');
        expect(query).not.toContain('AUTO_PARTITIONING_BY_LOAD');
        expect(query).not.toContain('AUTO_PARTITIONING_MIN_PARTITIONS_COUNT');
        expect(query).not.toContain('AUTO_PARTITIONING_MAX_PARTITIONS_COUNT');
        expect(query).not.toContain('UNIFORM_PARTITIONS');
        expect(query).not.toContain('PARTITION_AT_KEYS');
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
                {ttl: {status: true}},
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
