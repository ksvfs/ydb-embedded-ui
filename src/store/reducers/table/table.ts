import type {SchemaPathParam} from '../../../types/api/common';
import type {TEvDescribeSchemeResult} from '../../../types/api/schema/schema';
import {isQueryErrorResponse, parseQueryAPIResponse} from '../../../utils/query';
import {api} from '../api';

import type {BuildTemplateOptions, FormValues} from './types';
import {
    buildCreateColumnTableQuery,
    buildCreateTableQuery,
    buildRenameQuery,
    buildResetQuery,
    buildUpdateTableQuery,
    prepareYdbCreateQueryColumns,
} from './utils';

export const tableApi = api.injectEndpoints({
    endpoints: (build) => ({
        getTable: build.query({
            queryFn: async ({database, path}: {database: string; path: SchemaPathParam}) => {
                try {
                    const response = await window.api.viewer.getDescribe({
                        path,
                        database,
                    });

                    if (!response) {
                        return {error: {message: 'Table not found'}};
                    }

                    return {data: response};
                } catch (error) {
                    return {error};
                }
            },
            providesTags: ['All'],
        }),
        createTable: build.mutation({
            queryFn: async ({database, formValues}: {database: string; formValues: FormValues}) => {
                try {
                    const {
                        type,
                        name,
                        columns,
                        settings,
                        secondaryIndexes,
                        partitionKey,
                        partitionCount,
                    } = formValues;

                    const options: BuildTemplateOptions = {
                        tableName: name,
                        columns: prepareYdbCreateQueryColumns(columns),
                        ...(type === 'row' && {secondaryIndexes}),
                        ...(type === 'column' && {columnsHash: partitionKey}),
                        settings:
                            type === 'column'
                                ? {
                                      ttl: settings.ttl,
                                      autoPartitionMinPartitions: String(partitionCount),
                                  }
                                : settings,
                    };

                    const query =
                        type === 'row'
                            ? buildCreateTableQuery(options)
                            : buildCreateColumnTableQuery(options);

                    const response = await window.api.viewer.sendQuery({
                        query,
                        database,
                        action: 'execute-query',
                    });

                    if (isQueryErrorResponse(response)) {
                        return {error: response};
                    }

                    const data = parseQueryAPIResponse(response);
                    return {data};
                } catch (error) {
                    return {error};
                }
            },
            invalidatesTags: (_result, error) => (error ? [] : ['All']),
        }),
        updateTable: build.mutation({
            queryFn: async ({
                database,
                formValues,
                originalTable,
            }: {
                database: string;
                formValues: FormValues;
                originalTable: TEvDescribeSchemeResult;
            }) => {
                try {
                    const {
                        name,
                        columns,
                        settings,
                        secondaryIndexes,
                        deletedColumns,
                        updatedSecondaryIndexes,
                    } = formValues;

                    const pathDesc = originalTable.PathDescription;
                    const originalName = pathDesc?.Self?.Name;
                    const tableName = originalTable.Path ?? originalName ?? name;
                    const newTableName =
                        originalName && tableName.endsWith(originalName)
                            ? `${tableName.slice(0, -originalName.length)}${name}`
                            : name;
                    const originalHadTtl = Boolean(
                        pathDesc?.Table?.TTLSettings?.Enabled ??
                            pathDesc?.ColumnTableDescription?.TtlSettings?.Enabled,
                    );

                    const queries: string[] = [];

                    if (settings.ttl.status === 'disabled' && originalHadTtl) {
                        queries.push(buildResetQuery(tableName, 'TTL'));
                    }

                    const updateOptions: BuildTemplateOptions = {
                        tableName,
                        columns,
                        secondaryIndexes,
                        deletedColumns,
                        updatedSecondaryIndexes,
                        settings,
                    };
                    const updateQuery = buildUpdateTableQuery(updateOptions);
                    const updateQueryEmpty = buildUpdateTableQuery({tableName});
                    if (updateQuery !== updateQueryEmpty) {
                        queries.push(updateQuery);
                    }

                    if (originalName && name !== originalName) {
                        queries.push(buildRenameQuery(tableName, newTableName));
                    }

                    if (queries.length === 0) {
                        return {data: undefined};
                    }

                    const response = await window.api.viewer.sendQuery({
                        query: queries.join('\n'),
                        database,
                        action: 'execute-query',
                    });

                    if (isQueryErrorResponse(response)) {
                        return {error: response};
                    }

                    const data = parseQueryAPIResponse(response);
                    return {data};
                } catch (error) {
                    return {error};
                }
            },
            invalidatesTags: (_result, error) => (error ? [] : ['All']),
        }),
    }),
    overrideExisting: 'throw',
});
