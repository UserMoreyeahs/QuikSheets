export type FormulaCategory =
  | 'Math'
  | 'Statistical'
  | 'Text'
  | 'Logical'
  | 'Lookup'
  | 'Date'

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

  // Date
  { name: 'TODAY', category: 'Date', syntax: 'TODAY()', description: 'Returns the current date.', example: '=TODAY()' },
  { name: 'NOW', category: 'Date', syntax: 'NOW()', description: 'Returns the current date and time.', example: '=NOW()' },
  { name: 'DATE', category: 'Date', syntax: 'DATE(year, month, day)', description: 'Returns the serial number of a date.', example: '=DATE(2024, 12, 31)' },
  { name: 'YEAR', category: 'Date', syntax: 'YEAR(serial_number)', description: 'Extracts the year from a date.', example: '=YEAR(A1)' },
  { name: 'MONTH', category: 'Date', syntax: 'MONTH(serial_number)', description: 'Extracts the month from a date.', example: '=MONTH(A1)' },
  { name: 'DAY', category: 'Date', syntax: 'DAY(serial_number)', description: 'Extracts the day from a date.', example: '=DAY(A1)' },
  { name: 'DATEDIF', category: 'Date', syntax: 'DATEDIF(start_date, end_date, unit)', description: 'Calculates the difference between two dates.', example: '=DATEDIF(A1,B1,"D")' },
  { name: 'NETWORKDAYS', category: 'Date', syntax: 'NETWORKDAYS(start_date, end_date, [holidays])', description: 'Returns the number of working days between dates.', example: '=NETWORKDAYS(A1, B1)' },
]

export function searchFormulas(query: string): FormulaEntry[] {
  const q = query.toUpperCase()
  return FORMULA_LIST.filter((f) => f.name.startsWith(q))
}
