import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the roster offline-first shell', async () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByText('SR5 RUNNER SHEET')).toBeInTheDocument()
    expect(await screen.findByText(/No characters yet/)).toBeInTheDocument()
  })
})
