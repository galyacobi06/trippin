import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { useLive, getKV, setKV } from './lib/db.js';
import { useTrips, useCurrentTripId, useTripData, setCurrentTrip } from './lib/trip.js';
import { Nav } from './components/Nav.jsx';
import { Today } from './screens/Today.jsx';
import { Plan } from './screens/Plan.jsx';
import { Tickets, TicketView } from './screens/Tickets.jsx';
import { Trip } from './screens/Trip.jsx';
import { Expenses } from './screens/Expenses.jsx';
import { PlaceView } from './screens/PlaceView.jsx';
import { Discover } from './screens/Discover.jsx';
import { Documents } from './screens/Documents.jsx';
import { Packing, RouteScreen, Emergency } from './screens/Extras.jsx';
import { Settings } from './screens/Settings.jsx';
import { Welcome } from './screens/Welcome.jsx';
import { Sheets } from './sheets/Sheets.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function parseHash() {
  const h = (location.hash || '#/today').slice(2).split('/');
  return { name: h[0] || 'today', id: h[1] ? decodeURIComponent(h[1]) : null };
}
export const go = (path) => { location.hash = '#/' + path; };

export function App() {
  const [route, setRoute] = useState(parseHash());
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToast] = useState('');
  const mode = useLive(() => getKV('mode', 'light'), [], 'light');
  const trips = useTrips();
  const storedId = useCurrentTripId();
  const tripId = storedId && trips.some((t) => t.id === storedId) ? storedId : trips[0]?.id;
  const data = useTripData(tripId);
  const [selDate, setSelDate] = useState(null);

  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.documentElement.dataset.mode = mode || 'light'; }, [mode]);
  useEffect(() => { if (tripId && storedId !== tripId) setCurrentTrip(tripId); }, [tripId]);

  const toast = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const open = useCallback((name, props = {}) => setSheet({ name, props }), []);
  const close = useCallback(() => setSheet(null), []);
  const setMode = (m) => setKV('mode', m);

  const ctx = { route, data, tripId, trips, mode, setMode, open, close, toast, selDate, setSelDate };

  if (trips === undefined) return null;
  if (!trips.length || !data.trip) {
    return <Ctx.Provider value={ctx}><div class="app"><Welcome /></div>{sheet && <Sheets sheet={sheet} />}</Ctx.Provider>;
  }

  const screens = {
    today: Today, plan: Plan, tickets: Tickets, ticket: TicketView, trip: Trip, expenses: Expenses,
    place: PlaceView, discover: Discover, docs: Documents, packing: Packing, route: RouteScreen, emergency: Emergency, settings: Settings
  };
  const Screen = screens[route.name] || Today;

  return (
    <Ctx.Provider value={ctx}>
      <div class="app">
        <Screen id={route.id} />
        <Nav active={route.name} />
        {sheet && <Sheets sheet={sheet} />}
        {toastMsg && <div class="toast" role="status">{toastMsg}</div>}
      </div>
    </Ctx.Provider>
  );
}
