import type { Booking, DB, Lang, MessageLog } from './types';
import { fmtDate, fmtTime, manilaHour, peso } from './dates';
import { poolLimit } from './pricing';
import { amountsFor } from './money';

/**
 * sendEmail()/sendSms() wrappers. In the demo they write to message_log (the admin "Outbox").
 * In production swap the bodies for Resend / Semaphore calls — callers don't change.
 * A failed send never throws into the booking flow.
 */
export interface Ctx { now: Date; actor: string; baseUrl: string }

export function sendEmail(db: DB, ctx: Ctx, m: { booking_id: string | null; to: string; template: string; subject: string; body: string }) {
  return log(db, ctx, { ...m, channel: 'email' });
}
export function sendSms(db: DB, ctx: Ctx, m: { booking_id: string | null; to: string; template: string; body: string; ownerAlert?: boolean }) {
  // No guest SMS between 9 PM and 7 AM (owner alerts are exempt) → queued until 7 AM.
  const h = manilaHour(ctx.now);
  const quiet = !m.ownerAlert && (h >= 21 || h < 7);
  return log(db, ctx, { ...m, channel: 'sms' }, quiet ? 'queued' : 'sent');
}

function log(db: DB, ctx: Ctx, m: { booking_id: string | null; to: string; template: string; subject?: string; body: string; channel: 'email' | 'sms' }, status: MessageLog['status'] = 'sent') {
  let error: string | null = null;
  if (!m.to) { status = 'failed'; error = 'No recipient'; }
  // Demo: simulate a provider failure for numbers ending in 0000 so the "resend" button can be tried.
  if (m.channel === 'sms' && /0{6}$/.test(m.to) && !m.template.startsWith('owner')) { status = 'failed'; error = 'Semaphore: invalid number (demo)'; }
  const entry: MessageLog = { id: rid(), booking_id: m.booking_id, channel: m.channel, template: m.template, to: m.to, subject: m.subject, body: m.body, status, error, sent_at: ctx.now.toISOString() };
  db.message_log.unshift(entry);
  return entry;
}
const rid = () => Math.random().toString(36).slice(2, 10);

export function bookingLink(ctx: Ctx, b: Booking) {
  return `${ctx.baseUrl}/b/?code=${b.code}&t=${b.guest_token}`;
}

function allotText(b: Booking, lang: Lang) {
  if (b.rooms_allowed === 2) return lang === 'fil' ? '2 kuwarto, 2 aircon' : '2 rooms, 2 aircons';
  const ac = b.aircon_choice === 'bedroom' ? (lang === 'fil' ? 'kuwarto' : 'bedroom') : 'sala';
  return lang === 'fil' ? `1 kuwarto, 1 aircon (${ac})` : `1 room, 1 aircon (${ac})`;
}

type Tpl = (db: DB, b: Booking, ctx: Ctx, extra?: Record<string, string>) => { subject: string; email: string; sms: string };

const T: Record<string, Record<Lang, Tpl>> = {
  booking_created: {
    en: (db, b, ctx) => ({
      subject: `Booking ${b.code}: send ₱${db.settings.downpayment_amount.toLocaleString()} GCash downpayment`,
      email: `Hi ${b.booker_name},\n\nWe're holding ${fmtDate(b.check_in_date)} – ${fmtDate(b.check_out_date)} for you until ${new Date(b.hold_expires_at!).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}.\n\nPlease send the ${peso(db.settings.downpayment_amount)} downpayment via GCash to ${db.settings.gcash_name} (${db.settings.gcash_number}) and upload the screenshot here:\n${bookingLink(ctx, b)}\n\nIf no proof is uploaded in ${db.settings.hold_hours} hours, the dates are released.`,
      sms: `TRC ${b.code}: Send ${peso(db.settings.downpayment_amount)} GCash in ${db.settings.hold_hours}h to hold dates. Upload proof: ${bookingLink(ctx, b)}`,
    }),
    fil: (db, b, ctx) => ({
      subject: `Booking ${b.code}: ipadala ang ₱${db.settings.downpayment_amount.toLocaleString()} GCash downpayment`,
      email: `Hi ${b.booker_name},\n\nNakareserba sa iyo ang ${fmtDate(b.check_in_date, 'fil')} – ${fmtDate(b.check_out_date, 'fil')} hanggang ${new Date(b.hold_expires_at!).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}.\n\nPakipadala ang ${peso(db.settings.downpayment_amount)} downpayment sa GCash ni ${db.settings.gcash_name} (${db.settings.gcash_number}) at i-upload ang screenshot dito:\n${bookingLink(ctx, b)}\n\nKung walang proof sa loob ng ${db.settings.hold_hours} oras, mare-release ang mga petsa.`,
      sms: `TRC ${b.code}: Magpadala ng ${peso(db.settings.downpayment_amount)} GCash sa loob ng ${db.settings.hold_hours}h. I-upload: ${bookingLink(ctx, b)}`,
    }),
  },
  payment_received: {
    en: (_db, b, ctx) => ({ subject: `Payment received – ${b.code}`, email: `Hi ${b.booker_name},\n\nWe received your payment proof. The owner will verify it and confirm your booking soon.\n\n${bookingLink(ctx, b)}`, sms: '' }),
    fil: (_db, b, ctx) => ({ subject: `Natanggap ang bayad – ${b.code}`, email: `Hi ${b.booker_name},\n\nNatanggap namin ang proof of payment mo. Ive-verify ito ng may-ari at kukumpirmahin ang booking mo.\n\n${bookingLink(ctx, b)}`, sms: '' }),
  },
  hold_expired: {
    en: (_db, b) => ({ subject: `Booking ${b.code} expired`, email: `Hi ${b.booker_name},\n\nWe didn't receive a payment proof in time, so ${fmtDate(b.check_in_date)} – ${fmtDate(b.check_out_date)} has been released. You're welcome to book again.`, sms: `TRC ${b.code}: No payment received, your dates were released. You may book again anytime.` }),
    fil: (_db, b) => ({ subject: `Nag-expire ang booking ${b.code}`, email: `Hi ${b.booker_name},\n\nWalang natanggap na proof of payment sa takdang oras, kaya na-release na ang ${fmtDate(b.check_in_date, 'fil')} – ${fmtDate(b.check_out_date, 'fil')}. Puwede kang mag-book ulit.`, sms: `TRC ${b.code}: Walang bayad na natanggap, na-release ang petsa mo. Puwede kang mag-book ulit.` }),
  },
  payment_rejected: {
    en: (_db, b, ctx, x) => ({ subject: `Payment issue – ${b.code}`, email: `Hi ${b.booker_name},\n\nWe couldn't verify your payment: ${x?.reason}\n\nPlease upload a new proof here: ${bookingLink(ctx, b)}`, sms: `TRC ${b.code}: Payment not verified (${x?.reason}). Re-upload: ${bookingLink(ctx, b)}` }),
    fil: (_db, b, ctx, x) => ({ subject: `Problema sa bayad – ${b.code}`, email: `Hi ${b.booker_name},\n\nHindi namin ma-verify ang bayad mo: ${x?.reason}\n\nPaki-upload ulit dito: ${bookingLink(ctx, b)}`, sms: `TRC ${b.code}: Hindi na-verify ang bayad (${x?.reason}). I-upload ulit: ${bookingLink(ctx, b)}` }),
  },
  approved: {
    en: (db, b, ctx) => { const a = amountsFor(db, b); return {
      subject: `Confirmed! ${b.code} – The Restful Corner`,
      email: `Hi ${b.booker_name},\n\nYour stay is CONFIRMED.\n\nCheck-in: ${fmtDate(b.check_in_date)}, ${fmtTime(db.settings.checkin_time)}\nCheck-out: ${fmtDate(b.check_out_date)}, ${fmtTime(db.settings.checkout_time)}\nGuests: ${b.declared_guests} (+${b.infants} infants)\nAllotment: ${allotText(b, 'en')} · Pool limit ${poolLimit(db.settings, b.rooms_allowed)}\nBalance due at check-in: ${peso(a.balance)}\n\nIMPORTANT: Every guest must register at the condo lobby with a valid ID. Only names on your guest list can go up. Each undeclared guest = ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)}.\n\nHouse rules: ${ctx.baseUrl}/rules/\nYour booking & invoice: ${bookingLink(ctx, b)}`,
      sms: `TRC ${b.code} CONFIRMED ${b.check_in_date} 2PM. ${allotText(b, 'en')}. Bal ${peso(a.balance)}. All guests bring valid ID. ${bookingLink(ctx, b)}`,
    }; },
    fil: (db, b, ctx) => { const a = amountsFor(db, b); return {
      subject: `Kumpirmado! ${b.code} – The Restful Corner`,
      email: `Hi ${b.booker_name},\n\nKUMPIRMADO ang stay mo.\n\nCheck-in: ${fmtDate(b.check_in_date, 'fil')}, ${fmtTime(db.settings.checkin_time)}\nCheck-out: ${fmtDate(b.check_out_date, 'fil')}, ${fmtTime(db.settings.checkout_time)}\nBisita: ${b.declared_guests} (+${b.infants} sanggol)\nAllotment: ${allotText(b, 'fil')} · Pool limit ${poolLimit(db.settings, b.rooms_allowed)}\nBalanseng babayaran sa check-in: ${peso(a.balance)}\n\nMAHALAGA: Lahat ng bisita ay kailangang magparehistro sa lobby ng condo gamit ang valid ID. Ang mga pangalan lang sa guest list ang makakaakyat. Bawat hindi idineklarang bisita = ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)}.\n\nHouse rules: ${ctx.baseUrl}/rules/\nBooking at invoice: ${bookingLink(ctx, b)}`,
      sms: `TRC ${b.code} KUMPIRMADO ${b.check_in_date} 2PM. ${allotText(b, 'fil')}. Bal ${peso(a.balance)}. Magdala ng valid ID lahat. ${bookingLink(ctx, b)}`,
    }; },
  },
  declined: {
    en: (_db, b, _c, x) => ({ subject: `Booking ${b.code} declined`, email: `Hi ${b.booker_name},\n\nSorry, we can't accommodate this booking. Reason: ${x?.reason}${x?.refund ? '\n\nYour downpayment will be refunded via GCash.' : ''}`, sms: `TRC ${b.code}: Sorry, booking declined. ${x?.refund ? 'Your downpayment will be refunded via GCash.' : ''}` }),
    fil: (_db, b, _c, x) => ({ subject: `Hindi natanggap ang booking ${b.code}`, email: `Hi ${b.booker_name},\n\nPasensya, hindi namin matatanggap ang booking na ito. Dahilan: ${x?.reason}${x?.refund ? '\n\nIbabalik ang downpayment mo sa GCash.' : ''}`, sms: `TRC ${b.code}: Pasensya, hindi natanggap ang booking. ${x?.refund ? 'Ibabalik ang downpayment sa GCash.' : ''}` }),
  },
  guests_changed: {
    en: (db, b, ctx) => ({ subject: `Guest change requested – ${b.code}`, email: `Hi ${b.booker_name},\n\nWe received your request to change your guests to ${b.pending_change?.declared_guests}. The owner will review it. Updated balance after approval: ${peso(amountsFor(db, b, b.pending_change?.declared_guests).balance)}.\n\n${bookingLink(ctx, b)}`, sms: '' }),
    fil: (db, b, ctx) => ({ subject: `Hiling na pagbabago ng bisita – ${b.code}`, email: `Hi ${b.booker_name},\n\nNatanggap namin ang hiling mong gawing ${b.pending_change?.declared_guests} ang bisita. Rerepasuhin ito ng may-ari. Bagong balanse kapag naaprubahan: ${peso(amountsFor(db, b, b.pending_change?.declared_guests).balance)}.\n\n${bookingLink(ctx, b)}`, sms: '' }),
  },
  reminder: {
    en: (db, b, ctx) => ({ subject: `See you tomorrow! ${b.code}`, email: `Hi ${b.booker_name},\n\nReminder: check-in tomorrow ${fmtDate(b.check_in_date)} at ${fmtTime(db.settings.checkin_time)}.\nBalance due: ${peso(amountsFor(db, b).balance)}\nAll ${b.declared_guests} guests must bring a valid ID for lobby registration. Your guest count is final — each undeclared guest is ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)}.\n\n${bookingLink(ctx, b)}`, sms: `TRC ${b.code}: Check-in tmrw 2PM. Bal ${peso(amountsFor(db, b).balance)}. All guests bring valid ID. Count is final; extra guest ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)} each.` }),
    fil: (db, b, ctx) => ({ subject: `Kita tayo bukas! ${b.code}`, email: `Hi ${b.booker_name},\n\nPaalala: check-in bukas ${fmtDate(b.check_in_date, 'fil')} ng ${fmtTime(db.settings.checkin_time)}.\nBalanse: ${peso(amountsFor(db, b).balance)}\nLahat ng ${b.declared_guests} bisita ay magdala ng valid ID para sa lobby. Final na ang bilang ng bisita — bawat hindi idineklara ay ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)}.\n\n${bookingLink(ctx, b)}`, sms: `TRC ${b.code}: Check-in bukas 2PM. Bal ${peso(amountsFor(db, b).balance)}. Magdala ng valid ID lahat. Sobrang bisita ${peso(db.settings.undeclared_penalty + db.settings.extra_guest_fee)} bawat isa.` }),
  },
  checked_out: {
    en: (db, b) => { const a = amountsFor(db, b); return { subject: `Thank you for staying! ${b.code}`, email: `Hi ${b.booker_name},\n\nThank you for staying at The Restful Corner!\n\nReceipt\n${a.lines.map((l) => `- ${l.label}: ${peso(l.amount)}`).join('\n')}\nTotal: ${peso(a.charges)}\nPaid: ${peso(a.paid)}\n\nWe'd love a review on our Facebook page: https://www.facebook.com/therestfulcorner`, sms: '' }; },
    fil: (db, b) => { const a = amountsFor(db, b); return { subject: `Salamat sa pag-stay! ${b.code}`, email: `Hi ${b.booker_name},\n\nSalamat sa pag-stay sa The Restful Corner!\n\nResibo\n${a.lines.map((l) => `- ${l.label}: ${peso(l.amount)}`).join('\n')}\nKabuuan: ${peso(a.charges)}\nBayad: ${peso(a.paid)}\n\nSana ay mag-iwan ka ng review sa aming Facebook page: https://www.facebook.com/therestfulcorner`, sms: '' }; },
  },
};

/** Send a guest template on the given channels in the booking's language. */
export function notifyGuest(db: DB, ctx: Ctx, b: Booking, template: keyof typeof T, channels: ('email' | 'sms')[], extra?: Record<string, string>) {
  const t = T[template][b.language](db, b, ctx, extra);
  if (channels.includes('email') && b.booker_email) sendEmail(db, ctx, { booking_id: b.id, to: b.booker_email, template, subject: t.subject, body: t.email });
  if (channels.includes('sms') && t.sms) sendSms(db, ctx, { booking_id: b.id, to: b.booker_mobile, template, body: t.sms });
}

/** Owner alerts (English). */
export function notifyOwner(db: DB, ctx: Ctx, b: Booking | null, template: string, text: string, channels: ('email' | 'sms')[]) {
  const link = b ? `${ctx.baseUrl}/admin/booking/?id=${b.id}` : `${ctx.baseUrl}/admin/`;
  if (channels.includes('email')) sendEmail(db, ctx, { booking_id: b?.id ?? null, to: db.settings.owner_email, template: 'owner_' + template, subject: `[TRC] ${text}`, body: `${text}\n\n${link}` });
  if (channels.includes('sms')) sendSms(db, ctx, { booking_id: b?.id ?? null, to: db.settings.owner_mobile, template: 'owner_' + template, body: `[TRC] ${text} ${link}`.slice(0, 300), ownerAlert: true });
}
