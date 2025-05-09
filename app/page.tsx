import { redirect } from "next/navigation"
import { isPreviewMode } from "@/lib/environment-detection"

// Force dynamic rendering
export const dynamic = "force-dynamic"

export default function Home() {
  // CRITICAL FIX: In preview mode, use a simple client-side redirect
  // This avoids the server-side redirect that's causing the error
  if (isPreviewMode()) {
    console.log("[Root Page] Preview mode detected, rendering client-side redirect")
    return (
      <html>
        <head>
          <meta httpEquiv="refresh" content="0;url=/dashboard" />
        </head>
        <body>
          <p>Redirecting to dashboard...</p>
          <script dangerouslySetInnerHTML={{ __html: `window.location.href = "/dashboard";` }} />
        </body>
      </html>
    )
  }

  // For non-preview mode, use the standard Next.js redirect
  // This won't be reached in preview mode
  console.log("[Root Page] Redirecting to dashboard")
  redirect("/dashboard")
}
