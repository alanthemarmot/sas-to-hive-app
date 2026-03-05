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
          { name: 'monthly_sales.sas', path: 'sas-repository/reports/monthly_sales.sas', type: 'file' },
          { name: 'customer_analysis.sas', path: 'sas-repository/reports/customer_analysis.sas', type: 'file' },
          { name: 'quarterly_summary.sas', path: 'sas-repository/reports/quarterly_summary.sas', type: 'file' },
        ],
      },
      {
        name: 'etl',
        path: 'sas-repository/etl',
        type: 'directory',
        children: [
          { name: 'data_load.sas', path: 'sas-repository/etl/data_load.sas', type: 'file' },
          { name: 'data_transform.sas', path: 'sas-repository/etl/data_transform.sas', type: 'file' },
          { name: 'data_quality.sas', path: 'sas-repository/etl/data_quality.sas', type: 'file' },
        ],
      },
      {
        name: 'analysis',
        path: 'sas-repository/analysis',
        type: 'directory',
        children: [
          { name: 'regression_model.sas', path: 'sas-repository/analysis/regression_model.sas', type: 'file' },
          { name: 'freq_analysis.sas', path: 'sas-repository/analysis/freq_analysis.sas', type: 'file' },
        ],
      },
      {
        name: 'macros',
        path: 'sas-repository/macros',
        type: 'directory',
        children: [
          { name: 'utility_macros.sas', path: 'sas-repository/macros/utility_macros.sas', type: 'file' },
          { name: 'date_macros.sas', path: 'sas-repository/macros/date_macros.sas', type: 'file' },
        ],
      },
    ],
  };
}

const FILE_CONTENTS: Record<string, string> = {
  'sas-repository/reports/monthly_sales.sas': `/* Monthly Sales Report - Creates summary tables from transaction data */
LIBNAME sales '/data/sales';

PROC SQL;
  CREATE TABLE work.monthly_revenue AS
  SELECT
    t.region,
    t.product_category,
    MONTH(t.transaction_date) AS sale_month,
    YEAR(t.transaction_date) AS sale_year,
    SUM(t.amount) AS total_revenue,
    COUNT(DISTINCT t.customer_id) AS unique_customers,
    COUNT(*) AS transaction_count
  FROM sales.transactions AS t
  INNER JOIN sales.products AS p
    ON t.product_id = p.product_id
  WHERE t.transaction_date BETWEEN '01JAN2024'd AND '31DEC2024'd
    AND t.status = 'COMPLETED'
  GROUP BY t.region, t.product_category,
           MONTH(t.transaction_date), YEAR(t.transaction_date)
  ORDER BY sale_year, sale_month, total_revenue DESC;

  CREATE TABLE work.top_products AS
  SELECT *
  FROM (
    SELECT
      product_category,
      region,
      total_revenue,
      CALCULATED total_revenue / CALCULATED transaction_count AS avg_transaction
    FROM work.monthly_revenue
  )
  WHERE avg_transaction > 100
  ORDER BY total_revenue DESC;

  CREATE TABLE work.regional_summary AS
  SELECT
    a.region,
    a.total_revenue,
    b.target_amount,
    (a.total_revenue / b.target_amount) * 100 AS pct_of_target
  FROM (
    SELECT region, SUM(total_revenue) AS total_revenue
    FROM work.monthly_revenue
    GROUP BY region
  ) AS a
  LEFT JOIN sales.regional_targets AS b
    ON a.region = b.region;
QUIT;`,

  'sas-repository/reports/customer_analysis.sas': `/* Customer Analysis - Segments customers and calculates lifetime value */
PROC SQL;
  /* Store total customer count in macro variable */
  SELECT COUNT(DISTINCT customer_id) INTO :total_customers TRIMMED
  FROM customers.master;

  SELECT AVG(total_spend) INTO :avg_spend TRIMMED
  FROM customers.master
  WHERE active_flag = 'Y';

  CREATE TABLE work.customer_segments AS
  SELECT
    c.customer_id,
    c.customer_name,
    c.signup_date,
    c.region,
    INTCK('MONTH', c.signup_date, TODAY()) AS tenure_months,
    o.total_orders,
    o.total_spent,
    CALCULATED total_spent / CALCULATED total_orders AS avg_order_value,
    CASE
      WHEN CALCULATED total_spent > 10000 THEN 'PLATINUM'
      WHEN CALCULATED total_spent > 5000  THEN 'GOLD'
      WHEN CALCULATED total_spent > 1000  THEN 'SILVER'
      ELSE 'BRONZE'
    END AS segment,
    CASE
      WHEN INTCK('DAY', o.last_order_date, TODAY()) <= 30 THEN 'ACTIVE'
      WHEN INTCK('DAY', o.last_order_date, TODAY()) <= 90 THEN 'AT_RISK'
      ELSE 'CHURNED'
    END AS activity_status
  FROM customers.master AS c
  LEFT JOIN (
    SELECT
      customer_id,
      COUNT(*) AS total_orders,
      SUM(order_total) AS total_spent,
      MAX(order_date) AS last_order_date
    FROM orders.history
    GROUP BY customer_id
  ) AS o
    ON c.customer_id = o.customer_id
  ORDER BY total_spent DESC;

  TITLE "Customer Analysis Report - &total_customers total customers";
QUIT;`,

  'sas-repository/reports/quarterly_summary.sas': `/* Quarterly Summary Statistics */
LIBNAME finance '/data/finance';

/* Calculate summary statistics by quarter and department */
PROC MEANS DATA=finance.expenses N MEAN SUM STD MIN MAX;
  CLASS department quarter;
  VAR amount headcount budget_pct;
  OUTPUT OUT=work.quarterly_stats
    MEAN=avg_amount avg_headcount avg_budget_pct
    SUM=total_amount total_headcount total_budget_pct
    N=n_amount n_headcount n_budget_pct;
RUN;

/* Summarize revenue by product line */
PROC SUMMARY DATA=finance.revenue NWAY;
  CLASS product_line region;
  VAR revenue units_sold discount_pct;
  OUTPUT OUT=work.revenue_summary(DROP=_TYPE_)
    SUM(revenue)=total_revenue
    SUM(units_sold)=total_units
    MEAN(discount_pct)=avg_discount
    MIN(revenue)=min_revenue
    MAX(revenue)=max_revenue;
RUN;

/* Merge the summaries */
PROC SQL;
  CREATE TABLE work.combined_quarterly AS
  SELECT
    q.department,
    q.quarter,
    q.avg_amount,
    q.total_amount,
    r.total_revenue,
    r.total_units,
    (q.total_amount / r.total_revenue) * 100 AS expense_ratio
  FROM work.quarterly_stats AS q
  INNER JOIN work.revenue_summary AS r
    ON q.department = r.product_line
  WHERE q._TYPE_ = 3
  ORDER BY q.quarter, q.department;
QUIT;`,

  'sas-repository/etl/data_load.sas': `/* Data Load - Reads raw files and applies basic transformations */
LIBNAME raw '/data/raw';
LIBNAME staging '/data/staging';

DATA staging.employee_clean;
  SET raw.employee_raw;

  /* Clean and standardize name fields */
  first_name = PROPCASE(TRIM(first_name));
  last_name = PROPCASE(TRIM(last_name));
  full_name = CATX(' ', first_name, last_name);
  email = LOWCASE(COMPRESS(email, ' '));

  /* Derive age and tenure */
  age = INTCK('YEAR', date_of_birth, TODAY());
  tenure_years = INTCK('YEAR', hire_date, TODAY());

  /* Categorize salary bands */
  IF salary >= 100000 THEN salary_band = 'HIGH';
  ELSE IF salary >= 60000 THEN salary_band = 'MEDIUM';
  ELSE IF salary >= 30000 THEN salary_band = 'LOW';
  ELSE salary_band = 'ENTRY';

  /* Flag missing critical fields */
  IF MISSING(employee_id) THEN flag_missing = 'Y';
  ELSE IF MISSING(department) THEN flag_missing = 'Y';
  ELSE flag_missing = 'N';

  /* Convert date formats */
  formatted_hire = PUT(hire_date, MMDDYY10.);

  /* Filter out terminated employees */
  IF status NE 'TERMINATED';

  /* Only keep relevant columns */
  KEEP employee_id first_name last_name full_name email department
       salary salary_band age tenure_years hire_date flag_missing;
RUN;`,

  'sas-repository/etl/data_transform.sas': `/* Data Transform - BY-group processing with first/last, RETAIN, OUTPUT */
LIBNAME input '/data/input';
LIBNAME output '/data/output';

/* Sort before BY-group processing */
PROC SORT DATA=input.account_transactions;
  BY account_id transaction_date;
RUN;

DATA output.account_summary
     output.flagged_accounts;
  SET input.account_transactions;
  BY account_id transaction_date;

  /* Running balance using RETAIN */
  RETAIN running_balance 0;
  RETAIN transaction_count 0;
  RETAIN max_single_transaction 0;

  /* Reset accumulators on first record of each account */
  IF first.account_id THEN DO;
    running_balance = 0;
    transaction_count = 0;
    max_single_transaction = 0;
  END;

  /* Accumulate values */
  running_balance = running_balance + amount;
  transaction_count = transaction_count + 1;
  IF amount > max_single_transaction THEN
    max_single_transaction = amount;

  /* Calculate days since previous transaction */
  prev_date = LAG(transaction_date);
  IF NOT first.account_id THEN
    days_between = INTCK('DAY', prev_date, transaction_date);
  ELSE
    days_between = .;

  /* Output summary on last record of each account */
  IF last.account_id THEN DO;
    avg_transaction = running_balance / transaction_count;
    OUTPUT output.account_summary;

    /* Flag accounts with suspicious patterns */
    IF max_single_transaction > 50000 OR transaction_count > 100 THEN
      OUTPUT output.flagged_accounts;
  END;

  DROP prev_date;
RUN;`,

  'sas-repository/etl/data_quality.sas': `/* Data Quality Checks - Dedup and frequency analysis */
LIBNAME dq '/data/quality';

/* Remove duplicate records by customer_id, keeping first occurrence */
PROC SORT DATA=dq.customer_raw OUT=work.customers_sorted NODUPKEY;
  BY customer_id;
RUN;

/* Remove duplicates by composite key */
PROC SORT DATA=dq.order_details OUT=work.orders_deduped NODUPKEY;
  BY order_id line_item_id;
RUN;

/* Frequency analysis on key fields to check distributions */
PROC FREQ DATA=work.customers_sorted;
  TABLES region / NOCUM NOPERCENT OUT=work.region_freq;
RUN;

PROC FREQ DATA=work.customers_sorted;
  TABLES customer_type * region / NOROW NOCOL OUT=work.type_region_freq;
RUN;

/* Sort by frequency for reporting */
PROC SORT DATA=work.region_freq;
  BY DESCENDING COUNT;
RUN;

/* Identify records with missing critical fields */
PROC SQL;
  CREATE TABLE work.missing_data_report AS
  SELECT
    customer_id,
    CASE WHEN MISSING(email) THEN 'EMAIL' ELSE '' END AS missing_email,
    CASE WHEN MISSING(phone) THEN 'PHONE' ELSE '' END AS missing_phone,
    CASE WHEN MISSING(address) THEN 'ADDRESS' ELSE '' END AS missing_address,
    CATX(', ',
      IFC(MISSING(email), 'EMAIL', ''),
      IFC(MISSING(phone), 'PHONE', ''),
      IFC(MISSING(address), 'ADDRESS', '')
    ) AS missing_fields
  FROM work.customers_sorted
  WHERE MISSING(email) OR MISSING(phone) OR MISSING(address);
QUIT;`,

  'sas-repository/analysis/regression_model.sas': `/* Regression Model Data Preparation - Complex joins and CASE logic */
LIBNAME model '/data/models';

PROC SQL;
  CREATE TABLE work.model_dataset AS
  SELECT
    c.customer_id,
    c.age,
    c.income,
    c.credit_score,
    c.years_as_customer,
    /* Encode categorical variables */
    CASE
      WHEN c.education = 'GRADUATE' THEN 3
      WHEN c.education = 'COLLEGE' THEN 2
      WHEN c.education = 'HIGH_SCHOOL' THEN 1
      ELSE 0
    END AS education_level,
    CASE
      WHEN c.employment_type = 'FULL_TIME' THEN 1 ELSE 0
    END AS is_full_time,
    CASE
      WHEN c.employment_type = 'SELF_EMPLOYED' THEN 1 ELSE 0
    END AS is_self_employed,
    /* Aggregate transaction features */
    t.total_transactions,
    t.avg_transaction_amount,
    t.max_transaction_amount,
    t.days_since_last_transaction,
    /* Account features */
    a.num_accounts,
    a.total_balance,
    a.avg_account_age,
    COALESCE(a.total_balance, 0) / COALESCE(c.income, 1) AS balance_to_income,
    /* Target variable */
    CASE WHEN d.default_flag = 'Y' THEN 1 ELSE 0 END AS defaulted
  FROM model.customers AS c
  LEFT JOIN (
    SELECT
      customer_id,
      COUNT(*) AS total_transactions,
      AVG(amount) AS avg_transaction_amount,
      MAX(amount) AS max_transaction_amount,
      INTCK('DAY', MAX(transaction_date), TODAY()) AS days_since_last_transaction
    FROM model.transactions
    WHERE transaction_date >= INTNX('YEAR', TODAY(), -2)
    GROUP BY customer_id
  ) AS t
    ON c.customer_id = t.customer_id
  LEFT JOIN (
    SELECT
      customer_id,
      COUNT(*) AS num_accounts,
      SUM(balance) AS total_balance,
      AVG(INTCK('MONTH', open_date, TODAY())) AS avg_account_age
    FROM model.accounts
    WHERE status = 'ACTIVE'
    GROUP BY customer_id
  ) AS a
    ON c.customer_id = a.customer_id
  LEFT JOIN model.defaults AS d
    ON c.customer_id = d.customer_id
  WHERE c.income IS NOT MISSING
    AND c.age BETWEEN 18 AND 85
  ORDER BY c.customer_id;
QUIT;`,

  'sas-repository/analysis/freq_analysis.sas': `/* Frequency Analysis and Transpose for Reporting */
LIBNAME survey '/data/survey';

/* Frequency counts by response category */
PROC FREQ DATA=survey.responses NOPRINT;
  TABLES question_id * response_value / OUT=work.response_counts;
RUN;

/* Transpose: one row per question, columns for each response */
PROC TRANSPOSE DATA=work.response_counts
               OUT=work.response_pivot(DROP=_NAME_)
               PREFIX=response_;
  BY question_id;
  ID response_value;
  VAR COUNT;
RUN;

/* Add percentages */
PROC FREQ DATA=survey.responses NOPRINT;
  TABLES department * satisfaction_level / OUTPCT
         OUT=work.dept_satisfaction(DROP=PERCENT);
  WHERE survey_year = 2024;
RUN;

/* Sort for reporting */
PROC SORT DATA=work.dept_satisfaction;
  BY department DESCENDING COUNT;
RUN;

/* Summary statistics on numeric responses */
PROC MEANS DATA=survey.responses NOPRINT;
  CLASS question_id;
  VAR numeric_score;
  OUTPUT OUT=work.score_summary
    MEAN=avg_score
    MEDIAN=median_score
    STD=std_score
    N=response_count;
RUN;

/* Crosstab frequency */
PROC FREQ DATA=survey.responses;
  TABLES region * question_id / CHISQ NOCOL NOROW;
  WHERE numeric_score IS NOT MISSING;
RUN;`,

  'sas-repository/macros/utility_macros.sas': `/* Utility Macros - Reusable macro definitions */

%LET default_lib = WORK;
%LET report_date = %SYSFUNC(TODAY(), DATE9.);
%LET fiscal_year = 2024;

/* Macro to create a filtered subset of data */
%MACRO filter_data(input_ds=, output_ds=, filter_col=, filter_val=);
  PROC SQL;
    CREATE TABLE &output_ds AS
    SELECT *
    FROM &input_ds
    WHERE &filter_col = "&filter_val";
  QUIT;
  %PUT NOTE: Created &output_ds from &input_ds where &filter_col = &filter_val;
%MEND filter_data;

/* Macro to generate summary statistics */
%MACRO summarize(ds=, class_var=, analysis_var=, out_ds=);
  PROC MEANS DATA=&ds NOPRINT NWAY;
    CLASS &class_var;
    VAR &analysis_var;
    OUTPUT OUT=&out_ds(DROP=_TYPE_ _FREQ_)
      MEAN=avg_&analysis_var
      SUM=sum_&analysis_var
      MIN=min_&analysis_var
      MAX=max_&analysis_var;
  RUN;
%MEND summarize;

/* Macro to check if a dataset exists */
%MACRO ds_exists(ds=);
  %IF %SYSFUNC(EXIST(&ds)) %THEN %DO;
    %PUT NOTE: Dataset &ds exists.;
  %END;
  %ELSE %DO;
    %PUT WARNING: Dataset &ds does NOT exist.;
  %END;
%MEND ds_exists;

/* Invoke macros */
%filter_data(input_ds=raw.sales, output_ds=work.east_sales,
             filter_col=region, filter_val=EAST);
%summarize(ds=work.east_sales, class_var=product,
           analysis_var=revenue, out_ds=work.east_product_summary);
%ds_exists(ds=work.east_product_summary);`,

  'sas-repository/macros/date_macros.sas': `/* Date Macros - Common date manipulation patterns */

%LET today = %SYSFUNC(TODAY());
%LET current_month = %SYSFUNC(MONTH(%SYSFUNC(TODAY())));
%LET current_year = %SYSFUNC(YEAR(%SYSFUNC(TODAY())));

/* Macro to get start/end of a month */
%MACRO month_range(year=, month=, start_var=, end_var=);
  %LET &start_var = %SYSFUNC(MDY(&month, 1, &year));
  %LET &end_var = %SYSFUNC(INTNX(MONTH, %SYSFUNC(MDY(&month, 1, &year)), 0, END));
%MEND month_range;

/* Date calculations in a DATA step */
DATA work.date_features;
  SET source.transactions;

  /* Days since transaction */
  days_ago = INTCK('DAY', transaction_date, TODAY());

  /* Months between signup and transaction */
  months_tenure = INTCK('MONTH', signup_date, transaction_date);

  /* Move to start of next quarter */
  next_quarter_start = INTNX('QTR', transaction_date, 1, 'BEGINNING');

  /* End of current month */
  month_end = INTNX('MONTH', transaction_date, 0, 'END');

  /* Compare with date literals */
  IF transaction_date >= '01JAN2024'd AND
     transaction_date <= '31DEC2024'd THEN
    in_scope = 'Y';
  ELSE
    in_scope = 'N';

  /* Extract date parts */
  tx_year = YEAR(transaction_date);
  tx_month = MONTH(transaction_date);
  tx_day = DAY(transaction_date);
  tx_weekday = WEEKDAY(transaction_date);

  /* Format dates */
  formatted_date = PUT(transaction_date, YYMMDD10.);
  display_date = PUT(transaction_date, WORDDATE20.);

  /* Date arithmetic */
  due_date = transaction_date + 30;
  review_date = INTNX('MONTH', transaction_date, 3);

  KEEP transaction_id transaction_date days_ago months_tenure
       next_quarter_start month_end in_scope tx_year tx_month
       tx_day tx_weekday formatted_date due_date review_date;
RUN;`,
};

export function getMockFileContent(filePath: string): string | null {
  return FILE_CONTENTS[filePath] ?? null;
}
