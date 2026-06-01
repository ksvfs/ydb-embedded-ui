import {render, screen} from '@testing-library/react';
import {FormProvider, useForm, useFormContext, useWatch} from 'react-hook-form';

import type {FormValues} from '../../types';
import {getCreateInitialValues} from '../../utils';
import {TTLSection} from '../TTLSection';

function TtlValueObserver() {
    const {control} = useFormContext<FormValues>();
    const column = useWatch({control, name: 'settings.ttl.column'});
    const epochMode = useWatch({control, name: 'settings.ttl.epochMode'});

    return <div data-testid="ttl-values">{`${column ?? ''}|${epochMode ?? ''}`}</div>;
}

describe('TTLSection', () => {
    test('preserves unsupported current TTL values instead of clearing them', () => {
        const defaultValues: FormValues = {
            ...getCreateInitialValues('row'),
            settings: {
                ...getCreateInitialValues('row').settings,
                ttl: {
                    status: 'enabled',
                    column: 'legacy_ttl_column',
                    columnWithEpochMode: true,
                    lifetime: 1,
                    epochMode: 'UNIT_CUSTOM_CYCLES',
                },
            },
        };

        function TestForm() {
            const methods = useForm<FormValues>({defaultValues});

            return (
                <FormProvider {...methods}>
                    <TTLSection />
                    <TtlValueObserver />
                </FormProvider>
            );
        }

        render(<TestForm />);

        expect(screen.getByTestId('ttl-values')).toHaveTextContent(
            'legacy_ttl_column|UNIT_CUSTOM_CYCLES',
        );
    });
});
