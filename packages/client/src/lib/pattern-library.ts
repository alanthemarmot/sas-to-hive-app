export interface SasPattern {
  id: string;
  category: string;
  title: string;
  description: string;
  sasCode: string;
  hiveCode: string;
  notes?: string;
  tags: string[];
}

export const PATTERN_CATEGORIES = [
  'Sorting & Deduplication',
  'Aggregation & Summaries',
  'Merging & Joining',
  'Reshaping & Transposing',
  'Filtering & Subsetting',
  'Dates & Times',
  'String Functions',
  'Macros & Variables',
  'Missing Values',
  'Table Creation',
] as const;

export const PATTERNS: SasPattern[] = [
  // ── Sorting & Deduplication ───────────────────────────────────────
  {
    id: 'sort-basic',
    category: 'Sorting & Deduplication',
    title: 'Sort by one column',
    description: 'Orders all rows in a dataset by a single column in ascending order.',
    sasCode: `PROC SORT DATA=work.sales OUT=work.sales_sorted;
  BY region;
RUN;`,
    hiveCode: `CREATE TABLE sales_sorted STORED AS ORC AS
SELECT *
FROM sales
ORDER BY region;`,
    tags: ['proc sort', 'order by'],
  },
  {
    id: 'sort-multi',
    category: 'Sorting & Deduplication',
    title: 'Sort by multiple columns',
    description: 'Orders rows by multiple columns, with descending on the second column.',
    sasCode: `PROC SORT DATA=work.sales OUT=work.sales_sorted;
  BY region DESCENDING revenue;
RUN;`,
    hiveCode: `CREATE TABLE sales_sorted STORED AS ORC AS
SELECT *
FROM sales
ORDER BY region ASC, revenue DESC;`,
    tags: ['proc sort', 'order by', 'descending'],
  },
  {
    id: 'sort-nodupkey',
    category: 'Sorting & Deduplication',
    title: 'Remove duplicates (NODUPKEY, single key)',
    description: 'Keeps only the first row for each unique value of the BY variable — equivalent to deduplication.',
    sasCode: `PROC SORT DATA=work.customers NODUPKEY;
  BY customer_id;
RUN;`,
    hiveCode: `CREATE TABLE customers_deduped STORED AS ORC AS
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id
      ORDER BY customer_id
    ) AS rn
  FROM customers
) t
WHERE rn = 1;`,
    notes: 'The ORDER BY inside the window function determines which duplicate is kept. Adjust it to match your SAS sort order.',
    tags: ['proc sort', 'nodupkey', 'deduplication', 'row_number'],
  },
  {
    id: 'sort-nodupkey-composite',
    category: 'Sorting & Deduplication',
    title: 'Remove duplicates (NODUPKEY, composite key)',
    description: 'Deduplicates by a combination of multiple BY variables.',
    sasCode: `PROC SORT DATA=work.orders NODUPKEY;
  BY customer_id order_date;
RUN;`,
    hiveCode: `CREATE TABLE orders_deduped STORED AS ORC AS
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id, order_date
      ORDER BY customer_id, order_date
    ) AS rn
  FROM orders
) t
WHERE rn = 1;`,
    notes: 'All BY variables become the PARTITION BY clause. Choose an ORDER BY that reflects which row you want to keep.',
    tags: ['proc sort', 'nodupkey', 'composite key', 'deduplication'],
  },

  // ── Aggregation & Summaries ───────────────────────────────────────
  {
    id: 'agg-freq',
    category: 'Aggregation & Summaries',
    title: 'Count rows per group (PROC FREQ)',
    description: 'Counts the number of rows for each distinct value of a variable.',
    sasCode: `PROC FREQ DATA=work.orders;
  TABLES region / NOCUM NOPERCENT;
RUN;`,
    hiveCode: `SELECT region, COUNT(*) AS frequency
FROM orders
GROUP BY region
ORDER BY region;`,
    tags: ['proc freq', 'count', 'group by'],
  },
  {
    id: 'agg-means',
    category: 'Aggregation & Summaries',
    title: 'Sum and average per group (PROC MEANS)',
    description: 'Calculates the sum and mean of a numeric variable, grouped by a class variable.',
    sasCode: `PROC MEANS DATA=work.sales SUM MEAN;
  CLASS region;
  VAR revenue;
RUN;`,
    hiveCode: `SELECT
  region,
  SUM(revenue)  AS revenue_sum,
  AVG(revenue)  AS revenue_mean
FROM sales
GROUP BY region;`,
    tags: ['proc means', 'sum', 'avg', 'group by'],
  },
  {
    id: 'agg-summary-output',
    category: 'Aggregation & Summaries',
    title: 'Multiple statistics with output (PROC SUMMARY)',
    description: 'Produces N, SUM, MEAN, MIN, MAX and saves results to a new dataset.',
    sasCode: `PROC SUMMARY DATA=work.sales NWAY;
  CLASS region product;
  VAR revenue quantity;
  OUTPUT OUT=work.summary(DROP=_TYPE_ _FREQ_)
    N= SUM= MEAN= MIN= MAX=;
RUN;`,
    hiveCode: `CREATE TABLE summary STORED AS ORC AS
SELECT
  region,
  product,
  COUNT(*)          AS _n,
  SUM(revenue)      AS revenue_sum,
  AVG(revenue)      AS revenue_mean,
  MIN(revenue)      AS revenue_min,
  MAX(revenue)      AS revenue_max,
  SUM(quantity)     AS quantity_sum,
  AVG(quantity)     AS quantity_mean,
  MIN(quantity)     AS quantity_min,
  MAX(quantity)     AS quantity_max
FROM sales
GROUP BY region, product;`,
    notes: 'SAS auto-generates column names with prefixes. In Hive, name each aggregate explicitly.',
    tags: ['proc summary', 'output', 'n', 'sum', 'mean', 'min', 'max'],
  },
  {
    id: 'agg-grand-total',
    category: 'Aggregation & Summaries',
    title: 'Grand total with subtotals',
    description: 'Produces subtotals per group and a grand total row using GROUPING SETS.',
    sasCode: `PROC MEANS DATA=work.sales SUM;
  CLASS region;
  VAR revenue;
  WAYS 0 1;
RUN;`,
    hiveCode: `SELECT
  COALESCE(region, 'Grand Total') AS region,
  SUM(revenue) AS revenue_sum
FROM sales
GROUP BY region
WITH ROLLUP;`,
    tags: ['proc means', 'ways', 'rollup', 'grand total'],
  },

  // ── Merging & Joining ─────────────────────────────────────────────
  {
    id: 'join-inner',
    category: 'Merging & Joining',
    title: 'Inner join (PROC SQL / DATA MERGE)',
    description: 'Combines rows from two tables where the key matches in both.',
    sasCode: `PROC SQL;
  CREATE TABLE work.combined AS
  SELECT a.*, b.region_name
  FROM work.orders AS a
  INNER JOIN work.regions AS b
    ON a.region_id = b.region_id;
QUIT;`,
    hiveCode: `CREATE TABLE combined STORED AS ORC AS
SELECT a.*, b.region_name
FROM orders a
INNER JOIN regions b
  ON a.region_id = b.region_id;`,
    tags: ['proc sql', 'inner join', 'merge'],
  },
  {
    id: 'join-left',
    category: 'Merging & Joining',
    title: 'Left join',
    description: 'Keeps all rows from the left table, with matching data from the right table where available.',
    sasCode: `PROC SQL;
  CREATE TABLE work.combined AS
  SELECT a.*, b.region_name
  FROM work.orders AS a
  LEFT JOIN work.regions AS b
    ON a.region_id = b.region_id;
QUIT;`,
    hiveCode: `CREATE TABLE combined STORED AS ORC AS
SELECT a.*, b.region_name
FROM orders a
LEFT JOIN regions b
  ON a.region_id = b.region_id;`,
    tags: ['proc sql', 'left join'],
  },
  {
    id: 'join-anti',
    category: 'Merging & Joining',
    title: 'Anti-join (rows in A but not B)',
    description: 'Finds rows in the first table that have no matching key in the second table.',
    sasCode: `PROC SQL;
  CREATE TABLE work.unmatched AS
  SELECT a.*
  FROM work.orders AS a
  LEFT JOIN work.returns AS b
    ON a.order_id = b.order_id
  WHERE b.order_id IS NULL;
QUIT;`,
    hiveCode: `CREATE TABLE unmatched STORED AS ORC AS
SELECT a.*
FROM orders a
LEFT JOIN returns b
  ON a.order_id = b.order_id
WHERE b.order_id IS NULL;`,
    tags: ['proc sql', 'anti-join', 'not in', 'left join'],
  },
  {
    id: 'join-append',
    category: 'Merging & Joining',
    title: 'Stack two tables (PROC APPEND / SET)',
    description: 'Appends rows from one table below another (vertical concatenation).',
    sasCode: `DATA work.combined;
  SET work.q1_sales work.q2_sales;
RUN;`,
    hiveCode: `CREATE TABLE combined STORED AS ORC AS
SELECT * FROM q1_sales
UNION ALL
SELECT * FROM q2_sales;`,
    notes: 'UNION ALL preserves all rows including duplicates. Use UNION (without ALL) to remove duplicates.',
    tags: ['proc append', 'set', 'union all', 'stack'],
  },

  // ── Reshaping & Transposing ───────────────────────────────────────
  {
    id: 'reshape-pivot',
    category: 'Reshaping & Transposing',
    title: 'Pivot rows to columns (PROC TRANSPOSE)',
    description: 'Converts long-format data to wide-format using a pivot operation.',
    sasCode: `PROC TRANSPOSE DATA=work.monthly
  OUT=work.wide(DROP=_NAME_);
  BY customer_id;
  ID month;
  VAR revenue;
RUN;`,
    hiveCode: `CREATE TABLE wide STORED AS ORC AS
SELECT
  customer_id,
  MAX(CASE WHEN month = 'Jan' THEN revenue END) AS Jan,
  MAX(CASE WHEN month = 'Feb' THEN revenue END) AS Feb,
  MAX(CASE WHEN month = 'Mar' THEN revenue END) AS Mar
FROM monthly
GROUP BY customer_id;`,
    notes: 'In Hive, each pivot value needs an explicit CASE WHEN. List all expected values in advance.',
    tags: ['proc transpose', 'pivot', 'case when', 'wide'],
  },
  {
    id: 'reshape-unpivot',
    category: 'Reshaping & Transposing',
    title: 'Unpivot columns to rows',
    description: 'Converts wide-format data back to long-format using LATERAL VIEW.',
    sasCode: `PROC TRANSPOSE DATA=work.wide
  OUT=work.long(RENAME=(COL1=revenue _NAME_=month));
  BY customer_id;
  VAR Jan Feb Mar;
RUN;`,
    hiveCode: `CREATE TABLE long_format STORED AS ORC AS
SELECT customer_id, month, revenue
FROM wide
LATERAL VIEW EXPLODE(
  MAP('Jan', Jan, 'Feb', Feb, 'Mar', Mar)
) t AS month, revenue;`,
    notes: 'LATERAL VIEW EXPLODE with a MAP is the Hive idiom for unpivoting known columns.',
    tags: ['proc transpose', 'unpivot', 'lateral view', 'explode', 'long'],
  },

  // ── Filtering & Subsetting ────────────────────────────────────────
  {
    id: 'filter-where',
    category: 'Filtering & Subsetting',
    title: 'Filter rows with WHERE',
    description: 'Keeps rows that meet a condition, discarding the rest.',
    sasCode: `DATA work.high_value;
  SET work.orders;
  WHERE revenue > 1000;
RUN;`,
    hiveCode: `CREATE TABLE high_value STORED AS ORC AS
SELECT *
FROM orders
WHERE revenue > 1000;`,
    tags: ['where', 'filter', 'subset'],
  },
  {
    id: 'filter-first-last',
    category: 'Filtering & Subsetting',
    title: 'First/last row per group (first./last.)',
    description: 'Selects the first or last observation within each BY group — a classic DATA step pattern.',
    sasCode: `PROC SORT DATA=work.events;
  BY customer_id event_date;
RUN;

DATA work.first_event;
  SET work.events;
  BY customer_id;
  IF first.customer_id;
RUN;`,
    hiveCode: `CREATE TABLE first_event STORED AS ORC AS
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id
      ORDER BY event_date
    ) AS rn
  FROM events
) t
WHERE rn = 1;`,
    notes: 'For last row, change to ORDER BY event_date DESC or use rn = max.',
    tags: ['first.', 'last.', 'by group', 'row_number', 'data step'],
  },
  {
    id: 'filter-top-n',
    category: 'Filtering & Subsetting',
    title: 'Top N rows per group',
    description: 'Selects the top N rows within each group ranked by a value column.',
    sasCode: `PROC RANK DATA=work.sales OUT=work.ranked
  DESCENDING;
  BY region;
  VAR revenue;
  RANKS rank;
RUN;

DATA work.top3;
  SET work.ranked;
  WHERE rank <= 3;
RUN;`,
    hiveCode: `CREATE TABLE top3 STORED AS ORC AS
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY region
      ORDER BY revenue DESC
    ) AS rank
  FROM sales
) t
WHERE rank <= 3;`,
    tags: ['proc rank', 'top n', 'row_number', 'partition by'],
  },

  // ── Dates & Times ─────────────────────────────────────────────────
  {
    id: 'date-diff',
    category: 'Dates & Times',
    title: 'Date difference in days (INTCK)',
    description: 'Calculates the number of days between two dates.',
    sasCode: `DATA work.with_diff;
  SET work.events;
  days_between = INTCK('day', start_date, end_date);
RUN;`,
    hiveCode: `CREATE TABLE with_diff STORED AS ORC AS
SELECT *,
  DATEDIFF(end_date, start_date) AS days_between
FROM events;`,
    notes: 'INTCK argument order is (interval, from, to). Hive DATEDIFF is (end, start) — note the reversed order.',
    tags: ['intck', 'datediff', 'date difference'],
  },
  {
    id: 'date-add',
    category: 'Dates & Times',
    title: 'Add days to a date (INTNX)',
    description: 'Shifts a date forward by a given number of days.',
    sasCode: `DATA work.shifted;
  SET work.events;
  future_date = INTNX('day', event_date, 30);
RUN;`,
    hiveCode: `CREATE TABLE shifted STORED AS ORC AS
SELECT *,
  DATE_ADD(event_date, 30) AS future_date
FROM events;`,
    notes: 'INTNX supports alignment (B, M, E). Hive DATE_ADD always adds exact days — handle month/year shifts with ADD_MONTHS.',
    tags: ['intnx', 'date_add', 'add days'],
  },
  {
    id: 'date-extract',
    category: 'Dates & Times',
    title: 'Extract year/month from a date',
    description: 'Extracts the year and month components from a date column.',
    sasCode: `DATA work.parts;
  SET work.events;
  yr = YEAR(event_date);
  mo = MONTH(event_date);
RUN;`,
    hiveCode: `CREATE TABLE parts STORED AS ORC AS
SELECT *,
  YEAR(event_date)  AS yr,
  MONTH(event_date) AS mo
FROM events;`,
    tags: ['year', 'month', 'extract', 'date parts'],
  },

  // ── String Functions ──────────────────────────────────────────────
  {
    id: 'str-concat',
    category: 'String Functions',
    title: 'Trim and concatenate (CATS, CATX)',
    description: 'Strips whitespace and joins strings with a separator.',
    sasCode: `DATA work.names;
  SET work.people;
  full_name = CATX(' ', first_name, last_name);
  code = CATS(region, '-', id);
RUN;`,
    hiveCode: `CREATE TABLE names STORED AS ORC AS
SELECT *,
  CONCAT_WS(' ', first_name, last_name) AS full_name,
  CONCAT(TRIM(region), '-', TRIM(CAST(id AS STRING))) AS code
FROM people;`,
    notes: 'CATX trims and joins with a delimiter → CONCAT_WS. CATS trims then concatenates → CONCAT with TRIM.',
    tags: ['catx', 'cats', 'concat_ws', 'concat', 'trim'],
  },
  {
    id: 'str-scan-substr',
    category: 'String Functions',
    title: 'Find and extract substring (SCAN, SUBSTR)',
    description: 'Extracts a word by position or a substring by index.',
    sasCode: `DATA work.parsed;
  SET work.raw;
  first_word = SCAN(full_name, 1, ' ');
  area_code  = SUBSTR(phone, 1, 3);
RUN;`,
    hiveCode: `CREATE TABLE parsed STORED AS ORC AS
SELECT *,
  SPLIT(full_name, ' ')[0]    AS first_word,
  SUBSTR(phone, 1, 3)         AS area_code
FROM raw;`,
    notes: 'SAS SCAN is 1-based; Hive SPLIT returns a 0-based array, so SCAN(s, n, d) → SPLIT(s, d)[n-1].',
    tags: ['scan', 'substr', 'split', 'substring'],
  },
  {
    id: 'str-replace',
    category: 'String Functions',
    title: 'Replace characters (COMPRESS, TRANWRD)',
    description: 'Removes unwanted characters or replaces one substring with another.',
    sasCode: `DATA work.cleaned;
  SET work.raw;
  digits_only = COMPRESS(phone, , 'kd');
  fixed = TRANWRD(description, 'old term', 'new term');
RUN;`,
    hiveCode: `CREATE TABLE cleaned STORED AS ORC AS
SELECT *,
  REGEXP_REPLACE(phone, '[^0-9]', '')       AS digits_only,
  REGEXP_REPLACE(description, 'old term', 'new term') AS fixed
FROM raw;`,
    notes: 'SAS COMPRESS with modifiers removes character classes. Hive uses REGEXP_REPLACE for similar operations.',
    tags: ['compress', 'tranwrd', 'regexp_replace', 'replace'],
  },

  // ── Macros & Variables ────────────────────────────────────────────
  {
    id: 'macro-let',
    category: 'Macros & Variables',
    title: 'Macro variable assignment and reference',
    description: 'Assigns a value to a macro variable and uses it in subsequent code.',
    sasCode: `%LET cutoff_date = '01JAN2024'd;
%LET target_region = East;

PROC SQL;
  CREATE TABLE work.filtered AS
  SELECT *
  FROM work.orders
  WHERE order_date >= &cutoff_date
    AND region = "&target_region";
QUIT;`,
    hiveCode: `-- Hive uses SET for session variables
SET hivevar:cutoff_date = '2024-01-01';
SET hivevar:target_region = East;

CREATE TABLE filtered STORED AS ORC AS
SELECT *
FROM orders
WHERE order_date >= '\${hivevar:cutoff_date}'
  AND region = '\${hivevar:target_region}';`,
    notes: 'SAS macro variables (&var) become Hive session variables (${hivevar:var}). Date literals use ISO format in Hive.',
    tags: ['%let', 'macro variable', '&var', 'hivevar', 'set'],
  },
  {
    id: 'macro-simple',
    category: 'Macros & Variables',
    title: 'Simple parameterised macro',
    description: 'Defines a reusable macro that accepts parameters and generates code.',
    sasCode: `%MACRO filter_by_year(dsn, year);
  DATA work.&dsn._&year;
    SET work.&dsn;
    WHERE YEAR(order_date) = &year;
  RUN;
%MEND filter_by_year;

%filter_by_year(orders, 2024);`,
    hiveCode: `-- No direct macro equivalent in HiveQL.
-- Use a parameterised script or UDF.
-- Inline expansion:
CREATE TABLE orders_2024 STORED AS ORC AS
SELECT *
FROM orders
WHERE YEAR(order_date) = 2024;`,
    notes: 'Hive has no macro language. Parameterised queries can be achieved with hivevar, shell scripts, or orchestration tools like Oozie/Airflow.',
    tags: ['%macro', '%mend', 'parameterised', 'macro'],
  },
  {
    id: 'macro-conditional',
    category: 'Macros & Variables',
    title: 'Conditional macro logic (%IF / %THEN)',
    description: 'Uses macro conditionals to generate different code paths at compile time.',
    sasCode: `%MACRO report(type);
  %IF &type = summary %THEN %DO;
    PROC MEANS DATA=work.sales;
      VAR revenue;
    RUN;
  %END;
  %ELSE %DO;
    PROC PRINT DATA=work.sales;
    RUN;
  %END;
%MEND report;

%report(summary);`,
    hiveCode: `-- Conditional logic must be handled outside HiveQL.
-- For a "summary" path:
SELECT
  COUNT(*) AS n,
  SUM(revenue) AS total,
  AVG(revenue) AS mean
FROM sales;

-- For a "detail" path:
SELECT * FROM sales;`,
    notes: 'SAS %IF/%THEN is compile-time code generation. In Hive, use an external orchestrator (Airflow, shell script) to choose which query to run.',
    tags: ['%if', '%then', '%else', 'conditional', 'macro'],
  },

  // ── Missing Values ────────────────────────────────────────────────
  {
    id: 'missing-test',
    category: 'Missing Values',
    title: 'Test for missing value (MISSING(), IF x = .)',
    description: 'Checks whether a numeric or character variable is missing.',
    sasCode: `DATA work.flagged;
  SET work.customers;
  IF MISSING(email) THEN email_flag = 'No Email';
  IF age = . THEN age_flag = 'Missing';
RUN;`,
    hiveCode: `CREATE TABLE flagged STORED AS ORC AS
SELECT *,
  CASE WHEN email IS NULL THEN 'No Email'
       ELSE NULL END AS email_flag,
  CASE WHEN age IS NULL THEN 'Missing'
       ELSE NULL END AS age_flag
FROM customers;`,
    notes: 'SAS missing numeric (.) and missing character ("") both map to NULL in Hive.',
    tags: ['missing', 'is null', 'null', 'dot notation'],
  },
  {
    id: 'missing-coalesce',
    category: 'Missing Values',
    title: 'Replace missing with default (COALESCE)',
    description: 'Substitutes a default value when a variable is missing.',
    sasCode: `DATA work.filled;
  SET work.sales;
  revenue = COALESCE(revenue, 0);
  region  = COALESCEC(region, 'Unknown');
RUN;`,
    hiveCode: `CREATE TABLE filled STORED AS ORC AS
SELECT *,
  COALESCE(revenue, 0)          AS revenue_filled,
  COALESCE(region, 'Unknown')   AS region_filled
FROM sales;`,
    notes: 'SAS has separate COALESCE (numeric) and COALESCEC (character). Hive COALESCE handles both types.',
    tags: ['coalesce', 'coalescec', 'missing', 'default value', 'null'],
  },

  // ── Table Creation ────────────────────────────────────────────────
  {
    id: 'table-from-query',
    category: 'Table Creation',
    title: 'Create a table from a query (CTAS)',
    description: 'Creates a new table populated with the results of a SELECT query.',
    sasCode: `PROC SQL;
  CREATE TABLE work.active_customers AS
  SELECT customer_id, name, email
  FROM work.customers
  WHERE status = 'Active';
QUIT;`,
    hiveCode: `CREATE TABLE active_customers STORED AS ORC AS
SELECT customer_id, name, email
FROM customers
WHERE status = 'Active';`,
    tags: ['proc sql', 'create table', 'ctas'],
  },
  {
    id: 'table-explicit-types',
    category: 'Table Creation',
    title: 'Create a table with explicit column types',
    description: 'Defines a new table with explicit data types before inserting data.',
    sasCode: `DATA work.ledger;
  LENGTH account_id $10 description $100;
  FORMAT amount DOLLAR12.2 txn_date DATE9.;
  STOP;
RUN;`,
    hiveCode: `CREATE TABLE ledger (
  account_id  STRING,
  description STRING,
  amount      DECIMAL(12,2),
  txn_date    DATE
)
STORED AS ORC;`,
    notes: 'SAS uses LENGTH for character width and FORMAT for display. Hive uses explicit SQL data types. DECIMAL(12,2) replaces DOLLAR12.2.',
    tags: ['create table', 'data types', 'length', 'format', 'schema'],
  },
];
