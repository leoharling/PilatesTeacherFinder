import { Resend } from 'resend';

// Sends Sandra a notification for each new inquiry. No-op when RESEND_API_KEY
// or INQUIRY_NOTIFY_EMAIL is unset — inquiries are still stored in Supabase.
export async function sendInquiryNotification(args: {
  teacherDisplayName: string;
  studioName: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.log('email skipped (RESEND_API_KEY/INQUIRY_NOTIFY_EMAIL unset)');
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Pilates Teacher Finder <onboarding@resend.dev>',
      to,
      subject: `Neue Studio-Anfrage für ${args.teacherDisplayName}`,
      text: [
        `Neue Anfrage über den Pilates Teacher Finder:`,
        ``,
        `Trainer: ${args.teacherDisplayName}`,
        `Studio: ${args.studioName}${args.location ? ` (${args.location})` : ''}`,
        `Kontakt: ${args.contactName}`,
        `E-Mail: ${args.email}`,
        args.phone ? `Telefon: ${args.phone}` : '',
        ``,
        `Nachricht:`,
        args.message,
        ``,
        `Alle Anfragen: /admin/anfragen`,
      ]
        .filter((line) => line !== '')
        .join('\n'),
    });
  } catch (err) {
    console.error('inquiry email failed (inquiry is stored anyway)', err);
  }
}
