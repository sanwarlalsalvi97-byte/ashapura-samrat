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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>ईमेल बदलने की पुष्टि करें / Confirm your email change</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          ईमेल बदलने की पुष्टि करें
        </Heading>
        <Text style={hindi}>
          आपके Ashapura Samrat खाते का ईमेल {oldEmail} से {newEmail} में बदलने
          का अनुरोध किया गया है। पुष्टि के लिए नीचे दिए बटन पर टैप करें।
        </Text>
        <Text style={text}>
          A request was made to change your Ashapura Samrat account email from{' '}
          {oldEmail} to {newEmail}. Tap the button below to confirm.
        </Text>
        <Section style={{ margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            बदलाव की पुष्टि करें / Confirm change
          </Button>
        </Section>
        <Footer note="अगर आपने यह अनुरोध नहीं किया है तो तुरंत अपना खाता सुरक्षित करें. / If you did not request this, please secure your account immediately." />
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
