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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>आपको आमंत्रित किया गया है / You've been invited — Ashapura Samrat</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          आपको आमंत्रित किया गया है
        </Heading>
        <Text style={hindi}>
          आपको Ashapura Samrat में शामिल होने के लिए आमंत्रित किया गया है।
          अपना खाता बनाने के लिए नीचे दिए बटन पर टैप करें।
        </Text>
        <Text style={text}>
          You have been invited to join Ashapura Samrat. Tap the button below
          to accept the invitation and set up your account.
        </Text>
        <Section style={{ margin: '0 0 24px' }}>
          <Button style={button} href={confirmationUrl}>
            आमंत्रण स्वीकारें / Accept invitation
          </Button>
        </Section>
        <Footer note="अगर यह आमंत्रण आपके लिए नहीं है तो इस ईमेल को अनदेखा करें. / If this invitation was not meant for you, you can ignore this email." />
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
