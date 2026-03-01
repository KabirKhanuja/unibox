"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_BASE } from "@/lib/utils";

export default function LoginPage() {
  const redirect = (path: string) => {
    window.location.href = `${API_BASE}${path}`;
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Connect your email account to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Gmail */}
          <Button
            className="w-full"
            onClick={() => redirect("/auth/gmail")}
          >
            Continue with Gmail
          </Button>

          {/* Zoho */}
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => redirect("/auth/zoho")}
          >
            Continue with Zoho
          </Button>



          {/* Outlook */}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => redirect("/auth/outlook")}
          >
            Continue with Outlook
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}