'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '../../lib/api';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  // Auth always uses the report register, whichever role signed in last.
  useEffect(() => {
    document.documentElement.dataset.register = 'report';
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = isSignup
        ? await api.register({ displayName, email, password, phone: phone || undefined })
        : await api.login(email, password);
      auth.save(res.token, res.user);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="login-wrap">
      {/* Left: what this thing actually is. Numbers are real programme figures. */}
      <aside className="login-aside">
        <div>
          <div className="login-kicker">Used cooking oil recovery</div>
          <h2 className="login-lede">
            Oil goes in. Money comes out. Everything gets counted.
          </h2>
          <p className="login-sub">
            Kitchens and households pour used cooking oil into a station, the sensors
            verify it, and the depositor is paid to their UPI within seconds. This is
            where the fleet, the payouts and the rentals are managed.
          </p>
        </div>

        <div className="login-figures">
          <div>
            <div className="fk">Recovered</div>
            <div className="fv">41.4<span className="fu"> kg</span></div>
          </div>
          <div>
            <div className="fk">Paid out</div>
            <div className="fv">₹1,036</div>
          </div>
          <div>
            <div className="fk">Stations</div>
            <div className="fv">2</div>
          </div>
        </div>
      </aside>

      {/* Right: the form. */}
      <div className="login-form-col">
        <form className="login-card" onSubmit={submit}>
          <h1>{isSignup ? 'Rent a machine' : 'Sign in'}</h1>
          <p>
            {isSignup
              ? 'Create an account to rent a station and fund payouts.'
              : 'Operations, rentals and settlement.'}
          </p>

          <div className="seg" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? 'active' : ''}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? 'active' : ''}
              onClick={() => switchMode('signup')}
            >
              Create account
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {isSignup && (
            <label className="field">
              <span>Name or business</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.currentTarget.value)}
                placeholder="Green Foods Pvt Ltd"
                autoComplete="organization"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete={isSignup ? 'email' : 'username'}
              required
            />
          </label>

          {isSignup && (
            <label className="field">
              <span>Phone (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? 'At least 8 characters' : ''}
              required
            />
          </label>

          <button className="btn" type="submit" disabled={busy}>
            {busy
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>

          <p className="switch">
            {isSignup ? 'Already have an account? ' : 'Renting a machine? '}
            <button type="button" onClick={() => switchMode(isSignup ? 'signin' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          {!isSignup && (
            <p className="hint">
              admin@uco.local · admin12345
              <br />
              renter@uco.local · renter12345
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
