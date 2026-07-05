import { redirect } from 'next/navigation'

// The document upload flow now lives inside the Schedule page
// (Edit Mode → Import from a document). Keep this route as a redirect
// so any existing bookmarks land in the right place.
export default function UploadRedirect() {
  redirect('/schedule')
}
