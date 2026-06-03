/**
 * Curated set of free-to-use stock photos for the Stock Image picker.
 *
 * All photos are hosted on Unsplash's CDN and licensed under the
 * Unsplash License (free for commercial and personal use, no
 * attribution required). We hotlink the public `images.unsplash.com`
 * URLs directly — no API key, no runtime fetch, no auth.
 *
 * URL pattern:
 *   https://images.unsplash.com/photo-<id>?<query>
 * where <query> is `w=800&q=80` for the inserted full image and
 * `w=240&q=70&fit=crop` for the picker thumbnail (smaller payload).
 *
 * To add more photos, copy the photo ID from a public Unsplash page
 * (the segment after `/photos/` in the URL) and append a row here.
 */

export interface StockPhoto {
  id: string
  category: StockPhotoCategory
  /** Small image used in the picker grid. */
  thumbnail: string
  /** Full-resolution image inserted into the sheet. */
  full: string
  alt: string
  photographer: string
}

export type StockPhotoCategory =
  | 'Business'
  | 'Nature'
  | 'People'
  | 'Tech'
  | 'Food'
  | 'Abstract'

export const STOCK_PHOTO_CATEGORIES: ReadonlyArray<StockPhotoCategory> = [
  'Business', 'Nature', 'People', 'Tech', 'Food', 'Abstract',
]

function unsplash(id: string): { thumbnail: string; full: string } {
  return {
    thumbnail: `https://images.unsplash.com/photo-${id}?w=240&q=70&fit=crop`,
    full:      `https://images.unsplash.com/photo-${id}?w=1200&q=80`,
  }
}

export const STOCK_PHOTOS: ReadonlyArray<StockPhoto> = [
  // Business
  { id: 'b1', category: 'Business', ...unsplash('1454165804606-c3d57bc86b40'), alt: 'Laptop on a desk with a notebook',     photographer: 'Carl Heyerdahl' },
  { id: 'b2', category: 'Business', ...unsplash('1556761175-5973dc0f32e7'), alt: 'Office meeting with whiteboard',          photographer: 'Campaign Creators' },
  { id: 'b3', category: 'Business', ...unsplash('1542744173-8e7e53415bb0'), alt: 'Person reading financial reports',        photographer: 'Adeolu Eletu' },
  { id: 'b4', category: 'Business', ...unsplash('1521737711867-e3b97375f902'), alt: 'Charts and data on a screen',          photographer: 'Carlos Muza' },
  { id: 'b5', category: 'Business', ...unsplash('1556742049-0cfed4f6a45d'), alt: 'Coworkers at a startup office',           photographer: 'Brooke Cagle' },

  // Nature
  { id: 'n1', category: 'Nature', ...unsplash('1506905925346-21bda4d32df4'), alt: 'Mountain landscape at sunrise',          photographer: 'Łukasz Łada' },
  { id: 'n2', category: 'Nature', ...unsplash('1501785888041-af3ef285b470'), alt: 'Forest lake reflection',                 photographer: 'Luca Bravo' },
  { id: 'n3', category: 'Nature', ...unsplash('1470071459604-3b5ec3a7fe05'), alt: 'Misty mountain valley',                  photographer: 'David Marcu' },
  { id: 'n4', category: 'Nature', ...unsplash('1469474968028-56623f02e42e'), alt: 'Dark forest path',                       photographer: 'Sergei Akulich' },
  { id: 'n5', category: 'Nature', ...unsplash('1418065460487-3e41a6c84dc5'), alt: 'Beach at golden hour',                   photographer: 'Sean O.' },

  // People
  { id: 'p1', category: 'People', ...unsplash('1494790108377-be9c29b29330'), alt: 'Portrait of a smiling woman',            photographer: 'Christina @ wocintech' },
  { id: 'p2', category: 'People', ...unsplash('1507003211169-0a1dd7228f2d'), alt: 'Portrait of a man in glasses',           photographer: 'Stefan Stefancik' },
  { id: 'p3', category: 'People', ...unsplash('1500648767791-00dcc994a43e'), alt: 'Man with beard',                         photographer: 'Tom Ezzatkhah' },
  { id: 'p4', category: 'People', ...unsplash('1438761681033-6461ffad8d80'), alt: 'Woman laughing outdoors',                photographer: 'Joseph Gonzalez' },
  { id: 'p5', category: 'People', ...unsplash('1573496359142-b8d87734a5a2'), alt: 'Team standing together',                 photographer: 'Brooke Cagle' },

  // Tech
  { id: 't1', category: 'Tech', ...unsplash('1518770660439-4636190af475'), alt: 'Circuit board macro',                       photographer: 'Alexandre Debiève' },
  { id: 't2', category: 'Tech', ...unsplash('1517694712202-14dd9538aa97'), alt: 'Code editor on a screen',                   photographer: 'Pankaj Patel' },
  { id: 't3', category: 'Tech', ...unsplash('1496171367470-9ed9a91ea931'), alt: 'Hands typing on a keyboard',                photographer: 'Glenn Carstens-Peters' },
  { id: 't4', category: 'Tech', ...unsplash('1531297484001-80022131f5a1'), alt: 'Laptop with code',                          photographer: 'Caspar Camille Rubin' },
  { id: 't5', category: 'Tech', ...unsplash('1581091226825-a6a2a5aee158'), alt: 'Smart watch on a wrist',                    photographer: 'ThisisEngineering' },

  // Food
  { id: 'f1', category: 'Food', ...unsplash('1565299624946-b28f40a0ae38'), alt: 'Pizza on a wooden board',                   photographer: 'Brett Jordan' },
  { id: 'f2', category: 'Food', ...unsplash('1504674900247-0877df9cc836'), alt: 'Steak with garnish',                        photographer: 'Jonas Tebbe' },
  { id: 'f3', category: 'Food', ...unsplash('1490474418585-ba9bad8fd0ea'), alt: 'Fresh fruit salad',                         photographer: 'Brooke Lark' },
  { id: 'f4', category: 'Food', ...unsplash('1506084868230-bb9d95c24759'), alt: 'Latte art in a cup',                        photographer: 'Demi DeHerrera' },
  { id: 'f5', category: 'Food', ...unsplash('1467003909585-2f8a72700288'), alt: 'Pancake stack with syrup',                  photographer: 'Joseph Gonzalez' },

  // Abstract
  { id: 'a1', category: 'Abstract', ...unsplash('1557682250-33bd709cbe85'), alt: 'Colorful neon abstract',                   photographer: 'Pawel Czerwinski' },
  { id: 'a2', category: 'Abstract', ...unsplash('1604079628040-94301bb21b91'), alt: 'Geometric shapes',                      photographer: 'Pawel Czerwinski' },
  { id: 'a3', category: 'Abstract', ...unsplash('1579546929518-9e396f3cc809'), alt: 'Gradient pastel waves',                 photographer: 'Pawel Czerwinski' },
  { id: 'a4', category: 'Abstract', ...unsplash('1518837695005-2083093ee35b'), alt: 'Ocean from above',                      photographer: 'Shifaaz Shamoon' },
  { id: 'a5', category: 'Abstract', ...unsplash('1557672172-298e090bd0f1'), alt: 'Liquid colours',                           photographer: 'Pawel Czerwinski' },
]
