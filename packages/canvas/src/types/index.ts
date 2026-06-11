export interface CanvasNodeType {
  id: string
  type: string
  label: string
  icon?: string
  category: 'content' | 'media' | 'ai' | 'storyboard' | 'asset'
  description: string
  defaultData?: Record<string, unknown>
}

export interface DesignTokens {
  colors: Record<string, string>
  spacing: Record<string, string>
  borderRadius: Record<string, string>
  fontSize: Record<string, string>
}

export const DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: '#6C5CE7',
    primaryHover: '#5A4BD1',
    surface: '#1E1E2E',
    surfaceHover: '#2A2A3E',
    border: '#3A3A4E',
    text: '#E0E0E0',
    textSecondary: '#A0A0B0',
    success: '#00C853',
    warning: '#FFD600',
    error: '#FF5252',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
  },
  fontSize: {
    sm: '12px',
    md: '14px',
    lg: '16px',
    xl: '20px',
  },
}
