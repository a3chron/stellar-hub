import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "Privacy policy and terms of use for Stellar, the Starship prompt theme hub.",
};

// The GDPR requires a named controller who can actually be reached (Art. 13),
// which a name and a working email address satisfy.
//
// No postal address is listed because this is a free, non-commercial hobby
// project. Germany's Impressum duty attaches to services offered
// "geschäftsmäßig" - if Stellar ever takes donations, sponsorship or ads, that
// changes, and a full postal address becomes required here.
const OPERATOR = {
  name: "Kurt Schambach",
  email: "kurt.schambach@gmail.com",
};

const LAST_UPDATED = "22 September 2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-3xl font-bold text-ctp-text mt-16 mb-6">{title}</h2>
      <div className="space-y-4 text-ctp-subtext1 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xl font-semibold text-ctp-text mt-8 mb-3">
      {children}
    </h3>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside pl-6 space-y-2">{children}</ul>;
}

export default function LegalPage() {
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-ctp-text mb-2">Legal</h1>
        <p className="text-ctp-subtext0">
          Last updated: {LAST_UPDATED}. This page covers both the{" "}
          <Link
            href="#privacy"
            className="text-ctp-lavender underline underline-offset-4"
          >
            privacy policy
          </Link>{" "}
          and the{" "}
          <Link
            href="#terms"
            className="text-ctp-lavender underline underline-offset-4"
          >
            terms of use
          </Link>
          .
        </p>

        {/* ------------------------------------------------------------- */}
        <Section id="operator" title="Who runs Stellar">
          <p>
            Stellar is a free, open-source hobby project. It is operated by:
          </p>
          <address className="not-italic bg-ctp-mantle border border-ctp-surface0 rounded-lg p-4 text-ctp-text">
            {OPERATOR.name}
            <br />
            <Link
              href={`mailto:${OPERATOR.email}`}
              className="text-ctp-lavender underline underline-offset-4"
            >
              {OPERATOR.email}
            </Link>
          </address>
          <p>
            The source code for both the website and the command-line tool is
            public at{" "}
            <Link
              href="https://github.com/a3chron/stellar"
              className="text-ctp-lavender underline underline-offset-4"
            >
              github.com/a3chron/stellar
            </Link>
            .
          </p>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section id="privacy" title="Privacy policy">
          <p>
            The short version: you can browse this site and install themes with
            the CLI without an account and without telling us anything about
            yourself. An account is needed only to publish themes, and the data
            it holds is what is required to run that account — nothing is sold,
            and nothing is used for advertising or profiling.
          </p>

          <H3>Browsing without an account</H3>
          <p>
            No account is required to browse themes, read the documentation, or
            apply a theme with the CLI. Visiting the site sets no advertising or
            tracking cookies.
          </p>

          <H3>Account data</H3>
          <p>
            If you create an account, we store: your email address, your
            username (the handle your themes are published under), a display
            name, and — if you provide them — an avatar image, a short bio, and
            links to your GitHub profile or website. Bio and links are optional
            and are shown publicly on your profile page.
          </p>
          <p>
            Legal basis: Art. 6(1)(b) GDPR — processing necessary to provide the
            service you signed up for.
          </p>

          <H3>How you sign in</H3>
          <List>
            <li>
              <strong>Email and password:</strong> your password is stored only
              as a salted cryptographic hash. We never store or can read the
              password itself.
            </li>
            <li>
              <strong>GitHub, GitLab or Google:</strong> we receive your
              username or name, your email address, and your avatar image from
              the provider you choose. We store the access and refresh tokens
              the provider issues so the connection keeps working. We never
              receive your password, and we do not use these tokens to access
              your repositories or any other data — the permissions requested
              are read-only profile access.
            </li>
          </List>

          <H3>Sessions and security</H3>
          <p>
            While you are signed in, we store a session record containing a
            session token, your browser's user-agent string, and a one-way keyed
            digest of your IP address. We do not store the IP address itself —
            the digest lets us notice that a session is being used from
            somewhere unusual without keeping the address on file, and it cannot
            be turned back into your IP from the database. This keeps you signed
            in and makes account misuse detectable. Sessions expire
            automatically. An essential cookie holds the session token; it is
            required for logging in and is not used for tracking.
          </p>
          <p>
            Legal basis: Art. 6(1)(f) GDPR — legitimate interest in operating a
            secure service.
          </p>
          <p>
            To limit abuse of the download counter and the username lookup, the
            same one-way keyed digest is held in memory for a short window. The
            raw address is not written to disk.
          </p>

          <H3>Themes you publish</H3>
          <p>
            Themes are public by design. The configuration file, name,
            description, version notes, screenshot, and the username of the
            author are visible to everyone and are served through the public API
            to the CLI. Do not put anything private into a theme configuration
            or a screenshot.
          </p>

          <H3>Email</H3>
          <p>
            We send email only for address verification and password resets.
            There is no newsletter and no marketing email. Delivery is handled
            by Resend.
          </p>

          <H3>CLI usage statistics</H3>
          <p>
            The command-line tool sends one anonymous report on its first run,
            again after a version change, and once on uninstall. It contains a
            random install identifier generated on your own machine, whether the
            install was new or pre-existing, the CLI version and the previously
            reported version, and your operating system and CPU architecture.
          </p>
          <p>
            It contains nothing else: no IP address is stored, and no theme
            names, file paths, or usernames are transmitted. There is no
            periodic ping. You can switch it off entirely by setting{" "}
            <code className="text-ctp-text">STELLAR_NO_TELEMETRY=1</code> or the
            cross-tool <code className="text-ctp-text">DO_NOT_TRACK=1</code> in
            your shell configuration, and deleting the install id from{" "}
            <code className="text-ctp-text">~/.config/stellar/config.json</code>{" "}
            resets it.
          </p>
          <p>
            Legal basis: Art. 6(1)(f) GDPR — legitimate interest in knowing
            roughly how many installs exist and which versions are in use.
          </p>

          <H3>Analytics</H3>
          <p>
            This site uses Vercel Web Analytics and Vercel Speed Insights to
            measure page views and loading performance in aggregate. These do
            not set cookies and do not track you across other websites.
          </p>

          <H3>Service providers</H3>
          <p>
            We use the following processors, each only for the purpose listed:
          </p>
          <List>
            <li>
              <strong>Vercel</strong> — website hosting and analytics
            </li>
            <li>
              <strong>Supabase</strong> — database and storage for screenshots
              and avatars
            </li>
            <li>
              <strong>Resend</strong> — sending verification and password reset
              email
            </li>
            <li>
              <strong>GitHub, GitLab, Google</strong> — only if you choose that
              provider to sign in
            </li>
          </List>
          <p>
            Some of these providers operate infrastructure outside the European
            Union, including in the United States. Such transfers are based on
            the European Commission's standard contractual clauses or an
            adequacy decision.
          </p>

          <H3>How long data is kept</H3>
          <List>
            <li>
              Account data: until you delete your account, which you can do
              yourself at any time from your settings.
            </li>
            <li>
              Published themes: until you delete them. Deleting your account
              deletes your themes as well.
            </li>
            <li>Sessions: until they expire or you sign out.</li>
            <li>
              CLI install records: until the install reports an uninstall, or
              until we no longer need them.
            </li>
          </List>

          <H3>Your rights</H3>
          <p>
            Under the GDPR you have the right to access your data, to have
            inaccurate data corrected, to have your data deleted, to restrict or
            object to processing, and to receive your data in a portable format.
            Where processing is based on consent, you may withdraw it at any
            time with future effect.
          </p>
          <p>
            You can exercise most of these yourself: edit your profile, delete
            individual themes, or delete your account outright from your{" "}
            <Link
              href="/settings"
              className="text-ctp-lavender underline underline-offset-4"
            >
              settings page
            </Link>
            . Deleting your account immediately removes your profile, your
            sign-in methods, every theme you published together with all of its
            versions, and the associated images. For anything else, write to the
            address above.
          </p>
          <p>
            You also have the right to complain to a data protection supervisory
            authority.
          </p>
        </Section>

        {/* ------------------------------------------------------------- */}
        <Section id="terms" title="Terms of use">
          <p>
            By using Stellar you agree to the following. If you do not agree,
            please do not use the service.
          </p>

          <H3>The service</H3>
          <p>
            Stellar is a free hobby project that lets people share and install
            Starship prompt configurations. It is provided as-is, with no
            guarantee of availability, and it may change or shut down at any
            time. There is no paid tier and no service level agreement.
          </p>

          <H3>Your account</H3>
          <List>
            <li>
              You are responsible for what happens under your account. Keep your
              password and connected accounts secure.
            </li>
            <li>Provide an email address you actually control.</li>
            <li>
              You must be at least 16 years old to create an account, or have
              the consent of a parent or guardian.
            </li>
            <li>
              Do not impersonate someone else or pick a username intended to
              suggest an affiliation you do not have.
            </li>
          </List>

          <H3>Content you upload</H3>
          <p>
            You keep ownership of the themes and screenshots you publish. By
            publishing, you grant us the non-exclusive, worldwide, royalty-free
            right to store, display, and distribute that content through this
            website and its API, including to the CLI — this is simply what is
            needed to host it and let others install it. You can withdraw this
            by deleting your theme, though copies already downloaded by others
            remain on their machines.
          </p>
          <p>
            You may only upload content you created or otherwise have the right
            to publish.
          </p>

          <H3>What you must not upload</H3>
          <List>
            <li>
              Anything unlawful, or content that infringes someone else's
              copyright or trademark.
            </li>
            <li>
              Sexual or pornographic imagery, graphic violence, or shock
              content. Screenshots should show a terminal prompt — that is what
              the field is for.
            </li>
            <li>
              Hateful, harassing, or discriminatory content, including in theme
              names, descriptions, and usernames.
            </li>
            <li>
              <strong>
                Configurations that do anything harmful when a prompt is
                rendered.
              </strong>{" "}
              Starship configurations can define custom modules that execute
              shell commands. Any theme whose commands exfiltrate data, download
              or execute remote code, modify files outside the prompt, or
              otherwise do something a user would not expect from a prompt will
              be removed, and the account behind it suspended.
            </li>
            <li>
              Advertising, spam, or content whose purpose is to drive traffic
              elsewhere.
            </li>
          </List>

          <H3>Moderation</H3>
          <p>
            We may remove any theme, screenshot, or account that breaks these
            terms, or that we reasonably believe to be harmful — with or without
            notice, and at our discretion. If you find content that breaks these
            rules, please report it to the contact address above.
          </p>

          <H3>Liability</H3>
          <p>
            Themes are written by other users, not by us. We do not review every
            configuration before it appears, and we give no warranty that a
            theme is safe, correct, or fit for any purpose — you install
            community configurations at your own risk, and you are encouraged to
            read a configuration before applying it.
          </p>
          <p>
            To the extent permitted by law, we are not liable for damages
            arising from the use of this service, except for damages caused
            intentionally or by gross negligence, and except for liability that
            cannot be excluded by law, such as under the German Product
            Liability Act or for injury to life, body, or health.
          </p>

          <H3>Changes</H3>
          <p>
            These terms and the privacy policy may change as the project
            develops. The date at the top of this page shows when it was last
            revised. Significant changes affecting account holders will be
            announced by email or on the site.
          </p>

          <H3>Governing law</H3>
          <p>
            German law applies, without prejudice to any mandatory consumer
            protection rules of the country you live in.
          </p>
        </Section>
      </div>
    </main>
  );
}
