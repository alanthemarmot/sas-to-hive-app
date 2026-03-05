import type { Monaco } from '@monaco-editor/react';

const SAS_LANGUAGE_ID = 'sas';

export function registerSasLanguage(monaco: Monaco): void {
  // Only register once
  if (monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === SAS_LANGUAGE_ID)) {
    return;
  }

  monaco.languages.register({ id: SAS_LANGUAGE_ID });

  monaco.languages.setMonarchTokensProvider(SAS_LANGUAGE_ID, {
    ignoreCase: true,

    keywords: [
      'data', 'set', 'merge', 'by', 'where', 'output', 'retain', 'array',
      'do', 'end', 'if', 'then', 'else', 'run', 'quit', 'proc', 'options',
      'return', 'stop', 'drop', 'keep', 'rename', 'label', 'format',
      'informat', 'length', 'attrib', 'delete', 'call', 'link', 'goto',
      'abort', 'cards', 'datalines', 'endsas', 'in', 'not', 'and', 'or',
      'select', 'when', 'otherwise', 'leave', 'continue', 'to', 'until',
      'while', 'over', 'descending', 'nodup', 'nodupkey', 'out', 'as',
      'from', 'group', 'having', 'order', 'on', 'join', 'left', 'right',
      'inner', 'outer', 'full', 'cross', 'union', 'except', 'intersect',
      'into', 'case', 'create', 'table', 'view', 'insert', 'update',
      'values', 'like', 'between', 'is', 'null', 'exists', 'distinct',
      'calculated', 'class', 'var', 'weight', 'freq', 'tables', 'with',
      'noprint', 'obs', 'firstobs', 'infile', 'input', 'put', 'file',
      'dlm', 'missover', 'truncover', 'lrecl', 'column', 'define',
    ],

    procs: [
      'sort', 'sql', 'means', 'freq', 'transpose', 'print', 'contents',
      'import', 'export', 'datasets', 'tabulate', 'report', 'sgplot',
      'reg', 'logistic', 'glm', 'mixed', 'univariate', 'summary',
      'append', 'compare', 'copy', 'format', 'corr', 'rank', 'standard',
      'surveyselect', 'gplot', 'gchart', 'g3d', 'template', 'sgpanel',
      'phreg', 'lifetest', 'genmod', 'ttest', 'npar1way', 'anova',
      'factor', 'cluster', 'tree', 'varclus', 'princomp', 'candisc',
      'discrim', 'catmod', 'probit', 'nlmixed', 'surveymeans',
      'surveyfreq', 'surveylogistic', 'surveyreg', 'mi', 'mianalyze',
      'power', 'kde', 'loess', 'gam', 'pls',
    ],

    builtinFunctions: [
      'sum', 'mean', 'max', 'min', 'count', 'substr', 'trim', 'upcase',
      'lowcase', 'compress', 'scan', 'index', 'cat', 'catx', 'cats',
      'catt', 'strip', 'int', 'abs', 'round', 'ceil', 'floor', 'mod',
      'log', 'log2', 'log10', 'exp', 'sqrt', 'date', 'today', 'mdy',
      'datepart', 'timepart', 'intck', 'intnx', 'year', 'month', 'day',
      'hour', 'minute', 'second', 'lag', 'dif', 'n', 'nmiss', 'coalesce',
      'coalescec', 'first', 'last', 'missing', 'tranwrd', 'translate',
      'prxmatch', 'prxchange', 'prxparse', 'propcase', 'reverse', 'left',
      'right', 'verify', 'indexc', 'indexw', 'anyalpha', 'anydigit',
      'anypunct', 'countc', 'countw', 'find', 'findc', 'findw',
      'lengthc', 'lengthm', 'lengthn', 'repeat', 'byte', 'rank',
      'collate', 'kcompress', 'kstrip', 'kupcase', 'klowcase',
      'symget', 'symput', 'symputx', 'resolve',
      'ifn', 'ifc', 'whichc', 'whichn', 'choosec', 'choosen',
      'sign', 'constant', 'fact', 'comb', 'perm', 'gamma', 'lgamma',
      'beta', 'digamma', 'trigamma',
      'rand', 'ranuni', 'rannor', 'ranbin', 'ranpoi', 'rantbl',
      'uniform', 'normal',
      'dhms', 'hms', 'datetime', 'time',
      'weekday', 'qtr', 'week', 'juldate', 'yrdif',
      'inputn', 'inputc', 'putn', 'putc',
      'vname', 'vtype', 'vlabel', 'vformat', 'vinformat', 'vlength',
      'dim', 'hbound', 'lbound',
    ],

    specialVars: [
      '_n_', '_error_', '_all_', '_numeric_', '_character_', '_null_',
      '_infile_', '_last_', '_cmd_', '_msg_', '_iorc_', '_file_',
      '_type_', '_freq_', '_stat_', '_way_', '_page_',
    ],

    operators: [
      '=', '>', '<', '>=', '<=', '<>', '^=', '~=',
      '+', '-', '*', '/', '**',
      'eq', 'ne', 'gt', 'lt', 'ge', 'le',
    ],

    tokenizer: {
      root: [
        // Block comments /* ... */
        [/\/\*/, 'comment', '@blockComment'],

        // Statement comments: * ... ;
        [/^\s*\*/, 'comment', '@statementComment'],

        // Macro keywords: %macro, %let, %if, etc.
        [/%[a-zA-Z_]\w*/, {
          cases: {
            '%macro': 'keyword.macro',
            '%mend': 'keyword.macro',
            '%if': 'keyword.macro',
            '%then': 'keyword.macro',
            '%else': 'keyword.macro',
            '%do': 'keyword.macro',
            '%while': 'keyword.macro',
            '%until': 'keyword.macro',
            '%end': 'keyword.macro',
            '%let': 'keyword.macro',
            '%put': 'keyword.macro',
            '%include': 'keyword.macro',
            '%local': 'keyword.macro',
            '%global': 'keyword.macro',
            '%sysfunc': 'keyword.macro',
            '%eval': 'keyword.macro',
            '%sysevalf': 'keyword.macro',
            '%str': 'keyword.macro',
            '%nrstr': 'keyword.macro',
            '%bquote': 'keyword.macro',
            '%nrbquote': 'keyword.macro',
            '%unquote': 'keyword.macro',
            '%qsysfunc': 'keyword.macro',
            '%scan': 'keyword.macro',
            '%substr': 'keyword.macro',
            '%upcase': 'keyword.macro',
            '%lowcase': 'keyword.macro',
            '%length': 'keyword.macro',
            '%index': 'keyword.macro',
            '%symdel': 'keyword.macro',
            '%symexist': 'keyword.macro',
            '%abort': 'keyword.macro',
            '%return': 'keyword.macro',
            '%goto': 'keyword.macro',
            '%label': 'keyword.macro',
            '@default': 'keyword.macro',
          },
        }],

        // Macro variable references: &var, &&var, &var.
        [/&&?[a-zA-Z_]\w*\.?/, 'variable'],

        // Strings
        [/"/, 'string', '@doubleString'],
        [/'/, 'string', '@singleString'],

        // Numbers
        [/\b\d+\.?\d*(e[+-]?\d+)?\b/i, 'number'],
        [/\.\d+(e[+-]?\d+)?\b/i, 'number'],

        // Date/time/datetime literals: '01JAN2020'd, '12:00't, '01JAN2020:12:00'dt
        [/'[^']*'(d|t|dt)\b/i, 'number.date'],

        // Identifiers & keyword matching
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@specialVars': 'variable.predefined',
            '@builtinFunctions': 'predefined',
            '@procs': 'type',
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],

        // Semicolons (statement terminators — important in SAS)
        [/;/, 'delimiter'],

        // Operators
        [/[<>=!~^]+/, 'operator'],
        [/[+\-*/]/, 'operator'],
        [/\*\*/, 'operator'],

        // Whitespace
        [/\s+/, 'white'],
      ],

      blockComment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],

      statementComment: [
        [/[^;]+/, 'comment'],
        [/;/, 'comment', '@pop'],
      ],

      doubleString: [
        [/&&?[a-zA-Z_]\w*\.?/, 'variable'],  // macro vars inside double-quoted strings
        [/[^"&]+/, 'string'],
        [/""/, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],

      singleString: [
        [/[^']+/, 'string'],
        [/''/, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(SAS_LANGUAGE_ID, {
    comments: {
      lineComment: '*',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: "'", close: "'", notIn: ['string'] },
      { open: '"', close: '"', notIn: ['string'] },
      { open: '/*', close: '*/', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
    folding: {
      markers: {
        start: /^\s*(data|proc|%macro|do)\b/i,
        end: /^\s*(run|quit|%mend|end)\b/i,
      },
    },
  });
}
