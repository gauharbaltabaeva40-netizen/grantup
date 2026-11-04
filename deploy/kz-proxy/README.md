# grantup.kz → Қазақстандағы прокси-сервер → Vercel

.kz домені Қазақстандағы сервердің IP-іне бағытталуы керек (KazNIC талабы). Сайттың өзі Vercel-де қалады,
ал Қазақстандағы шағын VPS «есік» ретінде сұраныстарды Vercel-ге жеткізеді (nginx reverse proxy).

```
Оқушы → https://grantup.kz → ҚР VPS (nginx, SSL) → https://grantup-alpha.vercel.app (Vercel) → Supabase
```

## 1. Иесі жасайтыны (сатып алу, жеке деректер)

1. **VPS** — қазақстандық хостингтен (мысалы ps.kz, hoster.kz):
   - ОЖ: **Ubuntu 24.04** (немесе 22.04), ең кіші тариф жеткілікті (1 vCPU, 1 ГБ RAM).
   - Дата-орталық: **Қазақстан** (Алматы/Астана).
   - Тапсырыс кезінде «SSH кілт» өрісіне `~/.ssh/grantup_vps.pub` мазмұнын қойыңыз (бұл — ашық кілт, оны көрсетуге болады).
     Құпиясөз керек емес.
   - Нәтижесінде сервердің **IP-адресі** беріледі.
2. **Домен grantup.kz** — аккредиттелген тіркеуші арқылы (тізім: nic.kz):
   - Тіркеуге аты-жөні, ЖСН, мекенжай, телефон енгізіледі.
   - «Сервер IP-адресі / мекенжайы» өрісіне 1-қадамдағы VPS IP-і мен дата-орталық мекенжайын (хостинг береді) жазыңыз.
3. **DNS** (тіркеушінің панелінде):
   - `A` жазба: `grantup.kz` → VPS IP
   - `A` жазба: `www.grantup.kz` → VPS IP
4. Маған VPS IP-ін айтыңыз (кілт пен құпиясөзді чатқа жазбаңыз).

## 2. Әзірлеуші жасайтыны (DNS жұмыс істегеннен кейін)

1. Құпия кілт жасап, Vercel → Settings → Environment Variables (Production):
   - `PROXY_SHARED_SECRET` = 48 таңбалы кездейсоқ мән (`openssl rand -hex 24`)
   - `NEXT_PUBLIC_SITE_URL` = `https://grantup.kz`
   - Redeploy.
2. Серверге орнату (Mac-тан):
   ```bash
   scp -i ~/.ssh/grantup_vps -r deploy/kz-proxy root@<VPS_IP>:/root/kz-proxy
   ssh -i ~/.ssh/grantup_vps root@<VPS_IP> \
     "DOMAIN=grantup.kz UPSTREAM=grantup-alpha.vercel.app PROXY_SECRET=<сол мән> EMAIL=<email> bash /root/kz-proxy/setup.sh"
   ```
   Скрипт: nginx + Let's Encrypt SSL (автоматты жаңарады) + файрвол + қауіпсіздік жаңартулары.
3. Supabase → Authentication → URL Configuration:
   - Site URL: `https://grantup.kz`
   - Redirect URLs: `https://grantup.kz/**` қосу (vercel.app-ты әзірге қалдыру).
4. Тексеру: басты бет, тіркелу/кіру, сынақ ҰБТ (камера), админ-панель, push.
5. Бәрі жұмыс істегенде Vercel-де `REDIRECT_TO_SITE_URL=1` → vercel.app-қа тікелей кіргендер grantup.kz-ке жіберіледі.
6. Google Search Console / Яндекс Вебмастерге `https://grantup.kz` қосып, `sitemap.xml` жіберу.

## Қолданбадағы дайындық (кодта бар)

- `next.config.ts` → `serverActions.allowedOrigins: ["grantup.kz", "www.grantup.kz"]` — прокси артында формалар жұмыс істейді.
- `src/lib/security/proxy.ts` — `X-GU-Proxy-Secret` сәйкес келсе ғана `X-GU-Client-IP`-ге сенеміз
  (rate limit, құрылғы журналы нақты IP-мен жұмыс істейді). Кілтсіз сұраныстарда бұл тақырыптар еленбейді.
- nginx `proxy_redirect` және `proxy_cookie_domain` — Vercel редиректтері мен cookie-лері grantup.kz-ке жазылады.

## Ескертпелер

- Прокси арқылы келген сұраныстарда Vercel геолокациясы (қала/ел) прокси орнын көрсетеді, сондықтан
  қолданба оларды бос қалдырады; күдікті кіруді анықтау IP бойынша жүреді.
- VPS тоқтаса, grantup.kz ашылмайды (vercel.app жұмыс істей береді). Хостингте автоматты қайта қосылуды қосыңыз.
