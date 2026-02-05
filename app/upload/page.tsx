import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import UploadForm from "@/components/upload-form";
import { headers } from "next/headers";

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
        <h1 className="text-4xl font-bold mb-8">Upload Theme</h1>
        <UploadForm />
      </div>
    </main>
  );
}
