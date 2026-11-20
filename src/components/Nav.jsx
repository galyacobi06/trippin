import Icon from './Icon.jsx';
import { useApp } from '../app.jsx';

const tabFor = { today: 'today', plan: 'plan', place: 'plan', discover: 'today', tickets: 'tickets', ticket: 'tickets', trip: 'trip', expenses: 'trip', docs: 'trip', packing: 'trip', route: 'trip', emergency: 'trip', settings: 'trip' };

export function Nav({ active }) {
  const { open } = useApp();
  const tab = tabFor[active] || 'today';
  const T = (key, label, icon) => (
    <a href={'#/' + key} class={tab === key ? 'on' : ''} aria-current={tab === key ? 'page' : undefined}>
      <Icon name={icon} size={22} fill={tab === key && icon === 'home' ? 'currentColor' : undefined} />{label}
    </a>
  );
  return (
    <nav class="nav" aria-label="Main">
      {T('today', 'Today', 'home')}
      {T('plan', 'Plan', 'calendar')}
      <button class="fab" aria-label="Add ticket, place, expense or plan item" onClick={() => open('add')}><Icon name="plus" size={24} stroke={2} /></button>
      {T('tickets', 'Tickets', 'ticket')}
      {T('trip', 'Trip', 'bag')}
    </nav>
  );
}
