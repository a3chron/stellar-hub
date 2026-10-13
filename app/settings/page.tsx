import { desc, eq } from "drizzle-orm";
import { Eye, UserRound } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ScrollToHash from "@/components/scroll-to-hash";
import CliSessions from "@/components/settings/cli-sessions";
import DeleteAccount from "@/components/settings/delete-account";
import Drafts from "@/components/settings/drafts";
import ProfileSettings from "@/components/settings/profile-settings";
import SettingsNav from "@/components/settings/settings-nav";
import { buttonClass } from "@/components/settings/settings-section";
import ThemeManagement from "@/components/settings/theme-management";
import UsernameSettings from "@/components/settings/username-settings";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliTokens, themeDrafts } from "@/lib/db/schema";
import { purgeExpiredDrafts, serializeDrafts } from "@/lib/drafts";
import { getAuthorGroups } from "@/lib/theme-groups";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login?callbackUrl=/settings");
  }

  // The user with their themes. Of the versions only what the list shows:
  // the configs aren't needed here, and every theme's every config used to
  // be shipped to the browser with the page.
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
    with: {
      themes: {
        orderBy: (themes, { desc }) => [desc(themes.updatedAt)],
        with: {
          versions: {
            columns: { version: true, versionNotes: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/login?callbackUrl=/settings");
  }

  // The profile sections get the user row alone - passing `user` would
  // serialize the themes into the page once more for each of them.
  const { themes, ...profile } = user;

  // Fetch color schemes
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });
  const groups = await getAuthorGroups(user.id);

  await purgeExpiredDrafts(user.id);
  const drafts = await serializeDrafts(
    await db
      .select()
      .from(themeDrafts)
      .where(eq(themeDrafts.userId, user.id))
      .orderBy(desc(themeDrafts.updatedAt)),
    { includeConfig: false },
  );

  const cliLogins = await db
    .select({
      id: cliTokens.id,
      label: cliTokens.label,
      createdAt: cliTokens.createdAt,
      lastUsedAt: cliTokens.lastUsedAt,
    })
    .from(cliTokens)
    .where(eq(cliTokens.userId, user.id))
    .orderBy(desc(cliTokens.createdAt));

  return (
    <main className="bg-ctp-base">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-ctp-surface1 bg-ctp-surface0 sm:size-16">
            {profile.image ? (
              <Image
                src={profile.image}
                alt=""
                fill
                sizes="64px"
                // OAuth avatars come from hosts images.remotePatterns doesn't
                // list (Google, GitLab), same as on the profile page.
                unoptimized
                className="object-cover"
              />
            ) : (
              <UserRound
                aria-hidden="true"
                className="absolute inset-0 m-auto size-1/2 text-ctp-overlay0"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ctp-text sm:text-3xl">
              Settings
            </h1>
            <p className="truncate text-sm text-ctp-subtext0">
              {profile.name}{" "}
              <span className="font-mono text-ctp-subtext1">
                @{profile.username}
              </span>
            </p>
          </div>
          <Link
            href={`/${profile.username}`}
            className={`${buttonClass("secondary", "sm")} shrink-0`}
          >
            <Eye aria-hidden="true" className="size-4" />
            {/* Icon only below 360px, where the label would run into the
                heading - still read out by screen readers. */}
            <span className="sr-only min-[360px]:not-sr-only sm:hidden">
              Public profile
            </span>
            <span className="hidden sm:inline">View public profile</span>
          </Link>
        </header>

        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <SettingsNav
            drafts={drafts.length}
            themes={themes.length}
            cliLogins={cliLogins.length}
          />

          <div className="mt-6 min-w-0 space-y-6 lg:mt-0">
            <ProfileSettings user={profile} />
            <UsernameSettings
              user={profile}
              hasPublishedThemes={themes.length > 0}
            />
            <Drafts drafts={drafts} />
            <ThemeManagement
              author={profile.username}
              themes={themes}
              colorSchemes={colorSchemes}
              groups={groups}
            />
            <CliSessions logins={cliLogins} />
            <DeleteAccount user={profile} themeCount={themes.length} />
          </div>
        </div>
      </div>
      {/* After the sections, so /settings#cli-logins and #drafts find them. */}
      <ScrollToHash />
    </main>
  );
}

export const metadata = {
  // The root layout's title.template appends " - Stellar" automatically.
  title: "Settings",
  description: "Manage your Stellar profile and themes",
};
