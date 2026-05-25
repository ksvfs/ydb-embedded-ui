import React from 'react';

import * as NiceModal from '@ebay/nice-modal-react';
import {Dialog, Text} from '@gravity-ui/uikit';
import {zodResolver} from '@hookform/resolvers/zod';
import {FormProvider, useForm, useWatch} from 'react-hook-form';

import {CONFIRMATION_DIALOG} from '../../../components/ConfirmationDialog/ConfirmationDialog';
import {ResponseError} from '../../../components/Errors/ResponseError';
import {Loader} from '../../../components/Loader';
import {tableApi} from '../../../store/reducers/table/table';
import type {TEvDescribeSchemeResult} from '../../../types/api/schema/schema';
import {cn} from '../../../utils/cn';
import createToast from '../../../utils/createToast';
import {prepareCommonErrorMessage} from '../../../utils/errors';

import {
    TABLE_FORM_DIALOG,
    YDB_COLUMN_PK_TYPES,
    YDB_COLUMN_TABLE_TYPES,
    YDB_PK_TYPES,
    YDB_TABLE_TYPES,
} from './constants';
import i18n from './i18n';
import {GeneralSection} from './sections/GeneralSection';
import {PartitioningSection} from './sections/PartitioningSection';
import {SettingsSection} from './sections/SettingsSection';
import {TTLSection} from './sections/TTLSection';
import {YdbColumnsSection} from './sections/YdbColumnsSection';
import {YdbIndexesSection} from './sections/YdbIndexesSection';
import type {FormMode, FormValues, OriginalTableInfo, TableType} from './types';
import {
    describeOriginalTable,
    getCreateInitialValues,
    getInitialColumns,
    getUpdateInitialValues,
} from './utils';
import {buildTableValidationSchema} from './validation';

import './TableFormDialog.scss';

const b = cn('ydb-table-form-dialog');

interface CommonDialogProps {
    mode: FormMode;
    database: string;
    databaseFullPath: string;
    path?: string;
    onSuccess?: (path: string) => void;
}

interface TableFormDialogNiceModalProps extends CommonDialogProps {
    onClose?: () => void;
}

interface TableFormDialogInnerProps extends CommonDialogProps {
    open: boolean;
    onClose: () => void;
}

interface TableFormProps {
    mode: FormMode;
    database: string;
    databaseFullPath: string;
    path?: string;
    initialValues: FormValues;
    originalInfo?: OriginalTableInfo;
    originalTable?: TEvDescribeSchemeResult;
    onClose: () => void;
    onSuccess?: (path: string) => void;
}

function buildTablePath(databaseFullPath: string, name: string) {
    const trimmedDb = databaseFullPath.replace(/\/+$/, '');
    return `${trimmedDb}/${name}`;
}

function confirmTtlColumnDeletion() {
    return NiceModal.show(CONFIRMATION_DIALOG, {
        id: CONFIRMATION_DIALOG,
        caption: i18n('label_ttl-remove-column-warning'),
        message: i18n('label_ttl-remove-column-text'),
        textButtonApply: i18n('action_delete'),
        buttonApplyView: 'action',
    }) as Promise<boolean>;
}

function TableForm({
    mode,
    database,
    databaseFullPath,
    path,
    initialValues,
    originalInfo,
    originalTable,
    onClose,
    onSuccess,
}: TableFormProps) {
    const [createTable, createState] = tableApi.useCreateTableMutation();
    const [updateTable, updateState] = tableApi.useUpdateTableMutation();

    const validationSchema = React.useMemo(
        () => buildTableValidationSchema({mode, originalInfo}),
        [mode, originalInfo],
    );

    const methods = useForm<FormValues>({
        defaultValues: initialValues,
        resolver: zodResolver(validationSchema),
        mode: 'onChange',
    });

    const {control, handleSubmit, setValue, formState} = methods;
    const type: TableType = useWatch({control, name: 'type'});

    const previousTypeRef = React.useRef<TableType>(initialValues.type);
    React.useEffect(() => {
        if (mode === 'update') {
            return;
        }
        if (type === previousTypeRef.current) {
            return;
        }
        previousTypeRef.current = type;
        const nextColumns = getInitialColumns(type);
        setValue('columns', nextColumns, {shouldValidate: false});
        setValue('partitionKey', nextColumns[0]?.name ? [nextColumns[0].name] : [], {
            shouldValidate: false,
        });
        setValue('settings.ttl', {status: 'disabled'}, {shouldValidate: false});
    }, [mode, type, setValue]);

    const isSubmitting = createState.isLoading || updateState.isLoading;

    const handleTtlColumnDeletionRequest = React.useCallback(
        async (_columnName: string, onConfirm: () => void) => {
            const confirmed = await confirmTtlColumnDeletion();
            if (confirmed) {
                onConfirm();
            }
        },
        [],
    );

    const handleFormSubmit = handleSubmit(async (formValues) => {
        try {
            if (mode === 'create') {
                const fullName = buildTablePath(databaseFullPath, formValues.name);
                await createTable({
                    database,
                    formValues: {...formValues, name: fullName},
                }).unwrap();
                createToast({
                    name: 'table-create-success',
                    title: i18n('alert_create-success'),
                    theme: 'success',
                    autoHiding: 5000,
                });
                onSuccess?.(fullName);
            } else {
                if (!originalTable || !path) {
                    throw new Error('Original table is required for update');
                }
                await updateTable({
                    database,
                    formValues,
                    originalTable,
                }).unwrap();
                createToast({
                    name: 'table-update-success',
                    title: i18n('alert_update-success'),
                    theme: 'success',
                    autoHiding: 5000,
                });
                onSuccess?.(path);
            }
            onClose();
        } catch (error) {
            createToast({
                name: `table-${mode}-error`,
                title: mode === 'create' ? i18n('alert_create-error') : i18n('alert_update-error'),
                content: prepareCommonErrorMessage(error),
                theme: 'danger',
                autoHiding: 5000,
            });
        }
    });

    const showIndexes = type === 'row' && mode === 'create';
    const showSettings = type === 'row';
    const showPartitioning = type === 'column' && mode === 'create';

    const columnTypes = type === 'column' ? YDB_COLUMN_TABLE_TYPES : YDB_TABLE_TYPES;
    const pkTypes = type === 'column' ? YDB_COLUMN_PK_TYPES : YDB_PK_TYPES;
    const keyNullable = type !== 'column';

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleFormSubmit} className={b('form')}>
                <Dialog.Body className={b('body')}>
                    <GeneralSection mode={mode} />
                    <YdbColumnsSection
                        mode={mode}
                        types={columnTypes}
                        pkTypes={pkTypes}
                        keyNullable={keyNullable}
                        originalInfo={originalInfo}
                        onRequestTtlColumnDeletion={handleTtlColumnDeletionRequest}
                    />
                    {showIndexes ? (
                        <YdbIndexesSection mode={mode} originalInfo={originalInfo} />
                    ) : null}
                    <TTLSection originalInfo={originalInfo} />
                    {showSettings ? <SettingsSection mode={mode} /> : null}
                    {showPartitioning ? <PartitioningSection pkTypes={pkTypes} /> : null}
                </Dialog.Body>
                <Dialog.Footer
                    textButtonApply={
                        mode === 'create' ? i18n('action_create') : i18n('action_update')
                    }
                    textButtonCancel={i18n('action_cancel')}
                    onClickButtonCancel={onClose}
                    loading={isSubmitting}
                    propsButtonApply={{
                        type: 'submit',
                        view: mode === 'create' ? 'action' : 'normal',
                        disabled: isSubmitting || (mode === 'update' && !formState.isDirty),
                    }}
                />
            </form>
        </FormProvider>
    );
}

function TableFormDialog({
    open,
    mode,
    database,
    databaseFullPath,
    path,
    onClose,
    onSuccess,
}: TableFormDialogInnerProps) {
    const tableQuery = tableApi.useGetTableQuery(
        {database, path: {path: path ?? '', databaseFullPath}},
        {skip: mode !== 'update' || !path},
    );

    const originalTable = mode === 'update' ? tableQuery.data : undefined;
    const originalInfo = React.useMemo(() => describeOriginalTable(originalTable), [originalTable]);

    const initialValues = React.useMemo<FormValues | undefined>(() => {
        if (mode === 'create') {
            return getCreateInitialValues('row');
        }
        if (!originalTable) {
            return undefined;
        }
        return getUpdateInitialValues(originalTable);
    }, [mode, originalTable]);

    const renderContent = () => {
        if (mode === 'update' && !path) {
            return (
                <Dialog.Body className={b('body')}>
                    <Text color="danger">{i18n('error_load-table')}</Text>
                </Dialog.Body>
            );
        }
        if (mode === 'update' && tableQuery.error) {
            return (
                <Dialog.Body className={b('body')}>
                    <ResponseError
                        error={tableQuery.error}
                        defaultMessage={i18n('error_load-table')}
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
            <TableForm
                key={`${mode}-${path ?? database}`}
                mode={mode}
                database={database}
                databaseFullPath={databaseFullPath}
                path={path}
                initialValues={initialValues}
                originalInfo={originalInfo}
                originalTable={originalTable}
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );
    };

    return (
        <Dialog open={open} onClose={onClose} size="l" className={b()}>
            <Dialog.Header
                caption={mode === 'create' ? i18n('title_create') : i18n('title_update')}
            />
            {renderContent()}
        </Dialog>
    );
}

export const TableFormDialogNiceModal = NiceModal.create((props: TableFormDialogNiceModalProps) => {
    const modal = NiceModal.useModal();

    const handleClose = () => {
        modal.hide();
        modal.remove();
    };

    return (
        <TableFormDialog
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

NiceModal.register(TABLE_FORM_DIALOG, TableFormDialogNiceModal);

export function openTableFormDialog(
    props: Omit<TableFormDialogNiceModalProps, 'id'>,
): Promise<string | null> {
    return NiceModal.show(TABLE_FORM_DIALOG, {
        id: TABLE_FORM_DIALOG,
        ...props,
    }) as Promise<string | null>;
}
