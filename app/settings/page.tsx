import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProfileSettings from "@/components/settings/profile-settings";
import ThemeManagement from "@/components/settings/theme-management";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/api/auth/signin/github");
  }

  // Fetch user with themes
  const user = await db.query.user.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
    with: {
      themes: {
        orderBy: (themes, { desc }) => [desc(themes.updatedAt)],
      },
    },
  });

  if (!user) {
    redirect("/api/auth/signin/github");
  }

  return (
    <main className="min-h-screen bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-ctp-text mb-2">Settings</h1>
          <p className="text-ctp-subtext0 mb-12">
            Manage your profile and themes
          </p>

          <div className="space-y-12">
            <ProfileSettings user={user} />
            <ThemeManagement themes={user.themes} />
          </div>
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  title: "Settings - Stellar",
  description: "Manage your Stellar profile and themes",
};
