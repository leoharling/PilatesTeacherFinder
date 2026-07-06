import { notFound } from 'next/navigation';

// Catch-all for unmatched localized routes (e.g. /de/gibberish) so they
// render the localized not-found page instead of the global 404.
export default function CatchAllPage(): never {
  notFound();
}
