import {z} from 'zod';

import type {TopicFormData} from '../../../store/reducers/topic/utils';
import {AutoPartitioningStrategy} from '../../../store/reducers/topic/utils';

import i18n from './i18n';
import {formatBandwidthBytes} from './utils';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 63;
const NAME_REGEX = /^[a-z][a-z\-0-9]*[a-z0-9]$/;
const MIN_ONE_MESSAGE = i18n('error_min-number', {count: 1});
const MAX_HUNDRED_MESSAGE = i18n('error_max-number', {count: 100});

const addIssue = (ctx: z.RefinementCtx, path: Array<string | number>, message: string) => {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message,
    });
};

const requiredNumber = (schema?: z.ZodNumber) =>
    z.preprocess(
        (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
        schema ??
            z.number({
                required_error: i18n('error_required'),
                invalid_type_error: i18n('error_number'),
            }),
    );

const optionalNumber = (schema?: z.ZodNumber) =>
    z.preprocess(
        (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
        (
            schema ??
            z.number({
                invalid_type_error: i18n('error_number'),
            })
        ).optional(),
    );

const topicNameSchema = z
    .string({required_error: i18n('error_required'), invalid_type_error: i18n('error_required')})
    .min(1, i18n('error_required'))
    .superRefine((value, ctx) => {
        if (value !== value.toLowerCase()) {
            addIssue(ctx, [], i18n('error_lowercase'));
            return;
        }

        const segments = value.split('/');
        if (segments.some((segment) => !segment)) {
            addIssue(ctx, [], i18n('error_name-regex'));
            return;
        }

        for (const segment of segments) {
            if (segment.length < NAME_MIN_LENGTH) {
                addIssue(ctx, [], i18n('error_min-length', {count: NAME_MIN_LENGTH}));
                return;
            }
            if (segment.length > NAME_MAX_LENGTH) {
                addIssue(ctx, [], i18n('error_max-length', {count: NAME_MAX_LENGTH}));
                return;
            }
            if (!NAME_REGEX.test(segment)) {
                addIssue(ctx, [], i18n('error_name-regex'));
                return;
            }
        }
    });

function validateRequiredNumber(
    ctx: z.RefinementCtx,
    path: Array<string | number>,
    value: number | undefined,
) {
    if (value === undefined) {
        addIssue(ctx, path, i18n('error_required'));
        return false;
    }

    return true;
}

export function getTopicFormValidationSchema(minPartitions: number) {
    return (
        z
            .object({
                databaseId: z.string().min(1, i18n('error_required')),
                path: z.string().optional(),
                name: topicNameSchema,
                shards: requiredNumber(
                    z
                        .number({
                            required_error: i18n('error_required'),
                            invalid_type_error: i18n('error_number'),
                        })
                        .min(1, MIN_ONE_MESSAGE),
                ),
                writeQuota: requiredNumber(),
                retentionHours: optionalNumber(),
                storageLimitMb: optionalNumber(),
                retentionType: z.enum(['size', 'time']),
                autoPartitioning: z.object({
                    enabled: z.boolean(),
                    mode: z.union([
                        z.literal(AutoPartitioningStrategy.ScaleUp),
                        z.literal(AutoPartitioningStrategy.Paused),
                    ]),
                    minPartitions: optionalNumber(
                        z
                            .number({invalid_type_error: i18n('error_number')})
                            .min(1, MIN_ONE_MESSAGE),
                    ),
                    maxPartitions: optionalNumber(
                        z
                            .number({invalid_type_error: i18n('error_number')})
                            .min(1, MIN_ONE_MESSAGE),
                    ),
                    stabilizationWindow: optionalNumber(),
                    upUtilization: optionalNumber(
                        z
                            .number({invalid_type_error: i18n('error_number')})
                            .max(100, MAX_HUNDRED_MESSAGE),
                    ),
                }),
            })
            // The form mirrors Cloud Console cross-field validation rules in one place.
            .superRefine((data, ctx) => {
                if (data.shards < minPartitions) {
                    addIssue(ctx, ['shards'], i18n('error_min-number', {count: minPartitions}));
                }

                if (data.retentionHours === 1 && data.writeQuota !== 128) {
                    addIssue(
                        ctx,
                        ['retentionHours'],
                        i18n('error_retention-unavailable', {
                            speed: formatBandwidthBytes(128 * 1024),
                        }),
                    );
                }

                if (data.retentionType === 'time') {
                    validateRequiredNumber(ctx, ['retentionHours'], data.retentionHours);
                } else if (data.retentionType === 'size') {
                    validateRequiredNumber(ctx, ['storageLimitMb'], data.storageLimitMb);
                }

                const {autoPartitioning} = data;

                if (!autoPartitioning.enabled) {
                    return;
                }

                const minPath = ['autoPartitioning', 'minPartitions'];
                const maxPath = ['autoPartitioning', 'maxPartitions'];
                const stabilizationPath = ['autoPartitioning', 'stabilizationWindow'];
                const upUtilizationPath = ['autoPartitioning', 'upUtilization'];

                if (
                    validateRequiredNumber(ctx, minPath, autoPartitioning.minPartitions) &&
                    autoPartitioning.minPartitions !== undefined &&
                    autoPartitioning.minPartitions < minPartitions
                ) {
                    addIssue(ctx, minPath, i18n('error_min-number', {count: minPartitions}));
                }

                if (validateRequiredNumber(ctx, maxPath, autoPartitioning.maxPartitions)) {
                    const minValue = autoPartitioning.minPartitions;
                    if (
                        minValue !== undefined &&
                        autoPartitioning.maxPartitions !== undefined &&
                        autoPartitioning.maxPartitions <= minValue
                    ) {
                        addIssue(ctx, maxPath, i18n('error_more-than-number', {count: minValue}));
                    }
                }

                validateRequiredNumber(
                    ctx,
                    stabilizationPath,
                    autoPartitioning.stabilizationWindow,
                );

                validateRequiredNumber(ctx, upUtilizationPath, autoPartitioning.upUtilization);
            }) as z.ZodType<TopicFormData>
    );
}
