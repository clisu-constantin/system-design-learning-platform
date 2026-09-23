import type { DepthMap } from './types';

export const securityDepth: DepthMap = {
  authentication: {
    analogy: {
      title: 'Showing your passport at the desk',
      body:
        'Authentication is proving you are who you claim to be. The passport does not say which rooms you may enter - that is a separate question asked later. Confusing the two is the most common structural mistake in access control: knowing the name of the person at the door is not the same as knowing what they are allowed to do.',
    },
    deepDive: [
      {
        heading: 'Factors, and why more than one matters',
        paragraphs: [
          'Authentication factors come in three kinds: something you know (a password), something you have (a phone, a hardware key), something you are (a fingerprint, a face). A single factor is only as strong as its weakest failure - passwords are reused, phished and leaked in bulk.',
          'Multi-factor authentication requires two different kinds, and it is the single highest-impact security control available for accounts. Note the "different kinds" part: a password plus a security question is still one factor, because both are things you know and both leak the same way.',
          'Not all second factors are equal. SMS codes are phishable and vulnerable to SIM swapping. Time-based codes from an authenticator app are much better but still phishable in real time. Hardware keys and passkeys using WebAuthn are bound to the origin, so a phishing site cannot use them at all - which is why they are the current recommendation.',
        ],
        bullets: [
          'Something you know, have, or are - MFA means two different kinds.',
          'SMS is better than nothing and worse than an app; passkeys beat both.',
          'Account recovery is an authentication path too, and usually the weakest one - secure it as carefully as login.',
          'Rate limit and monitor login attempts; credential stuffing is automated and constant.',
        ],
      },
      {
        heading: 'Storing passwords: the only acceptable answer',
        paragraphs: [
          'Never store a password, never encrypt a password. Store a hash produced by a slow, salted, memory-hard function: Argon2id if available, otherwise bcrypt or scrypt. General-purpose hashes like SHA-256 are the wrong tool precisely because they are fast - a GPU can test billions per second.',
          'The salt is per user and stored alongside the hash; it exists so that identical passwords produce different hashes and precomputed rainbow tables are useless. The cost parameter - the work factor - is what makes each guess expensive, and it should be tuned so a single verification takes on the order of 100-250 ms on your hardware.',
          'Then the operational rules: compare in constant time, never log the password, never include it in an error message, and check new passwords against known-breached lists rather than imposing arcane composition rules. Modern guidance favours length and breach checking over forced rotation and special characters, because the old rules pushed people toward predictable patterns.',
        ],
        code: {
          caption: 'Why the algorithm choice is not a detail',
          body: `attacker with one RTX 4090, guessing a leaked hash
(hashcat benchmark figures)

SHA-256 (fast, wrong tool)   ~22,000,000,000 guesses/sec
bcrypt cost 12               ~         1,400 guesses/sec

a list of 1,000,000,000 likely passwords, one user:
  SHA-256       under 0.1 seconds
  bcrypt 12     about 8 days

Argon2id is slower still on a GPU: every guess needs
its own block of memory (19 MiB or more).

same password, same leak, different storage decision.`,
        },
      },
      {
        heading: 'Sessions: cookies, tokens, and what each costs',
        paragraphs: [
          'After a successful login you must remember the user across requests. A server-side session stores state in Redis or a database and gives the browser an opaque id in a cookie. Revocation is instant - delete the row - and the cookie carries no information. The cost is a lookup per request and a dependency on that store.',
          'A stateless token (typically a JWT) puts the claims in the token itself, signed. No lookup and no shared store, which is attractive at scale, but revoking before expiry is not possible without adding a denylist - and once you add one you have reintroduced the lookup for the cases that matter.',
          'Whichever you use, the cookie settings do most of the security work: HttpOnly so JavaScript cannot read it, Secure so it is never sent over plain HTTP, SameSite=Lax or Strict to blunt CSRF, and a sensible expiry - OWASP suggests an idle timeout of 15-30 minutes for low-risk applications. For sensitive actions, re-authenticate rather than trusting a session issued hours ago.',
          'When a request arrives with no credential, or one that is expired, unknown or revoked, the answer is 401 Unauthorized, with a WWW-Authenticate header saying how to authenticate. It means "we do not know who you are - prove it and try again". That is a different answer from 403 Forbidden, which means "we know who you are, and you may not", and mixing them up sends clients to a login screen that cannot help, or keeps them away from one that would.',
        ],
      },
    ],
    examples: [
      {
        title: 'What a credential-stuffing attack meets',
        setup:
          'An attacker has 5 million email and password pairs from an unrelated breach and tries them against your login endpoint.',
        walkthrough: [
          'Without defences: if only 0.2% of the 5,000,000 pairs match a user here, that is 10,000 accounts taken over, and every one of those logins looks completely legitimate.',
          'Defence 1 - rate limiting per IP at 10 attempts a minute: spread over 10,000 IPs the attacker still makes 100,000 attempts a minute. It slows the attack; it does not stop it.',
          'Defence 2 - rate limiting per account: after 5 failures on one email, add increasing delays. That stops guessing many passwords for one account, but stuffing tries each email only once or twice, so it barely touches this attack.',
          'Defence 3 - breached-password checks at registration and at login (NIST SP 800-63B requires a blocklist check): a password found in a known breach corpus must be changed. Most of the 10,000 reused passwords are exactly those, so the fuel runs out.',
          'Defence 4 - MFA: the 10,000 correct passwords now each need a second factor the attacker does not have - zero takeovers from a password alone. This is the control that ends the attack class.',
          'Defence 5 - anomaly detection: a login from a new device and a new country triggers a verification email. For the attacker that is nearly 100% of logins; for a real user it is a rare trip abroad.',
          'Defence 6 - one error message and similar timing for "no such user" and "wrong password", so the 5,000,000 emails cannot be sorted into accounts that exist and accounts that do not.',
        ],
        result:
          'Rate limiting slows the attack, breach checking removes its fuel, and MFA removes its value. Layered controls matter because each one alone is bypassable.',
      },
    ],
    jargon: [
      { term: 'Authentication vs authorisation', plain: 'Who are you, versus what may you do. Always two separate steps.' },
      { term: 'Salt', plain: 'Random per-user data mixed into the hash so identical passwords hash differently.' },
      { term: 'Work factor / cost', plain: 'How expensive one hash computation is. Tune it to about 100-250 ms.' },
      { term: 'MFA', plain: 'Requiring two different kinds of factor.' },
      { term: 'Passkey / WebAuthn', plain: 'Public-key credentials bound to the site origin, so phishing cannot reuse them.' },
      { term: 'Credential stuffing', plain: 'Automated login attempts using passwords leaked from other sites.' },
    ],
    remember: [
      'Authentication is identity only - authorisation is a separate decision.',
      'Hash with Argon2id or bcrypt, salted, tuned to hundreds of milliseconds.',
      'MFA is the single highest-impact control; passkeys are the strongest common form.',
      'HttpOnly, Secure and SameSite carry most of the session security.',
      '401 means "prove who you are"; 403 means "known, and not allowed".',
    ],
  },

  authorization: {
    analogy: {
      title: 'The hotel keycard',
      body:
        'Reception verified your passport, then encoded a card that opens your room, the gym and nothing else. The card does not care who you are - it encodes what you may open. And crucially, every door checks the card itself: a door that opens because "reception checks people" would be no security at all.',
    },
    deepDive: [
      {
        heading: 'RBAC, ABAC and ReBAC - three ways to express a rule',
        paragraphs: [
          'Role-based access control assigns permissions to roles and roles to users: an editor may publish, a viewer may not. It is simple, auditable and sufficient for a great many systems. Its weakness appears when rules depend on the specific object - "may edit documents in their own department" is not expressible as a role without creating a role per department.',
          'Attribute-based access control evaluates a policy over attributes of the user, the resource and the context: department matches, time is within business hours, the request comes from a managed device. It is far more expressive and correspondingly harder to reason about and to audit.',
          'Relationship-based access control - the model behind Google Zanzibar and its open-source descendants - answers "is this user related to this object in a way that grants the permission", which naturally handles sharing, folder inheritance and ownership. It is the right shape for products with per-document permissions and complex hierarchies.',
        ],
        code: {
          caption: 'The same rule, three ways',
          body: `RBAC   user has role "editor"                     -> may publish
ABAC   user.dept == doc.dept AND doc.state == "draft"
                                                   -> may edit
ReBAC  user is "owner" of doc, OR member of a group
       that is "editor" of a folder that contains doc
                                                   -> may edit

start with RBAC; move to ReBAC when sharing and hierarchy appear.`,
        },
      },
      {
        heading: 'Check at the object, not at the route',
        paragraphs: [
          'The most common and most damaging authorisation bug is broken object-level authorisation: the endpoint checks that you are logged in and that you have the "customer" role, then loads order id 4711 without checking it belongs to you. Changing the number in the URL returns the data of another account.',
          'The fix is structural rather than vigilant. Do not fetch by id and then check; fetch scoped to the caller in the first place - a query that filters by owner cannot return another user row. Where a framework supports it, enforce this in the data access layer so a missing check is impossible rather than merely discouraged.',
          'Apply the same principle to every listing, export, search result and aggregate. The classic leak is a report endpoint that correctly checks access to individual records but aggregates across all tenants because the filter was omitted in one query.',
        ],
        bullets: [
          'Fetch scoped to the caller; never fetch then check.',
          'Deny by default - an unmatched rule must refuse, not allow.',
          'Enforce on the server. Hiding a button is a UI nicety, not a control.',
          'Re-check on every request; a permission may have been revoked since login.',
          'Test authorisation explicitly: for each endpoint, assert that another user gets 403 or 404.',
          'Answer 403 to a known caller who lacks permission, never 401 - a 401 asks for a login that cannot help.',
        ],
      },
      {
        heading: 'Where the decision lives, and keeping it fast',
        paragraphs: [
          'A gateway can check coarse things - is the token valid, does the caller have any access to this service - but it usually cannot answer "may this user edit this particular document", because that needs the data. So fine-grained authorisation belongs in the service that owns the resource, even when a gateway exists.',
          'Centralising the policy without centralising the enforcement is the pattern that scales: a shared policy engine or library evaluates rules consistently, while each service applies it to its own data. That gives uniform semantics and an auditable policy definition without a network call per object check.',
          'Performance is a real concern for relationship models, where answering one question can require walking a graph. The standard mitigations are caching decisions briefly with an explicit invalidation on permission change, precomputing effective permissions for hot paths, and batching checks - asking "which of these 50 documents may this user read" in one call rather than 50.',
        ],
      },
    ],
    examples: [
      {
        title: 'Finding an IDOR before an attacker does',
        setup:
          'GET /api/invoices/{id} returns an invoice. The handler verifies the JWT and that the user has the "customer" role, then loads the invoice by id.',
        walkthrough: [
          'A customer changes the id in the URL from 8842 to 8841 and receives another company invoice, including bank details.',
          'The check that was missing: does invoice 8841 belong to the authenticated account?',
          'Weak fix: load the invoice, compare invoice.account_id with the caller, return 403 otherwise. Correct, but it relies on every future handler remembering.',
          'Better fix: query scoped to the caller - SELECT ... WHERE id = ? AND account_id = ?. A wrong id simply returns nothing, and the handler returns 404.',
          'Structural fix: a repository layer that requires an account scope for every query, so an unscoped query does not compile or fails a lint rule.',
          'Return 404 rather than 403 for objects the caller may not see - a 403 confirms the object exists, which itself leaks information. RFC 9110 explicitly allows a server to answer 404 to hide a forbidden resource.',
          'Regression test: for each resource endpoint, a test asserts that user B receives 404 for user A object. This is cheap and catches the class permanently.',
        ],
        result:
          'The vulnerability was one missing clause, and it is consistently among the most common and most exploited API flaws. Scoping queries by owner makes the whole class structurally impossible rather than a matter of discipline.',
      },
    ],
    jargon: [
      { term: 'RBAC / ABAC / ReBAC', plain: 'Permissions by role, by attributes, or by relationship to the object.' },
      { term: 'IDOR / BOLA', plain: 'Reaching another user object by changing an id. The most common API vulnerability.' },
      { term: 'Principle of least privilege', plain: 'Grant the minimum needed, for the shortest time.' },
      { term: 'Deny by default', plain: 'Anything not explicitly permitted is refused.' },
      { term: 'Policy engine', plain: 'A shared component that evaluates authorisation rules consistently.' },
      { term: 'Scope (in tokens)', plain: 'A coarse permission attached to a token, e.g. read:orders.' },
    ],
    remember: [
      'Authentication asks who; authorisation asks what they may do to this object.',
      'Fetch scoped to the caller instead of fetching and then checking.',
      'Deny by default, enforce on the server, re-check every request.',
      'Return 404 rather than 403 when existence itself is sensitive.',
      'Write a test per endpoint proving another user cannot reach the object.',
    ],
  },

  jwt: {
    analogy: {
      title: 'A sealed festival wristband',
      body:
        'Once issued, the band states who you are and which areas you may enter, and any guard can verify the seal without phoning the office. That is fast and works everywhere. The catch is the same one every wristband has: if somebody must be removed early, there is no way to un-issue a band that is already on a wrist.',
    },
    deepDive: [
      {
        heading: 'Three parts, one signature',
        paragraphs: [
          'A JWT is header.payload.signature, each base64url encoded. The header names the algorithm, the payload holds claims (who, when issued, when expiring, what scopes), and the signature proves the token was produced by someone holding the key. The payload is encoded, not encrypted - anyone can read it, so never put secrets in it.',
          'Symmetric signing (HS256) uses one shared secret for signing and verifying, which is fine when the same service does both. Asymmetric signing (RS256, ES256) signs with a private key and verifies with a public one, which is what you want when many services verify tokens an identity provider issues - they need no secret at all.',
          'Verification is where implementations go wrong. Always validate the signature, always check exp, and always check iss and aud so a token minted for another audience cannot be replayed at your service. And pin the expected algorithm rather than trusting the header, or you inherit the classic alg:none and HS/RS confusion attacks.',
        ],
        code: {
          caption: 'What a token contains, and what to verify',
          body: `header   {"alg":"RS256","kid":"2026-09"}
payload  {"sub":"user_42","iss":"https://auth.example.com",
          "aud":"api.example.com","exp":1695034800,
          "iat":1695031200,"scope":"read:orders"}
signature RS256(base64(header) + "." + base64(payload), private_key)

verify: signature with the key for kid
        exp not passed, iat not in the future
        iss and aud are exactly what you expect
        alg is the one you configured - never read it from the token`,
        },
      },
      {
        heading: 'The revocation problem, stated plainly',
        paragraphs: [
          'A signed token is valid until it expires, because verification is local and consults nothing. Logging out, deleting the account, changing a password or removing a permission does not invalidate tokens already issued. If your access token lives 24 hours, a compromised token is usable for up to 24 hours.',
          'The standard mitigation is short-lived access tokens (5-15 minutes) plus a long-lived refresh token stored server-side. Revocation then means deleting the refresh token, and the window of exposure is bounded by the access token lifetime. Note what happened: you reintroduced server state, deliberately, for the operations where it matters.',
          'For immediate revocation you need a denylist of token ids checked on each request - which is a lookup per request and therefore removes the main advantage. That is an acceptable trade for sensitive systems, but it should be a conscious choice rather than a surprise discovered after an incident.',
        ],
        bullets: [
          'Access token: 5-15 minutes, stateless, verified locally.',
          'Refresh token: long-lived, stored server-side, revocable, rotated on each use.',
          'Refresh rotation with reuse detection catches a stolen refresh token.',
          'Keep tokens small - they travel on every request, and headers have limits.',
        ],
      },
      {
        heading: 'Where to store it in a browser',
        paragraphs: [
          'localStorage is convenient and readable by any JavaScript running on the page, which means a single XSS vulnerability exfiltrates the token. Given how common third-party scripts are, that is a substantial risk.',
          'An HttpOnly, Secure, SameSite cookie cannot be read by JavaScript, so XSS cannot steal it directly. The trade is that cookies are sent automatically, which reintroduces CSRF - mitigated by SameSite=Lax or Strict plus a CSRF token on state-changing requests.',
          'The common modern recommendation is the cookie approach for browser applications, and Authorization: Bearer headers for mobile and server-to-server clients where cookie semantics do not apply. Either way, never put a token in a URL - URLs end up in logs, referrer headers and browser history.',
        ],
      },
    ],
    examples: [
      {
        title: 'A logout that did not log anyone out',
        setup:
          'An app issues JWTs with a 24-hour expiry and no refresh flow. Logout deletes the token from localStorage. A user reports their account was accessed after they logged out on a shared computer.',
        walkthrough: [
          'The token had been copied from localStorage before logout. Deleting the client copy does nothing - the token remains valid for up to 24 hours.',
          'The server had no way to reject it, because verification is purely cryptographic and consults no state.',
          'Fix 1: access tokens reduced to 10 minutes. The exposure window drops from a day to ten minutes.',
          'Fix 2: refresh tokens stored server-side, rotated on every use. Logout deletes the refresh token, so no new access tokens can be minted.',
          'Fix 3: reuse detection - if an old refresh token is presented again, assume theft and revoke the whole family, forcing a full re-login.',
          'Fix 4: move tokens from localStorage into HttpOnly cookies so client-side script cannot read them at all, plus SameSite and a CSRF token.',
          'Fix 5: for high-value actions (changing an email, adding a payout account), require a fresh authentication regardless of token validity.',
        ],
        result:
          'Stateless tokens trade revocation for scale. Short access tokens plus revocable rotating refresh tokens give you most of both, and the residual window becomes an explicit, documented number.',
      },
    ],
    jargon: [
      { term: 'Claim', plain: 'One field in the payload: sub, exp, scope and so on.' },
      { term: 'exp / iat / nbf', plain: 'Expiry, issued-at and not-before timestamps. Validate all that are present.' },
      { term: 'iss / aud', plain: 'Who issued the token and who it is for. Check both or tokens can be replayed across services.' },
      { term: 'kid / JWKS', plain: 'The key id and the public key set, so verifiers can find the right key and rotate.' },
      { term: 'Refresh token', plain: 'A long-lived, server-stored credential used to obtain new access tokens.' },
      { term: 'Rotation with reuse detection', plain: 'Issuing a new refresh token each time; a reused old one signals theft.' },
    ],
    remember: [
      'The payload is readable by anyone - signed, not encrypted.',
      'Validate signature, expiry, issuer and audience, and pin the algorithm.',
      'A JWT cannot be revoked; short lifetimes plus refresh tokens bound the damage.',
      'HttpOnly cookies beat localStorage for browsers; never put a token in a URL.',
      'Rotating refresh tokens with reuse detection is what catches a stolen one.',
    ],
  },

  oauth: {
    analogy: {
      title: 'The valet key',
      body:
        'A valet key starts the car and opens the door, but not the boot or the glovebox, and you can stop using it any time. You hand it over instead of your main key. OAuth is that: a third party gets a limited, revocable credential to act on your behalf, and never sees your password.',
    },
    deepDive: [
      {
        heading: 'OAuth is delegation; OIDC is login',
        paragraphs: [
          'OAuth 2.0 is an authorisation framework: it lets an application obtain limited access to a resource on behalf of a user, without the user giving that application their credentials. The output is an access token with scopes, and the token is for calling an API.',
          'OpenID Connect is a thin layer on top that adds identity: an id_token (a JWT describing who the user is) and a userinfo endpoint. When you click "sign in with Google", you are using OIDC, not raw OAuth - and using an access token as proof of identity is a classic and dangerous confusion, because an access token says what may be done, not who is present.',
          'The four parties are worth naming: the resource owner (the user), the client (the application asking), the authorisation server (which authenticates the user and issues tokens), and the resource server (the API that accepts them). Most confusion in OAuth comes from losing track of which party is doing what.',
        ],
        code: {
          caption: 'Authorization code flow with PKCE - the one to use',
          body: `1 app generates code_verifier (random) and code_challenge = SHA256(it)
2 browser -> auth server: /authorize?client_id&redirect_uri
                          &scope&state&code_challenge
3 user authenticates and consents
4 auth server -> browser: redirect back with ?code=...&state=...
5 app checks state matches, then POSTs code + code_verifier to /token
6 auth server verifies the challenge, returns access + refresh tokens

why PKCE: a stolen code is useless without the verifier, which never
left the app. Required for mobile and SPAs, recommended everywhere.`,
        },
      },
      {
        heading: 'Which flow, and which ones are dead',
        paragraphs: [
          'Authorization code with PKCE is the answer for web applications, single-page applications and mobile apps. Client credentials is the answer for machine-to-machine access, where there is no user at all. Device code is for input-constrained devices such as TVs, where the user authorises on a phone instead.',
          'The implicit flow returned tokens directly in the URL fragment and is deprecated - tokens leaked through browser history, referrers and logs. The resource owner password credentials grant, where the app collects the users password and exchanges it, defeats the entire purpose and is also deprecated. If a tutorial shows either, it predates current guidance.',
          'Two parameters do essential work in the code flow. state is a random value you send and verify on return, protecting against CSRF on the callback - without it, an attacker can make the browser of a victim deliver a code for the account of the attacker, and the victim ends up signed in to an account the attacker can read. PKCE protects against an intercepted authorisation code being redeemed by an attacker. Note that state never protects the code: it travels in the same redirect, so whoever steals one has both.',
          'Current best practice (RFC 9700, 2025) requires PKCE for public clients - mobile and single-page apps, which cannot keep a secret - and recommends it for all clients. PKCE also blocks the callback CSRF above, and a client may rely on it instead of state once it knows the server enforces PKCE. Both are cheap, so most clients send both.',
        ],
        bullets: [
          'Web / SPA / mobile: authorization code + PKCE.',
          'Service to service: client credentials.',
          'TV or CLI: device code.',
          'Never: implicit, or password grant.',
          'Always: exact redirect URI matching, state, PKCE, and minimal scopes.',
        ],
      },
      {
        heading: 'Scopes, consent and the mistakes that leak accounts',
        paragraphs: [
          'Scopes are the granularity of delegation, and they should be narrow: read:contacts rather than full account access. Users grant what they are asked for, so over-broad scope requests both lower consent rates and increase the damage when a token leaks. Request the minimum, and request more only when the feature needs it. The resource server enforces them on every call: a valid token without the needed scope gets 403 with error insufficient_scope (RFC 6750), not 401, because the token itself is fine.',
          'Redirect URI handling is where real vulnerabilities cluster. The authorisation server must match the registered URI exactly - open redirects and wildcard matching have repeatedly allowed attackers to have codes delivered to their own endpoints. Never allow a user-supplied redirect target. PKCE does not help here: the attacker builds the /authorize link, so the attacker made the code_challenge and holds the matching verifier. Only exact matching stops the code from leaving.',
          'And keep the token types straight. The id_token proves identity to the client, the access token authorises API calls at the resource server, and the refresh token obtains new access tokens. Sending an id_token to an API, or treating an access token as proof of who is logged in, are the two mix-ups that cause authentication bypasses: an access token is not bound to your app, so one issued to another app for the same user could be replayed to log in as them.',
          'Revoking access - the user clicks Remove access - kills the refresh token at the authorisation server at once. An access token that the API verifies locally, such as a JWT, keeps working until it expires unless the API asks the server about it (token introspection). That is why access tokens live minutes to an hour and refresh tokens carry the long-lived part of the grant.',
        ],
      },
    ],
    examples: [
      {
        title: 'Adding "sign in with Google" correctly',
        setup: 'A web app wants Google sign-in plus read-only access to the users calendar.',
        walkthrough: [
          'Register the app with 1 exact redirect URI, https://app.example/cb, and request 4 scopes: openid, email, profile and calendar.readonly - nothing more.',
          'On sign-in, generate state, a nonce and a 43-character code_verifier (RFC 7636 allows 43 to 128), store all 3 in the server session, and redirect the browser to Google with the SHA-256 code_challenge.',
          'Google authenticates the user, shows a consent screen listing exactly those 4 scopes, and redirects back with a single-use code - RFC 6749 recommends a code lifetime of 10 minutes at most.',
          'The server checks that state matches, then makes 1 direct call to the token endpoint with the code plus verifier. The response carries an access token with expires_in of about 3600 seconds (1 hour), a refresh token and an id_token.',
          'It validates the id_token in 5 checks: signature against the Google JWKS, iss, aud equal to the client id, exp, and the nonce from step 2. Identity comes from the sub claim - stable per user - not from the email, which can change.',
          'The access token stays server-side and is used only for calendar calls. After about 60 minutes it expires and the refresh token gets a new one, so background sync needs 0 further consent screens.',
          'When the user disconnects, the app calls the Google revoke endpoint and deletes the stored refresh token: from then on 0 new access tokens can be minted, and the last one runs out within the hour.',
        ],
        result:
          'The app never saw a password, held 1 read-only calendar scope, and lost access within at most 1 hour of the user saying no. That combination - no password, narrow scope, revocable - is the entire point of OAuth.',
      },
    ],
    jargon: [
      { term: 'Resource owner / client', plain: 'The user, and the application acting on their behalf.' },
      { term: 'Authorisation server', plain: 'The service that authenticates the user and issues tokens.' },
      { term: 'Scope', plain: 'A named, limited permission the token carries.' },
      { term: 'PKCE', plain: 'A proof that the app redeeming the code is the one that started the flow.' },
      { term: 'state', plain: 'A random value round-tripped through the redirect to prevent CSRF.' },
      { term: 'id_token vs access_token', plain: 'Proof of who the user is, versus permission to call an API.' },
    ],
    remember: [
      'OAuth delegates access; OIDC adds identity. Do not use an access token as proof of login.',
      'Authorization code with PKCE is the flow; implicit and password grants are deprecated.',
      'state protects the callback, PKCE protects the code. Use both.',
      'Exact redirect URI matching - wildcards and prefix checks leak codes, and PKCE does not stop that.',
      'Request the narrowest scopes that make the feature work.',
    ],
  },

  'rate-limiting': {
    analogy: {
      title: 'A doorman with a pouch of wristbands',
      body:
        'Every guest needs a wristband to get in. The doorman holds at most 10, and is handed one new wristband every 6 seconds. A group of 10 arriving together walks straight in if the pouch is full; the 11th is told "come back in 6 seconds". Over an hour no more than 610 get in, however they arrive. That is a token bucket: the pouch is the burst, the steady supply is the rate, and "come back in 6 seconds" is a 429 with Retry-After.',
    },
    deepDive: [
      {
        heading: 'Four algorithms, and what each gets wrong',
        paragraphs: [
          'Fixed window counts requests per calendar minute. It is trivial to implement with one counter and one expiry, and it allows a burst of double the limit at a window boundary. With a limit of 100 per minute, for example, 100 requests at 10:00:59.9 and 100 more at 10:01:00.1 all pass: each batch lands in its own window with a fresh counter, so 200 get through within 0.2 seconds.',
          'Sliding window log stores a timestamp per request and counts those within the last 60 seconds. Perfectly accurate, and the memory cost grows with the request rate - potentially large for high-volume clients. Sliding window counter approximates it with two counters: 15 seconds into the current minute, it counts the previous minute at 75% plus the current one. It assumes the previous minute was evenly spread; Cloudflare measured only 0.003% of requests wrongly allowed or limited with it.',
          'Token bucket is the one many systems end up using - Stripe and Amazon API Gateway both describe theirs as token buckets. Tokens refill at a steady rate up to a maximum; each request consumes one. It enforces an average rate while permitting a burst up to the bucket size, which matches how real clients behave. Leaky bucket is its sibling: requests queue and drain at a constant rate, so bursts wait instead of passing.',
        ],
        code: {
          caption: 'Token bucket, which covers most needs',
          body: `capacity 100 tokens, refill 10 tokens/sec

t=0    bucket 100   burst of 100 requests -> all pass, bucket 0
t=1    bucket 10    10 requests pass, 11th is rejected, bucket 0
t=11   bucket 100   full again after 10 idle seconds

allows a legitimate burst, enforces 10/sec sustained.
Redis: one hash per key (tokens, last_refill) updated in a Lua script
so the check-and-decrement is atomic across all app instances.`,
        },
      },
      {
        heading: 'What to limit by, and returning the right thing',
        paragraphs: [
          'The key determines fairness. Per API key or user id is the most meaningful for authenticated traffic. Per IP is the fallback for anonymous traffic, but it punishes users behind a shared NAT and is trivially evaded with a proxy pool. Many systems layer several: a global limit, a per-user limit, and a tighter limit on expensive endpoints.',
          'Different endpoints deserve different limits. A login endpoint should be far stricter than a product listing, because the threat is credential stuffing rather than load. Expensive operations - search, export, report generation - should be counted more heavily, sometimes literally by assigning them a cost in tokens.',
          'When you reject, return 429 Too Many Requests (RFC 6585) with a Retry-After header, and expose the allowance in headers so well-behaved clients can pace themselves. GitHub sends x-ratelimit-limit, x-ratelimit-remaining and x-ratelimit-reset; an IETF draft is standardising RateLimit and RateLimit-Policy fields. Silent throttling produces clients that retry harder, which is the opposite of the goal.',
        ],
        bullets: [
          'Per user or API key for authenticated traffic; per IP only as a fallback.',
          'Stricter limits on login, password reset and anything that sends a message.',
          'Weight expensive endpoints more heavily than cheap ones.',
          '429 plus Retry-After, and rate limit headers on every response.',
          'Allow a burst - real clients are bursty, and a hard flat rate feels broken.',
        ],
      },
      {
        heading: 'Distributed counting, and the related patterns',
        paragraphs: [
          'With many instances, a local counter means the effective limit is your limit times the instance count - a common and quiet mistake. A shared store such as Redis fixes it, with the check-and-decrement done atomically in a script so two instances cannot both see the last token.',
          'That adds a network hop to every request and makes the limiter a dependency. Two mitigations: fail open (allow the request when Redis is unreachable, so the limiter cannot cause an outage) unless the endpoint is security-critical, and consider approximate local counting with periodic synchronisation for very high rates.',
          'Rate limiting is also only one of three related tools. Throttling slows clients instead of rejecting them. Load shedding drops low-priority work when the system is saturated, regardless of who sent it. Backpressure propagates the "slow down" signal upstream. A complete design usually has a rate limit at the edge for fairness and load shedding inside for survival.',
        ],
      },
    ],
    examples: [
      {
        title: 'One limit was the wrong shape for four problems',
        setup:
          'An API has a single rule: 1,000 requests per minute per IP. It is failing to prevent abuse and is annoying legitimate users.',
        walkthrough: [
          'Problem 1 - credential stuffing: an attacker distributes across 5,000 IPs and stays under the limit on every one. Fix: a per-account limit on login attempts, 5 per 15 minutes, regardless of source IP.',
          'Problem 2 - corporate users: an entire office behind one NAT address shares the 1,000 and gets throttled during normal work. Fix: authenticate first, then limit per user rather than per IP.',
          'Problem 3 - an expensive export endpoint: 1,000 exports per minute would destroy the database, although it is within the limit. Fix: per-endpoint costs, with export counted as 50 tokens.',
          'Problem 4 - a legitimate client synchronising at startup sends 1,500 requests in 30 seconds, gets 500 of them rejected, and fails its sync, although its hourly average is tiny. Fix: a token bucket with a capacity of 2,000 and a refill of about 16 per second (1,000 per minute sustained): the full bucket covers all 1,500.',
          'Implementation: a Lua script in Redis updates the bucket atomically, keyed by user id plus endpoint class.',
          'Failure policy: if Redis is unavailable, general endpoints fail open (serve the request) while login fails closed (reject), because the consequences differ.',
        ],
        result:
          'One rule became four, each matched to the behaviour it governs. Rate limiting is a per-endpoint, per-identity design decision, not a single global number.',
      },
    ],
    jargon: [
      { term: 'Token bucket', plain: 'Tokens refill at a rate and each request spends one. Allows bursts, caps the average.' },
      { term: 'Fixed / sliding window', plain: 'Counting per calendar period, or over the trailing period. The second avoids boundary bursts.' },
      { term: '429', plain: 'Too Many Requests. Send Retry-After with it.' },
      { term: 'Throttling vs shedding', plain: 'Slowing clients down, versus dropping work to survive overload.' },
      { term: 'Backpressure', plain: 'Signalling upstream to slow down instead of accepting work you cannot handle.' },
      { term: 'Fail open / closed', plain: 'What the limiter does when its own store is unavailable. Decide per endpoint.' },
    ],
    remember: [
      'Token bucket is the sensible default: burst allowance plus a sustained rate.',
      'Limit per identity where you can; per IP punishes shared networks and is easy to evade.',
      'Login and messaging endpoints need much tighter limits than read endpoints.',
      'Return 429 with Retry-After and rate limit headers so clients can behave.',
      'With many instances, count in a shared store atomically or your limit multiplies.',
    ],
  },

  'api-keys': {
    analogy: {
      title: 'A numbered key for a supplier',
      body:
        'You give each supplier their own key to the delivery door, and you write down which key is which. If one goes missing you deactivate that one key without changing every lock in the building. The value is not secrecy alone - it is that keys are individually identifiable and individually revocable.',
    },
    deepDive: [
      {
        heading: 'What an API key is and is not',
        paragraphs: [
          'An API key is a long random string identifying a client application or an integration. It authenticates the caller in the weakest sense: possession is sufficient. There is no user, no expiry by default, no proof of origin beyond having the string.',
          'That makes it appropriate for server-to-server integrations, where the key can be stored securely and the caller is an application rather than a person. It makes it inappropriate for anything running in a browser or a mobile app, where the key is extractable by anyone with a debugger - a "secret" shipped to a client is not a secret.',
          'It is also not authorisation on its own. A key should carry scopes and limits, so a key used for reading reports cannot create refunds. Keys with full account access are the ones that turn a leaked string into an incident.',
        ],
        bullets: [
          'Good: server-to-server, webhooks, CI systems, internal tooling.',
          'Bad: browsers, mobile apps, anything a user can extract.',
          'Always scoped, ideally IP-restricted, always individually revocable.',
          'For user-facing authorisation, use OAuth instead - keys have no user identity.',
        ],
      },
      {
        heading: 'Generating, storing and displaying keys',
        paragraphs: [
          'Generate from a cryptographically secure random source with at least 128 bits of entropy, and give the key a visible prefix identifying its type and environment - sk_live_, pk_test_. Prefixes make accidental leaks detectable by secret scanners and stop people pasting a production key into a staging config.',
          'Store only a hash, exactly as you would a password. A database dump should not hand an attacker working credentials. Because keys are high-entropy random strings rather than guessable passwords, a fast hash such as SHA-256 is acceptable here - the brute-force argument that requires bcrypt for passwords does not apply.',
          'Show the full key exactly once, at creation. Afterwards display only the prefix and last four characters, enough to identify which key is which in a list. If a user loses it, they rotate rather than retrieve - the model Stripe uses for the secret keys you create, because it is the only one that survives a database compromise.',
        ],
        code: {
          caption: 'The lifecycle worth implementing',
          body: `create   key = "sk_live_" + base62(32 random bytes)
         store: hash(key), prefix, last4, scopes, created_by, expires_at
         show the full value once, never again

use      lookup by prefix -> compare hash in constant time
         check scopes, check expiry, check IP allow-list
         update last_used_at (async, do not block the request)

rotate   allow two active keys so the swap has no downtime
revoke   delete instantly; log who did it and when
audit    alert on keys unused for 90 days and on first use from a new IP`,
        },
      },
      {
        heading: 'Leaks are the normal failure, so plan for them',
        paragraphs: [
          'Keys end up in git repositories, CI logs, error reports, screenshots and support tickets. Assume it will happen and build for fast detection and fast rotation: secret scanning on your repositories, alerting on use from an unexpected IP or country, and a rotation procedure that does not require downtime.',
          'Supporting two active keys per integration is what makes rotation painless - create the new one, deploy it, verify traffic has moved, then revoke the old one. Stripe, for example, keeps a rotated key working for up to 7 days for exactly this. Without an overlap, revoking a leaked key cuts off the legitimate client in the same moment as the attacker, which is why so many teams never rotate at all.',
          'Add expiry dates even when it feels inconvenient. A key that expires in a year is a key that cannot still be valid in a repository five years later. And log usage per key so that when a leak is suspected, you can see exactly what that key did.',
        ],
      },
    ],
    examples: [
      {
        title: 'A key in a mobile app, and what to do instead',
        setup:
          'A mobile app calls a third-party maps API directly using a key compiled into the binary. Within weeks the monthly bill triples.',
        walkthrough: [
          'Anyone can extract the key from the app package in minutes; there is no way to hide a string that the app itself must send.',
          'The key was scraped and reused by other applications: monthly calls went from 2 million to 6 million, all billed to your account.',
          'Mitigation 1 (partial): restrict the key at the provider to your app bundle id and signing certificate. This helps, and is bypassable by a determined attacker who replays those 2 identifiers.',
          'Mitigation 2 (partial): set a hard quota - say 100,000 calls a day - so the worst month is bounded at about 3 million calls instead of open-ended.',
          'Proper fix: the app calls your backend, and your backend calls the maps API with a key that never leaves your servers. You authenticate your own users, apply your own rate limits, and can cache responses.',
          'Added benefit: if 40% of lookups repeat, a cache in your backend cuts the 2 million billed calls to about 1.2 million, and you can switch providers and see per-user usage.',
        ],
        result:
          'A secret that ships to a client is not a secret. Proxying through your own backend is the only structural fix, and it usually brings caching and observability benefits that justify it on their own.',
      },
    ],
    jargon: [
      { term: 'API key', plain: 'A long random string identifying a calling application. Possession is the whole credential.' },
      { term: 'Key prefix', plain: 'A readable marker (sk_live_) that makes keys identifiable and scannable.' },
      { term: 'Scoped key', plain: 'A key limited to specific permissions rather than full account access.' },
      { term: 'Rotation', plain: 'Replacing a key without downtime, usually by supporting two active keys.' },
      { term: 'Secret scanning', plain: 'Automatically detecting keys committed to repositories or logs.' },
      { term: 'HMAC signing', plain: 'Signing requests with a shared secret so the key itself is never transmitted.' },
    ],
    remember: [
      'Possession is the entire credential - so never ship a key to a browser or mobile app.',
      'Store hashes, show the full value once, and identify keys by prefix and last four.',
      'Scope every key; full-access keys turn a leak into an incident.',
      'Support two active keys so rotation needs no downtime.',
      'Assume leaks: scan, alert on anomalous use, expire keys, and log usage per key.',
    ],
  },

  'tls-https': {
    analogy: {
      title: 'A sealed envelope from a verified sender',
      body:
        'Three separate promises come with it: nobody along the way can read the contents, nobody can alter them without the tampering being obvious, and the sender identity was checked by someone you already trust. Remove the third and the first two are worthless - a perfectly private conversation with an impostor is still a disaster.',
    },
    deepDive: [
      {
        heading: 'The handshake, and why 1.3 matters',
        paragraphs: [
          'A TLS handshake agrees on a cipher suite, verifies the server certificate, and establishes a shared symmetric key. TLS 1.2 needed two round trips; TLS 1.3 removed legacy options and cut it to one, with session resumption able to send data on the first flight (0-RTT). On a 60 ms link that is 60 ms saved on every new connection.',
          'The asymmetric cryptography is used only to establish the key; the actual data is protected with fast symmetric encryption. That is why TLS is not slow at scale - the expensive part happens once per connection, which is another reason connection reuse matters so much.',
          'TLS 1.3 also made forward secrecy mandatory: the session key is ephemeral, so recording traffic today and stealing the server private key later does not decrypt it. Disabling old versions (1.0 and 1.1) and weak cipher suites is routine hardening, and modern defaults from your web server or cloud load balancer are usually correct out of the box.',
        ],
        code: {
          caption: 'What the certificate chain proves',
          body: `browser trusts ~150 root CAs shipped with the OS

  root CA (offline, in the trust store)
    signs -> intermediate CA
      signs -> your certificate (example.com, valid 90 days)

verification: name matches, not expired, chain reaches a trusted root,
              not revoked (OCSP stapling), signature valid

serving an incomplete chain is the classic misconfiguration:
it works in browsers that cache the intermediate, and fails in curl
and in mobile apps. Always test with an external checker.`,
        },
      },
      {
        heading: 'Certificates in practice',
        paragraphs: [
          'Domain-validated certificates prove control of the domain and are free and automatic through ACME-based issuers. Organisation and extended validation certificates additionally verify the legal entity, which browsers no longer display prominently, so their practical value is limited to specific compliance requirements.',
          'Automate renewal. Certificate expiry is one of the most common self-inflicted outages, and it is entirely preventable: ACME clients renew at two-thirds of the lifetime, and an alert 30 days before expiry catches an automation that has silently stopped working. Short-lived certificates are a feature - they force the automation to be real.',
          'Where to terminate TLS is a design decision. Terminating at the load balancer or CDN centralises certificate management and lets the proxy read requests for routing; the traffic behind it is then plaintext, which is acceptable inside a trusted network and unacceptable for regulated data. Re-encrypting to the backend, or mutual TLS between services, is the stricter alternative.',
        ],
        bullets: [
          'Automate issuance and renewal with ACME; alert well before expiry.',
          'Serve the full chain, and verify from outside your network.',
          'TLS 1.2 minimum, 1.3 preferred; disable old protocols and weak ciphers.',
          'HSTS so browsers never attempt plain HTTP after the first visit.',
          'mTLS for service-to-service when both sides must be authenticated.',
        ],
      },
      {
        heading: 'What HTTPS does not give you',
        paragraphs: [
          'It secures data in transit only. The server can still be compromised, the database can still be unencrypted, and the application can still be vulnerable to injection, broken authorisation or XSS. The padlock says the channel is protected, not that the site is trustworthy - which is why phishing sites use HTTPS too.',
          'Metadata still leaks. The destination IP and the hostname in the SNI field are visible to observers, so an eavesdropper learns which sites you visit even if not what you read. Encrypted Client Hello addresses this and is still being deployed.',
          'And the first request is a weak point: typing example.com without a scheme triggers a plain HTTP request that can be intercepted. HSTS closes this for repeat visitors, and the HSTS preload list closes it for first-time visitors by baking the rule into browsers.',
        ],
      },
    ],
    examples: [
      {
        title: 'The certificate that expired on a Sunday',
        setup:
          'A payment API certificate expires at 03:00 on a Sunday. Every client fails TLS verification. Recovery takes 3 hours.',
        walkthrough: [
          'The certificate had been issued manually a year earlier by an engineer who has since left. No automation existed and the renewal reminder went to their old inbox.',
          'Monitoring checked HTTP 200 from inside the network, where a different termination point was used, so nothing alerted until customers did.',
          'Recovery was slow because the ACME account, the DNS credentials and the deployment procedure all had to be located and re-established at 03:00.',
          'Fix 1: ACME with automatic renewal at 60 days of a 90-day lifetime, so there are 30 days of retries before anything expires.',
          'Fix 2: an external monitor that connects from outside and alerts at 30, 14 and 7 days before expiry - checking the certificate itself, not just that the page loads.',
          'Fix 3: a synthetic check performing a full TLS handshake from outside the network, which would also have caught an incomplete chain.',
          'Fix 4: certificates issued to a team-owned account with shared access, so no renewal depends on one person.',
        ],
        result:
          'Expiry is a scheduled outage that announces itself months in advance and is missed anyway. Automated renewal plus an external expiry alert costs an hour to set up and removes the entire class.',
      },
    ],
    jargon: [
      { term: 'TLS vs SSL', plain: 'TLS is the current protocol; SSL is its obsolete predecessor, though the name persists.' },
      { term: 'Certificate chain', plain: 'Your certificate, signed by an intermediate, signed by a trusted root.' },
      { term: 'SNI', plain: 'The hostname sent in the clear so one IP can serve many sites. Visible to observers.' },
      { term: 'Forward secrecy', plain: 'Past traffic stays safe even if the private key is stolen later.' },
      { term: 'HSTS', plain: 'A header telling browsers to use HTTPS only for this domain from now on.' },
      { term: 'mTLS', plain: 'Both sides present certificates, so the client is authenticated too.' },
    ],
    remember: [
      'Three guarantees: confidentiality, integrity and authentication - the third makes the others meaningful.',
      'TLS 1.3 costs one round trip; connection reuse removes even that.',
      'Automate renewal and alert on expiry from outside your network.',
      'Serve the full chain, or it breaks for non-browser clients.',
      'HTTPS protects the channel, not the server, the data at rest or the application.',
    ],
  },

  'secrets-management': {
    analogy: {
      title: 'A key safe with a log, not a note on the desk',
      body:
        'Keys live in a safe that records who took what and when, and the codes are changed periodically. Nobody writes the master code on a sticky note or emails it to a colleague. Secrets management is that discipline: not merely hiding values, but controlling access, recording it, and being able to change everything quickly.',
    },
    deepDive: [
      {
        heading: 'Where secrets should not be',
        paragraphs: [
          'Not in source control - git keeps history forever, so a committed secret is still there after you delete it, and it is in every clone and every fork. Removing it requires rewriting history and rotating the secret anyway, so treat any commit as permanent exposure.',
          'Not in container images, which are pulled by many systems and often pushed to shared registries. Not in build logs or CI output, which are widely readable. Not in front-end bundles, ever. And not in plain environment variables on shared hosts, where any process and most crash reporters can read them.',
          'Environment variables deserve a nuance: they are a reasonable delivery mechanism when injected at runtime by an orchestrator or secrets manager, and a bad storage mechanism when written into a .env file that gets committed or copied. The difference is where the value lives at rest.',
        ],
        code: {
          caption: 'The progression most teams walk',
          body: `0  secrets in code                 exposed forever, in every clone
1  .env file, gitignored          better; still on disk, still copied
2  env vars injected by the platform   no file, but static and shared
3  secrets manager, fetched at start   central, access-controlled, audited
4  short-lived dynamic credentials     the database password lives 1 hour

each step reduces both the blast radius and the cost of rotation.`,
        },
      },
      {
        heading: 'What a secrets manager actually buys',
        paragraphs: [
          'Central storage encrypted at rest is the least of it. The valuable parts are access control per identity (this service may read this secret and no other), an audit log of every access, versioning so a rotation can be rolled back, and an API that makes automated rotation possible.',
          'Dynamic secrets go further: the manager creates a database user on demand with a one-hour lease and deletes it afterwards. There is then no long-lived credential to leak, and a compromised process yields a credential that expires by itself. This is the strongest available answer for database access.',
          'Workload identity removes the bootstrapping problem - how does the service authenticate to the secrets manager without a secret? The platform vouches for the workload (a Kubernetes service account, an instance role), so no credential is provisioned by hand at all. Where available, this is the clean solution to the oldest problem in the field.',
        ],
        bullets: [
          'Per-identity access control, so a compromised service cannot read everything.',
          'Audit log of every read - the answer to "what did this key touch?".',
          'Versioning, so rotation is reversible.',
          'Dynamic, short-lived credentials wherever the backend supports them.',
          'Workload identity, so nothing has to hold a bootstrap secret.',
        ],
      },
      {
        heading: 'Rotation is the capability that matters',
        paragraphs: [
          'The question to ask of any secret is: if this leaked right now, how long would it take us to replace it? If the answer is "we are not sure" or "it would require downtime", that is the problem to fix, ahead of most other security work.',
          'Rotation is only painless if the system supports two valid secrets at once. Then the sequence is: create the new one, deploy it, verify traffic has moved, revoke the old one. Without overlap, rotation is a coordinated outage, which is precisely why it never happens.',
          'Support it with detection: secret scanning in repositories and CI, alerting on use from unexpected sources, and an inventory of what exists and who owns it. An unknown secret cannot be rotated, and most organisations discover during an incident that their inventory was incomplete.',
        ],
      },
    ],
    examples: [
      {
        title: 'A key in git history, three years later',
        setup:
          'A developer commits a cloud access key, notices within minutes, and pushes a commit removing it. Three years later the key is used to mine cryptocurrency.',
        walkthrough: [
          'The removal commit deleted the file contents but not the history. The key remained in the repository object store, in every clone, and in a fork somebody had made.',
          'The key was never rotated, because it had been "removed". It retained full permissions the entire time.',
          'An automated scanner found it in the public fork and used it. Detection came from the cloud bill, not from monitoring.',
          'Correct immediate response: rotate the key first, then worry about the history. Removal without rotation is theatre.',
          'Fix 1: pre-commit and server-side secret scanning, so the commit is blocked rather than discovered later.',
          'Fix 2: keys issued with narrow scopes and short expiry, so a leaked key cannot do everything and cannot do it forever.',
          'Fix 3: cloud billing and anomaly alerts, so unusual usage is noticed in hours rather than weeks.',
          'Fix 4: move to workload identity, so no long-lived key exists to be committed at all.',
        ],
        result:
          'Deleting a committed secret does not unexpose it - only rotation does. The strategic fix is having fewer long-lived secrets in the first place, which is exactly what workload identity and dynamic credentials provide.',
      },
    ],
    jargon: [
      { term: 'Secret', plain: 'Any value that grants access: passwords, API keys, tokens, private keys, certificates.' },
      { term: 'Secrets manager', plain: 'A service storing secrets with access control, auditing and rotation support.' },
      { term: 'Dynamic secret', plain: 'A credential created on demand with a short lease and then deleted.' },
      { term: 'Workload identity', plain: 'The platform vouching for a service so it needs no bootstrap credential.' },
      { term: 'Rotation', plain: 'Replacing a secret. Painless only if two are valid at once.' },
      { term: 'Envelope encryption', plain: 'Encrypting data with a key that is itself encrypted by a managed master key.' },
    ],
    remember: [
      'A committed secret is exposed permanently - rotate first, clean history second.',
      'Environment variables are an acceptable delivery mechanism, not a storage mechanism.',
      'The value of a secrets manager is access control, auditing and rotation, not just encryption.',
      'Design for two valid secrets at once, or rotation will never happen.',
      'Short-lived dynamic credentials beat protecting long-lived ones.',
    ],
  },

  waf: {
    analogy: {
      title: 'A security guard reading the forms at the door',
      body:
        'The guard checks each form for obvious problems - a signature block containing a threat, a field stuffed with someone else details - and rejects those. It is useful and fast, and it is pattern matching: a determined visitor can phrase things differently. It is a filter in front of the building, not a substitute for locking the doors inside.',
    },
    deepDive: [
      {
        heading: 'What a WAF inspects and what it blocks',
        paragraphs: [
          'A web application firewall sits in front of your application, decrypts HTTPS, and inspects each request - method, path, headers, query string, body, cookies - against rules. Managed rule sets cover the well-known categories: SQL injection patterns, cross-site scripting payloads, path traversal, command injection, and known scanner and bot signatures.',
          'It also provides controls that are awkward to implement per application: IP reputation blocking, geographic restrictions, per-path rate limits, request size limits and bot management. For a fleet of services, applying those once at the edge is far more consistent than in each codebase.',
          'And it gives you a lever during an incident. When a new vulnerability is disclosed in a library you use, a virtual patch at the WAF can block the exploit pattern within minutes, while the real fix is developed, tested and deployed. That time compression is often the single most valuable thing a WAF provides.',
        ],
        code: {
          caption: 'Layers, and why the WAF is only the first',
          body: `request
  |
[WAF]         blocks known patterns, rate limits, bad IPs   <- helpful
  |
[app]         input validation, output encoding             <- necessary
  |
[data layer]  parameterised queries, ORM                    <- the actual fix
  |
[database]    least-privilege user, no DDL rights           <- containment

a WAF that blocks "' OR 1=1" does not make string-concatenated SQL safe.
Parameterised queries make injection structurally impossible.`,
        },
      },
      {
        heading: 'False positives are the real operational cost',
        paragraphs: [
          'Generic rules match legitimate traffic surprisingly often. A user writing about SQL in a support ticket, a document containing script tags, a form field with an apostrophe, a base64 payload that happens to match a signature - all can be blocked, and the user sees an unexplained 403 with no way to proceed.',
          'Strictness is a dial, not a switch. The OWASP Core Rule Set adds points to an anomaly score for every rule a request matches - a critical match is 5 - and blocks at a score of 5 by default. Its paranoia level, 1 to 4, decides how many rules are switched on: level 1 aims for almost no false positives, and each level above it catches more disguised attacks and blocks more real users, until level 4 can take weeks of tuning.',
          'So the deployment sequence matters: run in detection-only mode first, review what would have been blocked against real traffic for a week or two, tune or exclude the noisy rules, and only then start blocking. Turning on a full managed rule set in blocking mode on day one reliably breaks something important.',
          'Keep tuning afterwards, and make blocked requests easy to investigate. A log with the rule id, the matched content and the request id turns "some customers cannot submit the form" into a five-minute diagnosis rather than a day of guessing.',
        ],
        bullets: [
          'Start in detection mode; tune against real traffic before blocking.',
          'Exclude one rule for one path and field rather than disabling whole rule sets - that field is then uninspected by it.',
          'Log rule id and request id, and make them visible to support.',
          'Re-tune after any significant change to your request shapes.',
        ],
      },
      {
        heading: 'Where it genuinely helps, and where it gives false comfort',
        paragraphs: [
          'It helps most against automated, untargeted traffic: scanners, commodity exploit kits, credential stuffing, scraping and floods of HTTP requests (with rate-based rules and bot detection). A flood of packets that fills the network link never becomes a request, so it needs network-layer DDoS protection instead. That is the overwhelming majority of hostile traffic any public service receives, so the reduction in noise is real.',
          'It helps least against logic flaws, which are the vulnerabilities that actually matter in modern applications. Broken object-level authorisation - changing an id to read another account data - is a perfectly formed, legitimate-looking request. No pattern matcher can tell it from a valid one, because the problem is in your authorisation logic.',
          'So treat it as one layer. Parameterised queries prevent SQL injection; output encoding and a content security policy prevent XSS; scoped queries prevent IDOR; dependency updates prevent known CVEs. The WAF buys time and filters noise on top of those, and a team that believes it is the defence has usually stopped doing the work that matters.',
        ],
      },
    ],
    examples: [
      {
        title: 'Virtual patching a zero-day over a weekend',
        setup:
          'A critical remote code execution vulnerability is disclosed in a widely used logging library. Your services use it. A patched version exists but full deployment will take days of testing.',
        walkthrough: [
          'Hour 1: a WAF rule is added blocking requests containing the exploit pattern in any header or parameter, in blocking mode immediately - the risk of false positives is acceptable against active exploitation.',
          'Hour 2: WAF logs are reviewed and show exploitation attempts already arriving, confirming the urgency and providing the source addresses.',
          'Hours 3-8: additional rules cover the encoded and nested variants that researchers publish as bypasses. This is the honest limitation - pattern rules are an arms race.',
          'Day 1-3: the library is upgraded across services, tested and deployed through the normal pipeline, which is the actual fix.',
          'Day 4: the WAF rules are kept anyway, since they cost nothing and block ongoing background scanning.',
          'Retrospective: a dependency inventory is added so the next disclosure takes minutes to assess rather than a day of searching.',
        ],
        result:
          'The WAF did not fix the vulnerability - it bought three days of protection while the fix was done properly. That is precisely the right way to use it, and precisely why it must not become the permanent answer.',
      },
    ],
    jargon: [
      { term: 'WAF', plain: 'A filter in front of your application that inspects and blocks requests by rule.' },
      { term: 'Managed rule set', plain: 'Vendor-maintained rules covering common attack classes, updated for you.' },
      { term: 'Detection / blocking mode', plain: 'Logging what would be blocked, versus actually blocking it.' },
      { term: 'False positive', plain: 'Legitimate traffic blocked by a rule. The main operational cost.' },
      { term: 'Virtual patch', plain: 'A rule that blocks an exploit while the real fix is developed.' },
      { term: 'Paranoia level', plain: 'How strict a rule set is, 1 to 4. Higher catches more attacks and blocks more real users.' },
    ],
    remember: [
      'A WAF filters known patterns and buys time - it is not a fix for a vulnerability.',
      'Start in detection mode and tune, or you will block real customers - a stricter level catches more attacks and more real users.',
      'It cannot catch logic flaws like broken object-level authorisation.',
      'Its best moment is virtual patching between disclosure and deployment.',
      'Parameterised queries, output encoding and scoped queries are the actual defences.',
    ],
  },
};
