import {buildUpdateTableQuery, getUpdateTableSettings} from '../utils';

describe('table update settings helpers', () => {
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
});
