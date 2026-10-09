const { app, BrowserWindow, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

function insideApp(relativePath) {
  const root = path.resolve(__dirname, '..', 'dist');
  const file = path.resolve(root, `.${decodeURIComponent(relativePath)}`);
  return file.startsWith(root + path.sep) || file === path.join(root, 'index.html') ? file : path.join(root, 'index.html');
}

async function createWindow() {
  await protocol.handle('app', (request) => {
    const pathname = new URL(request.url).pathname;
    const file = insideApp(pathname === '/' ? '/index.html' : pathname);
    return net.fetch(pathToFileURL(file).toString());
  });

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#0a1120',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  await window.loadURL('app://eonis/');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
