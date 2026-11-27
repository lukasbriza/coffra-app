import { webTheme } from '../src/web-theme'

const { accent, amount, background, band, chart, primary, text } = webTheme.palette

/**
 * One row of the Storybook palette page.
 *
 * @property title - the name of the group
 * @property subtitle - where the group lives on the theme
 * @property colors - the colours of the group by key
 */
type ColorGroup = {
  title: string
  subtitle: string
  colors: Record<string, string>
}

/**
 * Colours of the theme, grouped as `design/DESIGN.md` describes them, for the Storybook palette page.
 */
export const colorDefinition: ColorGroup[] = [
  {
    title: 'Primary',
    subtitle: 'theme.palette.primary',
    colors: { main: primary.main, contrastText: primary.contrastText },
  },
  {
    title: 'Background',
    subtitle: 'theme.palette.background',
    colors: { default: background.default, paper: background.paper, sunken: background.sunken },
  },
  {
    title: 'Text',
    subtitle: 'theme.palette.text',
    colors: { primary: text.primary, secondary: text.secondary, onAccent: text.onAccent },
  },
  { title: 'Accent', subtitle: 'theme.palette.accent', colors: accent },
  { title: 'Amount', subtitle: 'theme.palette.amount', colors: amount },
  {
    title: 'Band',
    subtitle: 'theme.palette.band',
    colors: { bg: band.bg, surface: band.surface, track: band.track, selected: band.selected },
  },
  { title: 'Band text', subtitle: 'theme.palette.band.text', colors: band.text },
  { title: 'Band amount', subtitle: 'theme.palette.band.amount', colors: band.amount },
  {
    title: 'Chart categories',
    subtitle: 'theme.palette.chart',
    colors: {
      series1: chart.series1,
      series2: chart.series2,
      series3: chart.series3,
      series4: chart.series4,
      series5: chart.series5,
      other: chart.other,
    },
  },
  {
    title: 'Chart trend',
    subtitle: 'theme.palette.chart',
    colors: {
      income: chart.income,
      expense: chart.expense,
      expenseArea: chart.expenseArea,
      gainArea: chart.gainArea,
      lossArea: chart.lossArea,
      grid: chart.grid,
      track: chart.track,
    },
  },
]
