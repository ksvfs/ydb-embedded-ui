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

const NAME_REGEX = /^[a-z_][a-z0-9_]*$/i;

function prepareTopicEntityName(segment: string) {
    return NAME_REGEX.test(segment)
        ? segment
        : `\`${segment.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``;
}

function buildTopicPath(path: string | undefined, name: string | undefined) {
    if (path && name) {
        return `${prepareTopicEntityName(path)}/${prepareTopicEntityName(name)}`;
    }
    if (path) {
        return prepareTopicEntityName(path);
    }
    if (name) {
        return prepareTopicEntityName(name);
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
    settings.push(`min_active_partitions = ${minActivePartitions}`);

    if (autoPartitioning.enabled) {
        if (autoPartitioning.maxPartitions !== undefined) {
            settings.push(`max_active_partitions = ${autoPartitioning.maxPartitions}`);
        }
    } else {
        settings.push(`partition_count_limit = ${shards}`);
    }

    settings.push(`retention_period = Interval('PT${retentionHours}H')`);

    const effectiveStorageMb = retentionType === 'time' ? 0 : storageLimitMb;
    settings.push(`retention_storage_mb = ${effectiveStorageMb}`);

    settings.push(`partition_write_speed_bytes_per_second = ${writeQuota * 1024}`);

    settings.push(`metering_mode = '${METERING_MODE_TO_YQL[meterMode]}'`);

    const strategy = autoPartitioning.enabled
        ? AUTO_PARTITIONING_STRATEGY_TO_YQL[autoPartitioning.mode]
        : AUTO_PARTITIONING_STRATEGY_TO_YQL[AutoPartitioningStrategy.Disabled];
    settings.push(`auto_partitioning_strategy = '${strategy}'`);

    if (autoPartitioning.enabled) {
        if (autoPartitioning.stabilizationWindow !== undefined) {
            settings.push(
                `auto_partitioning_stabilization_window = Interval('PT${autoPartitioning.stabilizationWindow}S')`,
            );
        }
        if (autoPartitioning.upUtilization !== undefined) {
            settings.push(
                `auto_partitioning_up_utilization_percent = ${autoPartitioning.upUtilization}`,
            );
        }
        if (autoPartitioning.downUtilization !== undefined) {
            settings.push(
                `auto_partitioning_down_utilization_percent = ${autoPartitioning.downUtilization}`,
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
