// Ready-made color themes for Spaces (original palettes).

export interface ThemePreset {
  name: string
  colors: string[]
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Sage', colors: ['#d9e4d8', '#ece3d3'] },
  { name: 'Dusk', colors: ['#d8d3f0', '#f3d9e3'] },
  { name: 'Lagoon', colors: ['#c9e6ea', '#d7e3f6'] },
  { name: 'Apricot', colors: ['#f8dcc4', '#f4e7c9'] },
  { name: 'Blush', colors: ['#f4d6db', '#f0e0f0'] },
  { name: 'Moss', colors: ['#c8d8b9', '#e2e8c8'] },
  { name: 'Slate', colors: ['#d5dae2', '#e8e8ec'] },
  { name: 'Midnight', colors: ['#2b3150', '#3e2f4f'] },
  { name: 'Ember', colors: ['#f2c5a8', '#e8a9a9', '#d9b8e3'] },
  { name: 'Aurora', colors: ['#b9e4d6', '#c3d3f2', '#e4c9ee'] }
]

export const SPACE_EMOJI = ['🌿', '💼', '📚', '🏠', '🎨', '🎧', '🧪', '✈️', '🍳', '🎮', '💡', '🌙', '⭐️', '🔥', '🌊', '🪴']
