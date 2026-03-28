# RIDDIM POS Terminal Provisioning

Wipe Windows, install Ubuntu, provision as POS kiosk terminal.

## Step 1: Create Ubuntu Boot USB

On your Mac:
```bash
# Download Ubuntu 22.04.4 LTS Desktop
# https://releases.ubuntu.com/22.04/

# Flash to USB (use balenaEtcher or:)
diskutil list                        # find your USB, e.g. /dev/disk4
diskutil unmountDisk /dev/disk4
sudo dd if=ubuntu-22.04.4-desktop-amd64.iso of=/dev/rdisk4 bs=4m status=progress
diskutil eject /dev/disk4
```

## Step 2: Create Provisioning USB

Copy the entire `provisioning/` folder to a second USB drive (FAT32 or ext4).

## Step 3: Install Ubuntu

1. Plug boot USB into POS terminal
2. Power on, enter BIOS (usually F2 or DEL on Elo units)
3. Disable Secure Boot
4. Set USB as first boot device
5. Install Ubuntu — choose **Erase disk and install Ubuntu**
6. When asked for user, enter anything temporary (it will be replaced)
7. Complete install, reboot, remove boot USB

## Step 4: Run Provisioning

1. Plug in the provisioning USB
2. Open a terminal (Ctrl+Alt+T)
3. Mount and run:
```bash
sudo mkdir -p /mnt/usb
sudo mount /dev/sda1 /mnt/usb      # adjust device if needed
sudo bash /mnt/usb/provisioning/setup-terminal.sh
```
4. Terminal will reboot into kiosk mode

## Users

| User | Password | Purpose |
|------|----------|---------|
| `cipher` | `cipher` | Admin — full desktop, sudo access |
| `kiosk` | (auto-login, no password) | POS only — Chromium fullscreen to local server |

## Post-Setup

- Login as `cipher` to configure network, troubleshoot, update
- `kiosk` user auto-logs in on boot and launches POS fullscreen
- To exit kiosk: Ctrl+Alt+F2 to switch TTY, login as cipher
- To restart kiosk: `sudo systemctl restart kiosk-pos`
