import type {StreamFormData} from '../../../store/reducers/topic/utils';
import {AutoPartitioningStrategy} from '../../../store/reducers/topic/utils';
import {UNBREAKABLE_GAP} from '../../../utils/constants';

export const TOPIC_FORM_DIALOG = 'topic-form-dialog';

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

export const DEFAULT_TOPIC_FORM_VALUES: StreamFormData = {
    shards: 1,
    writeQuota: 1024,
    retentionHours: 4,
    storageLimitMb: 50 * 1024,
    retentionType: 'time',
    autoPartitioning: {
        enabled: false,
        mode: AutoPartitioningStrategy.ScaleUp,
        minPartitions: 1,
        maxPartitions: 2,
        stabilizationWindow: 300,
        upUtilization: 90,
    },
};

export function acceptNumber(value: string) {
    return value === '' || (/^[0-9]+$/.test(value) && Number(value) <= Number.MAX_SAFE_INTEGER);
}

export function parseNumberInput(value: string): number {
    return value ? Number.parseInt(value, 10) : NaN;
}

export function formatNumberInput(value: number | undefined): string {
    return typeof value === 'number' && !Number.isNaN(value) ? value.toString() : '';
}

export function fromMbToGb(value: number) {
    return value / 1024;
}

export function formatBandwidthBytes(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
    }

    if (value >= MEGABYTE) {
        return `${value / MEGABYTE}${UNBREAKABLE_GAP}MB/s`;
    }

    if (value >= KILOBYTE) {
        return `${value / KILOBYTE}${UNBREAKABLE_GAP}KB/s`;
    }

    return `${value}${UNBREAKABLE_GAP}byte/s`;
}

function normalizePath(path: string) {
    return path.replace(/^\/+|\/+$/g, '');
}

export function getRelativePath(path: string, databaseFullPath: string): string | undefined {
    const normalizedPath = normalizePath(path);
    const normalizedDatabase = normalizePath(databaseFullPath);

    if (!normalizedPath || normalizedPath === normalizedDatabase) {
        return undefined;
    }

    if (normalizedPath.startsWith(`${normalizedDatabase}/`)) {
        return normalizedPath.slice(normalizedDatabase.length + 1) || undefined;
    }

    return normalizedPath;
}

export function splitTopicPath(topicPath: string, databaseFullPath: string) {
    const relativePath = getRelativePath(topicPath, databaseFullPath);
    const pathSegments = relativePath?.split('/').filter(Boolean) ?? [];
    const name = pathSegments.pop() ?? '';
    const path = pathSegments.join('/');

    return {path: path || undefined, name};
}

export function buildFullTopicPath(formData: StreamFormData, databaseFullPath: string) {
    const databasePath = databaseFullPath.startsWith('/')
        ? databaseFullPath
        : `/${databaseFullPath}`;
    const relativeTopicPath = [formData.path, formData.name].filter(Boolean).join('/');

    return relativeTopicPath ? `${databasePath}/${relativeTopicPath}` : databasePath;
}

export function getCreateTopicInitialValues({
    database,
    databaseFullPath,
    parentPath,
}: {
    database: string;
    databaseFullPath: string;
    parentPath?: string;
}): StreamFormData {
    return {
        ...DEFAULT_TOPIC_FORM_VALUES,
        databaseId: database,
        path: parentPath ? getRelativePath(parentPath, databaseFullPath) : undefined,
        autoPartitioning: {...DEFAULT_TOPIC_FORM_VALUES.autoPartitioning},
    };
}

export function getUpdateTopicInitialValues({
    database,
    databaseFullPath,
    formData,
    topicPath,
}: {
    database: string;
    databaseFullPath: string;
    formData: StreamFormData;
    topicPath: string;
}): StreamFormData {
    const topicPathData = splitTopicPath(topicPath, databaseFullPath);

    return {
        ...DEFAULT_TOPIC_FORM_VALUES,
        ...formData,
        databaseId: formData.databaseId ?? database,
        path: topicPathData.path,
        name: topicPathData.name || formData.name,
        autoPartitioning: {
            ...DEFAULT_TOPIC_FORM_VALUES.autoPartitioning,
            ...formData.autoPartitioning,
        },
    };
}
