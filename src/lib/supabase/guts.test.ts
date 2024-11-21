import { getGutsAnswers } from './guts';

describe('getGutsAnswers', () => {
  it('should find the first row with test_name equal to "Guts"', async () => {
    const response = await getGutsAnswers();
    const gutsRow = response.data.find((row) => row.test_name === 'Guts');
    expect(gutsRow).toBeDefined();
  });
});