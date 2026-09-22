// lib/auth.ts
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  isEmailConfigured,
  resetPasswordEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/email";
import {
  generateUniqueUsername,
  isUsernameTaken,
  validateUsername,
} from "@/lib/username";

/**
 * One-way, key-derived pseudonym for a client IP. Equal addresses produce equal
 * output so abuse patterns stay visible, but the address itself cannot be
 * recovered from the stored value without BETTER_AUTH_SECRET.
 */
/**
 * The key both pseudonymisers are built on.
 *
 * Falling back to "" would turn the HMAC into a plain digest, and an
 * unsalted digest of an IPv4 address is reversible by exhaustive search -
 * silently producing exactly the thing the HMAC exists to prevent. better-auth
 * Note better-auth does NOT require it: it silently falls back to a hardcoded
 * DEFAULT_SECRET and only logs a warning, so an unset variable would otherwise
 * go unnoticed while sessions are signed with a publicly known value. Throwing
 * makes that state impossible to deploy unnoticed - which does mean the
 * variable must be set in every environment, preview deploys included.
 */
function pseudonymKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to pseudonymise IP addresses",
    );
  }
  return secret;
}

function pseudonymiseIp(ipAddress: string): string {
  return createHmac("sha256", pseudonymKey()).update(ipAddress).digest("hex");
}

// Misconfigured mail is a deploy bug, and swallowing send failures (which the
// hooks below do, so a Resend blip cannot orphan an account) would otherwise
// make it completely silent: every sign-up would return 200, every user would
// be told to check an inbox nothing was sent to, and nobody could ever verify.
// Said once at boot so it lands in the deploy log rather than nowhere.
if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
  console.error(
    "[auth] RESEND_API_KEY / EMAIL_FROM are not set. Email verification and " +
      "password reset will silently do nothing, and no account created from " +
      "here on will be able to verify.",
  );
}

export const auth = betterAuth({
  // Enumeration and mail-bombing guard.
  //
  // /forget-password is deliberately neutral about whether an account exists,
  // but better-auth's /send-verification-email answers plainly (400 for an
  // unknown address, 200 for a known one) and cannot be made neutral without
  // reimplementing it - and each 200 also sends real mail. Rate limiting does
  // not close either oracle; it stops them being usable at scale, which for a
  // small hub is the practical difference.
  rateLimit: {
    enabled: true,
    customRules: {
      "/forget-password": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // No trailing slash: better-auth compares these with `pattern ===
    // getOrigin(url)`, and an origin never carries one - so "…dev/" silently
    // matches nothing and every callback is rejected as an untrusted origin.
    "https://stellar.a3chron.dev",
    // The old host has to keep serving regardless: every stellar binary up to
    // v1.4.0 hardcodes it as the API base. Those requests are unauthenticated,
    // but anyone who reaches the *site* there in a browser would otherwise be
    // unable to complete an OAuth callback, so it costs nothing to keep.
    "https://stellar-hub.vercel.app",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Without these, /sign-up/email signs the user straight in: the "check
    // your inbox" screen would be a lie, an unconfirmed address could publish
    // themes, and registering someone else's address pre-emptively would leave
    // an account waiting to be linked when they later sign in with Google.
    requireEmailVerification: true,
    autoSignIn: false,
    // An account owns published themes, so losing the password has to be
    // recoverable rather than terminal.
    //
    // Never allowed to throw: better-auth returns success immediately for an
    // address with no account (it never gets here), so surfacing a send
    // failure would make the two cases distinguishable and turn the
    // forgot-password form into an account-existence oracle. A failure is
    // logged and swallowed; the user simply tries again.
    sendResetPassword: async ({ user, url }) => {
      try {
        const { subject, text, html } = resetPasswordEmail(url);
        await sendEmail({ to: user.email, subject, text, html });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Also never allowed to throw. better-auth awaits this *after* it has
    // already written the user row and credential account, with no try/catch
    // of its own - so a Resend outage used to 500 the sign-up while leaving
    // the account behind: retrying the same address said "user already
    // exists", a different one said "that username is taken", and
    // requireEmailVerification meant they could never sign in. Letting sign-up
    // succeed keeps the account recoverable, because signing in mints and
    // sends a fresh link.
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { subject, text, html } = verificationEmail(url);
        await sendEmail({ to: user.email, subject, text, html });
      } catch (error) {
        console.error("Failed to send verification email:", error);
      }
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ["user:email", "read:user"],
      mapProfileToUser: (profile) => {
        return {
          // GitHub is the only provider that hands over a handle we can use
          // verbatim: `login` is already unique and already inside the CLI's
          // identifier charset. Falling back to it for the display name keeps
          // new GitHub accounts looking exactly like the accounts that predate
          // the username column.
          name: profile.name || profile.login,
          username: profile.login,
          email: profile.email,
          image: profile.avatar_url,
          emailVerified: profile.email !== null,
        };
      },
    },
    gitlab: {
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
      scope: ["read_user"],
      mapProfileToUser: (profile) => {
        return {
          name: profile.name || profile.username,
          username: profile.username,
          email: profile.email,
          image: profile.avatar_url,
          emailVerified: Boolean(profile.email),
        };
      },
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: (profile) => {
        return {
          name: profile.name,
          // Google has no concept of a handle, so there is nothing to map -
          // the create hook below derives one from the name and email.
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified,
        };
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // better-auth resolves the client IP from x-forwarded-for and friends
        // and writes it into session.ipAddress verbatim. Storing a raw address
        // next to a user id is more than this service needs: the only thing it
        // is used for here is noticing that a session is being used from
        // somewhere unusual, and a stable pseudonym answers that just as well.
        //
        // Keyed with BETTER_AUTH_SECRET rather than plain SHA-256 on purpose.
        // The entire IPv4 space is 2^32 addresses, so an unsalted digest of one
        // can be reversed by brute force in seconds - it would be a hash in
        // name only. An HMAC under a secret the database does not contain
        // cannot be reversed by someone who only has the database.
        before: async (session) => {
          const { ipAddress } = session;
          if (!ipAddress) {
            return { data: session };
          }
          return {
            data: { ...session, ipAddress: pseudonymiseIp(ipAddress) },
          };
        },
      },
    },
    user: {
      create: {
        // Last line of defence for the author handle. `mapProfileToUser` can
        // only propose a username, and only for the providers that have one -
        // it cannot check the proposal is free, and Google and email signups
        // do not supply one at all. Every path into user creation funnels
        // through here, so this is the single place that guarantees the column
        // is always set to something valid, unreserved and unused.
        before: async (user, context) => {
          const proposed = (user as { username?: string }).username;

          // A handle typed into the sign-up form is a request, not a hint: if
          // it cannot be honoured the signup has to fail with a reason. Only
          // OAuth may be silently re-derived - there the "proposal" is just
          // the provider's login, and refusing it would lock the user out of
          // signing in at all over a name they never chose.
          if (context?.path === "/sign-up/email" && proposed) {
            const validation = validateUsername(proposed);
            if (!validation.ok) {
              throw new APIError("BAD_REQUEST", { message: validation.error });
            }
            if (await isUsernameTaken(proposed)) {
              throw new APIError("BAD_REQUEST", {
                message: "That username is taken",
              });
            }
            return { data: { ...user, username: proposed } };
          }

          const username = await generateUniqueUsername([
            proposed,
            user.name,
            user.email?.split("@")[0],
          ]);

          return { data: { ...user, username } };
        },
      },
      update: {
        // `username` has to stay writable on create so the sign-up form can
        // propose one (better-auth strips `input: false` fields from
        // /sign-up/email before they reach the create hook above). That leaves
        // the generic /update-user endpoint able to set it too, which would
        // skip every validation and availability check - so drop it here.
        // The one supported way to change a handle is /api/settings/username,
        // which writes through Drizzle and never passes this hook.
        before: async (user) => {
          // Always return a data object. better-auth assigns the hook's result
          // straight into the update payload
          // (`actualData = isObject ? result.data : result`), so returning
          // undefined here would blank out every user update - including the
          // emailVerified write behind the verification link.
          if (!("username" in user)) {
            return { data: user };
          }
          const { username: _ignored, ...rest } = user as typeof user & {
            username?: string;
          };
          return { data: rest };
        },
      },
    },
  },
  user: {
    additionalFields: {
      bio: {
        type: "string",
        required: false,
      },
      username: {
        type: "string",
        // Not "required" even though the column is NOT NULL: the create hook
        // above always fills it in, so demanding it here would only make a
        // signup that omits a handle fail instead of being given one.
        //
        // Either way better-auth 1.2.0 types additional fields as optional and
        // nullable on the session user (it emits the key in both its required
        // and its optional mapping), so consumers still have to allow for a
        // missing handle at the type level.
        required: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
