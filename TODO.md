# 📋 To-Do List for Tomorrow

## 🛡️ 1. Security & Cloudflare Protection Setup
- [ ] Create a free account at [Cloudflare.com](https://www.cloudflare.com)
- [ ] Add primary domain `agoroll.com` to Cloudflare
- [ ] Update domain nameservers at registrar (GoDaddy/Namecheap/Hostinger) to Cloudflare nameservers
- [ ] Configure Cloudflare DNS records:
  - `CNAME` for `@` -> `cname.vercel-dns.com` (Proxied 🟠)
  - `CNAME` for `*` -> `cname.vercel-dns.com` (Proxied 🟠)
- [ ] Set SSL/TLS encryption mode to **Full (Strict)**
- [ ] Enable **Bot Fight Mode** & WAF managed security rules under **Security -> Bots**

## 🔍 2. System Monitoring & User Tracking
- [ ] Review live telemetry logs at `/admin/logs` (System Error & Exception Monitoring)
- [ ] Check Supabase Dashboard -> **Logs** -> **Auth Logs** for active user login sessions
- [ ] Inspect Cloudflare Security Events dashboard (`Security -> Events`) for blocked bot/scan attempts

## 📊 3. Reports Center & Monthly Matrix Verification
- [ ] Test the new **Monthly Attendance Matrix** on mobile and desktop
- [ ] Verify **Export CSV** spreadsheet generation
- [ ] Verify **Print Matrix (A4)** layout for monthly secretary sign-offs
- [ ] Demo the new Reports Center to club leadership / attendance secretary
