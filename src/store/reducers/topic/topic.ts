/* eslint-disable camelcase */
import {createSelector} from '@reduxjs/toolkit';

import type {IProtobufTimeObject} from '../../../types/api/common';
import type {TopicDataRequest} from '../../../types/api/topic';
import {convertBytesObjectToSpeed} from '../../../utils/bytesParsers';
import {isQueryErrorResponse, parseQueryAPIResponse} from '../../../utils/query';
import {parseLag, parseTimestampToIdleTime} from '../../../utils/timeParsers';
import type {RootState} from '../../defaultStore';
import {api} from '../api';

import type {StreamFormData} from './utils';
import {
    AutoPartitioningStrategy,
    MeteringMode,
    buildAlterTopicQuery,
    buildCreateTopicQuery,
} from './utils';

export const TOPIC_MESSAGE_SIZE_LIMIT = 100;

export const topicApi = api.injectEndpoints({
    endpoints: (build) => ({
        getTopic: build.query({
            queryFn: async ({
                path,
                database,
                databaseFullPath,
                useMetaProxy,
            }: {
                path: string;
                database: string;
                databaseFullPath: string;
                useMetaProxy?: boolean;
            }) => {
                try {
                    const data = await window.api.viewer.getTopic({
                        path: {path, databaseFullPath, useMetaProxy},
                        database,
                    });
                    // On older version it can return HTML page of Developer UI with an error
                    if (typeof data !== 'object') {
                        return {error: {}};
                    }
                    return {data};
                } catch (error) {
                    return {error};
                }
            },
            providesTags: ['All'],
        }),
        getTopicData: build.query({
            queryFn: async (params: TopicDataRequest) => {
                try {
                    const data = await window.api.viewer.getTopicData({
                        message_size_limit: TOPIC_MESSAGE_SIZE_LIMIT,
                        ...params,
                    });
                    return {data};
                } catch (error) {
                    return {error};
                }
            },
            keepUnusedDataFor: 0,
        }),
        createTopic: build.mutation({
            queryFn: async ({database, formData}: {database: string; formData: StreamFormData}) => {
                try {
                    const query = buildCreateTopicQuery(formData);

                    const response = await window.api.viewer.sendQuery({
                        query,
                        database,
                        action: 'execute-query',
                    });

                    if (isQueryErrorResponse(response)) {
                        return {error: response};
                    }

                    return {data: parseQueryAPIResponse(response)};
                } catch (error) {
                    return {error};
                }
            },
            invalidatesTags: (_result, error) => (error ? [] : ['All']),
        }),
        updateTopic: build.mutation({
            queryFn: async ({database, formData}: {database: string; formData: StreamFormData}) => {
                try {
                    const query = buildAlterTopicQuery(formData);

                    const response = await window.api.viewer.sendQuery({
                        query,
                        database,
                        action: 'execute-query',
                    });

                    if (isQueryErrorResponse(response)) {
                        return {error: response};
                    }

                    return {data: parseQueryAPIResponse(response)};
                } catch (error) {
                    return {error};
                }
            },
            invalidatesTags: (_result, error) => (error ? [] : ['All']),
        }),
    }),
    overrideExisting: 'throw',
});

const createGetTopicSelector = createSelector(
    (path: string) => path,
    (_path: string, database: string) => database,
    (_path: string, _database: string, databaseFullPath: string) => databaseFullPath,
    (_path: string, _database: string, _databaseFullPath: string, useMetaProxy?: boolean) =>
        useMetaProxy,
    (path, database, databaseFullPath, useMetaProxy) =>
        topicApi.endpoints.getTopic.select({path, database, databaseFullPath, useMetaProxy}),
);

const selectTopicStats = createSelector(
    (state: RootState) => state,
    (
        _state: RootState,
        path: string,
        database: string,
        databaseFullPath: string,
        useMetaProxy?: boolean,
    ) => createGetTopicSelector(path, database, databaseFullPath, useMetaProxy),
    (state, selectGetTopic) => selectGetTopic(state).data?.topic_stats,
);
const selectConsumers = createSelector(
    (state: RootState) => state,
    (
        _state: RootState,
        path: string,
        database: string,
        databaseFullPath: string,
        useMetaProxy?: boolean,
    ) => createGetTopicSelector(path, database, databaseFullPath, useMetaProxy),
    (state, selectGetTopic) => selectGetTopic(state).data?.consumers,
);

export const selectConsumersNames = createSelector(selectConsumers, (consumers) => {
    return consumers
        ?.map((consumer) => consumer?.name)
        .filter((consumer): consumer is string => consumer !== undefined);
});

export const selectPreparedTopicStats = createSelector(selectTopicStats, (rawTopicStats) => {
    if (!rawTopicStats) {
        return undefined;
    }

    const {
        store_size_bytes = '0',
        min_last_write_time,
        max_write_time_lag,
        bytes_written,
    } = rawTopicStats || {};

    return {
        storeSize: store_size_bytes,
        partitionsIdleTime: parseTimestampToIdleTime(min_last_write_time),
        partitionsWriteLag: parseLag(max_write_time_lag),
        writeSpeed: convertBytesObjectToSpeed(bytes_written),
    };
});

export const selectPreparedConsumersData = createSelector(selectConsumers, (consumers) => {
    return consumers?.map((consumer) => {
        const {name, consumer_stats} = consumer || {};

        const {min_partitions_last_read_time, max_read_time_lag, max_write_time_lag, bytes_read} =
            consumer_stats || {};

        return {
            name,
            readSpeed: convertBytesObjectToSpeed(bytes_read),

            writeLag: parseLag(max_write_time_lag),
            readLag: parseLag(max_read_time_lag),
            readIdleTime: parseTimestampToIdleTime(min_partitions_last_read_time),
        };
    });
});

function parseDurationToHours(duration?: string | IProtobufTimeObject): number {
    if (!duration) {
        return 0;
    }
    if (typeof duration === 'string') {
        const match = duration.match(/^(\d+)s$/);
        if (match) {
            return Math.round(parseInt(match[1], 10) / 3600);
        }
        return 0;
    }
    if (typeof duration === 'object' && duration.seconds) {
        const seconds =
            typeof duration.seconds === 'string'
                ? parseInt(duration.seconds, 10)
                : duration.seconds;
        return Math.round(seconds / 3600);
    }
    return 0;
}

function mapApiMeteringModeToFormMode(apiMode?: string): MeteringMode {
    switch (apiMode) {
        case 'METERING_MODE_REQUEST_UNITS':
            return MeteringMode.OnDemand;
        case 'METERING_MODE_RESERVED_CAPACITY':
        case 'METERING_MODE_UNSPECIFIED':
        default:
            return MeteringMode.Provisioned;
    }
}

export const selectTopicFormData = createSelector(
    (state: RootState) => state,
    (
        _state: RootState,
        path: string,
        database: string,
        databaseFullPath: string,
        useMetaProxy?: boolean,
    ) => createGetTopicSelector(path, database, databaseFullPath, useMetaProxy),
    (state, selectGetTopic) => {
        const topicData = selectGetTopic(state).data;
        if (!topicData) {
            return undefined;
        }

        const minActivePartitions = parseInt(
            topicData.partitioning_settings?.min_active_partitions ?? '1',
            10,
        );
        const partitionCountLimit = parseInt(
            topicData.partitioning_settings?.partition_count_limit ?? '0',
            10,
        );
        const retentionStorageMb = parseInt(topicData.retention_storage_mb ?? '0', 10);
        const writeQuotaBytes = parseInt(
            topicData.partition_write_speed_bytes_per_second ?? '1048576',
            10,
        );
        const retentionHours = parseDurationToHours(topicData.retention_period);

        return {
            path: undefined,
            name: topicData.self?.name,
            shards: minActivePartitions,
            writeQuota: writeQuotaBytes,
            retentionHours: retentionHours || 4,
            storageLimitMb: retentionStorageMb,
            meterMode: mapApiMeteringModeToFormMode(topicData.metering_mode),
            retentionType: retentionStorageMb > 0 ? 'size' : 'time',
            autoPartitioning: {
                enabled: false,
                mode: AutoPartitioningStrategy.Paused,
                minPartitions: minActivePartitions,
                maxPartitions: partitionCountLimit > 0 ? partitionCountLimit : undefined,
                stabilizationWindow: undefined,
                downUtilization: undefined,
                upUtilization: undefined,
            },
        } as StreamFormData;
    },
);
