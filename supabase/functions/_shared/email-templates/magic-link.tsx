/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  Footer,
  Header,
  button,
  container,
  h1,
  hindi,
  main,
  text,
} from './brand.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>लॉगिन लिंक / Your login link — Ashapura Samrat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          आपका लॉगिन लिंक
        </Heading>
        <Text style={hindi}>
          Ashapura Samrat में साइन इन करने के लिए नीचे दिए बटन पर टैप करें। यह
          लिंक सीमित समय के लिए ही वैध है।
        </Text>
        <Text style={text}>
          Tap the button below to sign in to Ashapura Samrat. This link is
          valid for a limited time and can be used once.
        </Text>
        <Section style={{ margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            लॉगिन करें / Sign in
          </Button>
        </Section>
        <Footer note="अगर आपने यह लिंक नहीं मांगा है तो इस ईमेल को अनदेखा करें. / If you did not request this link, you can ignore this email." />
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
