import type { DesignVariant } from '../src/types'

/**
 * One typography variant shown in the Storybook typography page.
 *
 * @property variant - the variant of the theme
 * @property use - where the design uses it
 */
type VariantDefinition = {
  variant: DesignVariant
  use: string
}

/**
 * Typography variants of the theme from the largest to the smallest, with their use from `design/DESIGN.md`.
 */
export const variantsDefinition: VariantDefinition[] = [
  { variant: 'display', use: 'the net amount in the band' },
  { variant: 'displayNarrow', use: 'the net amount on a narrow screen' },
  { variant: 'title', use: 'the page title' },
  { variant: 'figure', use: 'an amount that leads a card, the currency beside the display' },
  { variant: 'heading', use: 'a card heading' },
  { variant: 'body', use: 'running text and list rows' },
  { variant: 'label', use: 'controls and legends' },
  { variant: 'caption', use: 'the period, a share and a unit' },
]
