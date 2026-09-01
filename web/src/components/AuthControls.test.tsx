import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthControls } from './AuthControls'

describe('AuthControls', () => {
  it('renders the local-only state without requiring a Clerk provider', () => {
    render(<AuthControls cloudEnabled={false} />)

    expect(screen.getByText('Add a valid Clerk key for cloud save')).toBeTruthy()
  })
})
