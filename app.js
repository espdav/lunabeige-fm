(function () {
  'use strict';

  var WORKER_URL = 'https://lunabeige-beehiiv.davex270.workers.dev/';
  var audio = document.getElementById('stream');
  var player = document.getElementById('radio-player');
  var playButton = document.getElementById('play-toggle');
  var muteButton = document.getElementById('mute-toggle');
  var volumeControl = document.getElementById('volume');
  var volumeWrap = document.querySelector('.volume-control');
  var statusPill = document.getElementById('station-status');
  var statusDot = document.getElementById('status-dot');
  var shareButton = document.getElementById('share-button');
  var spotifyButton = document.getElementById('spotify-button');
  var volume = 0.7;
  var lastVolume = volume;
  audio.volume = volume;

  shareButton.addEventListener('click', function () {
    var url = window.location.href;
    var shareText = '🎧 Sto ascoltando Lunabeige FM, la radio per chi crea. Premi play e lasciati ispirare 👇 ' + url;
    var dummy = document.createElement('textarea');
    dummy.value = shareText;
    dummy.setAttribute('readonly', '');
    dummy.style.position = 'fixed';
    dummy.style.opacity = '0';
    document.body.appendChild(dummy);
    dummy.select();
    try { document.execCommand('copy'); } catch (error) { /* Clipboard non disponibile: l'alert conferma comunque l'azione. */ }
    document.body.removeChild(dummy);
    window.alert('Link copiato negli appunti, ora condividilo con i tuoi amici! 🎶');
  });

  function updatePlayerState(playing) {
    player.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-label', playing ? 'Metti in pausa lo stream' : 'Riproduci lo stream');
    statusPill.textContent = playing ? 'Live' : 'Offline';
    statusPill.classList.toggle('live', playing);
    statusDot.classList.toggle('is-live', playing);
  }

  playButton.addEventListener('click', function () {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.play().catch(function () { updatePlayerState(false); });
  });
  audio.addEventListener('play', function () { updatePlayerState(true); });
  audio.addEventListener('pause', function () { updatePlayerState(false); });
  audio.addEventListener('ended', function () { updatePlayerState(false); });
  muteButton.addEventListener('click', function () {
    if (audio.volume > 0) {
      lastVolume = audio.volume;
      audio.volume = 0;
      volumeControl.value = 0;
      volumeWrap.classList.add('is-muted');
      muteButton.setAttribute('aria-label', 'Attiva audio');
    } else {
      audio.volume = lastVolume || 0.7;
      volumeControl.value = Math.round(audio.volume * 100);
      volumeWrap.classList.remove('is-muted');
      muteButton.setAttribute('aria-label', 'Disattiva audio');
    }
  });
  volumeControl.addEventListener('input', function (event) {
    var next = Number(event.target.value) / 100;
    audio.volume = next;
    if (next > 0) lastVolume = next;
    volumeWrap.classList.toggle('is-muted', next === 0);
    muteButton.setAttribute('aria-label', next === 0 ? 'Attiva audio' : 'Disattiva audio');
  });

  function setClock() {
    var now = new Date();
    var time = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(now);
    var date = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(now).replace('.', '');
    document.getElementById('clock-time').textContent = time;
    document.getElementById('clock-date').textContent = date;
    document.querySelector('.clock').dateTime = now.toISOString();
    document.getElementById('player-updated').dateTime = now.toISOString();
  }
  setClock();
  window.setInterval(setClock, 1000);

  // Costruisce un link di ricerca Spotify (nessuna API, nessuna chiave, nessun account developer).
  function updateSpotifyLink(title, artist) {
    if (!spotifyButton) return;
    var query = (artist + ' ' + title).trim();
    if (!query) {
      spotifyButton.href = 'https://open.spotify.com/search';
      return;
    }
    spotifyButton.href = 'https://open.spotify.com/search/' + encodeURIComponent(query);
  }

  function setTrack(title, artist, live) {
    title = typeof title === 'string' ? title.trim() : '';
    artist = typeof artist === 'string' ? artist.trim() : '';
    var invalidArtist = /^(sconosciuto|unknown|n\/a|n\.a\.)$/i.test(artist);
    var invalidTitle = /^(in attesa del prossimo brano|lunabeige)$/i.test(title);
    if (!title || !artist || invalidArtist || invalidTitle) return;
    document.getElementById('track-title').textContent = title;
    document.getElementById('track-artist').textContent = artist;
    updateSpotifyLink(title, artist);
    window.requestAnimationFrame(updateMarquees);
    if (live !== null && typeof live !== 'undefined') {
      statusPill.textContent = live ? 'Live' : 'Offline';
      statusPill.classList.toggle('live', live);
      statusDot.classList.toggle('is-live', live);
    }
  }

  function readSong(data) {
    if (Array.isArray(data)) data = data[0];
    var song = data && (data.current_song || data.currentSong || data.song || data);
    if (Array.isArray(song)) song = song[0];
    if (!song || typeof song !== 'object') return null;
    var nestedSong = song.song && typeof song.song === 'object' ? song.song : null;
    var title = song.title || song.name || song.track || (nestedSong && (nestedSong.title || nestedSong.name)) || '';
    var artist = song.artist || song.interpret || song.author || (nestedSong && (nestedSong.artist || nestedSong.interpret || nestedSong.author)) || '';
    if (artist && typeof artist === 'object') artist = artist.name || artist.title || artist.artist || '';
    if (title && typeof title === 'object') title = title.name || title.title || '';
    if (typeof song.song === 'string' && !title) title = song.song;
    if (title && artist) {
      var lowerTitle = title.toLowerCase();
      var lowerArtist = artist.toLowerCase();
      if (lowerTitle.indexOf(lowerArtist + ' - ') === 0 || lowerTitle.indexOf(lowerArtist + ' — ') === 0) title = title.slice(artist.length + 3).trim();
    }
    var invalidArtist = !artist || /^(sconosciuto|unknown|n\/a|n\.a\.)$/i.test(String(artist).trim());
    var invalidTitle = !title || /^(in attesa del prossimo brano|lunabeige)$/i.test(String(title).trim());
    return !invalidTitle && !invalidArtist ? { title: String(title).trim(), artist: String(artist).trim() } : null;
  }

  function updateMarquees() {
    document.querySelectorAll('.track-viewport').forEach(function (viewport) {
      var text = viewport.querySelector('span');
      if (!text) return;
      viewport.classList.remove('is-overflowing');
      text.style.removeProperty('--marquee-distance');
      text.style.removeProperty('--marquee-duration');
      if (text.scrollWidth > viewport.clientWidth + 1) {
        var distance = text.scrollWidth - viewport.clientWidth;
        text.style.setProperty('--marquee-distance', distance + 'px');
        text.style.setProperty('--marquee-duration', Math.max(8, distance / 18 + 7) + 's');
        viewport.classList.add('is-overflowing');
      }
    });
  }
  var marqueeResizeObserver = new ResizeObserver(updateMarquees);
  document.querySelectorAll('.track-viewport').forEach(function (viewport) { marqueeResizeObserver.observe(viewport); });
  window.addEventListener('resize', updateMarquees);
  updateMarquees();
  function readLive(data) {
    if (!data || typeof data !== 'object') return null;
    var fields = [data.online, data.is_online, data.live, data.isLive, data.on_air, data.onAir, data.current_song && data.current_song.on_air];
    for (var i = 0; i < fields.length; i += 1) if (typeof fields[i] === 'boolean') return fields[i];
    return null;
  }
  function refreshMetadata() {
    var endpoints = ['https://api.laut.fm/station/lunabeige/current_song', 'https://api.laut.fm/station/lunabeige'];
    Promise.any(endpoints.map(function (url) { return fetch(url, { headers: { Accept: 'application/json' } }).then(function (response) { if (!response.ok) throw new Error('metadata'); return response.json(); }); })).then(function (data) {
      var song = readSong(data); var live = readLive(data);
      if (song) setTrack(song.title, song.artist, live === null ? true : live);
    }).catch(function () {});
  }
  refreshMetadata();
  window.setInterval(refreshMetadata, 20000);

  var form = document.getElementById('newsletter-form');
  var email = document.getElementById('email');
  var subscribeButton = document.getElementById('subscribe-button');
  var error = document.getElementById('newsletter-error');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!email.checkValidity()) { email.reportValidity(); return; }
    subscribeButton.disabled = true;
    email.disabled = true;
    subscribeButton.innerHTML = '<span class="spinner" aria-label="Invio in corso"></span>';
    error.hidden = true;
    fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim() }) })
      .then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { if (!response.ok) throw new Error(data.error || 'Qualcosa è andato storto.'); return data; }); })
      .then(function () { subscribeButton.classList.add('success'); subscribeButton.textContent = 'Grazie sei iscritto!'; email.value = ''; })
      .catch(function (err) { email.disabled = false; subscribeButton.disabled = false; subscribeButton.textContent = 'Iscriviti a Lunabeige'; error.textContent = err.message || 'Errore di connessione. Riprova.'; error.hidden = false; });
  });
}());
