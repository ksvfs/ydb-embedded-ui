import React from 'react';

import * as NiceModal from '@ebay/nice-modal-react';
import {TriangleExclamationFill} from '@gravity-ui/icons';
import type {SelectOption} from '@gravity-ui/uikit';
import {
    Dialog,
    Disclosure,
    Divider,
    Flex,
    HelpMark,
    Icon,
    Link,
    SegmentedRadioGroup,
    Select,
    Slider,
    Switch,
    Text,
    TextInput,
    Tooltip,
} from '@gravity-ui/uikit';
import {zodResolver} from '@hookform/resolvers/zod';
import {Controller, useForm} from 'react-hook-form';

import {CONFIRMATION_DIALOG} from '../../../components/ConfirmationDialog/ConfirmationDialog';
import {ResponseError} from '../../../components/Errors/ResponseError';
import {Loader} from '../../../components/Loader';
import {useClusterWithProxy} from '../../../store/reducers/cluster/cluster';
import {selectTopicFormData, topicApi} from '../../../store/reducers/topic/topic';
import type {StreamFormData} from '../../../store/reducers/topic/utils';
import {AutoPartitioningStrategy, MeteringMode} from '../../../store/reducers/topic/utils';
import {cn} from '../../../utils/cn';
import createToast from '../../../utils/createToast';
import {prepareCommonErrorMessage} from '../../../utils/errors';
import {useTypedSelector} from '../../../utils/hooks';

import i18n from './i18n';
import {
    TOPIC_FORM_DIALOG,
    acceptNumber,
    buildFullTopicPath,
    formatBandwidthBytes,
    formatNumberInput,
    fromMbToGb,
    getCreateTopicInitialValues,
    getUpdateTopicInitialValues,
    parseNumberInput,
} from './utils';
import {getTopicFormValidationSchema} from './validation';

import './TopicFormDialog.scss';

const b = cn('ydb-topic-form-dialog');

type TopicFormMode = 'create' | 'update';

interface CommonDialogProps {
    mode: TopicFormMode;
    database: string;
    databaseFullPath: string;
    parentPath?: string;
    topicPath?: string;
    onSuccess?: (path: string) => void;
}

interface TopicFormDialogNiceModalProps extends CommonDialogProps {
    onClose?: () => void;
}

interface TopicFormDialogProps extends CommonDialogProps {
    open: boolean;
    onClose: () => void;
}

const writeQuotaOptions: SelectOption[] = [128, 512, 1024].map((value) => ({
    content: formatBandwidthBytes(value * 1024),
    value: String(value),
}));

const retentionHoursOptions: SelectOption[] = [
    {content: `1 ${i18n('value_hour')}`, value: '1'},
    {content: `4 ${i18n('value_hours')}`, value: '4'},
    {content: `12 ${i18n('value_hours')}`, value: '12'},
    {content: `1 ${i18n('value_day')}`, value: '24'},
];

const STORAGE_LIMIT_MIN_MB = 50 * 1024;
const STORAGE_LIMIT_MAX_MB = 400 * 1024;
const STORAGE_LIMIT_STEP_MB = 1024;

const meterModeOptions = [
    {
        value: MeteringMode.Provisioned,
        content: i18n('value_reserved-capacity'),
    },
    {value: MeteringMode.OnDemand, content: i18n('value_request-units')},
];

function showAutoPartitioningConfirmation() {
    return NiceModal.show(CONFIRMATION_DIALOG, {
        id: CONFIRMATION_DIALOG,
        caption: i18n('confirm_auto-partitioning-title'),
        children: i18n('confirm_auto-partitioning-message'),
        textButtonApply: i18n('action_enable'),
        buttonApplyView: 'action',
    }) as Promise<boolean>;
}

function MarkdownNote({text}: {text: string}) {
    const content = React.useMemo(() => {
        const parts: React.ReactNode[] = [];
        const linkRegexp = /\[([^\]]+)]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match = linkRegexp.exec(text);

        while (match) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            parts.push(
                <Link key={`${match[1]}-${match.index}`} href={match[2].trim()} target="_blank">
                    {match[1]}
                </Link>,
            );
            lastIndex = linkRegexp.lastIndex;
            match = linkRegexp.exec(text);
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts;
    }, [text]);

    return (
        <Text as="div" color="secondary" className={b('label-note')}>
            {content}
        </Text>
    );
}

function RequiredMark() {
    return <span className={b('required')}> *</span>;
}

function FormSection({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <section className={b('section')}>
            <Text as="div" variant="subheader-2" className={b('section-title')}>
                {title}
            </Text>
            {children}
        </section>
    );
}

function FormRow({
    title,
    note,
    required,
    htmlFor,
    children,
}: {
    title: string;
    note?: string;
    required?: boolean;
    htmlFor?: string;
    children: React.ReactNode;
}) {
    const labelTitle = (
        <React.Fragment>
            <span>{title}</span>
            {required ? <RequiredMark /> : null}
        </React.Fragment>
    );

    return (
        <div className={b('row')}>
            <div className={b('label')}>
                {htmlFor ? (
                    <label className={b('label-title')} htmlFor={htmlFor}>
                        {labelTitle}
                    </label>
                ) : (
                    <span className={b('label-title')}>{labelTitle}</span>
                )}
                {note ? (
                    <HelpMark
                        className={b('help-mark')}
                        popoverProps={{
                            placement: ['right', 'bottom'],
                            className: b('help-mark-popup'),
                        }}
                    >
                        <MarkdownNote text={note} />
                    </HelpMark>
                ) : null}
            </div>
            <div>{children}</div>
        </div>
    );
}

function FixedValue({value}: {value?: string | number}) {
    return (
        <Text as="div" className={b('fixed-value')}>
            {value}
        </Text>
    );
}

function IncompatiblePopover({content}: {content: string}) {
    return (
        <Tooltip content={content} placement={['top', 'bottom']}>
            <Text
                as="div"
                color="warning"
                variant="body-short"
                tabIndex={0}
                className={b('warning-icon')}
            >
                <Icon data={TriangleExclamationFill} size={16} />
            </Text>
        </Tooltip>
    );
}

function NumericTextInput({
    id,
    value,
    onChange,
    errorMessage,
    invalid,
    endContent,
    className,
    disabled,
}: {
    id?: string;
    value?: number;
    onChange: (value: number) => void;
    errorMessage?: string;
    invalid?: boolean;
    endContent?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}) {
    const handleUpdate = React.useCallback(
        (nextValue: string) => {
            if (acceptNumber(nextValue)) {
                onChange(parseNumberInput(nextValue));
            }
        },
        [onChange],
    );

    return (
        <TextInput
            id={id}
            value={formatNumberInput(value)}
            onUpdate={handleUpdate}
            validationState={errorMessage || invalid ? 'invalid' : undefined}
            errorMessage={errorMessage}
            endContent={endContent}
            className={className}
            disabled={disabled}
        />
    );
}

function SelectNumberField({
    value,
    onChange,
    options,
    errorMessage,
}: {
    value?: number;
    onChange: (value: number | undefined) => void;
    options: SelectOption[];
    errorMessage?: string;
}) {
    const handleUpdate = React.useCallback(
        ([nextValue]: string[]) => {
            onChange(nextValue ? Number(nextValue) : undefined);
        },
        [onChange],
    );

    return (
        <div className={b('control-stack')}>
            <Select
                className={b('select-s')}
                value={value === undefined ? [] : [String(value)]}
                options={options}
                onUpdate={handleUpdate}
                validationState={errorMessage ? 'invalid' : undefined}
            />
            {errorMessage ? (
                <Text color="danger" variant="body-1">
                    {errorMessage}
                </Text>
            ) : null}
        </div>
    );
}

function StorageSizeNote({size = 0, shards = 0}: {size?: number; shards?: number}) {
    const validSize = Number.isNaN(size) ? 0 : size;
    const validShards = Number.isNaN(shards) ? 0 : shards;
    const key =
        validShards === 1 ? 'context_data-storage-note-one' : 'context_data-storage-note-many';

    return (
        <Text color="secondary">
            {i18n(key, {
                total: fromMbToGb(validSize * validShards),
                size: fromMbToGb(validSize),
                count: validShards,
            })}
        </Text>
    );
}

function formatStorageLimitMark(value: number) {
    return `${fromMbToGb(value)} ${i18n('value_gigabyte')}`;
}

function TopicForm({
    mode,
    database,
    databaseFullPath,
    initialValues,
    onClose,
    onSuccess,
}: {
    mode: TopicFormMode;
    database: string;
    databaseFullPath: string;
    initialValues: StreamFormData;
    onClose: () => void;
    onSuccess?: (path: string) => void;
}) {
    const validationSchema = React.useMemo(
        () => getTopicFormValidationSchema(initialValues.shards),
        [initialValues.shards],
    );
    const [apiError, setApiError] = React.useState<string | null>(null);
    const [createTopic, createTopicResponse] = topicApi.useCreateTopicMutation();
    const [updateTopic, updateTopicResponse] = topicApi.useUpdateTopicMutation();

    const {
        control,
        handleSubmit,
        setValue,
        trigger,
        watch,
        formState: {errors},
    } = useForm<StreamFormData>({
        defaultValues: initialValues,
        resolver: zodResolver(validationSchema),
        mode: 'onChange',
    });

    const isSubmitting = createTopicResponse.isLoading || updateTopicResponse.isLoading;

    const autoPartitioningEnabled = watch('autoPartitioning.enabled');
    const autoPartitioningMode = watch('autoPartitioning.mode');
    const retentionType = watch('retentionType');
    const shards = watch('shards');
    const writeQuota = watch('writeQuota');
    const minPartitions = watch('autoPartitioning.minPartitions');
    const maxPartitions = watch('autoPartitioning.maxPartitions');
    const minPartitionsError = errors.autoPartitioning?.minPartitions?.message;
    const maxPartitionsError = errors.autoPartitioning?.maxPartitions?.message;
    const autoPartitioningRangeError = minPartitionsError ?? maxPartitionsError;

    React.useEffect(() => {
        if (!autoPartitioningEnabled) {
            return;
        }
        trigger(['autoPartitioning.minPartitions', 'autoPartitioning.maxPartitions']);
    }, [autoPartitioningEnabled, minPartitions, maxPartitions, trigger]);

    const retentionTypeOptions = React.useMemo(
        () => [
            {content: i18n('value_data-storage-time-limit'), value: 'time'},
            {
                content: i18n('value_data-storage-size-limit'),
                value: 'size',
                disabled: autoPartitioningEnabled,
            },
        ],
        [autoPartitioningEnabled],
    );

    const autoPartitioningModeOptions = React.useMemo(
        () => [
            {
                content: i18n('value_auto-partitioning-scale-up'),
                value: AutoPartitioningStrategy.ScaleUp,
                disabled: retentionType === 'size',
            },
            {
                content: i18n('value_auto-partitioning-paused'),
                value: AutoPartitioningStrategy.Paused,
                disabled: retentionType === 'size',
            },
        ],
        [retentionType],
    );

    const throughputInfo = React.useMemo(() => {
        if (autoPartitioningEnabled) {
            return i18n('context_throughput-info-range', {
                from: minPartitions ? formatBandwidthBytes(minPartitions * writeQuota * 1024) : '_',
                to: maxPartitions ? formatBandwidthBytes(maxPartitions * writeQuota * 1024) : '_',
            });
        }

        return i18n('context_throughput-info', {
            speed: formatBandwidthBytes(Number(shards || 0) * writeQuota * 1024),
        });
    }, [autoPartitioningEnabled, maxPartitions, minPartitions, shards, writeQuota]);

    const handleTopicSubmit = handleSubmit(async (data) => {
        setApiError(null);
        const formData = {
            ...data,
            meterMode: data.meterMode ?? MeteringMode.OnDemand,
        };

        try {
            if (mode === 'create') {
                await createTopic({database, formData}).unwrap();
            } else {
                await updateTopic({database, formData}).unwrap();
            }

            createToast({
                name: `topic-${mode}-success`,
                title:
                    mode === 'create' ? i18n('alert_create-success') : i18n('alert_update-success'),
                theme: 'success',
            });
            onSuccess?.(buildFullTopicPath(formData, databaseFullPath));
        } catch (error) {
            setApiError(prepareCommonErrorMessage(error));
        }
    });

    const autoPartitioningCanBeDisabled =
        mode === 'create' || !initialValues.autoPartitioning.enabled;
    const autoPartitioningRestricted = retentionType === 'size';

    return (
        <form onSubmit={handleTopicSubmit} className={b('form')}>
            <Dialog.Body className={b('body')}>
                <FormSection title={i18n('title_general-parameters')}>
                    <FormRow title={i18n('field_database')} required={mode === 'create'}>
                        <div className={b('control-stack')}>
                            <FixedValue value={database} />
                            {mode === 'create' ? (
                                <Text color="secondary">
                                    {i18n('context_database-select-info')}
                                </Text>
                            ) : null}
                        </div>
                    </FormRow>
                    {mode === 'create' ? (
                        <FormRow
                            title={i18n('field_name')}
                            note={i18n('context_field-name', {min: 2})}
                            required
                            htmlFor="topicName"
                        >
                            <Controller
                                name="name"
                                control={control}
                                render={({field}) => (
                                    <TextInput
                                        id="topicName"
                                        value={field.value ?? ''}
                                        onUpdate={field.onChange}
                                        validationState={errors.name ? 'invalid' : undefined}
                                        errorMessage={errors.name?.message}
                                        autoComplete={false}
                                        disabled={isSubmitting}
                                    />
                                )}
                            />
                        </FormRow>
                    ) : (
                        <FormRow title={i18n('field_name')}>
                            <FixedValue value={initialValues.name} />
                        </FormRow>
                    )}
                    <FormRow title={i18n('field_meter-mode')} note={i18n('context_meter-mode')}>
                        <Controller
                            name="meterMode"
                            control={control}
                            render={({field}) => (
                                <SegmentedRadioGroup
                                    value={field.value}
                                    onUpdate={field.onChange}
                                    disabled={isSubmitting}
                                >
                                    {meterModeOptions.map((option) => (
                                        <SegmentedRadioGroup.Option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.content}
                                        </SegmentedRadioGroup.Option>
                                    ))}
                                </SegmentedRadioGroup>
                            )}
                        />
                    </FormRow>
                </FormSection>
                <FormSection title={i18n('title_stream-parameters')}>
                    <FormRow
                        title={i18n('field_shard-write-quota')}
                        note={i18n('context_shards-write-quota')}
                    >
                        <Controller
                            name="writeQuota"
                            control={control}
                            render={({field}) => (
                                <div className={b('control-stack')}>
                                    <SelectNumberField
                                        value={field.value}
                                        onChange={(value) => {
                                            field.onChange(value);
                                            trigger('retentionHours');
                                        }}
                                        options={writeQuotaOptions}
                                        errorMessage={errors.writeQuota?.message}
                                    />
                                    <Text color="secondary">{throughputInfo}</Text>
                                </div>
                            )}
                        />
                    </FormRow>
                    <Divider className={b('divider')} />
                    <FormRow
                        title={i18n('field_auto-partitioning')}
                        note={i18n('context_auto-partitioning')}
                    >
                        <Flex gap={3} alignItems="center" style={{paddingTop: 4}}>
                            <Controller
                                name="autoPartitioning.enabled"
                                control={control}
                                render={({field}) => (
                                    <Tooltip
                                        disabled={autoPartitioningCanBeDisabled}
                                        placement={['top', 'bottom']}
                                        content={i18n('context_auto-partitioning-mode-disabled')}
                                    >
                                        <Switch
                                            checked={field.value}
                                            disabled={
                                                isSubmitting ||
                                                autoPartitioningRestricted ||
                                                !autoPartitioningCanBeDisabled
                                            }
                                            onUpdate={async (enabled) => {
                                                if (
                                                    enabled &&
                                                    autoPartitioningMode !==
                                                        AutoPartitioningStrategy.Paused &&
                                                    mode !== 'update'
                                                ) {
                                                    const confirmed =
                                                        await showAutoPartitioningConfirmation();
                                                    if (!confirmed) {
                                                        return;
                                                    }
                                                }
                                                field.onChange(enabled);
                                            }}
                                        />
                                    </Tooltip>
                                )}
                            />
                            {autoPartitioningRestricted ? (
                                <IncompatiblePopover
                                    content={i18n('context_auto-partitioning-mode-restricted')}
                                />
                            ) : null}
                        </Flex>
                    </FormRow>
                    {/* eslint-disable-next-line no-negated-condition */}
                    {!autoPartitioningEnabled ? (
                        <FormRow
                            title={i18n('field_shards')}
                            note={i18n('context_shards')}
                            htmlFor="shards"
                        >
                            <div className={b('control-stack')}>
                                <Controller
                                    name="shards"
                                    control={control}
                                    render={({field}) => (
                                        <NumericTextInput
                                            id="shards"
                                            value={field.value}
                                            onChange={(value) => {
                                                field.onChange(value);
                                                setValue('autoPartitioning.minPartitions', value);

                                                if (
                                                    value !== undefined &&
                                                    maxPartitions !== undefined &&
                                                    maxPartitions <= value
                                                ) {
                                                    setValue(
                                                        'autoPartitioning.maxPartitions',
                                                        value + 1,
                                                    );
                                                }
                                                trigger('autoPartitioning.maxPartitions');
                                            }}
                                            errorMessage={errors.shards?.message}
                                            className={b('input-s')}
                                            disabled={isSubmitting}
                                        />
                                    )}
                                />
                                <Text color="secondary">{i18n('context_shards-info')}</Text>
                            </div>
                        </FormRow>
                    ) : (
                        <React.Fragment>
                            <FormRow title={i18n('field_shards')} note={i18n('context_shards')}>
                                <div className={b('control-stack')}>
                                    <div className={b('dual-inputs')}>
                                        <Controller
                                            name="autoPartitioning.minPartitions"
                                            control={control}
                                            render={({field}) => (
                                                <NumericTextInput
                                                    value={field.value}
                                                    onChange={(value) => {
                                                        field.onChange(value);
                                                        setValue('shards', value || 0);
                                                    }}
                                                    invalid={Boolean(minPartitionsError)}
                                                    className={b('input-s')}
                                                    disabled={isSubmitting}
                                                    endContent={
                                                        <span className={b('input-details')}>
                                                            {i18n('value_min')}
                                                        </span>
                                                    }
                                                />
                                            )}
                                        />
                                        <Controller
                                            name="autoPartitioning.maxPartitions"
                                            control={control}
                                            render={({field}) => (
                                                <NumericTextInput
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    invalid={Boolean(maxPartitionsError)}
                                                    className={b('input-s')}
                                                    disabled={isSubmitting}
                                                    endContent={
                                                        <span className={b('input-details')}>
                                                            {i18n('value_max')}
                                                        </span>
                                                    }
                                                />
                                            )}
                                        />
                                    </div>
                                    {autoPartitioningRangeError ? (
                                        <Text color="danger" variant="body-1">
                                            {autoPartitioningRangeError}
                                        </Text>
                                    ) : null}
                                </div>
                            </FormRow>
                            <Disclosure
                                summary={
                                    <Text variant="subheader-1">
                                        {i18n('title_auto-partitioning-settings')}
                                    </Text>
                                }
                            >
                                <Disclosure.Details>
                                    <div className={b('settings-content')}>
                                        <FormRow
                                            title={i18n('field_auto-partitioning-mode')}
                                            note={i18n('context_auto-partitioning-mode')}
                                        >
                                            <Controller
                                                name="autoPartitioning.mode"
                                                control={control}
                                                render={({field}) => (
                                                    <SegmentedRadioGroup
                                                        value={field.value}
                                                        onUpdate={field.onChange}
                                                        disabled={isSubmitting}
                                                    >
                                                        {autoPartitioningModeOptions.map(
                                                            (option) => (
                                                                <SegmentedRadioGroup.Option
                                                                    key={option.value}
                                                                    value={option.value}
                                                                    disabled={option.disabled}
                                                                >
                                                                    {option.content}
                                                                </SegmentedRadioGroup.Option>
                                                            ),
                                                        )}
                                                    </SegmentedRadioGroup>
                                                )}
                                            />
                                        </FormRow>
                                        <FormRow
                                            title={i18n(
                                                'field_auto-partitioning-stabilization-window',
                                            )}
                                            note={i18n(
                                                'context_auto-partitioning-stabilization-window',
                                            )}
                                        >
                                            <Controller
                                                name="autoPartitioning.stabilizationWindow"
                                                control={control}
                                                render={({field}) => (
                                                    <NumericTextInput
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        errorMessage={
                                                            errors.autoPartitioning
                                                                ?.stabilizationWindow?.message
                                                        }
                                                        className={b('input-s')}
                                                        disabled={isSubmitting}
                                                        endContent={
                                                            <span className={b('input-details')}>
                                                                {i18n('value_seconds')}
                                                            </span>
                                                        }
                                                    />
                                                )}
                                            />
                                        </FormRow>
                                        <FormRow
                                            title={i18n('field_auto-partitioning-up-utilization')}
                                            note={i18n('context_auto-partitioning-up-utilization')}
                                        >
                                            <Controller
                                                name="autoPartitioning.upUtilization"
                                                control={control}
                                                render={({field}) => (
                                                    <NumericTextInput
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        errorMessage={
                                                            errors.autoPartitioning?.upUtilization
                                                                ?.message
                                                        }
                                                        className={b('input-s')}
                                                        disabled={isSubmitting}
                                                        endContent={
                                                            <span className={b('input-details')}>
                                                                %
                                                            </span>
                                                        }
                                                    />
                                                )}
                                            />
                                        </FormRow>
                                    </div>
                                </Disclosure.Details>
                            </Disclosure>
                        </React.Fragment>
                    )}
                    <Divider className={b('divider')} />
                    <FormRow
                        title={i18n('field_data-storage-options')}
                        note={i18n('context_data-storage-options')}
                    >
                        <div className={b('control-stack')}>
                            <Flex gap={3} alignItems="center">
                                <Controller
                                    name="retentionType"
                                    control={control}
                                    render={({field}) => (
                                        <SegmentedRadioGroup
                                            value={field.value}
                                            onUpdate={field.onChange}
                                            disabled={isSubmitting}
                                        >
                                            {retentionTypeOptions.map((option) => (
                                                <SegmentedRadioGroup.Option
                                                    key={option.value}
                                                    value={option.value}
                                                    disabled={option.disabled}
                                                >
                                                    {option.content}
                                                </SegmentedRadioGroup.Option>
                                            ))}
                                        </SegmentedRadioGroup>
                                    )}
                                />
                                {autoPartitioningEnabled ? (
                                    <IncompatiblePopover
                                        content={i18n('context_data-storage-options-restricted')}
                                    />
                                ) : null}
                            </Flex>
                            {retentionType === 'size' ? (
                                <Controller
                                    key="storage-limit"
                                    name="storageLimitMb"
                                    control={control}
                                    render={({field}) => {
                                        const isNan = Number.isNaN(field.value);
                                        const value = isNan
                                            ? STORAGE_LIMIT_MIN_MB
                                            : (field.value ?? STORAGE_LIMIT_MIN_MB);
                                        return (
                                            <div className={b('storage-control')}>
                                                <div className={b('storage-input-row')}>
                                                    <Slider
                                                        value={value}
                                                        min={STORAGE_LIMIT_MIN_MB}
                                                        max={STORAGE_LIMIT_MAX_MB}
                                                        step={STORAGE_LIMIT_STEP_MB}
                                                        marks={[
                                                            STORAGE_LIMIT_MIN_MB,
                                                            STORAGE_LIMIT_MAX_MB,
                                                        ]}
                                                        markFormat={formatStorageLimitMark}
                                                        onUpdate={(nextValue) => {
                                                            field.onChange(
                                                                Array.isArray(nextValue)
                                                                    ? nextValue[0]
                                                                    : nextValue,
                                                            );
                                                        }}
                                                        className={b('storage-slider')}
                                                        disabled={isSubmitting}
                                                    />
                                                    <TextInput
                                                        value={
                                                            isNan ? '' : String(fromMbToGb(value))
                                                        }
                                                        onUpdate={(nextValue) => {
                                                            if (acceptNumber(nextValue)) {
                                                                const parsed =
                                                                    parseNumberInput(nextValue);
                                                                field.onChange(
                                                                    Number.isNaN(parsed)
                                                                        ? NaN
                                                                        : parsed * 1024,
                                                                );
                                                            }
                                                        }}
                                                        className={b('input-s')}
                                                        disabled={isSubmitting}
                                                        endContent={
                                                            <span className={b('input-details')}>
                                                                {i18n('value_gigabyte')}
                                                            </span>
                                                        }
                                                        validationState={
                                                            errors.storageLimitMb
                                                                ? 'invalid'
                                                                : undefined
                                                        }
                                                        errorMessage={
                                                            errors.storageLimitMb?.message
                                                        }
                                                    />
                                                </div>
                                                <StorageSizeNote
                                                    size={isNan ? 0 : value}
                                                    shards={shards}
                                                />
                                            </div>
                                        );
                                    }}
                                />
                            ) : (
                                <Controller
                                    key="retention-hours"
                                    name="retentionHours"
                                    control={control}
                                    render={({field}) => (
                                        <SelectNumberField
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={retentionHoursOptions}
                                            errorMessage={errors.retentionHours?.message}
                                        />
                                    )}
                                />
                            )}
                        </div>
                    </FormRow>
                    {apiError ? (
                        <Text as="div" color="danger" className={b('error')}>
                            {apiError}
                        </Text>
                    ) : null}
                </FormSection>
            </Dialog.Body>
            <Dialog.Footer
                textButtonApply={mode === 'create' ? i18n('action_create') : i18n('action_update')}
                textButtonCancel={i18n('action_cancel')}
                onClickButtonCancel={onClose}
                loading={isSubmitting}
                propsButtonApply={{type: 'submit', view: mode === 'create' ? 'action' : 'normal'}}
            />
        </form>
    );
}

function TopicFormDialog({
    open,
    mode,
    database,
    databaseFullPath,
    parentPath,
    topicPath,
    onClose,
    onSuccess,
}: TopicFormDialogProps) {
    const useMetaProxy = useClusterWithProxy();
    const topicQuery = topicApi.useGetTopicQuery(
        {path: topicPath ?? '', database, databaseFullPath, useMetaProxy},
        {skip: mode !== 'update' || !topicPath},
    );
    const topicFormData = useTypedSelector((state) => {
        if (mode !== 'update' || !topicPath) {
            return undefined;
        }

        return selectTopicFormData(state, topicPath, database, databaseFullPath, useMetaProxy);
    });

    const initialValues = React.useMemo(() => {
        if (mode === 'create') {
            return getCreateTopicInitialValues({database, databaseFullPath, parentPath});
        }

        if (!topicPath || !topicFormData) {
            return undefined;
        }

        return getUpdateTopicInitialValues({
            database,
            databaseFullPath,
            formData: topicFormData,
            topicPath,
        });
    }, [database, databaseFullPath, mode, parentPath, topicFormData, topicPath]);

    const renderContent = () => {
        if (mode === 'update' && !topicPath) {
            return (
                <Dialog.Body className={b('body')}>
                    <Text color="danger">{i18n('error_topic-path-required')}</Text>
                </Dialog.Body>
            );
        }

        if (mode === 'update' && topicQuery.error) {
            return (
                <Dialog.Body className={b('body')}>
                    <ResponseError
                        error={topicQuery.error}
                        defaultMessage={i18n('error_load-topic')}
                    />
                </Dialog.Body>
            );
        }

        if (!initialValues) {
            return (
                <Dialog.Body className={b('body')}>
                    <div className={b('loader')}>
                        <Loader size="m" />
                    </div>
                </Dialog.Body>
            );
        }

        return (
            <TopicForm
                key={`${mode}-${topicPath ?? parentPath ?? database}`}
                mode={mode}
                database={database}
                databaseFullPath={databaseFullPath}
                initialValues={initialValues}
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );
    };

    return (
        <Dialog open={open} onClose={onClose} size="m" className={b()}>
            <Dialog.Header
                caption={
                    mode === 'create' ? i18n('title_stream-create') : i18n('title_stream-edit')
                }
            />
            {renderContent()}
        </Dialog>
    );
}

export const TopicFormDialogNiceModal = NiceModal.create((props: TopicFormDialogNiceModalProps) => {
    const modal = NiceModal.useModal();

    const handleClose = () => {
        modal.hide();
        modal.remove();
    };

    return (
        <TopicFormDialog
            {...props}
            open={modal.visible}
            onSuccess={(path) => {
                props.onSuccess?.(path);
                modal.resolve(path);
                handleClose();
            }}
            onClose={() => {
                props.onClose?.();
                modal.resolve(null);
                handleClose();
            }}
        />
    );
});

NiceModal.register(TOPIC_FORM_DIALOG, TopicFormDialogNiceModal);

export function openTopicFormDialog(
    props: Omit<TopicFormDialogNiceModalProps, 'id'>,
): Promise<string | null> {
    return NiceModal.show(TOPIC_FORM_DIALOG, {
        id: TOPIC_FORM_DIALOG,
        ...props,
    }) as Promise<string | null>;
}
