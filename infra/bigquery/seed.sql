-- =============================================================================
-- Revenue Commissioners Sample Dataset
-- BigQuery Standard SQL — run against dataset: sas_migration_samples
--
-- Usage:
--   bq query --project_id=<YOUR_PROJECT> --use_legacy_sql=false < infra/bigquery/seed.sql
--
-- Tables:
--   1. customers       — taxpayer/entity master register
--   2. tax_heads       — tax type reference (IT, VAT, CT, CGT, PAYE, etc.)
--   3. registrations   — customer registrations per tax head
--   4. tax_returns     — filed (or unfiled) returns per customer/period
--   5. payments        — payments received against liabilities or preliminary tax
--   6. liabilities     — assessed amounts, outstanding balances, surcharges
-- =============================================================================


-- =============================================================================
-- 1. CUSTOMERS
-- Core taxpayer/entity master. Covers individuals, companies, and partnerships.
-- TIN = Tax Identification Number (PPSN for individuals, VAT/CHY number for entities)
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.customers` (
  customer_id       INT64   NOT NULL,
  tin               STRING  NOT NULL,
  customer_type     STRING  NOT NULL,   -- INDIVIDUAL | COMPANY | PARTNERSHIP | TRUST
  first_name        STRING,             -- populated for INDIVIDUAL / PARTNERSHIP only
  last_name         STRING,
  company_name      STRING,             -- populated for COMPANY / PARTNERSHIP
  date_of_birth     DATE,
  registration_date DATE    NOT NULL,
  address_line1     STRING,
  address_line2     STRING,
  city              STRING,
  county            STRING,
  eircode           STRING,
  status            STRING  NOT NULL    -- ACTIVE | INACTIVE | DECEASED | DISSOLVED
);

INSERT INTO `sas_migration_samples.customers` VALUES
  (1001, '1234567T',    'INDIVIDUAL',  'Seamus',   'Murphy',    NULL,                    DATE '1972-04-15', DATE '2005-03-01',  '14 Oak Drive',              NULL,             'Dublin',   'Dublin',   'D12 XY89', 'ACTIVE'),
  (1002, '2345678A',    'INDIVIDUAL',  'Aoife',    'O\'Brien',  NULL,                    DATE '1985-09-22', DATE '2010-07-14',  '3 Elm Court',               'Stillorgan',     'Dublin',   'Dublin',   'D18 AB12', 'ACTIVE'),
  (1003, '3456789B',    'INDIVIDUAL',  'Patrick',  'Gallagher', NULL,                    DATE '1960-01-08', DATE '1998-06-30',  '22 River Road',             NULL,             'Cork',     'Cork',     'T12 CD34', 'ACTIVE'),
  (1004, '4567890C',    'INDIVIDUAL',  'Niamh',    'Brennan',   NULL,                    DATE '1990-11-03', DATE '2015-02-20',  '7 Meadow Lane',             'Swords',         'Dublin',   'Dublin',   'K67 EF56', 'INACTIVE'),
  (1005, '5678901D',    'INDIVIDUAL',  'Ciarán',   'Walsh',     NULL,                    DATE '1978-06-25', DATE '2002-09-10',  '55 Castle Street',          NULL,             'Galway',   'Galway',   'H91 GH78', 'ACTIVE'),
  (1006, '6789012E',    'INDIVIDUAL',  'Síle',     'Doyle',     NULL,                    DATE '1995-03-17', DATE '2018-11-01',  '9 Harbour View',            'Dún Laoghaire',  'Dublin',   'Dublin',   'A96 IJ23', 'ACTIVE'),
  (2001, 'IE6388047V',  'COMPANY',     NULL,        NULL,        'Emerald Tech Ltd',     NULL,              DATE '2008-01-15',  '10 Silicon Dock',           'Grand Canal Sq', 'Dublin',   'Dublin',   'D02 KL34', 'ACTIVE'),
  (2002, 'IE9876543B',  'COMPANY',     NULL,        NULL,        'Atlantic Foods Ltd',   NULL,              DATE '2001-05-20',  'Unit 4 Cork Business Park', NULL,             'Cork',     'Cork',     'T23 MN56', 'ACTIVE'),
  (2003, 'IE5544332C',  'COMPANY',     NULL,        NULL,        'Shannon Logistics Ltd',NULL,              DATE '2012-11-01',  'Dock Road',                 NULL,             'Limerick', 'Limerick', 'V94 OP78', 'ACTIVE'),
  (2004, 'IE1122334D',  'COMPANY',     NULL,        NULL,        'Erin Services Ltd',    NULL,              DATE '1995-03-10',  '88 Lower Leeson St',        NULL,             'Dublin',   'Dublin',   'D02 QR90', 'DISSOLVED'),
  (3001, '7890123F',    'PARTNERSHIP', 'Joe',      'Connolly',  'Connolly & Sons',       DATE '1965-02-14', DATE '2000-08-05',  'Market Square',             NULL,             'Sligo',    'Sligo',    'F91 ST12', 'ACTIVE');


-- =============================================================================
-- 2. TAX_HEADS
-- Reference table for all tax types administered by Revenue.
-- filing_frequency drives return schedule logic in SAS batch jobs.
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.tax_heads` (
  tax_head_id       INT64   NOT NULL,
  tax_head_code     STRING  NOT NULL,
  tax_head_name     STRING  NOT NULL,
  description       STRING,
  filing_frequency  STRING  NOT NULL,   -- ANNUAL | BIMONTHLY | MONTHLY | ONCE | QUARTERLY
  standard_rate     NUMERIC,            -- primary rate as a decimal (e.g. 0.20 = 20%)
  is_active         BOOL    NOT NULL
);

INSERT INTO `sas_migration_samples.tax_heads` VALUES
  (1,  'IT',   'Income Tax',               'Annual self-assessed income tax for individuals and sole traders',    'ANNUAL',    0.40, TRUE),
  (2,  'VAT',  'Value Added Tax',           'Bi-monthly VAT returns for registered traders',                      'BIMONTHLY', 0.23, TRUE),
  (3,  'CT',   'Corporation Tax',           'Annual corporation tax for companies',                               'ANNUAL',    0.125,TRUE),
  (4,  'CGT',  'Capital Gains Tax',         'Tax on disposal of chargeable assets',                               'ANNUAL',    0.33, TRUE),
  (5,  'PAYE', 'Employer PAYE/PRSI',        'Monthly payroll tax submissions by employers',                       'MONTHLY',   0.40, TRUE),
  (6,  'CAT',  'Capital Acquisitions Tax',  'Tax on gifts and inheritances',                                      'ONCE',      0.33, TRUE),
  (7,  'SD',   'Stamp Duty',                'Duty on property and share transfers',                               'ONCE',      0.01, TRUE),
  (8,  'LPT',  'Local Property Tax',        'Annual self-assessed local property tax',                            'ANNUAL',    NULL, TRUE),
  (9,  'RCT',  'Relevant Contracts Tax',    'Tax deducted from payments in construction, forestry and meat',      'MONTHLY',   0.20, TRUE),
  (10, 'DIRT', 'Deposit Interest Ret. Tax', 'Tax deducted by financial institutions on deposit interest',         'ANNUAL',    0.33, FALSE);


-- =============================================================================
-- 3. REGISTRATIONS
-- Links customers to tax heads they are registered for.
-- effective_to = NULL means the registration is currently active.
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.registrations` (
  registration_id     INT64   NOT NULL,
  customer_id         INT64   NOT NULL,
  tax_head_id         INT64   NOT NULL,
  registration_number STRING  NOT NULL,
  registration_date   DATE    NOT NULL,
  effective_from      DATE    NOT NULL,
  effective_to        DATE,             -- NULL = currently active
  status              STRING  NOT NULL  -- ACTIVE | CEASED | SUSPENDED
);

INSERT INTO `sas_migration_samples.registrations` VALUES
  (10001, 1001, 1, 'IT-1001-2005',  DATE '2005-03-01', DATE '2005-01-01', NULL,              'ACTIVE'),
  (10002, 1001, 4, 'CGT-1001-2010', DATE '2010-06-15', DATE '2010-06-15', NULL,              'ACTIVE'),
  (10003, 1001, 8, 'LPT-1001-2013', DATE '2013-05-01', DATE '2013-01-01', NULL,              'ACTIVE'),
  (10004, 1002, 1, 'IT-1002-2010',  DATE '2010-07-14', DATE '2010-01-01', NULL,              'ACTIVE'),
  (10005, 1002, 8, 'LPT-1002-2013', DATE '2013-05-01', DATE '2013-01-01', NULL,              'ACTIVE'),
  (10006, 1003, 1, 'IT-1003-1998',  DATE '1998-06-30', DATE '1998-01-01', NULL,              'ACTIVE'),
  (10007, 1003, 2, 'VAT-1003-2003', DATE '2003-01-10', DATE '2003-01-01', NULL,              'ACTIVE'),
  (10008, 1003, 8, 'LPT-1003-2013', DATE '2013-05-01', DATE '2013-01-01', NULL,              'ACTIVE'),
  (10009, 1004, 1, 'IT-1004-2015',  DATE '2015-02-20', DATE '2015-01-01', DATE '2022-12-31', 'CEASED'),
  (10010, 1005, 1, 'IT-1005-2002',  DATE '2002-09-10', DATE '2002-01-01', NULL,              'ACTIVE'),
  (10011, 1006, 1, 'IT-1006-2018',  DATE '2018-11-01', DATE '2018-01-01', NULL,              'ACTIVE'),
  (10012, 2001, 3, 'CT-2001-2008',  DATE '2008-01-15', DATE '2008-01-01', NULL,              'ACTIVE'),
  (10013, 2001, 2, 'VAT-2001-2008', DATE '2008-02-01', DATE '2008-02-01', NULL,              'ACTIVE'),
  (10014, 2001, 5, 'PAYE-2001-2009',DATE '2009-03-01', DATE '2009-03-01', NULL,              'ACTIVE'),
  (10015, 2002, 3, 'CT-2002-2001',  DATE '2001-05-20', DATE '2001-01-01', NULL,              'ACTIVE'),
  (10016, 2002, 2, 'VAT-2002-2001', DATE '2001-06-01', DATE '2001-06-01', NULL,              'ACTIVE'),
  (10017, 2003, 3, 'CT-2003-2012',  DATE '2012-11-01', DATE '2012-01-01', NULL,              'ACTIVE'),
  (10018, 2003, 9, 'RCT-2003-2013', DATE '2013-01-15', DATE '2013-01-01', NULL,              'ACTIVE'),
  (10019, 2004, 3, 'CT-2004-1995',  DATE '1995-03-10', DATE '1995-01-01', DATE '2020-06-30', 'CEASED'),
  (10020, 3001, 2, 'VAT-3001-2000', DATE '2000-08-05', DATE '2000-08-01', NULL,              'ACTIVE'),
  (10021, 3001, 9, 'RCT-3001-2000', DATE '2000-08-05', DATE '2000-08-01', NULL,              'ACTIVE');


-- =============================================================================
-- 4. TAX_RETURNS
-- One row per return period per customer per tax head.
-- status NOT_FILED means a return was expected but not received.
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.tax_returns` (
  return_id         INT64   NOT NULL,
  customer_id       INT64   NOT NULL,
  tax_head_id       INT64   NOT NULL,
  form_type         STRING  NOT NULL,   -- Form11, CT1, VAT3, P30, CG1, IT38, etc.
  period_start      DATE    NOT NULL,
  period_end        DATE    NOT NULL,
  filing_date       DATE,               -- NULL if NOT_FILED
  due_date          DATE    NOT NULL,
  status            STRING  NOT NULL,   -- FILED | LATE | AMENDED | NOT_FILED
  gross_income      NUMERIC,
  total_deductions  NUMERIC,
  total_liability   NUMERIC,
  total_credits     NUMERIC,
  net_liability     NUMERIC
);

INSERT INTO `sas_migration_samples.tax_returns` VALUES
  -- Individual Income Tax (Form 11)
  (50001, 1001, 1, 'Form11', DATE '2022-01-01', DATE '2022-12-31', DATE '2023-10-31', DATE '2023-10-31', 'FILED',      85000.00,  12000.00,  27000.00,  3200.00, 23800.00),
  (50002, 1001, 1, 'Form11', DATE '2023-01-01', DATE '2023-12-31', DATE '2024-11-02', DATE '2024-10-31', 'LATE',       91000.00,  13500.00,  29500.00,  3200.00, 26300.00),
  (50003, 1002, 1, 'Form11', DATE '2022-01-01', DATE '2022-12-31', DATE '2023-10-28', DATE '2023-10-31', 'FILED',      62000.00,   8000.00,  18400.00,  3200.00, 15200.00),
  (50004, 1002, 1, 'Form11', DATE '2023-01-01', DATE '2023-12-31', DATE '2024-10-30', DATE '2024-10-31', 'FILED',      67500.00,   9200.00,  20800.00,  3200.00, 17600.00),
  (50005, 1003, 1, 'Form11', DATE '2022-01-01', DATE '2022-12-31', DATE '2023-10-31', DATE '2023-10-31', 'FILED',     120000.00,  18000.00,  43000.00,  3200.00, 39800.00),
  (50006, 1003, 1, 'Form11', DATE '2023-01-01', DATE '2023-12-31', DATE '2024-10-29', DATE '2024-10-31', 'FILED',     134000.00,  20000.00,  49200.00,  3200.00, 46000.00),
  (50007, 1005, 1, 'Form11', DATE '2022-01-01', DATE '2022-12-31', DATE '2023-10-31', DATE '2023-10-31', 'FILED',      48000.00,   6500.00,  12800.00,  3200.00,  9600.00),
  (50008, 1005, 1, 'Form11', DATE '2023-01-01', DATE '2023-12-31', NULL,              DATE '2024-10-31', 'NOT_FILED',      NULL,      NULL,      NULL,     NULL,     NULL),
  (50009, 1006, 1, 'Form11', DATE '2023-01-01', DATE '2023-12-31', DATE '2024-10-25', DATE '2024-10-31', 'FILED',      38000.00,   4200.00,   8960.00,  3200.00,  5760.00),
  -- Corporation Tax (CT1)
  (50010, 2001, 3, 'CT1',    DATE '2022-01-01', DATE '2022-12-31', DATE '2023-09-23', DATE '2023-09-23', 'FILED',    1200000.00, 250000.00, 150000.00,     0.00,150000.00),
  (50011, 2001, 3, 'CT1',    DATE '2023-01-01', DATE '2023-12-31', DATE '2024-09-23', DATE '2024-09-23', 'FILED',    1450000.00, 300000.00, 181250.00,     0.00,181250.00),
  (50012, 2002, 3, 'CT1',    DATE '2022-01-01', DATE '2022-12-31', DATE '2023-09-23', DATE '2023-09-23', 'FILED',     880000.00, 190000.00, 110000.00,     0.00,110000.00),
  (50013, 2003, 3, 'CT1',    DATE '2022-01-01', DATE '2022-12-31', DATE '2023-09-23', DATE '2023-09-23', 'FILED',     540000.00, 120000.00,  67500.00,     0.00, 67500.00),
  (50014, 2003, 3, 'CT1',    DATE '2023-01-01', DATE '2023-12-31', NULL,              DATE '2024-09-23', 'NOT_FILED',      NULL,      NULL,      NULL,     NULL,     NULL),
  -- VAT Returns (VAT3, bi-monthly periods)
  (50015, 1003, 2, 'VAT3',   DATE '2023-01-01', DATE '2023-02-28', DATE '2023-03-19', DATE '2023-03-19', 'FILED',      45000.00,     0.00,  10350.00,  6200.00,  4150.00),
  (50016, 1003, 2, 'VAT3',   DATE '2023-03-01', DATE '2023-04-30', DATE '2023-05-19', DATE '2023-05-19', 'FILED',      52000.00,     0.00,  11960.00,  7100.00,  4860.00),
  (50017, 2001, 2, 'VAT3',   DATE '2023-01-01', DATE '2023-02-28', DATE '2023-03-19', DATE '2023-03-19', 'FILED',     380000.00,     0.00,  87400.00, 62000.00, 25400.00),
  (50018, 2001, 2, 'VAT3',   DATE '2023-03-01', DATE '2023-04-30', DATE '2023-05-19', DATE '2023-05-19', 'FILED',     410000.00,     0.00,  94300.00, 66000.00, 28300.00),
  (50019, 2002, 2, 'VAT3',   DATE '2023-01-01', DATE '2023-02-28', DATE '2023-03-20', DATE '2023-03-19', 'LATE',      220000.00,     0.00,  50600.00, 38000.00, 12600.00),
  -- CGT return
  (50020, 1003, 4, 'CG1',    DATE '2023-01-01', DATE '2023-12-31', DATE '2023-11-30', DATE '2023-11-30', 'FILED',      75000.00,   1270.00,  24301.00,     0.00, 24301.00);


-- =============================================================================
-- 5. PAYMENTS
-- Payments received. May be linked to a specific return (return_id) or
-- standalone preliminary tax / LPT payments (return_id = NULL).
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.payments` (
  payment_id      INT64   NOT NULL,
  customer_id     INT64   NOT NULL,
  tax_head_id     INT64   NOT NULL,
  return_id       INT64,               -- NULL for preliminary tax / LPT / standalone
  payment_date    DATE    NOT NULL,
  period_start    DATE    NOT NULL,
  period_end      DATE    NOT NULL,
  amount          NUMERIC NOT NULL,
  payment_method  STRING  NOT NULL,    -- BANK_TRANSFER | DIRECT_DEBIT | CHEQUE | ONLINE | DEBIT_CARD
  reference       STRING  NOT NULL,
  status          STRING  NOT NULL     -- PROCESSED | PENDING | REVERSED
);

INSERT INTO `sas_migration_samples.payments` VALUES
  -- Income Tax
  (70001, 1001, 1, 50001, DATE '2023-10-31', DATE '2022-01-01', DATE '2022-12-31',  23800.00, 'ONLINE',          'PMT-IT-1001-2022',   'PROCESSED'),
  (70002, 1001, 1, 50002, DATE '2024-11-02', DATE '2023-01-01', DATE '2023-12-31',  26300.00, 'BANK_TRANSFER',   'PMT-IT-1001-2023',   'PROCESSED'),
  (70003, 1001, 1, NULL,  DATE '2024-10-15', DATE '2024-01-01', DATE '2024-12-31',  24000.00, 'ONLINE',          'PMT-IT-PREL-1001',   'PROCESSED'),
  (70004, 1002, 1, 50003, DATE '2023-10-28', DATE '2022-01-01', DATE '2022-12-31',  15200.00, 'DIRECT_DEBIT',    'PMT-IT-1002-2022',   'PROCESSED'),
  (70005, 1002, 1, 50004, DATE '2024-10-30', DATE '2023-01-01', DATE '2023-12-31',  17600.00, 'DIRECT_DEBIT',    'PMT-IT-1002-2023',   'PROCESSED'),
  (70006, 1003, 1, 50005, DATE '2023-10-31', DATE '2022-01-01', DATE '2022-12-31',  39800.00, 'BANK_TRANSFER',   'PMT-IT-1003-2022',   'PROCESSED'),
  (70007, 1003, 1, 50006, DATE '2024-10-29', DATE '2023-01-01', DATE '2023-12-31',  46000.00, 'BANK_TRANSFER',   'PMT-IT-1003-2023',   'PROCESSED'),
  (70008, 1005, 1, 50007, DATE '2023-10-31', DATE '2022-01-01', DATE '2022-12-31',   9600.00, 'ONLINE',          'PMT-IT-1005-2022',   'PROCESSED'),
  (70009, 1006, 1, 50009, DATE '2024-10-25', DATE '2023-01-01', DATE '2023-12-31',   5760.00, 'DEBIT_CARD',      'PMT-IT-1006-2023',   'PROCESSED'),
  -- Corporation Tax
  (70010, 2001, 3, 50010, DATE '2023-09-23', DATE '2022-01-01', DATE '2022-12-31', 150000.00, 'BANK_TRANSFER',   'PMT-CT-2001-2022',   'PROCESSED'),
  (70011, 2001, 3, 50011, DATE '2024-09-23', DATE '2023-01-01', DATE '2023-12-31', 181250.00, 'BANK_TRANSFER',   'PMT-CT-2001-2023',   'PROCESSED'),
  (70012, 2001, 3, NULL,  DATE '2024-06-21', DATE '2024-01-01', DATE '2024-12-31', 140000.00, 'BANK_TRANSFER',   'PMT-CT-PREL-2001',   'PROCESSED'),
  (70013, 2002, 3, 50012, DATE '2023-09-23', DATE '2022-01-01', DATE '2022-12-31', 110000.00, 'BANK_TRANSFER',   'PMT-CT-2002-2022',   'PROCESSED'),
  (70014, 2003, 3, 50013, DATE '2023-09-23', DATE '2022-01-01', DATE '2022-12-31',  45000.00, 'BANK_TRANSFER',   'PMT-CT-2003-PART',   'PROCESSED'),
  -- VAT
  (70015, 1003, 2, 50015, DATE '2023-03-19', DATE '2023-01-01', DATE '2023-02-28',   4150.00, 'ONLINE',          'PMT-VAT-1003-0123',  'PROCESSED'),
  (70016, 1003, 2, 50016, DATE '2023-05-19', DATE '2023-03-01', DATE '2023-04-30',   4860.00, 'ONLINE',          'PMT-VAT-1003-0323',  'PROCESSED'),
  (70017, 2001, 2, 50017, DATE '2023-03-19', DATE '2023-01-01', DATE '2023-02-28',  25400.00, 'DIRECT_DEBIT',    'PMT-VAT-2001-0123',  'PROCESSED'),
  (70018, 2001, 2, 50018, DATE '2023-05-19', DATE '2023-03-01', DATE '2023-04-30',  28300.00, 'DIRECT_DEBIT',    'PMT-VAT-2001-0323',  'PROCESSED'),
  (70019, 2002, 2, 50019, DATE '2023-03-25', DATE '2023-01-01', DATE '2023-02-28',  12600.00, 'BANK_TRANSFER',   'PMT-VAT-2002-0123',  'PROCESSED'),
  -- LPT direct debits
  (70020, 1001, 8, NULL,  DATE '2024-03-21', DATE '2024-01-01', DATE '2024-12-31',    450.00, 'DIRECT_DEBIT',    'PMT-LPT-1001-2024',  'PROCESSED'),
  (70021, 1002, 8, NULL,  DATE '2024-03-21', DATE '2024-01-01', DATE '2024-12-31',    315.00, 'DIRECT_DEBIT',    'PMT-LPT-1002-2024',  'PROCESSED'),
  (70022, 1003, 8, NULL,  DATE '2024-03-21', DATE '2024-01-01', DATE '2024-12-31',    690.00, 'DIRECT_DEBIT',    'PMT-LPT-1003-2024',  'PROCESSED'),
  -- CGT
  (70023, 1003, 4, 50020, DATE '2023-11-30', DATE '2023-01-01', DATE '2023-12-31',  24301.00, 'BANK_TRANSFER',   'PMT-CGT-1003-2023',  'PROCESSED'),
  -- Reversed payment example
  (70024, 1004, 1, NULL,  DATE '2022-05-10', DATE '2021-01-01', DATE '2021-12-31',   8200.00, 'CHEQUE',          'PMT-IT-1004-REV',    'REVERSED');


-- =============================================================================
-- 6. LIABILITIES
-- Assessed amounts owed. Covers self-assessed, audit-raised, interest,
-- and surcharge liabilities. outstanding_amount = assessed_amount - payments_applied.
-- =============================================================================
CREATE OR REPLACE TABLE `sas_migration_samples.liabilities` (
  liability_id       INT64   NOT NULL,
  customer_id        INT64   NOT NULL,
  tax_head_id        INT64   NOT NULL,
  return_id          INT64,             -- NULL for audit / interest liabilities raised independently
  period_start       DATE    NOT NULL,
  period_end         DATE    NOT NULL,
  assessed_amount    NUMERIC NOT NULL,
  payments_applied   NUMERIC NOT NULL,
  outstanding_amount NUMERIC NOT NULL,
  due_date           DATE    NOT NULL,
  liability_type     STRING  NOT NULL,  -- SELF_ASSESSED | AUDIT | INTEREST | SURCHARGE | AMENDED
  status             STRING  NOT NULL   -- OUTSTANDING | PAID | PARTIALLY_PAID | WRITTEN_OFF
);

INSERT INTO `sas_migration_samples.liabilities` VALUES
  -- Income Tax self-assessed
  (90001, 1001, 1, 50001, DATE '2022-01-01', DATE '2022-12-31',  23800.00,  23800.00,      0.00, DATE '2023-10-31', 'SELF_ASSESSED', 'PAID'),
  (90002, 1001, 1, 50002, DATE '2023-01-01', DATE '2023-12-31',  26300.00,  26300.00,      0.00, DATE '2024-10-31', 'SELF_ASSESSED', 'PAID'),
  -- Surcharge on late 2023 return for customer 1001 (2% of net liability)
  (90003, 1001, 1, 50002, DATE '2023-01-01', DATE '2023-12-31',    526.00,      0.00,    526.00, DATE '2025-01-31', 'SURCHARGE',    'OUTSTANDING'),
  (90004, 1002, 1, 50003, DATE '2022-01-01', DATE '2022-12-31',  15200.00,  15200.00,      0.00, DATE '2023-10-31', 'SELF_ASSESSED', 'PAID'),
  (90005, 1002, 1, 50004, DATE '2023-01-01', DATE '2023-12-31',  17600.00,  17600.00,      0.00, DATE '2024-10-31', 'SELF_ASSESSED', 'PAID'),
  (90006, 1003, 1, 50005, DATE '2022-01-01', DATE '2022-12-31',  39800.00,  39800.00,      0.00, DATE '2023-10-31', 'SELF_ASSESSED', 'PAID'),
  (90007, 1003, 1, 50006, DATE '2023-01-01', DATE '2023-12-31',  46000.00,  46000.00,      0.00, DATE '2024-10-31', 'SELF_ASSESSED', 'PAID'),
  (90008, 1005, 1, 50007, DATE '2022-01-01', DATE '2022-12-31',   9600.00,   9600.00,      0.00, DATE '2023-10-31', 'SELF_ASSESSED', 'PAID'),
  -- Estimated / audit-raised liability for 1005 who has not filed 2023 return
  (90009, 1005, 1, NULL,  DATE '2023-01-01', DATE '2023-12-31',  10500.00,      0.00,  10500.00, DATE '2025-03-31', 'AUDIT',        'OUTSTANDING'),
  (90010, 1006, 1, 50009, DATE '2023-01-01', DATE '2023-12-31',   5760.00,   5760.00,      0.00, DATE '2024-10-31', 'SELF_ASSESSED', 'PAID'),
  -- Corporation Tax
  (90011, 2001, 3, 50010, DATE '2022-01-01', DATE '2022-12-31', 150000.00, 150000.00,      0.00, DATE '2023-09-23', 'SELF_ASSESSED', 'PAID'),
  (90012, 2001, 3, 50011, DATE '2023-01-01', DATE '2023-12-31', 181250.00, 181250.00,      0.00, DATE '2024-09-23', 'SELF_ASSESSED', 'PAID'),
  (90013, 2002, 3, 50012, DATE '2022-01-01', DATE '2022-12-31', 110000.00, 110000.00,      0.00, DATE '2023-09-23', 'SELF_ASSESSED', 'PAID'),
  -- Shannon Logistics partial payment — still owes 22,500
  (90014, 2003, 3, 50013, DATE '2022-01-01', DATE '2022-12-31',  67500.00,  45000.00,  22500.00, DATE '2023-09-23', 'SELF_ASSESSED', 'PARTIALLY_PAID'),
  -- Interest on Shannon Logistics outstanding balance
  (90015, 2003, 3, NULL,  DATE '2022-01-01', DATE '2022-12-31',   1530.00,      0.00,   1530.00, DATE '2025-03-31', 'INTEREST',     'OUTSTANDING'),
  -- VAT
  (90016, 1003, 2, 50015, DATE '2023-01-01', DATE '2023-02-28',   4150.00,   4150.00,      0.00, DATE '2023-03-19', 'SELF_ASSESSED', 'PAID'),
  (90017, 1003, 2, 50016, DATE '2023-03-01', DATE '2023-04-30',   4860.00,   4860.00,      0.00, DATE '2023-05-19', 'SELF_ASSESSED', 'PAID'),
  (90018, 2001, 2, 50017, DATE '2023-01-01', DATE '2023-02-28',  25400.00,  25400.00,      0.00, DATE '2023-03-19', 'SELF_ASSESSED', 'PAID'),
  (90019, 2001, 2, 50018, DATE '2023-03-01', DATE '2023-04-30',  28300.00,  28300.00,      0.00, DATE '2023-05-19', 'SELF_ASSESSED', 'PAID'),
  (90020, 2002, 2, 50019, DATE '2023-01-01', DATE '2023-02-28',  12600.00,  12600.00,      0.00, DATE '2023-03-19', 'SELF_ASSESSED', 'PAID'),
  -- Interest on Atlantic Foods late VAT payment (1 week late × daily interest)
  (90021, 2002, 2, 50019, DATE '2023-01-01', DATE '2023-02-28',    252.00,      0.00,    252.00, DATE '2023-06-30', 'INTEREST',     'OUTSTANDING'),
  -- CGT
  (90022, 1003, 4, 50020, DATE '2023-01-01', DATE '2023-12-31',  24301.00,  24301.00,      0.00, DATE '2023-11-30', 'SELF_ASSESSED', 'PAID');
