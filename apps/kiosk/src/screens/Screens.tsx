import { useEffect, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import {
  LANGUAGES,
  PHRASES,
  kilos,
  rupees,
  rupeesWhole,
  type LangCode,
} from '../i18n';
import type { Reason } from '../api';

type T = (typeof PHRASES)['en'];

/* ===========================================================================
   Shared chrome
   =========================================================================== */

/**
 * The machine plate. Permanent, and deliberately the first thing rendered: a
 * depositor and a passing technician both need the station's identity, its rate
 * and its condition before anything else. Kept in English in every language —
 * it reads as the machine's stamped nameplate, not as interface copy.
 */
export function MachinePlate({
  machine,
  ratePaise,
  status,
}: {
  machine: string;
  ratePaise: number | null;
  status: string;
}) {
  const ready = status === 'in_service';
  const lamp = ready ? 'ready' : status === 'offline' ? 'bad' : 'warn';

  return (
    <div class="plate">
      <div class="plate-cell">
        <div class="plate-k">Station</div>
        <div class="plate-v">{machine}</div>
      </div>
      <div class="plate-cell">
        <div class="plate-k">Rate</div>
        <div class="plate-v rate">
          {ratePaise != null ? `₹${Math.round(ratePaise / 100)}/kg` : '—'}
        </div>
      </div>
      <div class="plate-cell">
        <div class="plate-k">Status</div>
        <div class="plate-status">
          <span class={`lamp ${lamp}`} />
          <span class="plate-v">
            {ready ? 'READY' : status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Position in the flow. Kiosk anxiety is mostly "how much longer is this?" —
 * four named stations answer it at a glance, and the filled track reads as
 * progress without borrowing a consumer progress bar.
 */
export function StepSpine({
  t,
  active,
  lastLabel,
}: {
  t: T;
  active: number;
  /** Overrides the final station's label once the outcome is known. While the
   *  deposit is still in progress that station reads "Paid" — it's the reason
   *  to keep going. On a rejection it must not keep claiming that. */
  lastLabel?: string;
}) {
  const steps = [t.stepLanguage, t.stepConnect, t.stepPour, lastLabel ?? t.stepResult];
  return (
    <div class="spine">
      {steps.map((label, i) => (
        <div
          key={label}
          class={`spine-step${i < active ? ' done' : ''}${i === active ? ' now' : ''}`}
        >
          <div class="spine-n">{String(i + 1).padStart(2, '0')}</div>
          <div class="spine-t">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ===========================================================================
   Count-up
   Money should land, not blink into existence. Animating the final figure is
   honest — the number is already settled, we're only pacing its arrival.
   =========================================================================== */
function useCountUp(target: number, duration = 900): number {
  // Seeded with the REAL figure, never 0. requestAnimationFrame is suspended
  // whenever the WebView stops painting — backgrounded, throttled, or in a
  // battery-saver mode, all of which happen on the used tablets this ships to.
  // Seeding at 0 meant a suspended rAF left the payout frozen at "₹0.00" while
  // the docket underneath read "₹60.00": the one lie this product must never
  // tell. The animation is now a decoration layered over an already-correct
  // number, not the thing that produces it.
  const [value, setValue] = useState(target);
  const raf = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || target <= 0) {
      setValue(target);
      return;
    }

    const start = Date.now();
    setValue(0);

    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      // decelerate — fast off the mark, settles gently onto the real figure
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(tick);

    // Belt and braces: setTimeout still fires when rAF is throttled to nothing,
    // so the correct figure is guaranteed on screen either way.
    const settle = window.setTimeout(() => setValue(target), duration + 400);

    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}

/* ===========================================================================
   01 — IDLE / LANGUAGE
   Two columns. The left is an offer: this machine has a few seconds to tell a
   passer-by what it does and what it pays, so the rate is set as architecture
   rather than as a caption. The right is the only interaction on screen.
   =========================================================================== */
export function LanguageScreen({
  t,
  ratePaise,
  onPick,
}: {
  t: T;
  ratePaise: number | null;
  onPick: (l: LangCode) => void;
}) {
  return (
    <div class="stage">
      <div class="split">
        <div class="split-offer enter">
          <p class="stencil lit">Used cooking oil · buy-back station</p>

          <h1 class="speak offer-title">{t.offerTitle}</h1>

          <div class="rate-block">
            <p class="stencil">{t.rateLabel}</p>
            <div class="rate-figure">
              <span class="rate-num">
                {ratePaise != null ? rupeesWhole(ratePaise) : '—'}
              </span>
              <span class="rate-unit">{t.perKg}</span>
            </div>
          </div>

          <ul class="proof">
            <li>{t.proofPaid}</li>
            <li>{t.proofWeighed}</li>
            <li>{t.proofFast}</li>
          </ul>
        </div>

        <div class="split-choice enter">
          <p class="stencil">{t.chooseLanguage}</p>
          <div class="lang-list">
            {LANGUAGES.map((l, i) => (
              <button
                key={l.code}
                class="lang-btn"
                onClick={() => onPick(l.code)}
                lang={l.code}
              >
                <span class="lang-index">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span class="lang-name">{l.label}</span>
                  <span class="lang-roman">{l.roman}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   02 — CONNECT
   The old copy was "Scan to begin", which never explained why a stranger should
   take out their phone. The QR exists so the money has somewhere to land, so
   the screen says exactly that.
   =========================================================================== */
function QrSvg({ text }: { text: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  return <div class="qr-plate" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function QrScreen({ t, pairUrl }: { t: T; pairUrl: string }) {
  return (
    <div class="stage">
      <div class="enter">
        <p class="stencil lit">02 · Connect</p>
        <h1 class="speak">{t.scanTitle}</h1>
        <p class="say">{t.scanBody}</p>

        <div class="qr-row">
          <QrSvg text={pairUrl} />
          <div>
            <ol class="steps-list">
              <li>
                <span class="steps-n">01</span>
                <span class="steps-t">{t.scanStep1}</span>
              </li>
              <li>
                <span class="steps-n">02</span>
                <span class="steps-t">{t.scanStep2}</span>
              </li>
              <li>
                <span class="steps-n">03</span>
                <span class="steps-t">{t.scanStep3}</span>
              </li>
            </ol>
            <p class="fine">{t.upiPrivacy}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   03 — POUR
   Two jobs the old screen didn't do: point at the physical intake (first-timers
   don't know where it is), and state what's accepted. Every rejection avoided
   here is an offence a person doesn't accrue toward a blacklist — that's
   fairness, not just throughput.
   =========================================================================== */
export function PourScreen({
  t,
  returning,
  ratePaise,
}: {
  t: T;
  returning: boolean;
  ratePaise: number | null;
}) {
  return (
    <div class="stage">
      <div class="enter">
        <div>
          <span class="chip">{returning ? t.returning : t.connected}</span>
        </div>

        <div class="pour-wrap">
          <div class="pour-copy">
            <h1 class="speak">{t.pourTitle}</h1>
            <p class="say">{t.pourBody}</p>
            <p class="stencil lit" style="margin-top:14px">{t.pourAim}</p>

            <div class="guard">
              <p class="stencil">{t.guardLabel}</p>
              <p>{t.guardText}</p>
            </div>
          </div>

          {/* Physical wayfinding: cascading chevrons read as flow direction,
              aimed at the funnel below the screen. */}
          <div class="aperture" aria-hidden="true">
            <div class="chev c1" />
            <div class="chev c2" />
            <div class="chev c3" />
          </div>
        </div>

        {ratePaise != null && (
          <p class="stencil" style="margin-top:26px">
            {t.rateLabel} · ₹{Math.round(ratePaise / 100)} {t.perKg}
          </p>
        )}
      </div>
    </div>
  );
}

/* ===========================================================================
   04 — PROCESSING
   These three gates are the backend classifier, in order: weight, then
   capacitance, then colour (api/src/kiosk/sensor-classifier.ts). So the
   animation isn't decorative filler — it's a truthful account of what the
   machine is doing during the most anxious moment in the flow.
   =========================================================================== */
export function ProcessingScreen({ t }: { t: T }) {
  return (
    <div class="stage">
      <div class="enter">
        {/* Still step 03 on the spine — the assay is part of the pour, not a
            station of its own. The eyebrow must not disagree with the spine. */}
        <p class="stencil lit">03 · Assay</p>
        <h1 class="speak">{t.verifying}</h1>

        <div class="assay">
          <div class="gate g1">
            <span class="gate-lamp" />
            <span class="gate-name">{t.gateWeight}</span>
          </div>
          <div class="gate g2">
            <span class="gate-lamp" />
            <span class="gate-name">{t.gatePurity}</span>
          </div>
          <div class="gate g3">
            <span class="gate-lamp" />
            <span class="gate-name">{t.gateQuality}</span>
          </div>
          <div class="sweep" />
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   05a — ACCEPTED
   The docket is the point of this screen. Previously it showed the payout and
   nothing else, so someone who had just poured 2.4 kg had no way to check the
   machine weighed them fairly. For a product whose whole promise is honest
   measurement, the arithmetic belongs on screen: weight × rate = paid.
   =========================================================================== */
export function AcceptedScreen({
  t,
  amountPaise,
  weightDeltaG,
  ratePaise,
}: {
  t: T;
  amountPaise: string;
  weightDeltaG: number;
  ratePaise: number | null;
}) {
  const target = Number(amountPaise);
  const shown = useCountUp(target);

  return (
    <div class="stage">
      <div class="enter">
        <div class="result-head">
          <span class="lamp ready" />
          <span class="result-label paid">{t.paidLabel}</span>
        </div>

        <div class="payout">{rupees(Math.round(shown))}</div>
        <p class="say">
          {t.thankYou} · {t.paidAmount}
        </p>

        <div class="docket">
          <div class="docket-row">
            <span class="docket-k">{t.docketWeight}</span>
            <span class="docket-v">{kilos(weightDeltaG)}</span>
          </div>
          {ratePaise != null && (
            <div class="docket-row">
              <span class="docket-k">{t.docketRate}</span>
              <span class="docket-v">{rupees(ratePaise)} / kg</span>
            </div>
          )}
          <div class="docket-row total">
            <span class="docket-k">{t.docketTotal}</span>
            <span class="docket-v">{rupees(amountPaise)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   05b — REJECTED
   The reason becomes the headline: "Not accepted" alone tells someone nothing
   they can act on. Guidance is concrete, and the account warning stays a
   warning rather than an accusation — some rejections are honest mistakes, and
   these strikes accumulate toward a real blacklist.
   =========================================================================== */
export function RejectedScreen({
  t,
  reason,
  weightDeltaG,
}: {
  t: T;
  reason: Reason;
  weightDeltaG: number;
}) {
  const reasonText =
    reason === 'not_oil'
      ? t.reason_not_oil
      : reason === 'water_contaminated'
        ? t.reason_water_contaminated
        : t.reason_low_quality;

  return (
    <div class="stage">
      <div class="enter">
        <div class="result-head">
          <span class="lamp bad" />
          <span class="result-label no">{t.rejectedTitle}</span>
        </div>

        <h1 class="speak">{reasonText}</h1>

        <div class="reason-box">
          <p class="stencil">
            {t.pouredLabel} · {kilos(weightDeltaG)}
          </p>
          <p>{t.disposed}</p>
        </div>

        {/* Guidance and the account warning belong together: one is how to
            avoid the other. Splitting them into separate boxes made the warning
            read as a detached scolding. */}
        <div class="notice">
          <p class="stencil" style="margin-bottom:6px">{t.nextTimeLabel}</p>
          <p>{t.guardText}</p>
          <p class="notice-warn">{t.warning}</p>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   06 — UNAVAILABLE
   Each cause reads differently so a technician checking the dashboard knows
   which container needs emptying without visiting (spec §7.2). The station ID
   is repeated here because this is the screen someone photographs to report a
   fault.
   =========================================================================== */
export function UnavailableScreen({
  t,
  status,
  machine,
}: {
  t: T;
  status: string;
  machine: string;
}) {
  const message =
    status === 'drum_full'
      ? t.drumFull
      : status === 'reject_full'
        ? t.rejectFull
        : status === 'balance_zero'
          ? t.balanceZero
          : t.offline;

  const isFault = status === 'offline' || status === 'reject_full';

  return (
    <div class="stage">
      <div class="enter">
        <div class={`hazard${isFault ? ' bad' : ''}`} aria-hidden="true" />
        <p class="stencil">
          {machine} · {status.replace(/_/g, ' ').toUpperCase()}
        </p>
        <h1 class="speak">{t.unavailableTitle}</h1>
        <p class="say">{message}</p>
      </div>
    </div>
  );
}
