const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const ipc = ipcMain

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 700,
    transparent: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })
  win.setResizable(true);
  win.loadFile('index.html')

  ipc.on('closeApp', () => {
    win.close();
  })

  ipc.on('minimizeApp', () => {
    win.minimize();
  })

  ipc.on('maximizeApp', () => {
    if (!win.isMaximized()) {
      win.maximize();          
    } else {
      win.restore();
    }
  })
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
})