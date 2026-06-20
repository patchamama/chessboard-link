/* eslint-disable */

const KEYBOARDCLASS = 'ccvkeyboard';

function addClasses() {
  // Sonderbehandlung für Anmeldedialog von chess.com
  const oldUsernameInput = document.getElementById('username');
  const oldPasswordInput = document.getElementById('password');
  let elementsFound = false;

  // Registriert uns bei allen Texteingabefeldern
  const textInputs = document.querySelectorAll('input:not(.ccvprocessed)');
  for (const input of textInputs) {
    input.classList.add('ccvprocessed');
    elementsFound = true;
    if (input.type === 'text' || input.type === 'password' || input.type === 'textarea' || input.type === 'email') {
      input.classList.add(KEYBOARDCLASS);
      input.setAttribute('data-kioskboard-specialcharacters', 'true');
      if (oldUsernameInput && input.type === 'email' && input.id === '') {
        input.type = 'text';
        input.addEventListener('change', (event) => {
          oldUsernameInput.value = event.target.value;
        });
      } else if (oldUsernameInput && input.type === 'password' && input.id === '') {
        input.addEventListener('change', (event) => {
          oldPasswordInput.value = event.target.value;
        });
      } else if (input.type === 'email') {
        input.classList.add(KEYBOARDCLASS);
        input.setAttribute('data-kioskboard-specialcharacters', 'true');
        input.type = 'text';
      }
    } else if (input.type === 'number') {
      input.classList.add(KEYBOARDCLASS);
      input.setAttribute('data-kioskboard-type', 'numpad');
    }
  }
  return elementsFound;
}

function removeFocus() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => input.blur());
}

function ccInstallVirtualKeyboard(lang, resUrl) {
  const elementsFound = addClasses();
  let layoutJson;
  switch (lang) {
    case 'de':
      layoutJson = 'kioskboard-keys-german.json';
      break;
    case 'fr':
      layoutJson = 'kioskboard-keys-french.json';
      break;
    case 'es':
      layoutJson = 'kioskboard-keys-spanish.json';
      break;
    default:
      layoutJson = 'kioskboard-keys-english.json';
  }

  if (elementsFound) {
    removeFocus();
    KioskBoard.run('input.' + KEYBOARDCLASS, {
      keysArrayOfObjects: null,
      keysJsonUrl: resUrl + '/' + layoutJson,
      language: lang,
      capsLockActive: false,
      allowRealKeyboard: true,
      allowMobileKeyboard: true,
    });
  }
}

const isPhoenix = true;
