# Manual test: create RDP file with embedded password and launch
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

# Configuration
$ip = "119.3.9.76"
$port = "3389"
$username = "administrator"
$password = "LX!@2024qazwsx"

# DPAPI encrypt
$bytes = [System.Text.Encoding]::Unicode.GetBytes($password)
$encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)

# Build blob: version + GUID + flags + encrypted
$header1 = [byte[]](0x01,0x00,0x00,0x00)
$guidBytes = [Guid]::new('D08C9DDF-0115-D111-8C7A-00C04FC297EB').ToByteArray()
$header3 = [byte[]](0x00,0x00,0x00,0x00)
$all = $header1 + $guidBytes + $header3 + $encrypted
$hex = -join ($all | ForEach-Object { $_.ToString('X2') })

Write-Host "Hex length: $($hex.Length)"

# Generate RDP file (ASCII encoding, no BOM)
$rdpPath = "$env:TEMP\manual_test.rdp"
$lines = @(
    "full address:s:${ip}:${port}",
    "username:s:${username}",
    "domain:s:.",
    "prompt for credentials:i:0",
    "promptcredentialonce:i:0",
    "enablecredsspsupport:i:1",
    "authentication level:i:2",
    "negotiate security layer:i:1",
    "disable wallpaper:i:0",
    "disable full window drag:i:1",
    "disable menu anims:i:1",
    "disable themes:i:0",
    "disable cursor setting:i:0",
    "bitmapcachepersistenable:i:1",
    "audiomode:i:0",
    "redirectprinters:i:0",
    "redirectcomports:i:0",
    "redirectsmartcards:i:0",
    "redirectclipboard:i:1",
    "redirectdrives:i:0",
    "keyboardhook:i:2",
    "displayconnectionbar:i:1",
    "autoreconnection enabled:i:1",
    "compression:i:1",
    "audiocapturemode:i:0",
    "videoplaybackmode:i:1",
    "connection type:i:2",
    "networkautodetect:i:1",
    "bandwidthautodetect:i:1",
    "screen mode id:i:2",
    "smart sizing:i:1",
    "desktopwidth:i:1280",
    "desktopheight:i:720",
    "session bpp:i:32",
    "winposstr:s:0,3,0,0,800,600",
    "use redirection server name:i:0",
    "password 51:b:${hex}"
)
$content = $lines -join "`r`n"
[System.IO.File]::WriteAllText($rdpPath, $content, [System.Text.Encoding]::ASCII)

Write-Host "RDP file: $rdpPath"
Write-Host "File size: $((Get-Item $rdpPath).Length) bytes"

# Verify content
$readBack = [System.IO.File]::ReadAllText($rdpPath)
$hasPwd = $readBack.Contains("password 51:b:")
Write-Host "Has password 51:b: $hasPwd"

Write-Host ""
Write-Host "Launching mstsc in 3 seconds..."
Start-Sleep -Seconds 3
Start-Process mstsc -ArgumentList $rdpPath
Write-Host "mstsc launched. Check if password is auto-filled."
