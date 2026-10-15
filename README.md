<div dir="rtl">

# 🎧 Alvana Audio — کتابخانه‌ی رایگان موزیک و افکت صوتی برای ساخت ویدیو

**۱۲۱۳ افکت صوتی** در ۲۹ دسته و **۱۵۷ آهنگ** (۴۵۰ دقیقه) در ۱۵ حس، همه آماده برای ویدیوی یوتیوب، اینستاگرام و تبلیغات.

- ✅ **استفاده‌ی تجاری آزاد:** تقریباً همه CC0 هستند، یعنی بدون نیاز به ذکر نام. فقط ۵ آهنگ `corporate` لایسنس CC BY 4.0 دارند و ذکر نام سازنده لازم است.
- 🎚️ **حجم صدای یکدست:** همه‌ی افکت‌ها هم‌بلندی‌اند و همه‌ی آهنگ‌ها روی ‎-16 LUFS. لازم نیست صدای هیچ‌کدام را جدا تنظیم کنی.
- 🎯 **زمان اوج هر افکت:** معلوم است ضربه دقیقاً کجای فایل است، تا روی فریم درست بنشیند.
- 🥁 **نقشه‌ی ضرب هر آهنگ:** BPM، ضرب‌ها، شروع میزان‌ها، دراپ‌ها و جاهای آرام، برای کات زدن روی ریتم.
- 🤖 **ساخته‌شده برای Claude:** با یک ابزار کوچک فقط همان فایل‌هایی که لازم است دانلود می‌شوند. کلمه‌ی فارسی هم می‌فهمد، مثلاً «ووش» یا «ترسناک».

## 🔊 اول گوش بده
هر دسته یک فایل پیش‌نمایش دارد که همه‌ی صداهایش را پشت سر هم پخش می‌کند. فهرست کامل: **[CATALOG.md](CATALOG.md)**

**افکت‌ها:** [ambience](previews/sfx-ambience.mp3) · [body](previews/sfx-body.mp3) · [break](previews/sfx-break.mp3) · [camera](previews/sfx-camera.mp3) · [casino](previews/sfx-casino.mp3) · [creature](previews/sfx-creature.mp3) · [data](previews/sfx-data.mp3) · [door](previews/sfx-door.mp3) · [explosion](previews/sfx-explosion.mp3) · [foley](previews/sfx-foley.mp3) · [footsteps](previews/sfx-footsteps.mp3) · [game](previews/sfx-game.mp3) · [glitch](previews/sfx-glitch.mp3) · [impact](previews/sfx-impact.mp3) · [jingle](previews/sfx-jingle.mp3) · [keyboard](previews/sfx-keyboard.mp3) · [magic](previews/sfx-magic.mp3) · [mechanical](previews/sfx-mechanical.mp3) · [misc](previews/sfx-misc.mp3) · [money](previews/sfx-money.mp3) · [notification](previews/sfx-notification.mp3) · [paper](previews/sfx-paper.mp3) · [pop](previews/sfx-pop.mp3) · [riser](previews/sfx-riser.mp3) · [scifi](previews/sfx-scifi.mp3) · [transition](previews/sfx-transition.mp3) · [ui](previews/sfx-ui.mp3) · [water](previews/sfx-water.mp3) · [whoosh](previews/sfx-whoosh.mp3)

**موزیک:** [ambient](previews/music-ambient.mp3) · [calm](previews/music-calm.mp3) · [chill](previews/music-chill.mp3) · [chiptune](previews/music-chiptune.mp3) · [corporate](previews/music-corporate.mp3) · [dark](previews/music-dark.mp3) · [funk](previews/music-funk.mp3) · [hiphop](previews/music-hiphop.mp3) · [horror](previews/music-horror.mp3) · [intro](previews/music-intro.mp3) · [lofi](previews/music-lofi.mp3) · [sad](previews/music-sad.mp3) · [scifi](previews/music-scifi.mp3) · [synthwave](previews/music-synthwave.mp3) · [upbeat](previews/music-upbeat.mp3)

## 🤖 استفاده با Claude
به Claude این را بگو:

> برای این ویدیو از کتابخانه‌ی صدای https://github.com/seyedpouramir/alvana-audio موزیک و افکت بردار. اول راهنمای USAGE.md را بخوان و فقط فایل‌های لازم را با `tools/get.mjs` دانلود کن.

برای Claude Code بهتر است skill را نصب کنی تا خودش همیشه بداند: پوشه‌ی [`skill/alvana-audio`](skill/alvana-audio) را در `.claude/skills/` پروژه‌ات کپی کن.

دستورهایی که Claude اجرا می‌کند (خودت هم می‌توانی):
</div>

```bash
curl -fsSLO https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/tools/get.mjs
node get.mjs search ووش نرم
node get.mjs get sfx/whoosh/soft-short music/lofi/blue-skies
node get.mjs credits
```

<div dir="rtl">

## ✋ استفاده‌ی دستی (مثلاً در CapCut یا Premiere)
- **۱.** در [CATALOG.md](CATALOG.md) پیش‌نمایش هر دسته را گوش بده.
- **۲.** فایلی را که خواستی در فهرست همان دسته پیدا کن و روی آن کلیک کن، بعد دکمه‌ی دانلود (Download raw file) را بزن.
- **۳.** برای کل کتابخانه: دکمه‌ی سبز **Code** و بعد **Download ZIP** (حدود ۷۳۰ مگابایت).

## 🏆 قانون‌های طلایی صدا
- **افکت هیچ‌وقت روی حرف نیاید و از صدای گوینده بلندتر نباشد.**
- برای هر اتفاق دیده‌شدنی یک افکت بگذار، و اوجش دقیقاً روی همان فریم باشد. هر صدا حداکثر ۴ تا ۵ بار در کل ویدیو.
- آهنگ را از وسط نبُر و تکه‌ها را به هم نچسبان. آخر یک جمله‌ی موسیقی با ۲ تا ۳ ثانیه fade تمامش کن.
- برای ویدیوی فقط‌موزیک (ریلز، تیزر، اینترو) آهنگی بردار که از ثانیه‌ی اول ملودی و بیت دارد (`--start instant`).
- سطح‌ها: گوینده ‎-21، موزیک زیر گوینده حدود ‎-31، افکت‌ها حدود ‎-38، و خروجی نهایی **‎-14 LUFS**.

جزئیات کامل: **[USAGE.md](USAGE.md)**

## 🔒 پک‌های خصوصی خودت
پک‌هایی که خریده‌ای یا لایسنسشان اجازه‌ی پخش نمی‌دهد را هرگز در ریپوی عمومی نگذار. با [`tools/index-local.mjs`](tools/index-local.mjs) فقط روی سیستم خودت فهرستشان کن تا Claude کنار همین کتابخانه از آن‌ها هم استفاده کند.

## 📜 لایسنس و منبع‌ها
افکت‌ها از Kenney، rubberduck، artisticdude، bart و unicaegames (OpenGameArt)، به‌علاوه‌ی افکت‌های سنتزی ساخته‌شده برای همین کتابخانه. موزیک‌ها از HoliznaCC0 و Sascha Ende (ende.app). جزئیات: [CREDITS.md](CREDITS.md) و [LICENSE.md](LICENSE.md).

</div>

---

## English

**1,213 sound effects** (29 categories) and **157 music tracks** (450 minutes, 15 moods) for videos — free for commercial use. Almost everything is **CC0**; the five `music/corporate` tracks are **CC BY 4.0** (credit required).

- Effects are trimmed and levelled to the same loudness (active RMS −20 dBFS) and carry the time of their **peak**, so a hit lands on the right frame.
- Music is normalised to **−16 LUFS** and every track has a **cue file**: bpm, beats, bars, kicks, snares, energy curve, drops and breaks.
- `tools/get.mjs` searches the index (English or Persian words) and downloads only the files you need — made for Claude and other agents. `tools/mix.mjs` mixes voice + music + effects at the right levels (−14 LUFS). `tools/index-local.mjs` indexes your own private packs without uploading them.
- Start with **[USAGE.md](USAGE.md)** and **[CATALOG.md](CATALOG.md)** (preview reels for every category). Credits: [CREDITS.md](CREDITS.md). Licence: [LICENSE.md](LICENSE.md).
