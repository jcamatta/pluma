// Size and complexity limits. Values chosen by the team; they push toward small, single-purpose
// functions and files. Counts apply to first-party source under src.

export const limits = {
  files: ['src/**/*.{ts,tsx}'],
  rules: {
    'max-params': ['error', 2],
    'max-lines-per-function': [
      'error',
      { max: 75, skipBlankLines: true, skipComments: true, IIFEs: true }
    ],
    'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    'max-statements': ['error', 12],
    'max-depth': ['error', 3],
    complexity: ['error', 8],
    'max-nested-callbacks': ['error', 3],
    'max-classes-per-file': ['error', 1]
  }
}
