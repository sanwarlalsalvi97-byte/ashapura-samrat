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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>अपना ईमेल कन्फर्म करें / Confirm your email — Ashapura Samrat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          अपना ईमेल कन्फर्म करें
        </Heading>
        <Text style={hindi}>
          नमस्ते, Ashapura Samrat में आपका स्वागत है। खाता शुरू करने के लिए
          नीचे दिए बटन से अपना ईमेल ({recipient}) कन्फर्म करें।
        </Text>
        <Text style={text}>
          Welcome to Ashapura Samrat. Please confirm your email address (
          {recipient}) to activate your account.
        </Text>
        <Section style={{ margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            ईमेल कन्फर्म करें / Confirm email
          </Button>
        </Section>
        <Footer note="अगर आपने यह खाता नहीं बनाया है तो इस ईमेल को अनदेखा करें. / If you did not create this account, you can ignore this email." />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
