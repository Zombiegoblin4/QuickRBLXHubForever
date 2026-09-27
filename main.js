// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;
let configPath;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    resizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Window controls
  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });
}

app.whenReady().then(() => {
  configPath = path.join(app.getPath('userData'), 'config.json');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Pickers
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-exe', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Executables', extensions: ['exe'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// ONLY .rbxl files now (NOT .rbxlx)
ipcMain.handle('pick-place', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Roblox Place (.rbxl only)', extensions: ['rbxl'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// Copy place file to server.rbxl location
ipcMain.handle('copy-to-server-rbxl', async (event, sourcePath) => {
  try {
    const localRobloxPath = path.join(os.homedir(), 'AppData', 'Local', 'Roblox');
    const serverRbxlPath = path.join(localRobloxPath, 'server.rbxl');
    
    // Ensure directory exists
    if (!fs.existsSync(localRobloxPath)) {
      fs.mkdirSync(localRobloxPath, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, serverRbxlPath);
    
    return { success: true, destPath: serverRbxlPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// run-cmd using exec (simple commands)
ipcMain.handle('run-cmd', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, { windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ? stdout.toString() : "",
        stderr: stderr ? stderr.toString() : "",
        error: error ? error.message : null
      });
    });
  });
});

// spawn-studio: fire-and-forget (Studio is a long-running server, we don't wait for it to close)
ipcMain.handle('spawn-studio', async (event, exePath, args) => {
  try {
    if (!fs.existsSync(exePath)) {
      return { error: `Executable not found: ${exePath}`, stdout: '', stderr: '', code: null };
    }

    const child = spawn(exePath, args, {
      detached: true,   // Let Studio run independently
      stdio: 'ignore'   // Don't pipe stdio - we don't wait for it
    });
    child.unref();  // Don't keep Electron alive waiting for Studio

    return { stdout: `Studio launched (PID ${child.pid})`, stderr: '', code: 0 };

  } catch (err) {
    return { error: err.message, stdout: '', stderr: '', code: null };
  }
});

// Config save/load
ipcMain.handle('save-config', (event, data) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('load-config', () => {
  try {
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath));
  } catch (err) {
    return null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});