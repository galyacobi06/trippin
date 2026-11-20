import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { TicketSheet } from './TicketSheet.jsx';
import { PlaceSheet } from './PlaceSheet.jsx';
import { ExpenseSheet } from './ExpenseSheet.jsx';
import { ItemSheet, DaySheet } from './ItemSheet.jsx';
import { WeatherSheet } from './WeatherSheet.jsx';
import { SignInSheet } from './SignInSheet.jsx';

export function Sheet({ title, children, onClose }) {
  const { close } = useApp();
  const done = onClose || close;
  return (
    <div class="backdrop" onClick={done}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="grab" />
        <div class="between">
          <h2 class="h2" style={{ fontSize: '28px' }}>{title}</h2>
          <button class="icon-btn" aria-label="Close" onClick={done} style={{ border: 'none', background: 'var(--soft)' }}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddMenu({ date }) {
  const { open } = useApp();
  const opt = (icon, title, sub, fn) => (
    <button class="list-item" onClick={fn}>
      <span class="ic"><Icon name={icon} size={18} /></span>
      <span class="grow"><span class="title" style={{ display: 'block' }}>{title}</span><span class="muted small">{sub}</span></span>
      <Icon name="chev" size={16} />
    </button>
  );
  return (
    <Sheet title="Add">
      <div class="stack" style={{ marginTop: '14px' }}>
        {opt('upload', 'Ticket or booking', 'PDF or screenshot: details are read for you', () => open('ticket', { date }))}
        {opt('link', 'Place', 'Paste a Google Maps link or type a name', () => open('place', { date }))}
        {opt('euro', 'Expense', 'What you spent, where', () => open('expense', { date }))}
        {opt('calendar', 'Plan item', 'Lunch, a visit, a meeting point…', () => open('item', { item: { date } }))}
      </div>
    </Sheet>
  );
}

export function Sheets({ sheet }) {
  const map = { add: AddMenu, ticket: TicketSheet, place: PlaceSheet, expense: ExpenseSheet, item: ItemSheet, day: DaySheet, weather: WeatherSheet, signin: SignInSheet };
  const C = map[sheet.name];
  return C ? <C {...sheet.props} /> : null;
}

export function Chips({ options, value, onChange, labels = {}, icons = true }) {
  return (
    <div class="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
      {options.map((o) => (
        <button type="button" class={'btn btn-sm' + (value === o ? ' btn-primary' : '')} aria-pressed={value === o} onClick={() => onChange(o)} style={{ height: '40px', paddingLeft: icons ? '10px' : '14px' }}>
          {icons && <Icon name={o} size={16} />}{labels[o] || o}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, id, children }) {
  return <div class="field"><label for={id}>{label}</label>{children}</div>;
}
