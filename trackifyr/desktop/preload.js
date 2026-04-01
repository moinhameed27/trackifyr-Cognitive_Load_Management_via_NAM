const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('trackifyr', {
  getConfig: () => ipcRenderer.invoke('trackifyr:config'),
  setSessionToken: (token) =>
    ipcRenderer.invoke('trackifyr:setSessionToken', { token: token == null ? '' : String(token) }),
  setTrackingApiBase: (base) => ipcRenderer.invoke('trackifyr:setTrackingApiBase', { base }),
  setContentSize: (payload) => ipcRenderer.invoke('trackifyr:setContentSize', payload),
  signin: (payload) => ipcRenderer.invoke('trackifyr:signin', payload),
  me: (payload) => ipcRenderer.invoke('trackifyr:me', payload),
  signout: (payload) => ipcRenderer.invoke('trackifyr:signout', payload),
  trackingStart: (payload) => ipcRenderer.invoke('trackifyr:tracking:start', payload),
  trackingStop: () => ipcRenderer.invoke('trackifyr:tracking:stop'),
  trackingSetFilter: (payload) => ipcRenderer.invoke('trackifyr:tracking:setFilter', payload),
  trackingGetState: () => ipcRenderer.invoke('trackifyr:tracking:getState'),
  onTracking: (callback) => {
    const fn = (_event, data) => {
      callback(data)
    }
    ipcRenderer.on('trackifyr:tracking', fn)
    return () => ipcRenderer.removeListener('trackifyr:tracking', fn)
  },
})
