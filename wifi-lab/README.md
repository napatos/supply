# Wi-Fi Reality Lab

This experiment is isolated under `wifi-lab/` so the existing SupplyFlow application remains unchanged.

## Live page

`https://napatos.github.io/supply/wifi-lab/`

## Real test procedure

1. On Windows, open Command Prompt.
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
- SSID, band, channel, radio type, adapter name, and link rates come from the pasted Windows output.
- Approximate dBm is calculated from Windows signal quality and is not a calibrated direct RSSI value.
- The colored area between captured points is inverse-distance interpolation.
- One stationary laptop measures one position; it does not directly image the whole room.

Do not publish physical addresses, AP BSSIDs, or device MAC addresses from raw command output.