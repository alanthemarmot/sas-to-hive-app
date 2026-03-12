export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export function getMockFileTree(): FileNode {
  return {
    name: 'sas-repository',
    path: 'sas-repository',
    type: 'directory',
    children: [
      {
        name: 'reports',
        path: 'sas-repository/reports',
        type: 'directory',
        children: [
          { name: 'active_registrations.sas',    path: 'sas-repository/reports/active_registrations.sas',    type: 'file' },
          { name: 'outstanding_liabilities.sas', path: 'sas-repository/reports/outstanding_liabilities.sas', type: 'file' },
          { name: 'late_filing_report.sas',      path: 'sas-repository/reports/late_filing_report.sas',      type: 'file' },
        ],
      },
      {
        name: 'etl',
        path: 'sas-repository/etl',
        type: 'directory',
        children: [
          { name: 'customer_compliance_load.sas', path: 'sas-repository/etl/customer_compliance_load.sas', type: 'file' },
          { name: 'payment_reconciliation.sas',   path: 'sas-repository/etl/payment_reconciliation.sas',   type: 'file' },
          { name: 'returns_quality_check.sas',    path: 'sas-repository/etl/returns_quality_check.sas',    type: 'file' },
        ],
      },
      {
        name: 'analysis',
        path: 'sas-repository/analysis',
        type: 'directory',
        children: [
          { name: 'liability_trend_analysis.sas', path: 'sas-repository/analysis/liability_trend_analysis.sas', type: 'file' },
          { name: 'non_filers_report.sas',        path: 'sas-repository/analysis/non_filers_report.sas',        type: 'file' },
        ],
      },
      {
        name: 'macros',
        path: 'sas-repository/macros',
        type: 'directory',
        children: [
          { name: 'tax_utility_macros.sas',      path: 'sas-repository/macros/tax_utility_macros.sas',      type: 'file' },
          { name: 'period_reporting_macros.sas', path: 'sas-repository/macros/period_reporting_macros.sas', type: 'file' },
        ],
      },
    ],
  };
}

const FILE_CONTENTS: Record<string, string> = {

  /* =========================================================================
     EASY — Simple 3-table PROC SQL join, WHERE, ORDER BY
     Tables: customers, registrations, tax_heads
     ========================================================================= */
  'sas-repository/reports/active_registrations.sas': `/* Active Registrations Report
   Lists all currently active tax registrations with taxpayer details.
   Difficulty: Easy — 3-table PROC SQL join with basic filtering */

PROC SQL;
  CREATE TABLE work.active_registrations AS
  SELECT
    c.customer_id,
    c.tin,
    c.customer_type,
    CASE
      WHEN c.customer_type = 'INDIVIDUAL'
        THEN CATX(' ', c.first_name, c.last_name)
      ELSE c.company_name
    END AS taxpayer_name,
    c.county,
    th.tax_head_code,
    th.tax_head_name,
    th.filing_frequency,
    r.registration_number,
    r.registration_date,
    r.effective_from
  FROM sas_migration_samples.registrations AS r
  INNER JOIN sas_migration_samples.customers AS c
    ON r.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON r.tax_head_id = th.tax_head_id
  WHERE r.status      = 'ACTIVE'
    AND r.effective_to IS NULL
    AND c.status       = 'ACTIVE'
    AND th.is_active   = 1
  ORDER BY c.county, taxpayer_name, th.tax_head_code;
QUIT;

PROC PRINT DATA=work.active_registrations NOOBS;
  TITLE 'Active Tax Registrations — Current';
RUN;`,


  /* =========================================================================
     MEDIUM — Aggregation, COALESCE, INTCK, CASE urgency flag, GROUP BY/HAVING
     Tables: customers, tax_heads, liabilities
     ========================================================================= */
  'sas-repository/reports/outstanding_liabilities.sas': `/* Outstanding Liabilities Summary Report
   Aggregates unpaid and partially paid liabilities per taxpayer and tax head.
   Classifies urgency based on days until earliest due date.
   Difficulty: Medium — GROUP BY aggregation, COALESCE, INTCK, CASE expressions */

%LET report_dt = %SYSFUNC(TODAY(), DATE9.);

PROC SQL;
  CREATE TABLE work.outstanding_liabilities AS
  SELECT
    c.tin,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name)) AS taxpayer_name,
    c.customer_type,
    th.tax_head_code,
    l.liability_type,
    COUNT(*)                     AS liability_count,
    SUM(l.assessed_amount)       AS total_assessed,
    SUM(l.payments_applied)      AS total_paid,
    SUM(l.outstanding_amount)    AS total_outstanding,
    MIN(l.due_date)              AS earliest_due_date,
    CASE
      WHEN MIN(l.due_date) < TODAY()                          THEN 'OVERDUE'
      WHEN INTCK('DAY', TODAY(), MIN(l.due_date)) <= 30       THEN 'DUE_SOON'
      ELSE                                                         'CURRENT'
    END AS urgency_flag
  FROM sas_migration_samples.liabilities AS l
  INNER JOIN sas_migration_samples.customers AS c
    ON l.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON l.tax_head_id = th.tax_head_id
  WHERE l.outstanding_amount > 0
    AND l.status IN ('OUTSTANDING', 'PARTIALLY_PAID')
  GROUP BY c.tin, taxpayer_name, c.customer_type,
           th.tax_head_code, l.liability_type
  HAVING SUM(l.outstanding_amount) > 0
  ORDER BY total_outstanding DESC, c.tin;
QUIT;

PROC PRINT DATA=work.outstanding_liabilities NOOBS;
  TITLE "Outstanding Liabilities Summary — &report_dt";
  FORMAT total_assessed total_paid total_outstanding COMMA12.2;
RUN;`,


  /* =========================================================================
     MEDIUM — INTO: macro variables, INTCK calculated fields, CASE severity,
               estimated surcharge derived from net_liability
     Tables: customers, tax_heads, tax_returns
     ========================================================================= */
  'sas-repository/reports/late_filing_report.sas': `/* Late Filing Report
   Identifies returns filed after their due date, calculates days late,
   classifies severity, and estimates potential surcharge liability.
   Uses INTO: to store summary counts in macro variables.
   Difficulty: Medium — INTCK, INTO:, CASE expressions, calculated columns */

PROC SQL;
  /* Store headline counts for the report title */
  SELECT COUNT(*)               INTO :late_count     TRIMMED
  FROM sas_migration_samples.tax_returns
  WHERE status = 'LATE';

  SELECT COUNT(DISTINCT customer_id) INTO :late_customers TRIMMED
  FROM sas_migration_samples.tax_returns
  WHERE status = 'LATE';

  CREATE TABLE work.late_filings AS
  SELECT
    c.tin,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name))     AS taxpayer_name,
    th.tax_head_code,
    r.form_type,
    r.period_start,
    r.period_end,
    r.due_date,
    r.filing_date,
    INTCK('DAY', r.due_date, r.filing_date)             AS days_late,
    r.net_liability,
    CASE
      WHEN INTCK('DAY', r.due_date, r.filing_date) <=  7 THEN 'MINOR'
      WHEN INTCK('DAY', r.due_date, r.filing_date) <= 30 THEN 'MODERATE'
      ELSE                                                     'SIGNIFICANT'
    END AS late_severity,
    /* 5% surcharge on net liability for returns > 30 days late */
    CASE
      WHEN INTCK('DAY', r.due_date, r.filing_date) > 30
        THEN r.net_liability * 0.05
      ELSE .
    END AS estimated_surcharge
  FROM sas_migration_samples.tax_returns AS r
  INNER JOIN sas_migration_samples.customers AS c
    ON r.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON r.tax_head_id = th.tax_head_id
  WHERE r.status      = 'LATE'
    AND r.filing_date IS NOT NULL
  ORDER BY days_late DESC, th.tax_head_code;
QUIT;

PROC PRINT DATA=work.late_filings NOOBS;
  TITLE "Late Filing Report — &late_count returns across &late_customers taxpayers";
  FORMAT net_liability estimated_surcharge COMMA12.2;
  FORMAT period_start period_end due_date filing_date DATE9.;
RUN;`,


  /* =========================================================================
     MEDIUM — PROC SQL pre-aggregation, DATA step with INTCK, IF/THEN chain,
               categorical banding, KEEP statement
     Tables: customers, registrations, tax_returns
     ========================================================================= */
  'sas-repository/etl/customer_compliance_load.sas': `/* Customer Compliance Classification
   Loads an enriched customer compliance dataset combining registration
   and return history.  Uses a DATA step to derive tenure segment,
   liability band, and a compliance flag for follow-up.
   Difficulty: Medium — PROC SQL pre-aggregation + DATA step IF/THEN, INTCK, KEEP */

/* Step 1: Pull aggregated customer data from three tables */
PROC SQL;
  CREATE TABLE work.customer_base AS
  SELECT
    c.customer_id,
    c.tin,
    c.customer_type,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name))             AS taxpayer_name,
    c.registration_date,
    c.status                                                    AS customer_status,
    c.county,
    COUNT(r.registration_id)                                    AS total_registrations,
    SUM(CASE WHEN r.status = 'ACTIVE'
              AND r.effective_to IS NULL THEN 1 ELSE 0 END)     AS active_registrations,
    MAX(tr.net_liability)                                       AS max_annual_liability,
    AVG(tr.net_liability)                                       AS avg_annual_liability
  FROM sas_migration_samples.customers AS c
  LEFT JOIN sas_migration_samples.registrations AS r
    ON c.customer_id = r.customer_id
  LEFT JOIN sas_migration_samples.tax_returns AS tr
    ON c.customer_id = tr.customer_id
   AND tr.status IN ('FILED', 'LATE', 'AMENDED')
  GROUP BY c.customer_id, c.tin, c.customer_type, taxpayer_name,
           c.registration_date, c.status, c.county;
QUIT;

/* Step 2: Derive categorical attributes in a DATA step */
DATA work.customer_compliance;
  SET work.customer_base;

  /* Tenure in full years since first registration with Revenue */
  tenure_years = INTCK('YEAR', registration_date, TODAY());

  /* Classify by average annual net liability */
  IF      avg_annual_liability >= 100000 THEN liability_band = 'HIGH';
  ELSE IF avg_annual_liability >=  20000 THEN liability_band = 'MEDIUM';
  ELSE IF avg_annual_liability >       0 THEN liability_band = 'LOW';
  ELSE                                        liability_band = 'NONE';

  /* Flag active customers with no live registration for review */
  IF active_registrations = 0 AND customer_status = 'ACTIVE'
    THEN compliance_flag = 'REVIEW_REQUIRED';
  ELSE IF customer_status IN ('INACTIVE', 'DISSOLVED', 'DECEASED')
    THEN compliance_flag = 'INACTIVE';
  ELSE
    compliance_flag = 'OK';

  /* Segment by registration tenure */
  IF      tenure_years >= 20 THEN tenure_segment = 'LONG_STANDING';
  ELSE IF tenure_years >= 10 THEN tenure_segment = 'ESTABLISHED';
  ELSE IF tenure_years >=  5 THEN tenure_segment = 'GROWING';
  ELSE                             tenure_segment = 'NEW';

  KEEP customer_id tin customer_type taxpayer_name county
       tenure_years active_registrations total_registrations
       max_annual_liability avg_annual_liability
       liability_band compliance_flag tenure_segment;
RUN;`,


  /* =========================================================================
     HARD — Multi-step PROC SQL with subquery aggregation, LEFT JOIN, complex
             CASE reconciliation logic, DATA step BY-group with RETAIN for
             cumulative outstanding tracking
     Tables: customers, tax_heads, liabilities, payments
     ========================================================================= */
  'sas-repository/etl/payment_reconciliation.sas': `/* Payment Reconciliation
   Matches payments against assessed liabilities to identify overpayments,
   underpayments, and unmatched transactions.
   Difficulty: Hard — multi-step PROC SQL, subquery aggregation, LEFT JOIN,
                      RETAIN + BY-group DATA step, reconciliation diff logic */

/* Step 1: Consolidate net payments per liability return */
PROC SQL;
  CREATE TABLE work.payments_by_return AS
  SELECT
    customer_id,
    tax_head_id,
    return_id,
    SUM(CASE WHEN status = 'PROCESSED' THEN amount ELSE 0 END) AS processed_amount,
    SUM(CASE WHEN status = 'REVERSED'  THEN amount ELSE 0 END) AS reversed_amount,
    SUM(CASE WHEN status = 'PENDING'   THEN amount ELSE 0 END) AS pending_amount,
    SUM(CASE WHEN status = 'PROCESSED' THEN amount ELSE 0 END)
      - SUM(CASE WHEN status = 'REVERSED' THEN amount ELSE 0 END) AS net_paid,
    COUNT(*)             AS payment_count,
    MAX(payment_date)    AS last_payment_date,
    MIN(payment_date)    AS first_payment_date
  FROM sas_migration_samples.payments
  GROUP BY customer_id, tax_head_id, return_id;

  /* Step 2: Reconcile payments against liabilities */
  CREATE TABLE work.reconciliation AS
  SELECT
    c.tin,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name))         AS taxpayer_name,
    th.tax_head_code,
    l.liability_id,
    l.period_start,
    l.period_end,
    l.liability_type,
    l.assessed_amount,
    l.payments_applied                                      AS liability_payments_applied,
    l.outstanding_amount,
    l.status                                                AS liability_status,
    COALESCE(p.net_paid,       0)                          AS payments_net_paid,
    COALESCE(p.payment_count,  0)                          AS payment_transactions,
    p.last_payment_date,
    /* Difference between payments table and liability tracker */
    COALESCE(p.net_paid, 0) - l.payments_applied           AS reconciliation_diff,
    CASE
      WHEN l.outstanding_amount <= 0                              THEN 'CLEARED'
      WHEN COALESCE(p.net_paid, 0) > l.assessed_amount            THEN 'OVERPAID'
      WHEN COALESCE(p.net_paid, 0) > 0
       AND COALESCE(p.net_paid, 0) < l.assessed_amount            THEN 'PARTIALLY_PAID'
      WHEN COALESCE(p.net_paid, 0) = 0
       AND l.outstanding_amount    > 0                            THEN 'UNPAID'
      ELSE                                                             'OTHER'
    END AS recon_status
  FROM sas_migration_samples.liabilities AS l
  INNER JOIN sas_migration_samples.customers AS c
    ON l.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON l.tax_head_id = th.tax_head_id
  LEFT JOIN work.payments_by_return AS p
    ON  l.customer_id = p.customer_id
   AND  l.tax_head_id = p.tax_head_id
   AND  l.return_id   = p.return_id
  ORDER BY c.tin, th.tax_head_code, l.period_start;
QUIT;

/* Step 3: BY-group RETAIN to accumulate running outstanding per taxpayer */
PROC SORT DATA=work.reconciliation;
  BY tin tax_head_code period_start;
RUN;

DATA work.reconciliation_running;
  SET work.reconciliation;
  BY tin tax_head_code;

  RETAIN cumulative_outstanding 0;

  IF first.tin THEN cumulative_outstanding = 0;

  cumulative_outstanding = cumulative_outstanding + outstanding_amount;

  /* Surface only exceptions for further review */
  IF ABS(reconciliation_diff) > 0.01
    OR recon_status IN ('OVERPAID', 'UNPAID')
  THEN OUTPUT;
RUN;`,


  /* =========================================================================
     MEDIUM — PROC SORT NODUPKEY (dedup), PROC FREQ cross-tab, MISSING() checks
     Tables: tax_returns, customers, tax_heads
     ========================================================================= */
  'sas-repository/etl/returns_quality_check.sas': `/* Returns Data Quality Checks
   Validates the tax_returns table for duplicate entries, missing financial
   fields on filed returns, and distribution of return statuses.
   Difficulty: Medium — PROC SORT NODUPKEY, PROC FREQ cross-tab, MISSING() */

/* 1. Deduplicate: one return per customer / tax head / period */
PROC SORT DATA=sas_migration_samples.tax_returns
          OUT=work.returns_deduped
          NODUPKEY
          DUPOUT=work.duplicate_returns;
  BY customer_id tax_head_id period_start period_end;
RUN;

/* 2. Status distribution */
PROC FREQ DATA=work.returns_deduped;
  TABLES status / NOCUM OUT=work.status_freq;
  TITLE 'Return Status Distribution';
RUN;

/* 3. Form type by status cross-tabulation */
PROC FREQ DATA=work.returns_deduped;
  TABLES form_type * status / NOROW NOCOL OUT=work.formtype_status_freq;
  TITLE 'Form Type by Return Status';
RUN;

/* 4. Sort status frequency descending for the report */
PROC SORT DATA=work.status_freq;
  BY DESCENDING COUNT;
RUN;

/* 5. Identify filed/amended returns with missing financial values */
PROC SQL;
  CREATE TABLE work.returns_missing_financials AS
  SELECT
    r.return_id,
    c.tin,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name))  AS taxpayer_name,
    th.tax_head_code,
    r.form_type,
    r.period_start,
    r.period_end,
    r.status,
    CASE WHEN MISSING(r.gross_income)    THEN 'Y' ELSE 'N' END AS missing_income,
    CASE WHEN MISSING(r.total_liability) THEN 'Y' ELSE 'N' END AS missing_liability,
    CASE WHEN MISSING(r.net_liability)   THEN 'Y' ELSE 'N' END AS missing_net_liability,
    CATX(', ',
      IFC(MISSING(r.gross_income),    'gross_income',    ''),
      IFC(MISSING(r.total_liability), 'total_liability', ''),
      IFC(MISSING(r.net_liability),   'net_liability',   '')
    ) AS missing_fields
  FROM sas_migration_samples.tax_returns AS r
  INNER JOIN sas_migration_samples.customers AS c
    ON r.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON r.tax_head_id = th.tax_head_id
  WHERE r.status IN ('FILED', 'LATE', 'AMENDED')
    AND (MISSING(r.gross_income)
      OR MISSING(r.total_liability)
      OR MISSING(r.net_liability));
QUIT;`,


  /* =========================================================================
     HARD — PROC SQL multi-year aggregation, PROC MEANS for statistical summary,
             DATA step LAG + RETAIN for YoY change, Z-score, final join
     Tables: customers, tax_heads, liabilities
     ========================================================================= */
  'sas-repository/analysis/liability_trend_analysis.sas': `/* Annual Liability Trend Analysis
   Compares year-over-year assessed liabilities per tax head and customer type.
   Flags significant growth anomalies using a Z-score against the multi-year mean.
   Difficulty: Hard — multi-step PROC SQL, PROC MEANS, LAG/RETAIN DATA step,
                      YoY % change, Z-score join */

/* Step 1: Annual liability roll-up */
PROC SQL;
  CREATE TABLE work.annual_liability AS
  SELECT
    YEAR(l.period_start)                                        AS tax_year,
    th.tax_head_code,
    c.customer_type,
    COUNT(DISTINCT l.customer_id)                               AS customer_count,
    SUM(l.assessed_amount)                                      AS total_assessed,
    SUM(l.payments_applied)                                     AS total_collected,
    SUM(l.outstanding_amount)                                   AS total_outstanding,
    AVG(l.assessed_amount)                                      AS avg_assessment,
    SUM(CASE WHEN l.status = 'OUTSTANDING'
              THEN l.outstanding_amount ELSE 0 END)             AS overdue_amount,
    SUM(CASE WHEN l.liability_type = 'AUDIT'
              THEN l.assessed_amount  ELSE 0 END)               AS audit_raised,
    SUM(CASE WHEN l.liability_type = 'INTEREST'
              THEN l.assessed_amount  ELSE 0 END)               AS interest_charged
  FROM sas_migration_samples.liabilities AS l
  INNER JOIN sas_migration_samples.customers AS c
    ON l.customer_id = c.customer_id
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON l.tax_head_id = th.tax_head_id
  GROUP BY tax_year, th.tax_head_code, c.customer_type
  ORDER BY th.tax_head_code, c.customer_type, tax_year;
QUIT;

/* Step 2: Statistical benchmarks across all years per tax head */
PROC MEANS DATA=work.annual_liability NWAY NOPRINT;
  CLASS tax_head_code;
  VAR total_assessed total_outstanding;
  OUTPUT OUT=work.liability_stats(DROP=_TYPE_ _FREQ_)
    MEAN=mean_assessed mean_outstanding
    STD=std_assessed std_outstanding
    MIN=min_assessed max=max_assessed;
RUN;

/* Step 3: Year-over-year change using LAG within BY group */
PROC SORT DATA=work.annual_liability;
  BY tax_head_code customer_type tax_year;
RUN;

DATA work.liability_yoy;
  SET work.annual_liability;
  BY tax_head_code customer_type;

  prev_assessed     = LAG(total_assessed);
  prev_outstanding  = LAG(total_outstanding);

  IF NOT first.customer_type THEN DO;
    yoy_assessed_change = total_assessed - prev_assessed;
    IF prev_assessed > 0
      THEN yoy_assessed_pct = (yoy_assessed_change / prev_assessed) * 100;
    ELSE yoy_assessed_pct = .;

    IF      ABS(yoy_assessed_pct) > 20 THEN growth_flag = 'SIGNIFICANT';
    ELSE IF ABS(yoy_assessed_pct) > 10 THEN growth_flag = 'MODERATE';
    ELSE                                     growth_flag = 'STABLE';
  END;
  ELSE DO;
    yoy_assessed_change = .;
    yoy_assessed_pct    = .;
    growth_flag         = 'BASELINE';
  END;

  DROP prev_assessed prev_outstanding;
RUN;

/* Step 4: Attach statistical benchmarks and compute Z-score */
PROC SQL;
  CREATE TABLE work.liability_trend_report AS
  SELECT
    y.*,
    s.mean_assessed,
    s.std_assessed,
    CASE
      WHEN s.std_assessed > 0
        THEN (y.total_assessed - s.mean_assessed) / s.std_assessed
      ELSE .
    END AS z_score_assessed
  FROM work.liability_yoy AS y
  LEFT JOIN work.liability_stats AS s
    ON y.tax_head_code = s.tax_head_code
  ORDER BY y.tax_head_code, y.customer_type, y.tax_year;
QUIT;`,


  /* =========================================================================
     MEDIUM-HARD — LEFT JOIN anti-pattern (non-filers), INTNX expected period
                   window, correlated subquery for historical filing count
     Tables: customers, tax_heads, registrations, tax_returns
     ========================================================================= */
  'sas-repository/analysis/non_filers_report.sas': `/* Non-Filers Report
   Identifies taxpayers with active registrations who have NOT submitted
   a return for the most recent expected filing period for each tax head.
   Excludes once-off tax heads (CAT, SD).
   Difficulty: Medium-Hard — LEFT JOIN anti-join, INTNX window derivation,
                              correlated subquery, COALESCE null handling */

PROC SQL;
  /* Step 1: Derive expected filing period per active registration */
  CREATE TABLE work.expected_filers AS
  SELECT
    r.customer_id,
    r.tax_head_id,
    th.tax_head_code,
    th.tax_head_name,
    th.filing_frequency,
    r.registration_number,
    r.effective_from,
    CASE th.filing_frequency
      WHEN 'ANNUAL'    THEN INTNX('YEAR',  TODAY(), -1, 'BEGINNING')
      WHEN 'BIMONTHLY' THEN INTNX('MONTH', TODAY(), -3, 'BEGINNING')
      WHEN 'MONTHLY'   THEN INTNX('MONTH', TODAY(), -2, 'BEGINNING')
      WHEN 'QUARTERLY' THEN INTNX('QTR',   TODAY(), -1, 'BEGINNING')
      ELSE                  .
    END AS expected_period_start,
    CASE th.filing_frequency
      WHEN 'ANNUAL'    THEN INTNX('YEAR',  TODAY(), -1, 'END')
      WHEN 'BIMONTHLY' THEN INTNX('MONTH', TODAY(), -2, 'END')
      WHEN 'MONTHLY'   THEN INTNX('MONTH', TODAY(), -1, 'END')
      WHEN 'QUARTERLY' THEN INTNX('QTR',   TODAY(), -1, 'END')
      ELSE                  .
    END AS expected_period_end
  FROM sas_migration_samples.registrations AS r
  INNER JOIN sas_migration_samples.tax_heads AS th
    ON r.tax_head_id = th.tax_head_id
  WHERE r.status         = 'ACTIVE'
    AND r.effective_to   IS NULL
    AND th.filing_frequency NE 'ONCE'
    AND th.is_active     = 1;

  /* Step 2: Anti-join — expected filers with no matching filed return */
  CREATE TABLE work.non_filers AS
  SELECT
    ef.customer_id,
    c.tin,
    COALESCE(c.company_name,
             CATX(' ', c.first_name, c.last_name))    AS taxpayer_name,
    c.customer_type,
    c.county,
    c.status                                          AS customer_status,
    ef.tax_head_code,
    ef.tax_head_name,
    ef.filing_frequency,
    ef.registration_number,
    ef.effective_from,
    ef.expected_period_start,
    ef.expected_period_end,
    INTCK('YEAR', ef.effective_from, TODAY())         AS years_registered,
    COALESCE(hist.total_filed, 0)                     AS historical_filings
  FROM work.expected_filers AS ef
  INNER JOIN sas_migration_samples.customers AS c
    ON ef.customer_id = c.customer_id
  /* No return filed (or status is NOT_FILED) for the expected period */
  LEFT JOIN sas_migration_samples.tax_returns AS tr
    ON  ef.customer_id = tr.customer_id
   AND  ef.tax_head_id = tr.tax_head_id
   AND  tr.period_start = ef.expected_period_start
   AND  tr.period_end   = ef.expected_period_end
   AND  tr.status NOT IN ('NOT_FILED')
  /* Historical filing count for context */
  LEFT JOIN (
    SELECT customer_id, tax_head_id,
           COUNT(*) AS total_filed
    FROM sas_migration_samples.tax_returns
    WHERE status IN ('FILED', 'LATE', 'AMENDED')
    GROUP BY customer_id, tax_head_id
  ) AS hist
    ON ef.customer_id = hist.customer_id
   AND ef.tax_head_id = hist.tax_head_id
  WHERE tr.return_id IS NULL
    AND c.status = 'ACTIVE'
  ORDER BY ef.tax_head_code, taxpayer_name;
QUIT;

PROC PRINT DATA=work.non_filers NOOBS;
  TITLE 'Non-Filers — Current Expected Filing Period';
  VAR tin taxpayer_name tax_head_code filing_frequency
      expected_period_start expected_period_end historical_filings;
  FORMAT expected_period_start expected_period_end DATE9.;
RUN;`,


  /* =========================================================================
     MEDIUM — Parameterised %MACRO/%MEND, %LET, %PUT, %IF/%THEN, repeated use
               of the schema across three reusable macro definitions
     Tables: customers, registrations, tax_heads, tax_returns, liabilities
     ========================================================================= */
  'sas-repository/macros/tax_utility_macros.sas': `/* Tax Utility Macros
   Reusable macro definitions for common Revenue data operations.
   Difficulty: Medium — %MACRO/%MEND, %LET, %PUT, %IF/%THEN, parameterised PROC SQL */

%LET schema        = sas_migration_samples;
%LET report_date   = %SYSFUNC(TODAY(), DATE9.);
%LET current_year  = %SYSFUNC(YEAR(%SYSFUNC(TODAY())));

/* -----------------------------------------------------------------------
   Macro: get_customer_registrations
   Returns all registrations (active and historic) for a given TIN.
   ----------------------------------------------------------------------- */
%MACRO get_customer_registrations(tin=, out_ds=work.customer_regs);
  PROC SQL;
    CREATE TABLE &out_ds AS
    SELECT
      c.customer_id,
      c.tin,
      COALESCE(c.company_name,
               CATX(' ', c.first_name, c.last_name)) AS taxpayer_name,
      th.tax_head_code,
      th.tax_head_name,
      r.registration_number,
      r.status          AS reg_status,
      r.effective_from,
      r.effective_to
    FROM &schema..registrations AS r
    INNER JOIN &schema..customers AS c
      ON r.customer_id = c.customer_id
    INNER JOIN &schema..tax_heads AS th
      ON r.tax_head_id = th.tax_head_id
    WHERE c.tin = "&tin"
    ORDER BY th.tax_head_code, r.effective_from;
  QUIT;

  %PUT NOTE: Registrations for TIN &tin written to &out_ds (&SQLOBS rows).;
%MEND get_customer_registrations;


/* -----------------------------------------------------------------------
   Macro: outstanding_by_taxhead
   Summarises taxpayers with outstanding liabilities for a given tax head code.
   ----------------------------------------------------------------------- */
%MACRO outstanding_by_taxhead(tax_code=, out_ds=work.outstanding_taxhead);
  PROC SQL;
    CREATE TABLE &out_ds AS
    SELECT
      c.tin,
      COALESCE(c.company_name,
               CATX(' ', c.first_name, c.last_name)) AS taxpayer_name,
      c.customer_type,
      SUM(l.outstanding_amount)   AS total_outstanding,
      COUNT(*)                    AS liability_count,
      MIN(l.due_date)             AS earliest_due
    FROM &schema..liabilities AS l
    INNER JOIN &schema..customers AS c
      ON l.customer_id = c.customer_id
    INNER JOIN &schema..tax_heads AS th
      ON l.tax_head_id = th.tax_head_id
    WHERE th.tax_head_code    = "&tax_code"
      AND l.outstanding_amount > 0
    GROUP BY c.tin, taxpayer_name, c.customer_type
    ORDER BY total_outstanding DESC;
  QUIT;

  %IF &SQLOBS = 0 %THEN
    %PUT NOTE: No outstanding &tax_code liabilities found.;
  %ELSE
    %PUT NOTE: &SQLOBS &tax_code taxpayers have outstanding liabilities.;
%MEND outstanding_by_taxhead;


/* -----------------------------------------------------------------------
   Macro: check_return_compliance
   Lists all returns for a customer over the last N years, with days late.
   ----------------------------------------------------------------------- */
%MACRO check_return_compliance(customer_id=, years_back=3,
                               out_ds=work.compliance_check);
  PROC SQL;
    CREATE TABLE &out_ds AS
    SELECT
      YEAR(r.period_start)                              AS tax_year,
      th.tax_head_code,
      r.form_type,
      r.status,
      r.filing_date,
      r.due_date,
      INTCK('DAY', r.due_date, r.filing_date)           AS days_late_or_early,
      r.net_liability
    FROM &schema..tax_returns AS r
    INNER JOIN &schema..tax_heads AS th
      ON r.tax_head_id = th.tax_head_id
    WHERE r.customer_id  = &customer_id
      AND YEAR(r.period_start) >= (&current_year - &years_back)
    ORDER BY tax_year DESC, th.tax_head_code;
  QUIT;

  %IF &SQLOBS = 0 %THEN
    %PUT WARNING: No returns found for customer &customer_id in last &years_back years.;
  %ELSE
    %PUT NOTE: Found &SQLOBS returns for customer &customer_id.;
%MEND check_return_compliance;


/* === Invoke macros === */
%get_customer_registrations(tin=3456789B,    out_ds=work.patrick_gallagher_regs);
%outstanding_by_taxhead(tax_code=CT,         out_ds=work.ct_outstanding);
%check_return_compliance(customer_id=1001,   years_back=2,
                         out_ds=work.seamus_compliance);`,


  /* =========================================================================
     HARD — %DO loop over rolling years, INTNX bi-monthly period generation,
             %SYSFUNC / %EVAL arithmetic, dynamic output table naming,
             two macro definitions called inside %DO
     Tables: customers, registrations, tax_heads, tax_returns, payments
     ========================================================================= */
  'sas-repository/macros/period_reporting_macros.sas': `/* Period Reporting Macros
   Generates Income Tax annual compliance tables and VAT bi-monthly summaries
   for a rolling date range using %DO loops and dynamic table naming.
   Difficulty: Hard — %DO/%END, INTNX, %SYSFUNC, %EVAL, dynamic dataset names,
                      complex LEFT JOIN with subquery inside macro */

%LET schema       = sas_migration_samples;
%LET base_year    = %SYSFUNC(YEAR(%SYSFUNC(TODAY())));
%LET n_years_back = 2;

/* -----------------------------------------------------------------------
   Macro: generate_annual_it_report
   Produces an Income Tax (head_id=1) annual compliance snapshot for one year.
   Joins registrations → customers → returns → payments to derive balance.
   ----------------------------------------------------------------------- */
%MACRO generate_annual_it_report(tax_year=);
  %LET period_start = %SYSFUNC(MDY(1,  1,  &tax_year));
  %LET period_end   = %SYSFUNC(MDY(12, 31, &tax_year));

  PROC SQL;
    CREATE TABLE work.it_annual_&tax_year AS
    SELECT
      c.tin,
      c.first_name,
      c.last_name,
      c.county,
      INTCK('YEAR', c.registration_date, TODAY())             AS years_registered,
      COALESCE(r.status, 'NOT_FILED')                         AS return_status,
      COALESCE(r.gross_income,   0)                           AS gross_income,
      COALESCE(r.net_liability,  0)                           AS net_liability,
      COALESCE(p.net_paid,       0)                           AS amount_paid,
      COALESCE(r.net_liability,  0)
        - COALESCE(p.net_paid,   0)                           AS balance_outstanding,
      CASE
        WHEN r.status IS NULL OR r.status = 'NOT_FILED'       THEN 'NON_FILER'
        WHEN r.status = 'LATE'
         AND COALESCE(r.net_liability, 0)
              - COALESCE(p.net_paid, 0) > 0                   THEN 'LATE_AND_OWING'
        WHEN r.status = 'LATE'                                THEN 'LATE_FILED'
        WHEN COALESCE(r.net_liability, 0)
              - COALESCE(p.net_paid, 0) > 0                   THEN 'OWING'
        ELSE                                                       'COMPLIANT'
      END AS compliance_category
    FROM &schema..registrations AS reg
    INNER JOIN &schema..customers AS c
      ON reg.customer_id = c.customer_id
    LEFT JOIN &schema..tax_returns AS r
      ON  reg.customer_id = r.customer_id
     AND  reg.tax_head_id = r.tax_head_id
     AND  YEAR(r.period_start) = &tax_year
    LEFT JOIN (
      SELECT customer_id, tax_head_id,
             SUM(CASE WHEN status = 'PROCESSED' THEN amount ELSE 0 END)
               - SUM(CASE WHEN status = 'REVERSED'  THEN amount ELSE 0 END)
               AS net_paid
      FROM &schema..payments
      WHERE YEAR(period_start) = &tax_year
      GROUP BY customer_id, tax_head_id
    ) AS p
      ON  reg.customer_id = p.customer_id
     AND  reg.tax_head_id = p.tax_head_id
    WHERE reg.tax_head_id   = 1          /* Income Tax */
      AND reg.status        = 'ACTIVE'
      AND c.status          = 'ACTIVE'
      AND reg.effective_from
            <= %SYSFUNC(MDY(12, 31, &tax_year))
    ORDER BY c.county, c.last_name;
  QUIT;

  %PUT NOTE: IT report for &tax_year — &SQLOBS taxpayers in work.it_annual_&tax_year;
%MEND generate_annual_it_report;


/* -----------------------------------------------------------------------
   Macro: vat_period_summary
   Generates a VAT (head_id=2) receipt/compliance table for one bi-monthly period.
   ----------------------------------------------------------------------- */
%MACRO vat_period_summary(period_start=, period_end=, out_suffix=);
  PROC SQL;
    CREATE TABLE work.vat_summary_&out_suffix AS
    SELECT
      c.tin,
      COALESCE(c.company_name,
               CATX(' ', c.first_name, c.last_name))      AS taxpayer_name,
      r.net_liability                                      AS vat_net_due,
      COALESCE(p.total_paid, 0)                           AS vat_paid,
      r.net_liability - COALESCE(p.total_paid, 0)         AS vat_balance,
      r.status                                            AS return_status,
      p.last_payment_date,
      CASE
        WHEN r.status = 'NOT_FILED' OR r.status IS NULL   THEN 'NO_RETURN'
        WHEN r.status = 'LATE'                            THEN 'LATE_FILED'
        WHEN r.net_liability
              - COALESCE(p.total_paid, 0) > 0             THEN 'BALANCE_DUE'
        ELSE                                                   'COMPLIANT'
      END AS compliance_status
    FROM &schema..registrations AS reg
    INNER JOIN &schema..customers AS c
      ON reg.customer_id = c.customer_id
    LEFT JOIN &schema..tax_returns AS r
      ON  reg.customer_id = r.customer_id
     AND  reg.tax_head_id = r.tax_head_id
     AND  r.period_start  = "&period_start"d
     AND  r.period_end    = "&period_end"d
    LEFT JOIN (
      SELECT return_id,
             SUM(CASE WHEN status = 'PROCESSED' THEN amount ELSE 0 END) AS total_paid,
             MAX(payment_date) AS last_payment_date
      FROM &schema..payments
      WHERE status = 'PROCESSED'
      GROUP BY return_id
    ) AS p
      ON r.return_id = p.return_id
    WHERE reg.tax_head_id  = 2          /* VAT */
      AND reg.status       = 'ACTIVE'
      AND reg.effective_to IS NULL;
  QUIT;

  %PUT NOTE: VAT period &period_start–&period_end — &SQLOBS registrants (work.vat_summary_&out_suffix).;
%MEND vat_period_summary;


/* === Generate IT annual reports for rolling 2-year window === */
%DO yr = %EVAL(&base_year - &n_years_back) %TO %EVAL(&base_year - 1);
  %generate_annual_it_report(tax_year=&yr);
%END;

/* === VAT bi-monthly summaries for 2023 === */
%vat_period_summary(period_start=01JAN2023, period_end=28FEB2023, out_suffix=2023_01);
%vat_period_summary(period_start=01MAR2023, period_end=30APR2023, out_suffix=2023_03);
%vat_period_summary(period_start=01MAY2023, period_end=30JUN2023, out_suffix=2023_05);
%vat_period_summary(period_start=01JUL2023, period_end=31AUG2023, out_suffix=2023_07);`,
};

export function getMockFileContent(filePath: string): string | null {
  return FILE_CONTENTS[filePath] ?? null;
}
