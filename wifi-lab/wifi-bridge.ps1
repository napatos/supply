# ============================================================
# Wi-Fi Auto-Fetcher (wifi-bridge.ps1)
# Writes live Windows Wi-Fi data to Desktop\wifi-data.json
# ============================================================

$ErrorActionPreference = 'Stop'
$outputPath = Join-Path $env:USERPROFILE 'Desktop\wifi-data.json'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Wi-Fi bridge started"
Write-Host "Output: $outputPath"
Write-Host "Press Ctrl+C to stop."

while ($true) {
    try {
        $raw = (& netsh wlan show interfaces 2>&1 | Out-String)

        if ($raw -match 'location permission' -or $raw -match 'WlanQueryInterface returns error 5') {
            throw 'Windows blocked WLAN information. Turn on Location services and run PowerShell as Administrator.'
        }

        function Read-Field([string]$label) {
            $match = [regex]::Match(
                $raw,
                "(?im)^\s*" + [regex]::Escape($label) + "\s*:\s*(.+?)\s*$"
            )
            if ($match.Success) { return $match.Groups[1].Value.Trim() }
            return $null
        }

        $state = Read-Field 'State'
        $ssid = Read-Field 'SSID'
        $signalText = Read-Field 'Signal'
        $receiveText = Read-Field 'Receive rate (Mbps)'
        $transmitText = Read-Field 'Transmit rate (Mbps)'
        $channelText = Read-Field 'Channel'
        $radio = Read-Field 'Radio type'
        $band = Read-Field 'Band'
        $adapter = Read-Field 'Description'

        if ($state -ine 'connected') { throw 'Wi-Fi is not connected.' }
        if (-not $signalText) { throw 'Windows did not return a Signal field.' }

        $signal = [int](($signalText -replace '[^0-9-]', '').Trim())
        $receive = if ($receiveText) { [double]$receiveText } else { 0 }
        $transmit = if ($transmitText) { [double]$transmitText } else { 0 }
        $channel = if ($channelText) { [int]$channelText } else { 0 }

        $jsonObject = [ordered]@{
            ssid = $ssid
            signal = $signal
            speed = $receive
            receive = $receive
            transmit = $transmit
            channel = $channel
            radio = $radio
            band = $band
            adapter = $adapter
            time = (Get-Date).ToString('HH:mm:ss')
            timestamp = (Get-Date).ToString('o')
        }

        $json = $jsonObject | ConvertTo-Json -Compress
        [System.IO.File]::WriteAllText($outputPath, $json, $utf8NoBom)
        Write-Host $json
    }
    catch {
        $errorObject = [ordered]@{
            error = $_.Exception.Message
            time = (Get-Date).ToString('HH:mm:ss')
            timestamp = (Get-Date).ToString('o')
        }
        $errorJson = $errorObject | ConvertTo-Json -Compress
        [System.IO.File]::WriteAllText($outputPath, $errorJson, $utf8NoBom)
        Write-Warning $_.Exception.Message
    }

    Start-Sleep -Seconds 2
}
