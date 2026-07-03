import asyncio
import os
import sys

# Add backend to path
sys.path.append("c:/coder/mind-os-growth/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402

django.setup()

from playwright.async_api import async_playwright  # noqa: E402


async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        print("1. Logging in...")
        await page.goto("http://localhost:5173/login")
        await page.fill("input[type='text']", "testuser")
        await page.fill("input[type='password']", "testpassword")
        await page.click("button:has-text('Login')")

        await page.wait_for_timeout(3000)

        print("2. Switching OS mode...")
        try:
            await page.click("text=LIFE OS")
            await page.wait_for_timeout(1000)
            await page.click("text=MIND OS")
            await page.wait_for_timeout(1000)
        except Exception as e:
            print("Could not switch OS mode:", e)

        print("3. Triggering events via API...")
        try:
            await page.evaluate(
                """
                import('/src/api/djangoClient.js').then(m => {
                    m.djangoApi.analytics.logEvent("task_created");
                    m.djangoApi.analytics.logEvent("changelog_viewed");
                    m.djangoApi.analytics.logEvent("mind_life_os_switched");
                }).catch(console.error);
            """
            )
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("Could not trigger manual events:", e)

        print("Events triggered.")
        await browser.close()

        print("Querying FeatureEvent table...")
        from api.models import FeatureEvent
        from django.contrib.auth.models import User

        user = User.objects.filter(username="testuser").first()
        if user:
            events = FeatureEvent.objects.filter(user=user).order_by("-timestamp")[:10]
            for ev in events:
                print(f"[{ev.timestamp}] {ev.user.username}: {ev.event_name}")
        else:
            print("testuser not found in DB.")


if __name__ == "__main__":
    asyncio.run(run())
