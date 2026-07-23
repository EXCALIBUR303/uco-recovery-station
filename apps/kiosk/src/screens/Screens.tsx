import qrcode from 'qrcode-generator';
import { LANGUAGES, PHRASES, rupees, type LangCode } from '../i18n';
import type { Reason } from '../api';

type T = (typeof PHRASES)['en'];

export function LanguageScreen({ onPick }: { onPick: (l: LangCode) => void }) {
  return (
    <div class="screen">
      <h1>Choose your language</h1>
      <p style="margin-bottom:28px">भाषा निवडा · भाषा चुनें</p>
      {LANGUAGES.map((l) => (
        <button key={l.code} class="big-btn" onClick={() => onPick(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function QrSvg({ text }: { text: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  return <div class="qr-frame" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function QrScreen({ t, pairUrl }: { t: T; pairUrl: string }) {
  return (
    <div class="screen">
      <h1>{t.scanTitle}</h1>
      <p style="margin-bottom:22px">{t.scanBody}</p>
      <QrSvg text={pairUrl} />
    </div>
  );
}

export function PourScreen({ t, returning }: { t: T; returning: boolean }) {
  return (
    <div class="screen">
      <div class="badge">{returning ? t.returning : t.connected}</div>
      <h1>{t.pourTitle}</h1>
      <p>{t.pourBody}</p>
    </div>
  );
}

export function ProcessingScreen({ t }: { t: T }) {
  return (
    <div class="screen">
      <div class="spinner" />
      <h1>{t.verifying}</h1>
    </div>
  );
}

export function AcceptedScreen({ t, amountPaise }: { t: T; amountPaise: string }) {
  return (
    <div class="screen">
      <div class="mark ok">✓</div>
      <h1>{t.thankYou}</h1>
      <div class="amount">{rupees(amountPaise)}</div>
      <p>{t.paidAmount}</p>
    </div>
  );
}

export function RejectedScreen({ t, reason }: { t: T; reason: Reason }) {
  const reasonText =
    reason === 'not_oil'
      ? t.reason_not_oil
      : reason === 'water_contaminated'
        ? t.reason_water_contaminated
        : t.reason_low_quality;

  return (
    <div class="screen">
      <div class="mark bad">✕</div>
      <h1>{t.rejectedTitle}</h1>
      <h2>{reasonText}</h2>
      <p>{t.disposed}</p>
      {/* firm, but a warning rather than an accusation — some rejections
          are genuine mistakes (spec §3.7) */}
      <div class="warning">{t.warning}</div>
    </div>
  );
}

export function UnavailableScreen({ t, status }: { t: T; status: string }) {
  // Each cause reads differently so a technician checking the dashboard knows
  // which container needs emptying without visiting (spec §7.2).
  const message =
    status === 'drum_full'
      ? t.drumFull
      : status === 'reject_full'
        ? t.rejectFull
        : status === 'balance_zero'
          ? t.balanceZero
          : t.offline;

  return (
    <div class="screen">
      <div class="mark wait">!</div>
      <h1>{t.unavailableTitle}</h1>
      <p>{message}</p>
    </div>
  );
}
