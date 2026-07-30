/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Container, Hr, Section, Text } from 'npm:@react-email/components@0.0.22'

export const BRAND = {
  name: 'Ashapura Samrat',
  support: 'Ashapura Samrat Support',
  amber: '#E97B14',
  amberDark: '#B85C05',
  ink: '#1F1A14',
  muted: '#6B625A',
  border: '#F0E3D4',
  soft: '#FFF8F0',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '24px',
  border: `1px solid ${BRAND.border}`,
  borderRadius: '12px',
}

export const brandBar = {
  backgroundColor: BRAND.soft,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 24px',
  borderLeft: `4px solid ${BRAND.amber}`,
}

export const brandName = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: BRAND.amberDark,
  margin: '0',
}

export const brandTag = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '4px 0 0',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: BRAND.ink,
  margin: '0 0 8px',
}

export const hindi = {
  fontSize: '15px',
  color: BRAND.ink,
  lineHeight: '1.6',
  margin: '0 0 8px',
}

export const text = {
  fontSize: '14px',
  color: BRAND.muted,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = { color: BRAND.amberDark, textDecoration: 'underline' }

export const button = {
  backgroundColor: BRAND.amber,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: BRAND.amberDark,
  backgroundColor: BRAND.soft,
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}

export const footer = {
  fontSize: '12px',
  color: '#9A9089',
  lineHeight: '1.6',
  margin: '0',
}

export const hr = { borderColor: BRAND.border, margin: '28px 0 16px' }

export const Header = () => (
  <Section style={brandBar}>
    <Text style={brandName}>{BRAND.name}</Text>
    <Text style={brandTag}>मजदूर · हाजिरी · कैशबुक · रिपोर्ट</Text>
  </Section>
)

export const Footer = ({ note }: { note?: string }) => (
  <Container style={{ padding: '0' }}>
    <Hr style={hr} />
    {note ? <Text style={footer}>{note}</Text> : null}
    <Text style={footer}>
      — {BRAND.support}
      <br />
      यह एक स्वचालित संदेश है, कृपया इसका उत्तर न दें. / This is an automated
      message, please do not reply.
    </Text>
  </Container>
)
