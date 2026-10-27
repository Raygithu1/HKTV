const state = { data: null, date: null, hidden: new Set(JSON.parse(localStorage.getItem('hk-guide-hidden') || '[]')), sort: localStorage.getItem('hk-guide-sort') || 'number' };
const $ = (selector) => document.querySelector(selector);
const hktDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date(value));
const time = (value) => new Intl.DateTimeFormat('en-HK', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

function save() { localStorage.setItem('hk-guide-hidden', JSON.stringify([...state.hidden])); }
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
  const channels = state.data.channels.filter(c => !state.hidden.has(c.id)).sort((a,b) => state.sort === 'name' ? a.name.localeCompare(b.name) : a.number - b.number);
  const programmes = state.data.programmes.filter(p => hktDate(p.start) === state.date);
  channels.forEach(channel => {
    const row = document.createElement('article'); row.className = 'channel';
    const shows = programmes.filter(p => p.channel === channel.id);
    row.innerHTML = `<div class="channel-info">${channel.icon ? `<img class="channel-icon" src="${channel.icon}" alt="">` : ''}<span class="number">${channel.number}</span><span class="channel-name">${channel.name}</span></div><div class="programmes"></div>`;
    const slot = row.querySelector('.programmes');
    if (!shows.length) slot.innerHTML = '<div class="programme"><span class="programme-time">No programme details available</span></div>';
    shows.forEach(show => { const item = document.createElement('div'); item.className = `programme type-${show.category}`; item.innerHTML = `<div class="programme-time">${time(show.start)} – ${time(show.stop)}</div><div class="programme-title"></div>${show.description ? '<p class="programme-description"></p>' : ''}`; item.querySelector('.programme-title').textContent = show.title; const desc = item.querySelector('.programme-description'); if (desc) desc.textContent = show.description; slot.append(item); });
    guide.append(row);
  });
  $('#empty').hidden = channels.length > 0 && programmes.length > 0;
}
function changeDate(days) { const d = new Date(`${state.date}T12:00:00+08:00`); d.setUTCDate(d.getUTCDate() + days); state.date = hktDate(d); $('#date').value = state.date; renderGuide(); }
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
