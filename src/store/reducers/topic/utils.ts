export enum AutoPartitioningStrategy {
    Disabled = 'AUTO_PARTITIONING_STRATEGY_DISABLED',
    Paused = 'AUTO_PARTITIONING_STRATEGY_PAUSED',
    ScaleUp = 'AUTO_PARTITIONING_STRATEGY_SCALE_UP',
}

export interface StreamFormData {
    databaseId?: string;
    path?: string;
    name?: string;
    shards: number;
    writeQuota: number;
    retentionHours: number;
    storageLimitMb: number;
    retentionType: 'size' | 'time';
    autoPartitioning: {
        enabled: boolean;
        mode: AutoPartitioningStrategy.ScaleUp | AutoPartitioningStrategy.Paused;
        minPartitions?: number;
        maxPartitions?: number;
        stabilizationWindow?: number;
        upUtilization?: number;
    };
}

const AUTO_PARTITIONING_STRATEGY_TO_YQL: Record<AutoPartitioningStrategy, string> = {
    [AutoPartitioningStrategy.Disabled]: 'disabled',
    [AutoPartitioningStrategy.Paused]: 'paused',
    [AutoPartitioningStrategy.ScaleUp]: 'scale_up',
};

const SIZE_RETENTION_PERIOD_HOURS = 24 * 7;

const NAME_REGEX = /^[a-z_][a-z0-9_]*$/i;

function prepareTopicEntityName(path: string) {
    return NAME_REGEX.test(path)
        ? path
        : `\`${path.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
}

function buildTopicPath(path: string | undefined, name: string | undefined) {
    const topicPath = [path, name].filter(Boolean).join('/');
    if (topicPath) {
        return prepareTopicEntityName(topicPath);
    }
    throw new Error('Topic name or path is required');
}

function buildTopicSettings(formData: StreamFormData): string[] {
    const {shards, writeQuota, retentionHours, storageLimitMb, retentionType, autoPartitioning} =
        formData;

    const settings: string[] = [];

    const minActivePartitions = autoPartitioning.enabled
        ? (autoPartitioning.minPartitions ?? shards)
        : shards;
    settings.push(`MIN_ACTIVE_PARTITIONS = ${minActivePartitions}`);

    if (autoPartitioning.enabled) {
        if (autoPartitioning.maxPartitions !== undefined) {
            settings.push(`MAX_ACTIVE_PARTITIONS = ${autoPartitioning.maxPartitions}`);
        }
    } else {
        settings.push(`PARTITION_COUNT_LIMIT = ${shards}`);
    }

    const effectiveRetentionHours =
        retentionType === 'time' ? retentionHours : SIZE_RETENTION_PERIOD_HOURS;
    settings.push(`RETENTION_PERIOD = Interval('PT${effectiveRetentionHours}H')`);

    const effectiveStorageMb = retentionType === 'time' ? 0 : storageLimitMb;
    settings.push(`RETENTION_STORAGE_MB = ${effectiveStorageMb}`);

    settings.push(`PARTITION_WRITE_SPEED_BYTES_PER_SECOND = ${writeQuota * 1024}`);

    const strategy = autoPartitioning.enabled
        ? AUTO_PARTITIONING_STRATEGY_TO_YQL[autoPartitioning.mode]
        : AUTO_PARTITIONING_STRATEGY_TO_YQL[AutoPartitioningStrategy.Disabled];
    settings.push(`AUTO_PARTITIONING_STRATEGY = '${strategy}'`);

    if (autoPartitioning.enabled) {
        if (autoPartitioning.stabilizationWindow !== undefined) {
            settings.push(
                `AUTO_PARTITIONING_STABILIZATION_WINDOW = Interval('PT${autoPartitioning.stabilizationWindow}S')`,
            );
        }
        if (autoPartitioning.upUtilization !== undefined) {
            settings.push(
                `AUTO_PARTITIONING_UP_UTILIZATION_PERCENT = ${autoPartitioning.upUtilization}`,
            );
        }
    }

    return settings;
}

export function buildCreateTopicQuery(formData: StreamFormData): string {
    const topicRef = buildTopicPath(formData.path, formData.name);
    const settings = buildTopicSettings(formData);
    return `CREATE TOPIC ${topicRef} WITH (\n    ${settings.join(',\n    ')}\n);`;
}

export function buildAlterTopicQuery(formData: StreamFormData): string {
    const topicRef = buildTopicPath(formData.path, formData.name);
    const settings = buildTopicSettings(formData);
    return `ALTER TOPIC ${topicRef} SET (\n    ${settings.join(',\n    ')}\n);`;
}
