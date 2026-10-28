const PX_PER_MINUTE = 2;
const DAY_MINUTES = 1440;
const state = { data: null, date: null, hidden: new Set(JSON.parse(localStorage.getItem('hk-guide-hidden') || '[]')), sort: localStorage.getItem('hk-guide-sort') || 'number' };
const $ = (selector) => document.querySelector(selector);
const hktDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date(value));
const time = (value) => new Intl.DateTimeFormat('en-HK', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

function save() { localStorage.setItem('hk-guide-hidden', JSON.stringify([...state.hidden])); }
function hktMinutes(value) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return h * 60 + m;
}
function formatHour(h) {
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${suffix}`;
}
function format12(mins) {
  const clamped = Math.max(0, Math.min(mins, DAY_MINUTES));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
function renderChannels() {
  const list = $('#channel-list'); list.replaceChildren();
  state.data.channels.forEach(channel => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" ${state.hidden.has(channel.id) ? '' : 'checked'}> <strong>${channel.number}</strong> ${channel.name}`;
    label.querySelector('input').onchange = event => { event.target.checked ? state.hidden.delete(channel.id) : state.hidden.add(channel.id); save(); renderGuide(); };
    list.append(label);
  });
}
function renderGuide() {
  const guide = $('#guide'); guide.replaceChildren();
  const shell = guide.parentElement;
  const channels = state.data.channels.filter(c => !state.hidden.has(c.id)).sort((a, b) => state.sort === 'name' ? a.name.localeCompare(b.name) : a.number - b.number);
  const programmes = state.data.programmes.filter(p => hktDate(p.start) === state.date);
  const hasProgrammes = channels.length > 0 && programmes.length > 0;
  $('#empty').hidden = hasProgrammes;
  if (!hasProgrammes) {
    setupTimelineSlider(shell, guide);
    return;
  }

  const ruler = document.createElement('div');
  ruler.className = 'timeline-ruler';
  const rulerLabel = document.createElement('div');
  rulerLabel.className = 'ruler-label';
  rulerLabel.textContent = 'CHANNEL';
  ruler.append(rulerLabel);
  const rulerTrack = document.createElement('div');
  rulerTrack.className = 'track ruler-track';
  rulerTrack.style.width = `${DAY_MINUTES * PX_PER_MINUTE}px`;
  for (let h = 0; h < 24; h++) {
    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.style.left = `${h * 60 * PX_PER_MINUTE}px`;
    hour.textContent = formatHour(h);
    rulerTrack.append(hour);
  }
  ruler.append(rulerTrack);
  guide.append(ruler);

  const today = hktDate(new Date());
  const isToday = state.date === today;

  channels.forEach(channel => {
    const row = document.createElement('article'); row.className = 'channel';
    const info = document.createElement('div'); info.className = 'channel-info';
    info.innerHTML = `${channel.icon ? `<img class="channel-icon" src="${channel.icon}" alt="">` : ''}<span class="number">${channel.number}</span><span class="channel-name">${channel.name}</span>`;
    row.append(info);

    const track = document.createElement('div'); track.className = 'track';
    track.style.width = `${DAY_MINUTES * PX_PER_MINUTE}px`;

    const shows = programmes.filter(p => p.channel === channel.id);
    shows.forEach(show => {
      const item = document.createElement('div');
      item.className = `programme type-${show.category}`;
      const startMin = hktMinutes(show.start);
      let stopMin = hktMinutes(show.stop);
      if (stopMin <= startMin) stopMin += DAY_MINUTES;
      const clampedStop = Math.min(stopMin, DAY_MINUTES);
      const left = startMin * PX_PER_MINUTE;
      const width = Math.max((clampedStop - startMin) * PX_PER_MINUTE, 18);
      item.style.left = `${left}px`;
      item.style.width = `${width}px`;
      if (show.originalTitle) item.title = show.originalTitle;

      item.innerHTML = `<div class="programme-time">${time(show.start)} – ${time(show.stop)}</div><div class="programme-title"></div>${show.description ? '<p class="programme-description"></p>' : ''}`;
      const titleEl = item.querySelector('.programme-title');
      titleEl.textContent = show.title;
      if (show.translated) {
        const badge = document.createElement('span');
        badge.className = 'translated';
        badge.textContent = 'EN';
        titleEl.append(badge);
      }
      const desc = item.querySelector('.programme-description');
      if (desc) desc.textContent = show.description;
      track.append(item);
    });

    if (isToday) {
      const nowMin = hktMinutes(new Date().toISOString());
      const nowLine = document.createElement('div');
      nowLine.className = 'now-line';
      nowLine.style.left = `${nowMin * PX_PER_MINUTE}px`;
      track.append(nowLine);
    }

    row.append(track);
    guide.append(row);
  });

  setupTimelineSlider(shell, guide);
}
function changeDate(days) { const d = new Date(`${state.date}T12:00:00+08:00`); d.setUTCDate(d.getUTCDate() + days); state.date = hktDate(d); $('#date').value = state.date; renderGuide(); }
function setupTimelineSlider(shell, guide) {
  const slider = $('#timeline');
  const timeLabel = $('#timeline-time');
  const updateTime = (scrollLeft) => {
    const mins = Math.round(scrollLeft / PX_PER_MINUTE);
    timeLabel.textContent = format12(Math.max(0, Math.min(mins, DAY_MINUTES)));
  };
  const measure = () => {
    const maxScroll = Math.max(0, shell.scrollWidth - shell.clientWidth);
    slider.max = maxScroll;
    const current = parseInt(slider.value, 10) || 0;
    if (current > maxScroll) slider.value = maxScroll;
  };
  shell.scrollLeft = 0;
  slider.value = 0;
  requestAnimationFrame(() => { measure(); updateTime(0); });
  if (shell._ro) shell._ro.disconnect();
  const ro = new ResizeObserver(measure);
  ro.observe(shell);
  shell._ro = ro;
  shell.onscroll = () => { slider.value = shell.scrollLeft; updateTime(shell.scrollLeft); };
  slider.oninput = () => { shell.scrollLeft = parseInt(slider.value, 10) || 0; updateTime(shell.scrollLeft); };
}
async function init() {
  const response = await fetch('data/guide.json'); state.data = await response.json();
  const today = hktDate(new Date()); const dates = [...new Set(state.data.programmes.map(p => hktDate(p.start)))].sort();
  state.date = dates.includes(today) ? today : dates[0]; $('#date').value = state.date; $('#sort').value = state.sort;
  $('#updated').textContent = `Updated ${new Intl.DateTimeFormat('en-HK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Hong_Kong' }).format(new Date(state.data.generatedAt))} HKT`;
  $('#date').onchange = event => { state.date = event.target.value; renderGuide(); }; $('#previous').onclick = () => changeDate(-1); $('#next').onclick = () => changeDate(1); $('#today').onclick = () => { state.date = dates.includes(today) ? today : dates[0]; $('#date').value = state.date; renderGuide(); };
  $('#sort').onchange = event => { state.sort = event.target.value; localStorage.setItem('hk-guide-sort', state.sort); renderGuide(); };
  $('#manage').onclick = () => { renderChannels(); $('#channel-dialog').showModal(); }; $('#all').onclick = () => { state.hidden.clear(); save(); renderChannels(); renderGuide(); }; $('#none').onclick = () => { state.data.channels.forEach(c => state.hidden.add(c.id)); save(); renderChannels(); renderGuide(); };
  renderGuide();
}
init().catch(() => { $('#updated').textContent = 'Could not load guide data.'; });
