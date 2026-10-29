# نقشهٔ سورس

[English](source-navigation.md) · [فارسی](source-navigation.fa.md)

[نقشهٔ وظایف](../.agents/navigation.json)، [سیاست انتشار](../.github/bootstrap-policy.json) و [فهرست مرجع](../.agents/validation.json) را بخوانید. مرحلهٔ application-verification پنل مستقل قابل‌اجرا و گیت کامل آن را می‌پذیرد؛ نقشه، اثبات اجرا، سازگاری provider، بارگذاری خودکار دستور در میزبان یا استقرار نیست.

راه‌اندازی و ترکیب متعلق به src/main.tsx، src/app/App.tsx و src/app/Routes.tsx است. فرادادهٔ مسیر و تصمیم خالص مجوز در src/app/config/routes.ts و src/app/lib/access.ts می‌ماند. رگرسیون دسترسی و خطای ترکیب‌شده در src/app/Routes.test.tsx و src/test/integration/pages.test.tsx است. هر قابلیت مالک مؤلفه، نوع wire و آداپتر HTTP خود است؛ نسل درخواست/نشست مشترک در src/shared/api و src/shared/hooks می‌ماند. [قابلیت اعتماد درخواست](admin-request-reliability.fa.md) را بخوانید.

واژگان مجوز در roles/types.ts، صفحه‌بندی و فیلتر URL کاربران در users/types.ts و hookها و تولید رمز در users/tools است. ابزار آپلود لوگو در settings/components/logo-upload می‌ماند. قرارداد خالص بین‌قابلیتی متعلق به src/shared/contracts است. فرانت‌اند checkout، workspace یا پیاده‌سازی API دیگری را وارد نمی‌کند.

هر ده کاتالوگ کامل هم‌نام کد، ۱۱۱ پیام و interpolation منطبق دارند. src/shared/i18n/catalogs.ts مالک انتخاب، index.ts مالک راه‌اندازی ثابت فارسی و date.ts مالک آداپترهای Day.js/Jalaliday است. تنظیمات API مالک زبان، جهت، تقویم و نام‌هاست؛ نگاشت محلی فقط آداپتر vendor/کاتالوگ را انتخاب می‌کند. مرورگر فقط پوسته و فشردگی را نگه می‌دارد. [ترجمه](localization.fa.md) را بخوانید.

برای تغییر UI، [DESIGN](../DESIGN.fa.md)، [گردش کار طراحی](../.agents/skills/design-ui/SKILL.md)، مالک پوسته/تنظیم و نزدیک‌ترین story را بخوانید. Storybook mock کامل مالک و بررسی دسترس‌پذیری Chromium مسدودکننده دارد. fixtureهای e2e و تعامل مصرف‌کنندهٔ contract شواهد جدا می‌افزایند؛ هیچ‌یک تأیید API-provider مستقل نیست. تنظیم/آمادگی تصویر و منشأ منطبق در playwright.visual.config.ts، e2e/visual و scripts/visual-environment.mjs است. تأیید انسانی تک‌تک تصاویر تازه همچنان الزامی است.

مالکیت Vite/build در vite.config.ts و فرمان‌های ریشهٔ اعلام‌شده است. بودجهٔ bundle، اجرای Lighthouse/visual بدون اثر هنگام import و ثبت metadata ساخت، آزمون خالص/ساختگی چرخه را حفظ می‌کنند. بررسی واقعی برنامه از تنظیم ساختگی صریح و فرایند و پورت متعلق به خود استفاده می‌کند. پیش از فراخوانی CLI عملیاتی کد را بخوانید؛ helper استقرار ممکن است فایل انتخاب‌شده بنویسد یا به مقصد متصل شود. محیط و state واقعی fixture سورس نیست.

برای تحویل از [گردش کار Git](../.agents/rules/git.md)، [قاعدهٔ شاخه](../.agents/rules/branches.md)، [اعتبارسنجی](validation.fa.md)، [ADRها](adr/README.fa.md) و [نقشهٔ مستندات](README.fa.md) استفاده کنید. خودکارسازی مستقل عملیات، تأیید واقعی API-provider و استقرار، مجوز و شاهد جدا می‌خواهند. تصاویر تاریخی Win32 فقط [منشأ تاریخ‌دار](visual-regression.fa.md) هستند و تأیید جاری نیستند.
