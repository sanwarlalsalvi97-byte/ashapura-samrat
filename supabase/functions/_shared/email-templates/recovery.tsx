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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>पासवर्ड रीसेट करें / Reset your password — Ashapura Samrat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          पासवर्ड रीसेट करें
        </Heading>
        <Text style={hindi}>
          आपके Ashapura Samrat खाते के लिए पासवर्ड रीसेट का अनुरोध मिला है।
          नया पासवर्ड बनाने के लिए नीचे दिए बटन पर टैप करें। यह लिंक कुछ समय
          बाद समाप्त हो जाएगा।
        </Text>
        <Text style={text}>
          We received a request to reset the password for your Ashapura Samrat
          account. Tap the button below to choose a new password. This link
          expires shortly.
        </Text>
        <Section style={{ margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            नया पासवर्ड बनाएं / Reset password
          </Button>
        </Section>
        <Footer note="अगर आपने यह अनुरोध नहीं किया है तो आपका पासवर्ड नहीं बदलेगा. / If you did not request this, your password will remain unchanged." />
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
