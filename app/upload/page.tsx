import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UploadForm from "@/components/upload-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function UploadPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/api/auth/signin");
  }

  // Fetch color schemes for the select dropdown
  const colorSchemes = await db.query.colorSchemes.findMany({
    orderBy: (colorSchemes, { asc }) => [asc(colorSchemes.name)],
  });

  return (
    <main className="min-h-screen bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-ctp-text mb-2">
            Publish Theme
          </h1>
          <p className="mb-8 text-ctp-subtext0">
            Share your Starship theme with the community
          </p>
          <UploadForm colorSchemes={colorSchemes} />
        </div>
      </div>
    </main>
  );
}

export const metadata = {
  title: "Upload Theme - Stellar",
  description: "Share your Starship theme with the community",
};
