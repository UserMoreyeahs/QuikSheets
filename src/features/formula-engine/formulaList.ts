export type FormulaCategory =
  | 'Math'
  | 'Statistical'
  | 'Text'
  | 'Logical'
  | 'Lookup'
  | 'Date'
  | 'Financial'
  | 'Information'
  | 'Engineering'

export interface FormulaEntry {
  name: string
  category: FormulaCategory
  syntax: string
  description: string
  example: string
}

export const CATEGORY_COLORS: Record<FormulaCategory, string> = {
  Math: 'bg-blue-100 text-blue-700',
  Statistical: 'bg-purple-100 text-purple-700',
  Text: 'bg-green-100 text-green-700',
  Logical: 'bg-orange-100 text-orange-700',
  Lookup: 'bg-cyan-100 text-cyan-700',
  Date: 'bg-rose-100 text-rose-700',
  Financial: 'bg-amber-100 text-amber-700',
  Information: 'bg-zinc-100 text-zinc-700',
  Engineering: 'bg-teal-100 text-teal-700',
}

export const FORMULA_LIST: FormulaEntry[] = [
  // Math
  { name: 'SUM', category: 'Math', syntax: 'SUM(number1, [number2], ...)', description: 'Adds all numbers in a range.', example: '=SUM(A1:A10)' },
  { name: 'SUMIF', category: 'Math', syntax: 'SUMIF(range, criteria, [sum_range])', description: 'Sums cells that meet a condition.', example: '=SUMIF(A1:A10,">5")' },
  { name: 'SUMIFS', category: 'Math', syntax: 'SUMIFS(sum_range, range1, crit1, ...)', description: 'Sums cells meeting multiple conditions.', example: '=SUMIFS(C1:C10,A1:A10,"A",B1:B10,">0")' },
  { name: 'PRODUCT', category: 'Math', syntax: 'PRODUCT(number1, [number2], ...)', description: 'Multiplies all numbers in a range.', example: '=PRODUCT(A1:A5)' },
  { name: 'ABS', category: 'Math', syntax: 'ABS(number)', description: 'Returns the absolute value.', example: '=ABS(-5)' },
  { name: 'ROUND', category: 'Math', syntax: 'ROUND(number, digits)', description: 'Rounds a number to specified digits.', example: '=ROUND(3.14159, 2)' },
  { name: 'ROUNDUP', category: 'Math', syntax: 'ROUNDUP(number, digits)', description: 'Rounds a number up away from zero.', example: '=ROUNDUP(3.1, 0)' },
  { name: 'ROUNDDOWN', category: 'Math', syntax: 'ROUNDDOWN(number, digits)', description: 'Rounds a number down toward zero.', example: '=ROUNDDOWN(3.9, 0)' },
  { name: 'SQRT', category: 'Math', syntax: 'SQRT(number)', description: 'Returns the square root of a number.', example: '=SQRT(16)' },
  { name: 'POWER', category: 'Math', syntax: 'POWER(number, power)', description: 'Returns a number raised to a power.', example: '=POWER(2, 8)' },
  { name: 'MOD', category: 'Math', syntax: 'MOD(number, divisor)', description: 'Returns the remainder after division.', example: '=MOD(10, 3)' },
  { name: 'INT', category: 'Math', syntax: 'INT(number)', description: 'Rounds a number down to nearest integer.', example: '=INT(3.9)' },
  { name: 'CEILING', category: 'Math', syntax: 'CEILING(number, significance)', description: 'Rounds a number up to nearest multiple.', example: '=CEILING(2.1, 0.5)' },
  { name: 'FLOOR', category: 'Math', syntax: 'FLOOR(number, significance)', description: 'Rounds a number down to nearest multiple.', example: '=FLOOR(2.9, 0.5)' },
  { name: 'LOG', category: 'Math', syntax: 'LOG(number, [base])', description: 'Returns the logarithm of a number.', example: '=LOG(100, 10)' },

  // Statistical
  { name: 'AVERAGE', category: 'Statistical', syntax: 'AVERAGE(number1, [number2], ...)', description: 'Returns the arithmetic mean of the arguments.', example: '=AVERAGE(A1:A10)' },
  { name: 'AVERAGEIF', category: 'Statistical', syntax: 'AVERAGEIF(range, criteria, [avg_range])', description: 'Averages cells that meet a condition.', example: '=AVERAGEIF(A1:A10,">5")' },
  { name: 'COUNT', category: 'Statistical', syntax: 'COUNT(value1, [value2], ...)', description: 'Counts numeric cells in a range.', example: '=COUNT(A1:A10)' },
  { name: 'COUNTA', category: 'Statistical', syntax: 'COUNTA(value1, [value2], ...)', description: 'Counts non-empty cells in a range.', example: '=COUNTA(A1:A10)' },
  { name: 'COUNTIF', category: 'Statistical', syntax: 'COUNTIF(range, criteria)', description: 'Counts cells matching a condition.', example: '=COUNTIF(A1:A10,"apple")' },
  { name: 'COUNTIFS', category: 'Statistical', syntax: 'COUNTIFS(range1, crit1, ...)', description: 'Counts cells matching multiple conditions.', example: '=COUNTIFS(A1:A10,"A",B1:B10,">0")' },
  { name: 'MAX', category: 'Statistical', syntax: 'MAX(number1, [number2], ...)', description: 'Returns the maximum value.', example: '=MAX(A1:A10)' },
  { name: 'MIN', category: 'Statistical', syntax: 'MIN(number1, [number2], ...)', description: 'Returns the minimum value.', example: '=MIN(A1:A10)' },
  { name: 'MEDIAN', category: 'Statistical', syntax: 'MEDIAN(number1, [number2], ...)', description: 'Returns the median value.', example: '=MEDIAN(A1:A10)' },
  { name: 'STDEV', category: 'Statistical', syntax: 'STDEV(number1, [number2], ...)', description: 'Returns the standard deviation.', example: '=STDEV(A1:A10)' },

  // Text
  { name: 'CONCATENATE', category: 'Text', syntax: 'CONCATENATE(text1, [text2], ...)', description: 'Joins several text strings into one.', example: '=CONCATENATE(A1," ",B1)' },
  { name: 'LEN', category: 'Text', syntax: 'LEN(text)', description: 'Returns the number of characters in a string.', example: '=LEN(A1)' },
  { name: 'LEFT', category: 'Text', syntax: 'LEFT(text, [num_chars])', description: 'Returns characters from the left of a string.', example: '=LEFT(A1, 3)' },
  { name: 'RIGHT', category: 'Text', syntax: 'RIGHT(text, [num_chars])', description: 'Returns characters from the right of a string.', example: '=RIGHT(A1, 3)' },
  { name: 'MID', category: 'Text', syntax: 'MID(text, start_num, num_chars)', description: 'Returns characters from the middle of a string.', example: '=MID(A1, 2, 5)' },
  { name: 'UPPER', category: 'Text', syntax: 'UPPER(text)', description: 'Converts text to uppercase.', example: '=UPPER(A1)' },
  { name: 'LOWER', category: 'Text', syntax: 'LOWER(text)', description: 'Converts text to lowercase.', example: '=LOWER(A1)' },
  { name: 'TRIM', category: 'Text', syntax: 'TRIM(text)', description: 'Removes extra spaces from text.', example: '=TRIM(A1)' },
  { name: 'SUBSTITUTE', category: 'Text', syntax: 'SUBSTITUTE(text, old_text, new_text, [instance])', description: 'Replaces occurrences of a substring.', example: '=SUBSTITUTE(A1,"o","0")' },
  { name: 'TEXT', category: 'Text', syntax: 'TEXT(value, format_text)', description: 'Formats a value as text with a format.', example: '=TEXT(A1,"MM/DD/YYYY")' },

  // Logical
  { name: 'IF', category: 'Logical', syntax: 'IF(logical_test, value_if_true, [value_if_false])', description: 'Returns one value if condition is true, another if false.', example: '=IF(A1>10,"High","Low")' },
  { name: 'IFS', category: 'Logical', syntax: 'IFS(cond1, val1, [cond2, val2], ...)', description: 'Checks multiple conditions, returns first match.', example: '=IFS(A1>90,"A",A1>80,"B",TRUE,"C")' },
  { name: 'AND', category: 'Logical', syntax: 'AND(logical1, [logical2], ...)', description: 'Returns TRUE if all conditions are true.', example: '=AND(A1>0, B1<10)' },
  { name: 'OR', category: 'Logical', syntax: 'OR(logical1, [logical2], ...)', description: 'Returns TRUE if any condition is true.', example: '=OR(A1="Yes", B1="Yes")' },
  { name: 'NOT', category: 'Logical', syntax: 'NOT(logical)', description: 'Reverses the logic of its argument.', example: '=NOT(A1=0)' },
  { name: 'IFERROR', category: 'Logical', syntax: 'IFERROR(value, value_if_error)', description: 'Returns a value if the expression errors.', example: '=IFERROR(A1/B1, 0)' },
  { name: 'IFNA', category: 'Logical', syntax: 'IFNA(value, value_if_na)', description: 'Returns a value if the expression is #N/A.', example: '=IFNA(VLOOKUP(A1,B:C,2,0), "Not found")' },
  { name: 'SWITCH', category: 'Logical', syntax: 'SWITCH(expr, val1, result1, ...)', description: 'Evaluates an expression against a list.', example: '=SWITCH(A1,1,"One",2,"Two","Other")' },

  // Lookup
  { name: 'VLOOKUP', category: 'Lookup', syntax: 'VLOOKUP(lookup_value, table_array, col_index, [range_lookup])', description: 'Looks up a value in the first column of a table.', example: '=VLOOKUP(A1,B:D,2,FALSE)' },
  { name: 'HLOOKUP', category: 'Lookup', syntax: 'HLOOKUP(lookup_value, table_array, row_index, [range_lookup])', description: 'Looks up a value in the first row of a table.', example: '=HLOOKUP(A1,1:3,2,FALSE)' },
  { name: 'INDEX', category: 'Lookup', syntax: 'INDEX(array, row_num, [col_num])', description: 'Returns the value at a given position.', example: '=INDEX(A1:C10, 3, 2)' },
  { name: 'MATCH', category: 'Lookup', syntax: 'MATCH(lookup_value, lookup_array, [match_type])', description: 'Returns the position of a value in a range.', example: '=MATCH("apple", A1:A10, 0)' },
  { name: 'XLOOKUP', category: 'Lookup', syntax: 'XLOOKUP(lookup, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])', description: 'Modern lookup with default value, exact/wildcard match, and reverse search.', example: '=XLOOKUP("Bob", B1:B5, C1:C5, "Not found")' },
  { name: 'XMATCH', category: 'Lookup', syntax: 'XMATCH(lookup, lookup_array, [match_mode], [search_mode])', description: 'Modern MATCH with wildcard support and reverse search.', example: '=XMATCH(30, A1:A5)' },
  { name: 'FILTER', category: 'Lookup', syntax: 'FILTER(array, include, [if_empty])', description: 'Filters an array by a boolean condition.', example: '=INDEX(FILTER(A1:A5, A1:A5>20), 1)' },
  { name: 'SORT', category: 'Lookup', syntax: 'SORT(array, [sort_index], [sort_order], [by_col])', description: 'Sorts an array. order=1 ascending, -1 descending.', example: '=INDEX(SORT(A1:A5, 1, -1), 1)' },
  { name: 'SORTBY', category: 'Lookup', syntax: 'SORTBY(array, by_array, [order])', description: 'Sorts an array by another array.', example: '=INDEX(SORTBY(B1:B5, A1:A5, -1), 1)' },
  { name: 'UNIQUE', category: 'Lookup', syntax: 'UNIQUE(array, [by_col], [exactly_once])', description: 'Returns unique values from an array.', example: '=COUNTA(UNIQUE(B1:B5))' },
  { name: 'SEQUENCE', category: 'Math', syntax: 'SEQUENCE(rows, [columns], [start], [step])', description: 'Generates a sequence of numbers.', example: '=INDEX(SEQUENCE(5, 1, 10, 5), 3)' },
  { name: 'TEXTJOIN', category: 'Text', syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)', description: 'Joins text with a delimiter, optionally skipping empties.', example: '=TEXTJOIN(", ", 1, B1:B3)' },
  { name: 'LET', category: 'Logical', syntax: 'LET(name1, value1, [name2, value2, ...], calculation)', description: 'Binds names to values for use in a calculation.', example: '=LET(x, 5, x*2)' },

  // Date
  { name: 'TODAY', category: 'Date', syntax: 'TODAY()', description: 'Returns the current date.', example: '=TODAY()' },
  { name: 'NOW', category: 'Date', syntax: 'NOW()', description: 'Returns the current date and time.', example: '=NOW()' },
  { name: 'DATE', category: 'Date', syntax: 'DATE(year, month, day)', description: 'Returns the serial number of a date.', example: '=DATE(2024, 12, 31)' },
  { name: 'YEAR', category: 'Date', syntax: 'YEAR(serial_number)', description: 'Extracts the year from a date.', example: '=YEAR(A1)' },
  { name: 'MONTH', category: 'Date', syntax: 'MONTH(serial_number)', description: 'Extracts the month from a date.', example: '=MONTH(A1)' },
  { name: 'DAY', category: 'Date', syntax: 'DAY(serial_number)', description: 'Extracts the day from a date.', example: '=DAY(A1)' },
  { name: 'DATEDIF', category: 'Date', syntax: 'DATEDIF(start_date, end_date, unit)', description: 'Calculates the difference between two dates.', example: '=DATEDIF(A1,B1,"D")' },
  { name: 'NETWORKDAYS', category: 'Date', syntax: 'NETWORKDAYS(start_date, end_date, [holidays])', description: 'Returns the number of working days between dates.', example: '=NETWORKDAYS(A1, B1)' },
  { name: 'WORKDAY', category: 'Date', syntax: 'WORKDAY(start_date, days, [holidays])', description: 'Returns a date that is the indicated number of working days after start.', example: '=WORKDAY(A1, 10)' },
  { name: 'EDATE', category: 'Date', syntax: 'EDATE(start_date, months)', description: 'Returns the date that is the indicated number of months from start.', example: '=EDATE(A1, 3)' },
  { name: 'EOMONTH', category: 'Date', syntax: 'EOMONTH(start_date, months)', description: 'Returns the last day of the month, n months from start.', example: '=EOMONTH(A1, 0)' },
  { name: 'WEEKDAY', category: 'Date', syntax: 'WEEKDAY(serial_number, [type])', description: 'Returns a number 1-7 for day of the week.', example: '=WEEKDAY(A1)' },
  { name: 'WEEKNUM', category: 'Date', syntax: 'WEEKNUM(serial_number, [type])', description: 'Returns the ISO week number.', example: '=WEEKNUM(A1)' },
  { name: 'HOUR', category: 'Date', syntax: 'HOUR(serial_number)', description: 'Returns the hour of a time value (0-23).', example: '=HOUR(A1)' },
  { name: 'MINUTE', category: 'Date', syntax: 'MINUTE(serial_number)', description: 'Returns the minute of a time value (0-59).', example: '=MINUTE(A1)' },
  { name: 'SECOND', category: 'Date', syntax: 'SECOND(serial_number)', description: 'Returns the second of a time value (0-59).', example: '=SECOND(A1)' },
  { name: 'TIME', category: 'Date', syntax: 'TIME(hour, minute, second)', description: 'Constructs a time serial number.', example: '=TIME(14, 30, 0)' },

  // More Math
  { name: 'RAND', category: 'Math', syntax: 'RAND()', description: 'Returns a random number between 0 and 1.', example: '=RAND()' },
  { name: 'RANDBETWEEN', category: 'Math', syntax: 'RANDBETWEEN(bottom, top)', description: 'Returns a random integer in a range.', example: '=RANDBETWEEN(1, 100)' },
  { name: 'SIGN', category: 'Math', syntax: 'SIGN(number)', description: 'Returns the sign of a number (-1, 0, or 1).', example: '=SIGN(-5)' },
  { name: 'EXP', category: 'Math', syntax: 'EXP(number)', description: 'Returns e raised to the power of number.', example: '=EXP(1)' },
  { name: 'LN', category: 'Math', syntax: 'LN(number)', description: 'Returns the natural logarithm.', example: '=LN(2.718)' },
  { name: 'LOG10', category: 'Math', syntax: 'LOG10(number)', description: 'Returns the base-10 logarithm.', example: '=LOG10(1000)' },
  { name: 'PI', category: 'Math', syntax: 'PI()', description: 'Returns the value of pi.', example: '=PI()' },
  { name: 'TRUNC', category: 'Math', syntax: 'TRUNC(number, [digits])', description: 'Truncates a number to integer or specified digits.', example: '=TRUNC(3.789, 1)' },
  { name: 'GCD', category: 'Math', syntax: 'GCD(number1, [number2], ...)', description: 'Returns the greatest common divisor.', example: '=GCD(12, 18)' },
  { name: 'LCM', category: 'Math', syntax: 'LCM(number1, [number2], ...)', description: 'Returns the least common multiple.', example: '=LCM(4, 6)' },
  { name: 'COMBIN', category: 'Math', syntax: 'COMBIN(n, k)', description: 'Returns the number of combinations.', example: '=COMBIN(10, 3)' },
  { name: 'PERMUT', category: 'Math', syntax: 'PERMUT(n, k)', description: 'Returns the number of permutations.', example: '=PERMUT(10, 3)' },
  { name: 'FACT', category: 'Math', syntax: 'FACT(number)', description: 'Returns the factorial of a number.', example: '=FACT(5)' },
  { name: 'SIN', category: 'Math', syntax: 'SIN(number)', description: 'Returns the sine of an angle (radians).', example: '=SIN(PI()/2)' },
  { name: 'COS', category: 'Math', syntax: 'COS(number)', description: 'Returns the cosine of an angle (radians).', example: '=COS(0)' },
  { name: 'TAN', category: 'Math', syntax: 'TAN(number)', description: 'Returns the tangent of an angle (radians).', example: '=TAN(PI()/4)' },

  // More Statistical
  { name: 'VAR', category: 'Statistical', syntax: 'VAR(number1, [number2], ...)', description: 'Estimates variance based on a sample.', example: '=VAR(A1:A10)' },
  { name: 'VARP', category: 'Statistical', syntax: 'VARP(number1, [number2], ...)', description: 'Calculates variance for a population.', example: '=VARP(A1:A10)' },
  { name: 'STDEVP', category: 'Statistical', syntax: 'STDEVP(number1, [number2], ...)', description: 'Population standard deviation.', example: '=STDEVP(A1:A10)' },
  { name: 'MODE', category: 'Statistical', syntax: 'MODE(number1, [number2], ...)', description: 'Returns the most frequent value.', example: '=MODE(A1:A10)' },
  { name: 'RANK', category: 'Statistical', syntax: 'RANK(number, ref, [order])', description: 'Returns the rank of a number in a list.', example: '=RANK(A1, A1:A10)' },
  { name: 'PERCENTILE', category: 'Statistical', syntax: 'PERCENTILE(array, k)', description: 'Returns the k-th percentile.', example: '=PERCENTILE(A1:A100, 0.9)' },
  { name: 'QUARTILE', category: 'Statistical', syntax: 'QUARTILE(array, quart)', description: 'Returns the quartile (0=min, 1=Q1, 2=median, 3=Q3, 4=max).', example: '=QUARTILE(A1:A10, 1)' },
  { name: 'CORREL', category: 'Statistical', syntax: 'CORREL(array1, array2)', description: 'Returns the correlation coefficient.', example: '=CORREL(A1:A10, B1:B10)' },
  { name: 'SLOPE', category: 'Statistical', syntax: 'SLOPE(known_ys, known_xs)', description: 'Returns the slope of a linear regression line.', example: '=SLOPE(B1:B10, A1:A10)' },
  { name: 'INTERCEPT', category: 'Statistical', syntax: 'INTERCEPT(known_ys, known_xs)', description: 'Returns the y-intercept of a linear regression.', example: '=INTERCEPT(B1:B10, A1:A10)' },

  // More Text
  { name: 'PROPER', category: 'Text', syntax: 'PROPER(text)', description: 'Capitalizes the first letter of each word.', example: '=PROPER("hello world")' },
  { name: 'CLEAN', category: 'Text', syntax: 'CLEAN(text)', description: 'Removes non-printable characters.', example: '=CLEAN(A1)' },
  { name: 'EXACT', category: 'Text', syntax: 'EXACT(text1, text2)', description: 'Returns TRUE if two strings are exactly equal.', example: '=EXACT(A1, B1)' },
  { name: 'FIND', category: 'Text', syntax: 'FIND(find_text, within_text, [start])', description: 'Case-sensitive search for substring.', example: '=FIND("a", A1)' },
  { name: 'SEARCH', category: 'Text', syntax: 'SEARCH(find_text, within_text, [start])', description: 'Case-insensitive search for substring.', example: '=SEARCH("hello", A1)' },
  { name: 'REPLACE', category: 'Text', syntax: 'REPLACE(old_text, start, length, new_text)', description: 'Replaces part of a string by position.', example: '=REPLACE(A1, 1, 3, "XYZ")' },
  { name: 'REPT', category: 'Text', syntax: 'REPT(text, number_times)', description: 'Repeats text n times.', example: '=REPT("-", 10)' },
  { name: 'VALUE', category: 'Text', syntax: 'VALUE(text)', description: 'Converts a text representation of a number to a number.', example: '=VALUE("123")' },
  { name: 'CHAR', category: 'Text', syntax: 'CHAR(number)', description: 'Returns character for an ASCII code.', example: '=CHAR(65)' },
  { name: 'CODE', category: 'Text', syntax: 'CODE(text)', description: 'Returns ASCII code of first character.', example: '=CODE("A")' },

  // More Lookup
  { name: 'ADDRESS', category: 'Lookup', syntax: 'ADDRESS(row, column, [abs_num])', description: 'Returns a cell address as text.', example: '=ADDRESS(2, 3)' },
  { name: 'INDIRECT', category: 'Lookup', syntax: 'INDIRECT(ref_text, [a1])', description: 'Returns the reference specified by a text string.', example: '=INDIRECT("A" & ROW())' },
  { name: 'OFFSET', category: 'Lookup', syntax: 'OFFSET(reference, rows, cols, [height], [width])', description: 'Returns a reference offset from a base.', example: '=OFFSET(A1, 2, 3)' },
  { name: 'ROW', category: 'Lookup', syntax: 'ROW([reference])', description: 'Returns the row number of a reference.', example: '=ROW(A5)' },
  { name: 'COLUMN', category: 'Lookup', syntax: 'COLUMN([reference])', description: 'Returns the column number of a reference.', example: '=COLUMN(C1)' },
  { name: 'ROWS', category: 'Lookup', syntax: 'ROWS(array)', description: 'Returns the number of rows in a reference.', example: '=ROWS(A1:A10)' },
  { name: 'COLUMNS', category: 'Lookup', syntax: 'COLUMNS(array)', description: 'Returns the number of columns in a reference.', example: '=COLUMNS(A1:E1)' },
  { name: 'CHOOSE', category: 'Lookup', syntax: 'CHOOSE(index, value1, [value2], ...)', description: 'Returns a value from a list by index.', example: '=CHOOSE(2, "a", "b", "c")' },
  { name: 'TRANSPOSE', category: 'Lookup', syntax: 'TRANSPOSE(array)', description: 'Returns a transposed version of an array.', example: '=TRANSPOSE(A1:C2)' },

  // More Logical
  { name: 'XOR', category: 'Logical', syntax: 'XOR(logical1, [logical2], ...)', description: 'Returns the exclusive-OR of arguments.', example: '=XOR(TRUE, FALSE)' },
  { name: 'TRUE', category: 'Logical', syntax: 'TRUE()', description: 'Returns the logical value TRUE.', example: '=TRUE()' },
  { name: 'FALSE', category: 'Logical', syntax: 'FALSE()', description: 'Returns the logical value FALSE.', example: '=FALSE()' },

  // Financial — common ones
  { name: 'PMT',      category: 'Financial', syntax: 'PMT(rate, nper, pv, [fv], [type])', description: 'Calculates loan/annuity payment.', example: '=PMT(0.05/12, 360, -200000)' },
  { name: 'FV',       category: 'Financial', syntax: 'FV(rate, nper, pmt, [pv], [type])', description: 'Returns future value of an investment.', example: '=FV(0.05/12, 12, -100)' },
  { name: 'PV',       category: 'Financial', syntax: 'PV(rate, nper, pmt, [fv], [type])', description: 'Returns present value of an investment.', example: '=PV(0.05/12, 12, -100)' },
  { name: 'NPV',      category: 'Financial', syntax: 'NPV(rate, value1, [value2], ...)', description: 'Net present value of cashflows.', example: '=NPV(0.1, A1:A5)' },
  { name: 'IRR',      category: 'Financial', syntax: 'IRR(values, [guess])', description: 'Internal rate of return.', example: '=IRR(A1:A5)' },
  { name: 'RATE',     category: 'Financial', syntax: 'RATE(nper, pmt, pv, [fv], [type], [guess])', description: 'Interest rate per period.', example: '=RATE(60, -100, 5000)' },
  { name: 'NPER',     category: 'Financial', syntax: 'NPER(rate, pmt, pv, [fv], [type])', description: 'Number of periods to pay off a loan.', example: '=NPER(0.05/12, -200, 5000)' },
  { name: 'IPMT',     category: 'Financial', syntax: 'IPMT(rate, per, nper, pv, [fv], [type])', description: 'Interest portion of payment for given period.', example: '=IPMT(0.05/12, 1, 60, -10000)' },
  { name: 'PPMT',     category: 'Financial', syntax: 'PPMT(rate, per, nper, pv, [fv], [type])', description: 'Principal portion of payment for given period.', example: '=PPMT(0.05/12, 1, 60, -10000)' },
  { name: 'CUMIPMT',  category: 'Financial', syntax: 'CUMIPMT(rate, nper, pv, start, end, type)', description: 'Cumulative interest paid between periods.', example: '=CUMIPMT(0.05/12, 60, 10000, 1, 12, 0)' },

  // Information — type tests
  { name: 'ISBLANK',  category: 'Information', syntax: 'ISBLANK(value)', description: 'Returns TRUE if the value is blank.', example: '=ISBLANK(A1)' },
  { name: 'ISNUMBER', category: 'Information', syntax: 'ISNUMBER(value)', description: 'Returns TRUE if the value is a number.', example: '=ISNUMBER(A1)' },
  { name: 'ISTEXT',   category: 'Information', syntax: 'ISTEXT(value)', description: 'Returns TRUE if the value is text.', example: '=ISTEXT(A1)' },
  { name: 'ISERROR',  category: 'Information', syntax: 'ISERROR(value)', description: 'Returns TRUE if the value is an error.', example: '=ISERROR(A1/B1)' },
  { name: 'ISNA',     category: 'Information', syntax: 'ISNA(value)', description: 'Returns TRUE if the value is #N/A.', example: '=ISNA(A1)' },
  { name: 'ISLOGICAL', category: 'Information', syntax: 'ISLOGICAL(value)', description: 'Returns TRUE if the value is logical (TRUE/FALSE).', example: '=ISLOGICAL(A1)' },
  { name: 'ISEVEN',   category: 'Information', syntax: 'ISEVEN(number)', description: 'Returns TRUE if the number is even.', example: '=ISEVEN(4)' },
  { name: 'ISODD',    category: 'Information', syntax: 'ISODD(number)', description: 'Returns TRUE if the number is odd.', example: '=ISODD(3)' },
  { name: 'NA',       category: 'Information', syntax: 'NA()', description: 'Returns the error value #N/A.', example: '=NA()' },
  { name: 'TYPE',     category: 'Information', syntax: 'TYPE(value)', description: 'Returns 1=number, 2=text, 4=logical, 16=error, 64=array.', example: '=TYPE(A1)' },

  // Engineering — basics
  { name: 'CONVERT',  category: 'Engineering', syntax: 'CONVERT(number, from_unit, to_unit)', description: 'Converts a number between measurement systems.', example: '=CONVERT(1, "mi", "km")' },
  { name: 'DEC2BIN',  category: 'Engineering', syntax: 'DEC2BIN(number)', description: 'Converts decimal to binary.', example: '=DEC2BIN(10)' },
  { name: 'DEC2HEX',  category: 'Engineering', syntax: 'DEC2HEX(number)', description: 'Converts decimal to hexadecimal.', example: '=DEC2HEX(255)' },
  { name: 'BIN2DEC',  category: 'Engineering', syntax: 'BIN2DEC(number)', description: 'Converts binary to decimal.', example: '=BIN2DEC("1010")' },
  { name: 'HEX2DEC',  category: 'Engineering', syntax: 'HEX2DEC(number)', description: 'Converts hexadecimal to decimal.', example: '=HEX2DEC("FF")' },
  { name: 'BITAND',   category: 'Engineering', syntax: 'BITAND(num1, num2)', description: 'Bitwise AND of two numbers.', example: '=BITAND(13, 10)' },
  { name: 'BITOR',    category: 'Engineering', syntax: 'BITOR(num1, num2)', description: 'Bitwise OR of two numbers.', example: '=BITOR(13, 10)' },
]

export function searchFormulas(query: string): FormulaEntry[] {
  const q = query.toUpperCase()
  return FORMULA_LIST.filter((f) => f.name.startsWith(q))
}
