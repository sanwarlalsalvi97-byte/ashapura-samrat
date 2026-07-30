/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  Footer,
  Header,
  codeStyle,
  container,
  h1,
  hindi,
  main,
  text,
} from './brand.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="hi" dir="ltr">
    <Head />
    <Preview>आपका वेरिफिकेशन कोड / Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header />
        <Heading as="h1" style={h1}>
          आपका वेरिफिकेशन कोड
        </Heading>
        <Text style={hindi}>
          अपनी पहचान की पुष्टि के लिए नीचे दिया कोड ऐप में दर्ज करें।
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>
          Enter this code in the app to confirm your identity. It expires
          shortly. Never share this code with anyone.
        </Text>
        <Footer note="यह कोड किसी के साथ साझा न करें. / Ashapura Samrat will never ask you for this code." />
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
