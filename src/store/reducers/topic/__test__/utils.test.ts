import {AutoPartitioningStrategy, buildAlterTopicQuery} from '../utils';

describe('buildAlterTopicQuery', () => {
    test('preserves partition count limit for untouched disabled autopartitioning updates', () => {
        const query = buildAlterTopicQuery({
            path: 'folder',
            name: 'topic',
            shards: 2,
            partitionCountLimit: 12,
            preservePartitionCountLimit: true,
            writeQuotaBytes: 153600,
            retentionPeriodSeconds: 7200,
            storageLimitMb: 0,
            retentionType: 'time',
            autoPartitioning: {
                enabled: false,
                mode: AutoPartitioningStrategy.Disabled,
                minPartitions: 2,
                maxPartitions: 12,
                stabilizationWindow: 300,
                upUtilization: 90,
            },
        });

        expect(query).toContain('MIN_ACTIVE_PARTITIONS = 2');
        expect(query).toContain('PARTITION_COUNT_LIMIT = 12');
        expect(query).toContain("AUTO_PARTITIONING_STRATEGY = 'disabled'");
    });

    test('preserves raw retention settings for untouched updates', () => {
        const query = buildAlterTopicQuery({
            path: 'folder',
            name: 'topic',
            shards: 2,
            writeQuotaBytes: 153600,
            retentionPeriodSeconds: 7200,
            storageLimitMb: 52500,
            retentionType: 'size',
            preserveRawRetentionSettings: true,
            autoPartitioning: {
                enabled: true,
                mode: AutoPartitioningStrategy.ScaleUpAndDown,
                minPartitions: 2,
                maxPartitions: 4,
                stabilizationWindow: 300,
                upUtilization: 90,
            },
        });

        expect(query).toContain("RETENTION_PERIOD = Interval('PT7200S')");
        expect(query).toContain('RETENTION_STORAGE_MB = 52500');
        expect(query).toContain("AUTO_PARTITIONING_STRATEGY = 'scale_up_and_down'");
    });

    test('normalizes retention settings after the retention controls change', () => {
        const query = buildAlterTopicQuery({
            path: 'folder',
            name: 'topic',
            shards: 2,
            writeQuotaBytes: 153600,
            retentionPeriodSeconds: 7200,
            storageLimitMb: 52500,
            retentionType: 'size',
            autoPartitioning: {
                enabled: false,
                mode: AutoPartitioningStrategy.ScaleUp,
                minPartitions: 2,
                maxPartitions: 4,
                stabilizationWindow: 300,
                upUtilization: 90,
            },
        });

        expect(query).toContain("RETENTION_PERIOD = Interval('PT604800S')");
        expect(query).toContain('RETENTION_STORAGE_MB = 52500');
        expect(query).toContain("AUTO_PARTITIONING_STRATEGY = 'disabled'");
    });
});
