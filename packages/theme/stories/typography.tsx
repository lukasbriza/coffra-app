import { fontSize, lineHeight } from '@lukasbriza/coffra-tokens'
import { Typography } from '@mui/material'
import { Stack } from '@mui/system'

import { webTheme } from '../src/web-theme'

import { variantsDefinition } from './font-variants'

const sampleText = 'Net for 6 months: +158,842.00 CZK'

/**
 * Renders every typography variant of the theme with its size, line height and weight.
 *
 * @returns one sample per variant, from the largest to the smallest
 */
export const TypeScale = () =>
  variantsDefinition.map(({ variant, use }) => (
    <Stack key={variant} sx={{ mb: 4 }}>
      <Typography color="text.secondary" variant="caption">
        {`${variant} · ${fontSize[variant]}/${lineHeight[variant]} px · ${String(webTheme.typography[variant].fontWeight)} · ${use}`}
      </Typography>
      <Typography variant={variant}>{sampleText}</Typography>
    </Stack>
  ))
