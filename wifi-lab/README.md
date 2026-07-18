# Device Reality Lab

This experiment is isolated under `wifi-lab/`, so the existing SupplyFlow application remains unchanged.

## Live page

`https://napatos.github.io/supply/wifi-lab/`

## Included tools

- Local camera preview
- Front/back camera switching where supported
- Local photo capture and download
- Live microphone level meter
- Screen sharing preview
- Local screen recording and WebM download
- Browser capability audit
- Device, screen, CPU-thread and memory-hint information
- Browser Network Information estimates
- Battery status where the browser exposes it
- Explicit location request and display
- Verified Windows Wi-Fi output parser
- Real signal-point capture and interpolated room heatmap
- Wi-Fi CSV export
- Local event log

## Privacy boundary

This is a static GitHub Pages application. Camera, microphone, screen and location access require an explicit browser permission prompt. The app does not contain an upload endpoint and does not transmit those streams or measurements to ChatGPT.

A local preview does **not** allow ChatGPT or the repository owner to see the user. Photos and recordings remain in the browser until the user downloads them.

## Windows Wi-Fi procedure

1. Open Command Prompt.
2. Run:

   ```bat
   netsh wlan show interfaces
   ```

3. Paste the complete output into the page.
4. Press **Parse real data**.
5. Select the laptop's physical position on the room grid.
6. Press **Capture point**.
7. Move the laptop, rerun the command, paste the new result, and capture another position.
8. Repeat at 8–15 positions for a useful room map.

## Truth boundary

- The pasted Windows `Signal` percentage is a real adapter reading.
- SSID, band, channel, radio type, adapter name and link rates come from the pasted Windows output.
- Approximate dBm is calculated from Windows signal quality and is not calibrated direct RSSI.
- Browser effective type, downlink and RTT are coarse browser estimates.
- The colored Wi-Fi area between captured points is inverse-distance interpolation.
- One stationary laptop measures one position; it does not directly image the whole room.
- Screen capture availability depends on the browser and operating system.

Do not publish physical addresses, AP BSSIDs or device MAC addresses from raw command output.