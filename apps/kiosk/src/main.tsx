import { render } from 'preact';
import { App } from './app';
import { JoinPage } from './JoinPage';
import './styles.css';

// One bundle, two entry points decided by the URL:
//   /                -> the kiosk touchscreen flow (on the machine)
//   /join/<token>    -> the phone sign-up page (on the depositor's phone)
const joinMatch = window.location.pathname.match(/^\/join\/(.+)$/);

render(
  joinMatch ? <JoinPage token={decodeURIComponent(joinMatch[1])} /> : <App />,
  document.getElementById('app')!,
);
