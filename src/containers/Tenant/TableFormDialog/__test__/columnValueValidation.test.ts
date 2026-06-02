import {isValueForTypeValid} from '../columnValueValidation';

describe('isValueForTypeValid', () => {
    test('accepts only exact boolean literals for Bool columns', () => {
        expect(isValueForTypeValid('true', 'Bool')).toBe(true);
        expect(isValueForTypeValid('FALSE', 'Bool')).toBe(true);
        expect(isValueForTypeValid('true123', 'Bool')).toBe(false);
        expect(isValueForTypeValid('xfalse', 'Bool')).toBe(false);
    });
});
