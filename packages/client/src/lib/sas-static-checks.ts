export interface TranslationWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  sasConstruct: string;
  message: string;
  hiveLine: number | null;
}

export interface TranslationConfidence {
  confidence: 'high' | 'moderate' | 'low';
  warnings: TranslationWarning[];
}

interface StaticCheck {
  pattern: RegExp;
  severity: 'info' | 'warning' | 'error';
  sasConstruct: string;
  message: string;
}

const STATIC_CHECKS: StaticCheck[] = [
  {
    pattern: /%IF|%THEN|%ELSE/i,
    severity: 'error',
    sasConstruct: '%IF / %THEN / %ELSE',
    message:
      'Macro conditional logic cannot be directly translated to Hive. This section will need manual rewriting.',
  },
  {
    pattern: /CALL\s+EXECUTE/i,
    severity: 'error',
    sasConstruct: 'CALL EXECUTE',
    message:
      'CALL EXECUTE generates dynamic SAS code at runtime. There is no Hive equivalent — manual rewrite required.',
  },
  {
    pattern: /\bRETAIN\b/i,
    severity: 'warning',
    sasConstruct: 'RETAIN statement',
    message:
      'RETAIN is translated using LAG() window functions. Verify that the row ordering in the translated SQL matches your SAS dataset.',
  },
  {
    pattern: /first\.\w+|last\.\w+/i,
    severity: 'warning',
    sasConstruct: 'first./last. variables',
    message:
      'first./last. detection depends on row ordering. Confirm the ORDER BY clause in the translated ROW_NUMBER() matches your data.',
  },
  {
    pattern: /PROC\s+TRANSPOSE/i,
    severity: 'warning',
    sasConstruct: 'PROC TRANSPOSE',
    message:
      'PROC TRANSPOSE with multiple ID variables or BY groups may require additional manual adjustment.',
  },
  {
    pattern: /HASH\s+/i,
    severity: 'error',
    sasConstruct: 'Hash object',
    message:
      'SAS hash objects have no direct Hive equivalent. Consider rewriting as a JOIN.',
  },
  {
    pattern: /INTCK\s*\(/i,
    severity: 'info',
    sasConstruct: 'INTCK()',
    message:
      "SAS's INTCK counts calendar boundaries, not elapsed time. Hive's DATEDIFF counts elapsed days. Results may differ for month/year intervals.",
  },
  {
    pattern: /INTO\s*:/i,
    severity: 'info',
    sasConstruct: 'SELECT INTO :macvar',
    message:
      'Macro variable assignment from SELECT is translated to a SET statement. Verify the variable is referenced correctly downstream.',
  },
];

export function runStaticChecks(sasCode: string): TranslationWarning[] {
  return STATIC_CHECKS.filter((check) => check.pattern.test(sasCode)).map((check, i) => ({
    id: `static-${i}`,
    severity: check.severity,
    sasConstruct: check.sasConstruct,
    message: check.message,
    hiveLine: null,
  }));
}
