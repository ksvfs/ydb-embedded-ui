import {ThemeProvider} from '@gravity-ui/uikit';
import {fireEvent, render, screen} from '@testing-library/react';

import {RangeInputPicker} from '../RangeInputPicker';

describe('RangeInputPicker', () => {
    test('preserves an unchanged out-of-range value on blur', () => {
        const onUpdate = jest.fn();

        render(
            <ThemeProvider theme="light">
                <RangeInputPicker value={12} min={1} max={10} onUpdate={onUpdate} />
            </ThemeProvider>,
        );

        const input = screen.getByRole('textbox');

        expect(input).toHaveValue('12');

        fireEvent.focus(input);
        fireEvent.blur(input);

        expect(input).toHaveValue('12');
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
