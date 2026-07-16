import { app, BrowserWindow, ipcMain, session, desktopCapturer } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { startDeepgramStream, sendAudioChunk, stopDeepgramStream } from './deepgram'
import { generateMinutes } from './mistral'
import { exportTranscriptToDocx, exportMinutesToDocx } from './exportDocx'

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

if (!app.isPackaged) {
  const sessionDataPath = join(app.getPath('temp'), 'raja-dharmaraj-minutes-notes-taker-session-data')
  mkdirSync(sessionDataPath, { recursive: true })
  app.setPath('sessionData', sessionDataPath)
}

try {
  process.loadEnvFile(join(app.getAppPath(), '.env'))
} catch {
  // .env not present yet — the app will report missing-key errors when used.
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Enables navigator.mediaDevices.getDisplayMedia({ audio: true }) in the
  // renderer to return system/meeting audio via loopback (Windows), so we
  // can mix it with the microphone stream before sending to Deepgram.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' })
    })
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('recording:start', () => {
  if (!mainWindow) return { ok: false, error: 'No window available' }

  startDeepgramStream(
    (segment) => mainWindow?.webContents.send('transcript:update', segment),
    (status, message) => mainWindow?.webContents.send('status:change', status, message)
  )
  return { ok: true }
})

ipcMain.handle('recording:stop', () => {
  stopDeepgramStream()
  return { ok: true }
})

ipcMain.on('audio:chunk', (_event, chunk: ArrayBuffer) => {
  sendAudioChunk(Buffer.from(chunk))
})

ipcMain.handle('minutes:generate', async (_event, transcript) => {
  try {
    const minutes = await generateMinutes(transcript)
    return { ok: true, minutes }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('export:transcript', async (_event, transcript, meetingTitle) => {
  try {
    return await exportTranscriptToDocx(transcript, meetingTitle)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('export:minutes', async (_event, minutes, meetingTitle) => {
  try {
    return await exportMinutesToDocx(minutes, meetingTitle)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})
