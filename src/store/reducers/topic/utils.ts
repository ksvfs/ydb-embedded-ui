export enum MeteringMode {
    Provisioned = 'reserved_capacity',
    OnDemand = 'request_units',
}

export enum AutoPartitioningStrategy {
    Disabled = 'AUTO_PARTITIONING_STRATEGY_DISABLED',
    Paused = 'AUTO_PARTITIONING_STRATEGY_PAUSED',
    ScaleUp = 'AUTO_PARTITIONING_STRATEGY_SCALE_UP',
    ScaleUpAndDown = 'AUTO_PARTITIONING_STRATEGY_SCALE_UP_AND_DOWN',
}

export interface StreamFormData {
    databaseId?: string;
    path?: string;
    name?: string;
    shards: number;
    writeQuota: number;
    retentionHours: number;
    storageLimitMb: number;
    meterMode: MeteringMode;
    retentionType: 'size' | 'time';
    autoPartitioning: {
        enabled: boolean;
        mode:
            | AutoPartitioningStrategy.ScaleUp
            | AutoPartitioningStrategy.ScaleUpAndDown
            | AutoPartitioningStrategy.Paused;
        minPartitions?: number;
        maxPartitions?: number;
        stabilizationWindow?: number;
        downUtilization?: number;
        upUtilization?: number;
    };
}

const METERING_MODE_TO_YQL: Record<MeteringMode, string> = {
    [MeteringMode.Provisioned]: 'RESERVED_CAPACITY',
    [MeteringMode.OnDemand]: 'REQUEST_UNITS',
};

const AUTO_PARTITIONING_STRATEGY_TO_YQL: Record<AutoPartitioningStrategy, string> = {
    [AutoPartitioningStrategy.Disabled]: 'disabled',
    [AutoPartitioningStrategy.Paused]: 'paused',
    [AutoPartitioningStrategy.ScaleUp]: 'scale_up',
    [AutoPartitioningStrategy.ScaleUpAndDown]: 'scale_up_and_down',
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
    const {
        shards,
        writeQuota,
        retentionHours,
        storageLimitMb,
        meterMode,
        retentionType,
        autoPartitioning,
    } = formData;

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

    settings.push(`METERING_MODE = '${METERING_MODE_TO_YQL[meterMode]}'`);

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
        if (autoPartitioning.downUtilization !== undefined) {
            settings.push(
                `AUTO_PARTITIONING_DOWN_UTILIZATION_PERCENT = ${autoPartitioning.downUtilization}`,
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
