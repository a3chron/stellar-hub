import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UploadForm from "@/components/upload-form";
import { auth } from "@/lib/auth";

export default async function UploadPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">Publish Theme</h1>
        <p className="mb-8 text-ctp-subtext0">
          Upload your theme for the community to use
        </p>
        <UploadForm />
      </div>
    </main>
  );
}
