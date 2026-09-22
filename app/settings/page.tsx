import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DeleteAccount from "@/components/settings/delete-account";
import ProfileSettings from "@/components/settings/profile-settings";
import ThemeManagement from "@/components/settings/theme-management";
import UsernameSettings from "@/components/settings/username-settings";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login?callbackUrl=/settings");
  }

  // Fetch user with themes and versions
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
    with: {
      themes: {
        orderBy: (themes, { desc }) => [desc(themes.updatedAt)],
        with: {
          versions: {
            orderBy: (versions, { desc }) => [desc(versions.createdAt)],
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/login?callbackUrl=/settings");
  }

  // Fetch color schemes
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-ctp-text mb-2">Settings</h1>
          <p className="text-ctp-subtext0 mb-12">
            Manage your profile and themes
          </p>

          <div className="space-y-12">
            <ProfileSettings user={user} />
            <UsernameSettings
              user={user}
              hasPublishedThemes={user.themes.length > 0}
            />
            <ThemeManagement
              author={user.username}
              themes={user.themes}
              colorSchemes={colorSchemes}
            />
            <DeleteAccount user={user} themeCount={user.themes.length} />
          </div>
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  // The root layout's title.template appends " - Stellar" automatically.
  title: "Settings",
  description: "Manage your Stellar profile and themes",
};
