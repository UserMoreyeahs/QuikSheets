/**
 * Curated set of lucide icon names for the IconPicker.
 *
 * Lucide ships 1000+ icons — importing all of them blows up the bundle
 * and overwhelms the picker UI. The 36 names below cover the most
 * common Excel/PowerPoint icon-insert use-cases (status, navigation,
 * commerce, media, communication, etc.) and stay inside a 6×6 grid.
 *
 * Keep this list short. If a user wants a specific icon outside the
 * set, they can type a name manually in the picker's "Other…" input.
 */

export const CURATED_ICON_NAMES = [
  // Status / approval
  'Check', 'X', 'Star', 'Heart', 'Flag', 'Bell',
  // Navigation / direction
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'TrendingUp', 'TrendingDown',
  // Commerce / finance
  'DollarSign', 'CreditCard', 'ShoppingCart', 'Tag', 'Package', 'Truck',
  // Communication
  'Mail', 'Phone', 'MessageSquare', 'Users', 'User', 'Send',
  // Tools / data
  'Settings', 'Search', 'Filter', 'Download', 'Upload', 'Trash2',
  // Time / location
  'Clock', 'Calendar', 'MapPin', 'Home', 'Building', 'Globe',
] as const

export type CuratedIconName = (typeof CURATED_ICON_NAMES)[number]
