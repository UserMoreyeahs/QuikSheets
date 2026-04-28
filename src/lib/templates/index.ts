import type { Sheet } from '@fortune-sheet/core'

export type TemplateCategory =
  | 'All'
  | 'Sales'
  | 'Finance'
  | 'HR'
  | 'Operations'
  | 'Project Management'
  | 'Personal'

export interface TemplateDefinition {
  id: string
  name: string
  category: TemplateCategory
  description: string
  rowCount: number
  colCount: number
  sheets: Sheet[]
}

// Header cell style
function hdr(text: string, bg = '#1E3A5F', fc = '#FFFFFF'): object {
  return { v: text, m: text, bl: 1, fs: 11, bg, fc, ht: 0 }
}

// Data cell
function cell(value: string | number, options?: { bl?: 1; bg?: string; fc?: string; ht?: 0 | 1 | 2 }): object {
  const base: Record<string, unknown> = {
    v: value,
    m: typeof value === 'number' ? String(value) : value,
  }
  if (options?.bl) base.bl = 1
  if (options?.bg) base.bg = options.bg
  if (options?.fc) base.fc = options.fc
  if (options?.ht !== undefined) base.ht = options.ht
  return base
}

// Currency cell
function curr(value: number): object {
  return { v: value, m: `$${value.toFixed(2)}`, ct: { fa: '$0.00', t: 'n' } }
}

// Percentage cell
function pct(value: number): object {
  return { v: value / 100, m: `${value}%`, ct: { fa: '0.00%', t: 'n' } }
}

function makeSheet(name: string, id: string, order: number, celldata: { r: number; c: number; v: object }[]): Sheet {
  return {
    name,
    id,
    status: order === 0 ? 1 : 0,
    order,
    hide: 0,
    row: 100,
    column: 26,
    celldata,
  }
}

// ─── Template 1: Sales Pipeline ─────────────────────────────────────────────
const SALES_HEADERS = ['Deal Name', 'Company', 'Contact', 'Stage', 'Value', 'Probability', 'Expected Close', 'Owner', 'Notes']
const SALES_ROWS = [
  ['Acme Corp Expansion', 'Acme Corp', 'John Smith', 'Proposal', 45000, 60, '2024-03-15', 'Alice Johnson', 'Follow up on Q2 needs'],
  ['Global Tech Platform', 'Global Tech', 'Maria Garcia', 'Negotiation', 120000, 75, '2024-02-28', 'Bob Williams', 'Contract review pending'],
  ['StartupXYZ CRM', 'StartupXYZ', 'Tom Chen', 'Qualified', 18000, 40, '2024-04-01', 'Alice Johnson', 'Demo scheduled next week'],
  ['MegaCorp Integration', 'MegaCorp', 'Sarah Lee', 'Won', 250000, 100, '2024-01-30', 'Carol Davis', 'Closed! Onboarding started'],
  ['SmallBiz Suite', 'SmallBiz Inc', 'Mike Brown', 'Lead', 8500, 20, '2024-05-10', 'Bob Williams', 'Initial contact made'],
  ['DataFlow Analytics', 'DataFlow', 'Emma Wilson', 'Proposal', 65000, 55, '2024-03-20', 'Carol Davis', 'Awaiting technical review'],
  ['TechStart Platform', 'TechStart', 'Ryan Martinez', 'Lost', 35000, 0, '2024-01-15', 'Alice Johnson', 'Went with competitor'],
  ['Enterprise Systems', 'Enterprise Co', 'Lily Thompson', 'Negotiation', 180000, 80, '2024-02-15', 'Bob Williams', 'Final terms in review'],
  ['CloudBase Upgrade', 'CloudBase', 'James Anderson', 'Qualified', 42000, 45, '2024-04-15', 'Carol Davis', 'Needs security assessment'],
  ['RetailPro Tools', 'RetailPro', 'Nina Patel', 'Proposal', 28000, 65, '2024-03-08', 'Alice Johnson', 'Budget approved'],
]

const salesCelldata: { r: number; c: number; v: object }[] = SALES_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h),
}))
SALES_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    let v: object
    if (ci === 4) v = curr(val as number)
    else if (ci === 5) v = pct(val as number)
    else if (ci === 3) {
      const stageColors: Record<string, string> = {
        Won: '#D1FAE5', Lost: '#FEE2E2', Negotiation: '#DBEAFE',
        Proposal: '#EDE9FE', Qualified: '#FEF3C7', Lead: '#F3F4F6',
      }
      v = cell(String(val), { bg: stageColors[String(val)] ?? '#F3F4F6', ht: 0 })
    } else v = cell(val as string | number)
    salesCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 2: Monthly Budget ─────────────────────────────────────────────
const budgetCelldata: { r: number; c: number; v: object }[] = [
  { r: 0, c: 0, v: hdr('Category') },
  { r: 0, c: 1, v: hdr('Budgeted') },
  { r: 0, c: 2, v: hdr('Actual') },
  { r: 0, c: 3, v: hdr('Variance') },
  { r: 0, c: 4, v: hdr('% of Budget') },
  // Income section
  { r: 1, c: 0, v: cell('INCOME', { bl: 1, bg: '#DBEAFE', fc: '#1E40AF' }) },
  { r: 2, c: 0, v: cell('Salary') }, { r: 2, c: 1, v: curr(5000) }, { r: 2, c: 2, v: curr(5000) }, { r: 2, c: 3, v: { f: 'C3-B3', v: 0, m: '$0.00' } }, { r: 2, c: 4, v: { f: 'C3/B3', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 3, c: 0, v: cell('Freelance') }, { r: 3, c: 1, v: curr(800) }, { r: 3, c: 2, v: curr(1200) }, { r: 3, c: 3, v: { f: 'C4-B4', v: 400, m: '$400.00' } }, { r: 3, c: 4, v: { f: 'C4/B4', v: 1.5, m: '150%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 4, c: 0, v: cell('Other') }, { r: 4, c: 1, v: curr(200) }, { r: 4, c: 2, v: curr(150) }, { r: 4, c: 3, v: { f: 'C5-B5', v: -50, m: '-$50.00' } }, { r: 4, c: 4, v: { f: 'C5/B5', v: 0.75, m: '75%', ct: { fa: '0.00%', t: 'n' } } },
  // Fixed expenses
  { r: 5, c: 0, v: cell('FIXED EXPENSES', { bl: 1, bg: '#FEE2E2', fc: '#991B1B' }) },
  { r: 6, c: 0, v: cell('Rent') }, { r: 6, c: 1, v: curr(1500) }, { r: 6, c: 2, v: curr(1500) }, { r: 6, c: 3, v: { f: 'C7-B7', v: 0, m: '$0.00' } }, { r: 6, c: 4, v: { f: 'C7/B7', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 7, c: 0, v: cell('Insurance') }, { r: 7, c: 1, v: curr(350) }, { r: 7, c: 2, v: curr(350) }, { r: 7, c: 3, v: { f: 'C8-B8', v: 0, m: '$0.00' } }, { r: 7, c: 4, v: { f: 'C8/B8', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 8, c: 0, v: cell('Car Payment') }, { r: 8, c: 1, v: curr(400) }, { r: 8, c: 2, v: curr(400) }, { r: 8, c: 3, v: { f: 'C9-B9', v: 0, m: '$0.00' } }, { r: 8, c: 4, v: { f: 'C9/B9', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  // Variable expenses
  { r: 9, c: 0, v: cell('VARIABLE EXPENSES', { bl: 1, bg: '#FEF3C7', fc: '#92400E' }) },
  { r: 10, c: 0, v: cell('Groceries') }, { r: 10, c: 1, v: curr(600) }, { r: 10, c: 2, v: curr(720) }, { r: 10, c: 3, v: { f: 'C11-B11', v: 120, m: '$120.00' } }, { r: 10, c: 4, v: { f: 'C11/B11', v: 1.2, m: '120%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 11, c: 0, v: cell('Dining Out') }, { r: 11, c: 1, v: curr(300) }, { r: 11, c: 2, v: curr(420) }, { r: 11, c: 3, v: { f: 'C12-B12', v: 120, m: '$120.00' } }, { r: 11, c: 4, v: { f: 'C12/B12', v: 1.4, m: '140%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 12, c: 0, v: cell('Entertainment') }, { r: 12, c: 1, v: curr(200) }, { r: 12, c: 2, v: curr(150) }, { r: 12, c: 3, v: { f: 'C13-B13', v: -50, m: '-$50.00' } }, { r: 12, c: 4, v: { f: 'C13/B13', v: 0.75, m: '75%', ct: { fa: '0.00%', t: 'n' } } },
  // Savings
  { r: 13, c: 0, v: cell('SAVINGS', { bl: 1, bg: '#D1FAE5', fc: '#065F46' }) },
  { r: 14, c: 0, v: cell('Emergency Fund') }, { r: 14, c: 1, v: curr(500) }, { r: 14, c: 2, v: curr(500) }, { r: 14, c: 3, v: { f: 'C15-B15', v: 0, m: '$0.00' } }, { r: 14, c: 4, v: { f: 'C15/B15', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  { r: 15, c: 0, v: cell('Retirement') }, { r: 15, c: 1, v: curr(300) }, { r: 15, c: 2, v: curr(300) }, { r: 15, c: 3, v: { f: 'C16-B16', v: 0, m: '$0.00' } }, { r: 15, c: 4, v: { f: 'C16/B16', v: 1, m: '100%', ct: { fa: '0.00%', t: 'n' } } },
  // Summary
  { r: 16, c: 0, v: cell('TOTAL', { bl: 1, bg: '#1E3A5F', fc: '#FFFFFF' }) },
  { r: 16, c: 1, v: { f: 'SUM(B3:B16)', v: 10150, m: '$10,150.00', bl: 1, bg: '#1E3A5F', fc: '#FFFFFF' } },
  { r: 16, c: 2, v: { f: 'SUM(C3:C16)', v: 10690, m: '$10,690.00', bl: 1, bg: '#1E3A5F', fc: '#FFFFFF' } },
  { r: 16, c: 3, v: { f: 'D3+D4+D5+D7+D8+D9+D11+D12+D13+D15+D16', v: 540, m: '$540.00', bl: 1, bg: '#1E3A5F', fc: '#FFFFFF' } },
]

// ─── Template 3: Employee Directory ─────────────────────────────────────────
const EMP_HEADERS = ['Employee ID', 'Full Name', 'Department', 'Title', 'Email', 'Phone', 'Start Date', 'Manager', 'Status']
const EMP_ROWS = [
  ['EMP001', 'Alice Johnson', 'Engineering', 'Senior Engineer', 'alice.j@company.com', '555-0101', '2020-03-01', 'Carol Davis', 'Active'],
  ['EMP002', 'Bob Williams', 'Sales', 'Account Executive', 'bob.w@company.com', '555-0102', '2021-06-15', 'Mike Brown', 'Active'],
  ['EMP003', 'Carol Davis', 'Engineering', 'VP Engineering', 'carol.d@company.com', '555-0103', '2018-01-10', '', 'Active'],
  ['EMP004', 'Tom Chen', 'Product', 'Product Manager', 'tom.c@company.com', '555-0104', '2022-01-20', 'Carol Davis', 'Active'],
  ['EMP005', 'Maria Garcia', 'Design', 'UX Designer', 'maria.g@company.com', '555-0105', '2021-09-01', 'Tom Chen', 'Active'],
  ['EMP006', 'Mike Brown', 'Sales', 'Sales Director', 'mike.b@company.com', '555-0106', '2019-05-15', '', 'On Leave'],
  ['EMP007', 'Sarah Lee', 'Finance', 'CFO', 'sarah.l@company.com', '555-0107', '2017-08-01', '', 'Active'],
  ['EMP008', 'James Anderson', 'Engineering', 'Software Engineer', 'james.a@company.com', '555-0108', '2023-02-01', 'Alice Johnson', 'Active'],
  ['EMP009', 'Emma Wilson', 'Marketing', 'Marketing Manager', 'emma.w@company.com', '555-0109', '2020-11-01', '', 'Active'],
  ['EMP010', 'Ryan Martinez', 'Engineering', 'DevOps Engineer', 'ryan.m@company.com', '555-0110', '2022-07-01', 'Alice Johnson', 'Active'],
  ['EMP011', 'Lily Thompson', 'HR', 'HR Manager', 'lily.t@company.com', '555-0111', '2019-03-15', '', 'Active'],
  ['EMP012', 'Nina Patel', 'Design', 'Graphic Designer', 'nina.p@company.com', '555-0112', '2023-05-01', 'Maria Garcia', 'Active'],
  ['EMP013', 'Chris Brown', 'Sales', 'SDR', 'chris.b@company.com', '555-0113', '2023-10-01', 'Bob Williams', 'Active'],
  ['EMP014', 'Priya Sharma', 'Finance', 'Financial Analyst', 'priya.s@company.com', '555-0114', '2022-04-01', 'Sarah Lee', 'Active'],
  ['EMP015', 'David Kim', 'Engineering', 'QA Engineer', 'david.k@company.com', '555-0115', '2021-12-01', 'Alice Johnson', 'Terminated'],
]

const empCelldata: { r: number; c: number; v: object }[] = EMP_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#2D3748'),
}))
EMP_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    const statusColors: Record<string, string> = { Active: '#D1FAE5', 'On Leave': '#FEF3C7', Terminated: '#FEE2E2' }
    const v = ci === 8 ? cell(val, { bg: statusColors[val] ?? '#F3F4F6', ht: 0 }) : cell(val)
    empCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 4: Project Task Tracker ───────────────────────────────────────
const TASK_HEADERS = ['Task ID', 'Task Name', 'Assignee', 'Priority', 'Status', 'Due Date', '% Complete', 'Blockers', 'Notes']
const TASK_ROWS = [
  ['T001', 'Set up CI/CD pipeline', 'Alice Johnson', 'High', 'Done', '2024-01-15', 100, '', 'Merged to main'],
  ['T002', 'Design system audit', 'Maria Garcia', 'Medium', 'In Progress', '2024-02-01', 60, '', 'Color tokens complete'],
  ['T003', 'User authentication', 'James Anderson', 'High', 'Done', '2024-01-20', 100, '', 'OAuth + JWT'],
  ['T004', 'Database schema v2', 'Ryan Martinez', 'High', 'Blocked', '2024-01-25', 30, 'Awaiting approval', 'Migration complex'],
  ['T005', 'API rate limiting', 'Alice Johnson', 'Medium', 'In Progress', '2024-02-10', 45, '', 'Redis integration'],
  ['T006', 'Mobile responsive', 'Maria Garcia', 'Low', 'Not Started', '2024-03-01', 0, '', ''],
  ['T007', 'Analytics dashboard', 'Tom Chen', 'High', 'In Progress', '2024-02-15', 70, '', 'ECharts integration done'],
  ['T008', 'Email notifications', 'James Anderson', 'Medium', 'Not Started', '2024-02-20', 0, '', 'Resend API'],
  ['T009', 'Performance audit', 'Ryan Martinez', 'Low', 'Not Started', '2024-03-15', 0, '', 'Lighthouse target 90+'],
  ['T010', 'Onboarding flow', 'Maria Garcia', 'High', 'Blocked', '2024-02-05', 25, 'Design pending', ''],
  ['T011', 'Export to PDF', 'Alice Johnson', 'Medium', 'Done', '2024-01-30', 100, '', 'jsPDF implemented'],
  ['T012', 'Role-based access', 'Tom Chen', 'High', 'In Progress', '2024-02-08', 50, '', 'RBAC policy design'],
  ['T013', 'Search functionality', 'James Anderson', 'Medium', 'Not Started', '2024-03-05', 0, '', ''],
  ['T014', 'Unit test coverage', 'Ryan Martinez', 'Low', 'In Progress', '2024-03-20', 35, '', 'Target 80%'],
  ['T015', 'Documentation', 'Tom Chen', 'Low', 'Not Started', '2024-04-01', 0, '', 'API docs first'],
  ['T016', 'Billing integration', 'Alice Johnson', 'High', 'Not Started', '2024-03-10', 0, '', 'Stripe setup'],
  ['T017', 'Customer support chat', 'Maria Garcia', 'Medium', 'Not Started', '2024-04-15', 0, '', 'Intercom eval'],
  ['T018', 'Data export wizard', 'James Anderson', 'Medium', 'In Progress', '2024-02-25', 40, '', ''],
  ['T019', 'A/B testing framework', 'Ryan Martinez', 'Low', 'Not Started', '2024-04-01', 0, '', ''],
  ['T020', 'Accessibility audit', 'Maria Garcia', 'High', 'Not Started', '2024-03-20', 0, 'Screen reader issues', 'WCAG 2.1 AA'],
]

const taskCelldata: { r: number; c: number; v: object }[] = TASK_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#4C1D95', '#EDE9FE'),
}))
TASK_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    let v: object
    const priorityColors: Record<string, string> = { High: '#FEE2E2', Medium: '#FEF3C7', Low: '#D1FAE5' }
    const statusColors: Record<string, string> = { Done: '#D1FAE5', 'In Progress': '#DBEAFE', Blocked: '#FED7AA', 'Not Started': '#F3F4F6' }
    if (ci === 3) v = cell(String(val), { bg: priorityColors[String(val)] ?? '#F3F4F6', ht: 0 })
    else if (ci === 4) v = cell(String(val), { bg: statusColors[String(val)] ?? '#F3F4F6', ht: 0 })
    else if (ci === 6) v = { v: (val as number) / 100, m: `${val}%`, ct: { fa: '0%', t: 'n' } }
    else v = cell(val as string | number)
    taskCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 5: Invoice Tracker ─────────────────────────────────────────────
const INV_HEADERS = ['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Days Overdue', 'Notes']
const INV_ROWS = [
  ['INV-001', 'Acme Corp', '2024-01-01', '2024-01-31', 12500, 'Paid', 0, 'Paid on time'],
  ['INV-002', 'Global Tech', '2024-01-05', '2024-02-04', 8750, 'Paid', 0, ''],
  ['INV-003', 'StartupXYZ', '2024-01-10', '2024-02-09', 3200, 'Overdue', 45, 'Second notice sent'],
  ['INV-004', 'MegaCorp', '2024-01-15', '2024-02-14', 25000, 'Paid', 0, 'Early payment'],
  ['INV-005', 'SmallBiz Inc', '2024-01-20', '2024-02-19', 1800, 'Overdue', 15, ''],
  ['INV-006', 'DataFlow', '2024-02-01', '2024-03-01', 9400, 'Sent', 0, 'Awaiting payment'],
  ['INV-007', 'Enterprise Co', '2024-02-05', '2024-03-06', 35000, 'Sent', 0, 'Net 30'],
  ['INV-008', 'CloudBase', '2024-02-10', '2024-03-11', 7200, 'Draft', 0, 'Pending review'],
]

const invCelldata: { r: number; c: number; v: object }[] = INV_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#0F766E', '#F0FDFA'),
}))
INV_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    let v: object
    const statusColors: Record<string, string> = { Paid: '#D1FAE5', Overdue: '#FEE2E2', Sent: '#DBEAFE', Draft: '#F3F4F6' }
    if (ci === 4) v = curr(val as number)
    else if (ci === 5) v = cell(String(val), { bg: statusColors[String(val)] ?? '#F3F4F6', ht: 0 })
    else if (ci === 6) {
      const days = val as number
      v = cell(days, { bg: days > 30 ? '#FEE2E2' : days > 0 ? '#FEF3C7' : '#FFFFFF', ht: 0 })
    } else v = cell(val as string | number)
    invCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 6: Content Calendar ────────────────────────────────────────────
const CC_HEADERS = ['Date', 'Platform', 'Content Type', 'Topic', 'Status', 'Author', 'Published URL', 'Notes']
const CC_ROWS = [
  ['2024-02-01', 'Blog', 'Article', '10 Tips for Remote Work', 'Published', 'Emma Wilson', 'https://blog.co/remote-tips', '4.2k views'],
  ['2024-02-03', 'Twitter', 'Thread', 'Product Hunt launch thread', 'Published', 'Bob Williams', 'https://x.com/launch', '890 likes'],
  ['2024-02-05', 'LinkedIn', 'Article', 'B2B SaaS Growth Tactics', 'Published', 'Emma Wilson', 'https://li.co/b2b', '1.2k impressions'],
  ['2024-02-08', 'Instagram', 'Infographic', 'Product Feature Highlights', 'Scheduled', 'Maria Garcia', '', 'Ready to post'],
  ['2024-02-10', 'YouTube', 'Video', 'Product Demo Walkthrough', 'Review', 'Tom Chen', '', 'Editing in progress'],
  ['2024-02-12', 'Blog', 'Article', 'Case Study: Acme Corp', 'Draft', 'Emma Wilson', '', 'Needs customer approval'],
  ['2024-02-15', 'Twitter', 'Thread', 'Industry news roundup', 'Draft', 'Bob Williams', '', '5 tweet thread'],
  ['2024-02-18', 'LinkedIn', 'Article', 'Engineering culture at our company', 'Draft', 'Alice Johnson', '', 'First draft done'],
]

const ccCelldata: { r: number; c: number; v: object }[] = CC_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#7C3AED', '#F5F3FF'),
}))
CC_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    const statusColors: Record<string, string> = {
      Published: '#D1FAE5', Scheduled: '#DBEAFE', Review: '#FEF3C7', Draft: '#F3F4F6',
    }
    const v = ci === 4 ? cell(String(val), { bg: statusColors[String(val)] ?? '#F3F4F6', ht: 0 }) : cell(val as string)
    ccCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 7: OKR Tracker ──────────────────────────────────────────────────
const OKR_HEADERS = ['Objective', 'Key Result', 'Owner', 'Target', 'Current', 'Progress', 'Q', 'Status']
const OKR_ROWS = [
  ['Grow revenue', 'Reach $1M ARR', 'CEO', 1000000, 780000, 78, 'Q1', 'On Track'],
  ['Grow revenue', 'Close 20 enterprise deals', 'Sales', 20, 14, 70, 'Q1', 'On Track'],
  ['Grow revenue', 'Reduce churn to <2%', 'CS', 2, 2.8, 40, 'Q1', 'At Risk'],
  ['Improve product', 'NPS score >50', 'Product', 50, 42, 84, 'Q1', 'On Track'],
  ['Improve product', 'Release 5 major features', 'Engineering', 5, 3, 60, 'Q1', 'On Track'],
  ['Improve product', 'Reduce bug backlog by 50%', 'QA', 50, 35, 70, 'Q1', 'On Track'],
  ['Scale team', 'Hire 10 engineers', 'HR', 10, 4, 40, 'Q1', 'At Risk'],
  ['Scale team', 'Achieve <30 day time-to-hire', 'HR', 30, 42, 30, 'Q1', 'Behind'],
]

const okrCelldata: { r: number; c: number; v: object }[] = OKR_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#065F46', '#D1FAE5'),
}))
OKR_ROWS.forEach((row, ri) => {
  row.forEach((val, ci) => {
    let v: object
    const progress = row[5] as number
    const pgBg = progress >= 75 ? '#D1FAE5' : progress >= 50 ? '#FEF3C7' : '#FEE2E2'
    const statusColors: Record<string, string> = { 'On Track': '#D1FAE5', 'At Risk': '#FEF3C7', Behind: '#FEE2E2' }
    if (ci === 5) v = { v: (val as number) / 100, m: `${val}%`, ct: { fa: '0%', t: 'n' }, bg: pgBg }
    else if (ci === 7) v = cell(String(val), { bg: statusColors[String(val)] ?? '#F3F4F6', ht: 0 })
    else v = cell(val as string | number)
    okrCelldata.push({ r: ri + 1, c: ci, v })
  })
})

// ─── Template 8: Personal Finance ─────────────────────────────────────────────
const PF_HEADERS = ['Date', 'Description', 'Category', 'Amount', 'Type', 'Balance']
const PF_ROWS: [string, string, string, number, string][] = [
  ['2024-01-01', 'Opening Balance', 'Balance', 5000, 'Income'],
  ['2024-01-03', 'Paycheck', 'Income', 2500, 'Income'],
  ['2024-01-05', 'Rent', 'Housing', 1500, 'Expense'],
  ['2024-01-07', 'Groceries', 'Food', 150, 'Expense'],
  ['2024-01-09', 'Netflix', 'Entertainment', 15, 'Expense'],
  ['2024-01-10', 'Gas', 'Transport', 55, 'Expense'],
  ['2024-01-12', 'Freelance payment', 'Income', 800, 'Income'],
  ['2024-01-14', 'Dining out', 'Food', 85, 'Expense'],
  ['2024-01-16', 'Gym membership', 'Health', 50, 'Expense'],
  ['2024-01-18', 'Online shopping', 'Shopping', 120, 'Expense'],
]

const pfCelldata: { r: number; c: number; v: object }[] = PF_HEADERS.map((h, c) => ({
  r: 0, c, v: hdr(h, '#1D4ED8', '#EFF6FF'),
}))
let runningBalance = 0
PF_ROWS.forEach((row, ri) => {
  const [date, desc, cat, amount, type] = row
  if (type === 'Income') runningBalance += amount
  else runningBalance -= amount

  const typeColor = type === 'Income' ? '#D1FAE5' : '#FEE2E2'
  pfCelldata.push(
    { r: ri + 1, c: 0, v: cell(date) },
    { r: ri + 1, c: 1, v: cell(desc) },
    { r: ri + 1, c: 2, v: cell(cat) },
    { r: ri + 1, c: 3, v: curr(amount) },
    { r: ri + 1, c: 4, v: cell(type, { bg: typeColor, ht: 0 }) },
    { r: ri + 1, c: 5, v: curr(runningBalance) },
  )
})

// ─── Export ────────────────────────────────────────────────────────────────────
export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'sales-pipeline',
    name: 'Sales Pipeline',
    category: 'Sales',
    description: 'Track deals from lead to close with stage-based color coding.',
    rowCount: 10,
    colCount: 9,
    sheets: [makeSheet('Pipeline', 'sheet1', 0, salesCelldata)],
  },
  {
    id: 'monthly-budget',
    name: 'Monthly Budget',
    category: 'Finance',
    description: 'Plan and track income, expenses, and savings with variance formulas.',
    rowCount: 17,
    colCount: 5,
    sheets: [makeSheet('Budget', 'sheet1', 0, budgetCelldata)],
  },
  {
    id: 'employee-directory',
    name: 'Employee Directory',
    category: 'HR',
    description: 'Maintain a structured employee roster with department and status.',
    rowCount: 15,
    colCount: 9,
    sheets: [makeSheet('Directory', 'sheet1', 0, empCelldata)],
  },
  {
    id: 'project-task-tracker',
    name: 'Project Task Tracker',
    category: 'Project Management',
    description: 'Manage tasks with priority, status, and completion tracking.',
    rowCount: 20,
    colCount: 9,
    sheets: [makeSheet('Tasks', 'sheet1', 0, taskCelldata)],
  },
  {
    id: 'invoice-tracker',
    name: 'Invoice Tracker',
    category: 'Finance',
    description: 'Track invoices, payment status, and overdue accounts.',
    rowCount: 8,
    colCount: 8,
    sheets: [makeSheet('Invoices', 'sheet1', 0, invCelldata)],
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    category: 'Operations',
    description: 'Plan and track content across platforms from draft to publish.',
    rowCount: 8,
    colCount: 8,
    sheets: [makeSheet('Calendar', 'sheet1', 0, ccCelldata)],
  },
  {
    id: 'okr-tracker',
    name: 'OKR Tracker',
    category: 'Operations',
    description: 'Track objectives and key results with color-coded progress.',
    rowCount: 8,
    colCount: 8,
    sheets: [makeSheet('OKRs', 'sheet1', 0, okrCelldata)],
  },
  {
    id: 'personal-finance',
    name: 'Personal Finance',
    category: 'Personal',
    description: 'Log income and expenses with a running balance.',
    rowCount: 10,
    colCount: 6,
    sheets: [makeSheet('Transactions', 'sheet1', 0, pfCelldata)],
  },
]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'All', 'Sales', 'Finance', 'HR', 'Operations', 'Project Management', 'Personal',
]

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
