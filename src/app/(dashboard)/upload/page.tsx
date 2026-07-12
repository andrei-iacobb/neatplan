import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Document Upload',
}

// The document upload flow now lives inside the Schedule page
// (Edit Mode → Import from a document). Keep this route as a redirect
// so any existing bookmarks land in the right place.
export default function UploadRedirect() {
  redirect('/schedule')
}
