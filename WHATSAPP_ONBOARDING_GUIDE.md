# 📱 Rotary Connect - WhatsApp Club Onboarding Guide

This guide explains the exact steps required to add a new Rotary Club to the system so they can send automated WhatsApp messages from their own unique phone number.

---

## 🛑 Golden Rules Before You Start
1. **Have the phone ready:** Do NOT start a session unless you have the club's WhatsApp mobile app open, unlocked, and ready to scan a QR code.
2. **Scan immediately:** If you start a session and do not scan the QR code, the server will constantly generate new QR codes every 30 seconds, filling up your server logs with spam.

---

## 🛠️ Step-by-Step Onboarding Process

### Step 1: Connect to your Server
SSH into your VPS where the WhatsApp Gateway is running:
```bash
ssh root@ugpay.tech
```

### Step 2: Open the Live Logs
You need to watch the live PM2 logs so you can see the QR code when it is generated.
Run this command:
```bash
pm2 logs rotary-whatsapp
```
*(Leave this terminal window open!)*

### Step 3: Trigger the New Session
Open a **second, separate terminal window** (e.g., a normal Windows command prompt on your PC, or a second SSH tab) and run the initialization command. 

Replace `rotary-club-name` with a unique ID for the club (no spaces, use hyphens):
```bash
curl -X POST http://ugpay.tech:3000/session/start/rotary-club-name
```

### Step 4: Scan the QR Code
1. The moment you run the `curl` command, look back at the **first terminal** (the one running `pm2 logs`). 
2. A large QR code will appear on the screen!
3. On the club's mobile phone, open **WhatsApp > Settings > Linked Devices > Link a Device**.
4. Scan the QR code on your computer screen.
5. The terminal will print `SUCCESS: WhatsApp Connection for [rotary-club-name] is active and online!`
6. Press **`Ctrl+C`** in the log window to exit the logs.

### Step 5: Update the Rotary Connect Dashboard
Now that the server has authenticated the phone number, tell the Rotary app where to route the messages:
1. Log in to the Rotary Connect web app.
2. Go to the **Admin Dashboard** for that specific club.
3. Scroll down to **WhatsApp Welcomer Integration**.
4. Paste the Webhook URL using the exact name you used in Step 3:
   `http://ugpay.tech:3000/send-whatsapp/rotary-club-name`
5. Click **Save WhatsApp Settings**.

✅ **You're Done!** The club's automated WhatsApp is now fully active.

---

## 🚑 Troubleshooting

**Error: "Bad MAC" or Server Crash Loop**
If a club's authentication keys get corrupted (e.g., you logged out on the mobile app, or the server crashed during a write), WhatsApp will throw a `Bad MAC` error and constantly request new QR codes.
To fix this, you must wipe the corrupted sessions and restart:
```bash
pm2 stop rotary-whatsapp
rm -rf /root/baileys_auth_info
pm2 flush
pm2 start rotary-whatsapp
```
*(Note: Deleting the `baileys_auth_info` folder will require you to re-link ALL clubs by repeating the onboarding process).*

**No QR Code Appears in the Logs?**
Make sure your PM2 process is actually running! 
Run `pm2 status` to check if `rotary-whatsapp` is `online`. If it says `errored` or `stopped`, run `pm2 restart rotary-whatsapp`.
