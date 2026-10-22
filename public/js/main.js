import { clearInvite, initHome, setHomeBusy, showHomeError } from './home.js';
import { connectionLost, enterGame, gameError, initGame, isInGame } from './game.js';
import * as sound from './sound.js';

const socket = window.io();

const HOME_ERRORS = {
  notFound: 'Өрөө олдсонгүй! Холбоосоо шалгана уу.',
  full: 'Өрөө дүүрсэн байна!',
  banned: 'Та энэ өрөөнд орох эрхгүй байна!',
  tooFast: 'Түр хүлээгээд дахин оролдоно уу.',
  server: 'Серверт алдаа гарлаа. Дахин оролдоно уу.',
};

function show(screen) {
  document.getElementById('home').classList.toggle('hidden', screen !== 'home');
  document.getElementById('game').classList.toggle('hidden', screen !== 'game');
  document.body.classList.toggle('in-game', screen === 'game');
  window.scrollTo(0, 0);
}

function join(kind, profile) {
  sound.unlock();
  if (!socket.connected) {
    showHomeError('Сервертэй холбогдож чадсангүй. Түр хүлээгээд дахин оролдоно уу.');
    return;
  }
  setHomeBusy(true);
  socket.emit(kind, profile);
}

initHome({
  onPlay: (p) => join('play', p),
  onCreate: (p) => join('create', p),
});

initGame(socket, {
  onExit: () => {
    clearInvite();
    history.replaceState(null, '', '/');
    show('home');
  },
});

socket.on('joined', (data) => {
  setHomeBusy(false);
  show('game');
  enterGame(data);
});

socket.on('err', ({ k }) => {
  if (isInGame()) gameError(k);
  else {
    setHomeBusy(false);
    showHomeError(HOME_ERRORS[k] || HOME_ERRORS.server);
  }
});

socket.on('disconnect', () => {
  setHomeBusy(false);
  connectionLost();
});

document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
